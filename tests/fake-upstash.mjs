// Faux serveur Upstash (API REST Redis) en mémoire, pour les tests.
import http from 'node:http';

export function startFakeUpstash() {
  const kv = new Map(); const exp = new Map();
  const alive = (k) => { const e = exp.get(k); if (e && e < Date.now()) { kv.delete(k); exp.delete(k); } return kv.has(k); };
  function run([cmd, ...a]) {
    cmd = String(cmd).toUpperCase();
    const k = a[0];
    switch (cmd) {
      case 'GET': return alive(k) ? kv.get(k) : null;
      case 'GETDEL': { const v = alive(k) ? kv.get(k) : null; kv.delete(k); exp.delete(k); return v; }
      case 'SET': {
        const opts = a.slice(2).map(String);
        if (opts.includes('NX') && alive(k)) return null;
        kv.set(k, String(a[1])); exp.delete(k);
        const ex = opts.indexOf('EX'); if (ex >= 0) exp.set(k, Date.now() + Number(opts[ex + 1]) * 1000);
        return 'OK';
      }
      case 'DEL': { let n = 0; for (const x of a) { if (alive(x)) n++; kv.delete(x); exp.delete(x); } return n; }
      case 'INCR': { const v = (alive(k) ? Number(kv.get(k)) : 0) + 1; kv.set(k, String(v)); return v; }
      case 'EXPIRE': if (!alive(k)) return 0; exp.set(k, Date.now() + Number(a[1]) * 1000); return 1;
      case 'SADD': { const s = alive(k) ? kv.get(k) : new Set(); let n = 0; for (const x of a.slice(1)) if (!s.has(x)) { s.add(x); n++; } kv.set(k, s); return n; }
      case 'SREM': { if (!alive(k)) return 0; const s = kv.get(k); let n = 0; for (const x of a.slice(1)) if (s.delete(x)) n++; return n; }
      case 'SMEMBERS': return alive(k) ? [...kv.get(k)] : [];
      case 'SISMEMBER': return alive(k) && kv.get(k).has(a[1]) ? 1 : 0;
      case 'SCARD': return alive(k) ? kv.get(k).size : 0;
      case 'ZADD': { const z = alive(k) ? kv.get(k) : new Map(); z.set(a[2], Number(a[1])); kv.set(k, z); return 1; }
      case 'HDEL': { if (!alive(k)) return 0; return kv.get(k).delete(a[1]) ? 1 : 0; }
      case 'HSET': { const h = alive(k) ? kv.get(k) : new Map(); h.set(a[1], a[2]); kv.set(k, h); return 1; }
      case 'LRANGE': return alive(k) ? kv.get(k).slice(Number(a[1]), Number(a[2]) === -1 ? undefined : Number(a[2]) + 1) : [];
      default: throw new Error('Commande non simulée : ' + cmd);
    }
  }
  const server = http.createServer((req, res) => {
    let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
      if (req.headers.authorization !== 'Bearer test-token') { res.writeHead(401); return res.end('{}'); }
      const payload = JSON.parse(body);
      let out;
      try {
        if (req.url === '/pipeline' || req.url === '/multi-exec') out = payload.map((c) => { try { return { result: run(c) }; } catch (e) { return { error: e.message }; } });
        else out = { result: run(payload) };
      } catch (e) { out = { error: e.message }; }
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(out));
    });
  });
  return new Promise((resolve) => server.listen(0, () => resolve({ url: `http://127.0.0.1:${server.address().port}`, kv, close: () => server.close() })));
}
