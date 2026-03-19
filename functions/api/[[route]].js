// functions/api/[[route]].js
// Cloudflare Pages Function — handles all /api/* routes
// context.env.DB is the D1 database binding

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function err(msg, status = 400) {
  return json({ error: msg }, status);
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  const DB = env.DB;

  // ── GET /api/trades ───────────────────────────────────────────────────
  if (path === '/api/trades' && request.method === 'GET') {
    const { results } = await DB.prepare(
      'SELECT * FROM trades ORDER BY date DESC, id DESC'
    ).all();
    return json(results);
  }

  // ── GET /api/trades/:id ───────────────────────────────────────────────
  const tradeMatch = path.match(/^\/api\/trades\/(\d+)$/);

  if (tradeMatch && request.method === 'GET') {
    const trade = await DB.prepare('SELECT * FROM trades WHERE id = ?')
      .bind(tradeMatch[1]).first();
    if (!trade) return err('Not found', 404);
    return json(trade);
  }

  // ── POST /api/trades ──────────────────────────────────────────────────
  if (path === '/api/trades' && request.method === 'POST') {
    const b = await request.json();
    if (!b.pair) return err('Pair is required');

    const r = await DB.prepare(`
      INSERT INTO trades (date, pair, session, direction, entry_price, stop_loss,
        take_profit, exit_price, lot_size, result, pips, pnl, rr_ratio,
        strategy, notes, photo_before, photo_after)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      b.date||null, b.pair, b.session||null, b.direction||null,
      b.entry_price||null, b.stop_loss||null, b.take_profit||null,
      b.exit_price||null, b.lot_size||null, b.result||null,
      b.pips||null, b.pnl||null, b.rr_ratio||null,
      b.strategy||null, b.notes||null,
      b.photo_before||null, b.photo_after||null
    ).run();

    return json({ id: r.meta.last_row_id, success: true }, 201);
  }

  // ── PUT /api/trades/:id ───────────────────────────────────────────────
  if (tradeMatch && request.method === 'PUT') {
    const b = await request.json();
    if (!b.pair) return err('Pair is required');

    await DB.prepare(`
      UPDATE trades SET
        date=?, pair=?, session=?, direction=?, entry_price=?, stop_loss=?,
        take_profit=?, exit_price=?, lot_size=?, result=?, pips=?, pnl=?,
        rr_ratio=?, strategy=?, notes=?, photo_before=?, photo_after=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).bind(
      b.date||null, b.pair, b.session||null, b.direction||null,
      b.entry_price||null, b.stop_loss||null, b.take_profit||null,
      b.exit_price||null, b.lot_size||null, b.result||null,
      b.pips||null, b.pnl||null, b.rr_ratio||null,
      b.strategy||null, b.notes||null,
      b.photo_before||null, b.photo_after||null,
      tradeMatch[1]
    ).run();

    return json({ success: true });
  }

  // ── DELETE /api/trades/:id ────────────────────────────────────────────
  if (tradeMatch && request.method === 'DELETE') {
    await DB.prepare('DELETE FROM trades WHERE id = ?').bind(tradeMatch[1]).run();
    return json({ success: true });
  }

  // ── GET /api/stats ────────────────────────────────────────────────────
  if (path === '/api/stats' && request.method === 'GET') {
    const summary = await DB.prepare(`
      SELECT
        COUNT(*) as total_trades,
        SUM(CASE WHEN result='Win'  THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN result='Loss' THEN 1 ELSE 0 END) as losses,
        SUM(CASE WHEN result='BE'   THEN 1 ELSE 0 END) as breakevens,
        ROUND(SUM(pnl),2)  as total_pnl,
        ROUND(SUM(pips),1) as total_pips,
        ROUND(AVG(CASE WHEN result='Win'  THEN pnl END),2) as avg_win,
        ROUND(AVG(CASE WHEN result='Loss' THEN pnl END),2) as avg_loss,
        ROUND(AVG(rr_ratio),2) as avg_rr,
        ROUND(MAX(pnl),2) as best_trade,
        ROUND(MIN(pnl),2) as worst_trade
      FROM trades
    `).first();

    const sessions = await DB.prepare(`
      SELECT session,
        COUNT(*) as trades,
        SUM(CASE WHEN result='Win' THEN 1 ELSE 0 END) as wins,
        ROUND(SUM(pnl),2) as pnl
      FROM trades WHERE session IS NOT NULL
      GROUP BY session ORDER BY trades DESC
    `).all();

    const pairs = await DB.prepare(`
      SELECT pair,
        COUNT(*) as trades,
        SUM(CASE WHEN result='Win' THEN 1 ELSE 0 END) as wins,
        ROUND(SUM(pnl),2) as pnl
      FROM trades WHERE pair IS NOT NULL
      GROUP BY pair ORDER BY trades DESC LIMIT 10
    `).all();

    const strategies = await DB.prepare(`
      SELECT strategy,
        COUNT(*) as trades,
        SUM(CASE WHEN result='Win' THEN 1 ELSE 0 END) as wins,
        ROUND(SUM(pnl),2) as pnl
      FROM trades WHERE strategy IS NOT NULL
      GROUP BY strategy ORDER BY trades DESC LIMIT 10
    `).all();

    return json({
      summary,
      sessions: sessions.results,
      pairs: pairs.results,
      strategies: strategies.results,
    });
  }

  // ── GET /api/settings ─────────────────────────────────────────────────
  if (path === '/api/settings' && request.method === 'GET') {
    try {
      await DB.prepare("ALTER TABLE settings ADD COLUMN account_currency TEXT DEFAULT 'QAR'").run();
    } catch (e) {}
    const s = await DB.prepare('SELECT * FROM settings WHERE id=1').first();
    return json(s || { starting_balance: 500, account_currency: 'QAR' });
  }

  // ── PUT /api/settings ─────────────────────────────────────────────────
  if (path === '/api/settings' && request.method === 'PUT') {
    try {
      await DB.prepare("ALTER TABLE settings ADD COLUMN account_currency TEXT DEFAULT 'QAR'").run();
    } catch (e) {}
    const { starting_balance, account_currency = 'QAR' } = await request.json();
    await DB.prepare(`
      INSERT INTO settings (id, starting_balance, account_currency) VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        starting_balance=excluded.starting_balance,
        account_currency=excluded.account_currency
    `).bind(starting_balance, account_currency).run();
    return json({ success: true });
  }

  return err('Not found', 404);
}
