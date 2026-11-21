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
      case 'MGET': return a.map((x) => (alive(x) ? kv.get(x) : null));
      case 'LTRIM': { if (!alive(k)) return 'OK'; const l = kv.get(k); kv.set(k, l.slice(Number(a[1]), Number(a[2]) === -1 ? undefined : Number(a[2]) + 1)); return 'OK'; }
      case 'LLEN': return alive(k) ? kv.get(k).length : 0;
      case 'HGETALL': return alive(k) ? [...kv.get(k)].flat() : [];
      case 'ZRANGE': { if (!alive(k)) return []; const e = [...kv.get(k)].sort((x, y) => x[1] - y[1]).map((x) => x[0]); return a.includes('REV') ? e.reverse() : e; }
      case 'ZCARD': return alive(k) ? kv.get(k).size : 0;
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
      case 'ZREM': { if (!alive(k)) return 0; return kv.get(k).delete(a[1]) ? 1 : 0; }
      case 'LPUSH': { const l = alive(k) ? kv.get(k) : []; for (const x of a.slice(1)) l.unshift(String(x)); kv.set(k, l); return l.length; }
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
