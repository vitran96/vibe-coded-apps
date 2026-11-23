// Shared test doubles: an in-memory file system with rename and recursive remove, and a scripted fetch.

export function createMockOps({ failWrite = () => false } = {}) {
  const files = new Map();
  const dirs = new Set(['/mock_appdata']);
  const calls = []; // every write/rename/remove, in order

  const under = (p, root) => p === root || p.startsWith(root + '/');
  const ops = {
    appDataDir: async () => '/mock_appdata',
    join: async (...parts) => parts.join('/').replace(/\/+/g, '/'),
    exists: async (p) => dirs.has(p) || files.has(p),
    mkdir: async (p) => {
      const parts = p.split('/');
      for (let i = 2; i <= parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
    },
    readTextFile: async (p) => {
      if (!files.has(p)) throw new Error('File not found: ' + p);
      const v = files.get(p);
      return typeof v === 'string' ? v : new TextDecoder().decode(v);
    },
    writeTextFile: async (p, content) => {
      calls.push(['write', p]);
      if (failWrite(p)) throw new Error('disk full');
      files.set(p, content);
    },
    writeFile: async (p, data) => {
      calls.push(['write', p]);
      if (failWrite(p)) throw new Error('disk full');
      files.set(p, data);
    },
    remove: async (p, opts) => {
      calls.push(['remove', p]);
      if (opts?.recursive) {
        for (const k of [...files.keys()]) if (under(k, p)) files.delete(k);
        for (const d of [...dirs]) if (under(d, p)) dirs.delete(d);
      } else {
        files.delete(p);
        dirs.delete(p);
      }
    },
    rename: async (from, to) => {
      calls.push(['rename', from, to]);
      if (!files.has(from) && !dirs.has(from)) throw new Error('ENOENT ' + from);
      if (files.has(from)) { files.set(to, files.get(from)); files.delete(from); return; }
      for (const k of [...files.keys()]) if (under(k, from)) { files.set(to + k.slice(from.length), files.get(k)); files.delete(k); }
      for (const d of [...dirs]) if (under(d, from)) { dirs.delete(d); dirs.add(to + d.slice(from.length)); }
    },
    convertFileSrc: (p) => `asset://localhost${p}`
  };
  return { files, dirs, calls, ops };
}

const enc = (v) => (typeof v === 'string' ? new TextEncoder().encode(v) : v);

// routes: { url: bytes | string | { bytes, headers, ok, status } | (n) => same } (a function gets the call number for that url).
export function createFetch(routes) {
  const seen = [];
  const counts = {};
  const fetchFn = async (url, init) => {
    seen.push({ url, init });
    const base = url.replace(/[?&]r=\d+$/, '');
    counts[base] = (counts[base] || 0) + 1;
    let r = routes[base] ?? routes[url];
    if (typeof r === 'function') r = r(counts[base]);
    if (r === undefined) return { ok: false, status: 404, headers: { get: () => null } };
    const spec = r instanceof Uint8Array || typeof r === 'string' ? { bytes: r } : r;
    const bytes = enc(spec.bytes);
    const headers = { 'content-length': String(spec.contentLength ?? bytes.length), ...spec.headers };
    return {
      ok: spec.ok ?? true,
      status: spec.status ?? 200,
      headers: { get: (h) => headers[h.toLowerCase()] ?? null },
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    };
  };
  fetchFn.seen = seen;
  return fetchFn;
}

export const sha256Hex = async (data) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc(data)))].map((b) => b.toString(16).padStart(2, '0')).join('');
