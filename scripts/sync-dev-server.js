// Server đồng bộ chạy trên máy (cùng mã với Cloudflare Worker), dữ liệu lưu ở data/sync-dev.sqlite.
// Chạy: npm run sync-server   → http://localhost:8787  (điện thoại cùng Wi-Fi: http://<IP máy>:8787)
import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { handle } from '../worker/src/handler.js';
import { createD1 } from '../worker/d1-node.js';

const port = Number(process.env.PORT || 8787);
const file = process.env.SYNC_DB || 'data/sync-dev.sqlite';
if (file !== ':memory:') mkdirSync('data', { recursive: true });
const env = { DB: createD1(file, ['worker/migrations/0001_init.sql']), ALLOWED_ORIGINS: '*' };

createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const request = new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
  const r = await handle(request, env);
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(port, () => console.log(`Server đồng bộ: http://localhost:${port}  (dữ liệu: ${file})`));
