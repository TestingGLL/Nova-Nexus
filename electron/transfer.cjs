// Local WiFi file-transfer server: serves a mobile web page so a phone on the same
// network can download files shared from the PC and upload files back to it.
// Everything is gated behind a random per-session token (carried in the QR URL).

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

let server = null;
let token = null;
let sharedFiles = [];   // { id, name, path, size }
let received = [];      // { name, path, size, ts } | { type:'text', text, ts }  (phone → PC)
let pcMessages = [];    // { id, type:'text', text, ts }  (PC → phone)
let downloadDir = null;
let activePort = 0;
let pruneTimer = null;

const FIXED_PORT = 8473;
const HISTORY_TTL = 2 * 60 * 60 * 1000; // 2h — only the history entries expire; files stay on disk.

// Tipo de contenido por extensión (para servir miniaturas inline y clasificar en el chat).
const MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  bmp: 'image/bmp', svg: 'image/svg+xml', avif: 'image/avif', heic: 'image/heic',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska', m4v: 'video/mp4',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac',
  pdf: 'application/pdf',
};
function extOf(name) { const d = String(name || '').lastIndexOf('.'); return d >= 0 ? String(name).slice(d + 1).toLowerCase() : ''; }
function mimeOf(name) { return MIME[extOf(name)] || 'application/octet-stream'; }
function kindOf(name) { const m = mimeOf(name); if (m.startsWith('image/')) return 'image'; if (m.startsWith('video/')) return 'video'; if (m.startsWith('audio/')) return 'audio'; return 'file'; }
function newId(p) { return p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// Drop history entries older than 2h. Transferred files remain on disk untouched.
function pruneHistory() {
  const cutoff = Date.now() - HISTORY_TTL;
  received = received.filter(r => r.ts > cutoff);
  pcMessages = pcMessages.filter(m => m.ts > cutoff);
}

// Stable token persisted next to the downloads so the QR/URL stays the same
// across restarts ("mantener siempre el mismo identificador").
function loadOrCreateToken() {
  try {
    const tf = path.join(downloadDir, '.nn-token');
    if (fs.existsSync(tf)) { const t = fs.readFileSync(tf, 'utf8').trim(); if (t) return t; }
    const t = crypto.randomBytes(8).toString('hex');
    fs.writeFileSync(tf, t);
    return t;
  } catch { return crypto.randomBytes(8).toString('hex'); }
}

function localIPv4() {
  const ifaces = os.networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(ifaces)) {
    for (const i of ifaces[name] || []) {
      if (i.family === 'IPv4' && !i.internal) candidates.push(i.address);
    }
  }
  return (
    candidates.find(a => a.startsWith('192.168.')) ||
    candidates.find(a => a.startsWith('10.')) ||
    candidates.find(a => /^172\.(1[6-9]|2\d|3[01])\./.test(a)) ||
    candidates[0] ||
    '127.0.0.1'
  );
}

function sanitize(name) {
  return (path.basename(String(name)).replace(/[^\w.\- ()]/g, '_').slice(0, 200)) || 'archivo';
}

function uniqueName(name) {
  let dest = path.join(downloadDir, name);
  if (!fs.existsSync(dest)) return name;
  const ext = path.extname(name);
  const base = name.slice(0, name.length - ext.length);
  let n = 1;
  while (fs.existsSync(path.join(downloadDir, `${base} (${n})${ext}`))) n++;
  return `${base} (${n})${ext}`;
}

function pageHtml() {
  return `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nova Nexus · Transferencia</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; background:#16161a; color:#e8e8ed; padding:18px; }
  h1 { font-size:18px; display:flex; align-items:center; gap:8px; margin:0 0 4px; }
  .sub { color:#8a8a92; font-size:13px; margin-bottom:18px; }
  .card { background:#222228; border:1px solid rgba(255,255,255,.08); border-radius:14px; padding:16px; margin-bottom:14px; }
  .card h2 { font-size:14px; margin:0 0 12px; color:#c7c7cf; }
  .file { display:flex; align-items:center; gap:10px; padding:10px 12px; background:#1a1a1f; border:1px solid rgba(255,255,255,.06); border-radius:10px; margin-bottom:8px; text-decoration:none; color:#e8e8ed; }
  .file .nm { flex:1; font-size:14px; word-break:break-all; }
  .file .sz { font-size:12px; color:#8a8a92; }
  .dl { background:#38bdf8; color:#001018; border:none; padding:7px 14px; border-radius:8px; font-weight:600; font-size:13px; text-decoration:none; }
  .empty { color:#8a8a92; font-size:13px; text-align:center; padding:14px 0; }
  .uploadbox { border:2px dashed rgba(255,255,255,.15); border-radius:12px; padding:22px; text-align:center; }
  .uploadbox label { display:inline-block; background:#38bdf8; color:#001018; padding:11px 20px; border-radius:10px; font-weight:600; cursor:pointer; }
  input[type=file]{ display:none; }
  .prog { margin-top:10px; font-size:13px; }
  .row { display:flex; align-items:center; gap:8px; padding:8px 0; font-size:13px; }
  .ok { color:#22c55e; } .err { color:#ef4444; }
  .bar { height:5px; background:#333; border-radius:3px; overflow:hidden; margin-top:4px; }
  .bar > div { height:100%; background:#38bdf8; width:0; transition:width .15s; }
</style></head>
<body>
  <h1>🔄 Nova Nexus</h1>
  <div class="sub">Transferencia por WiFi · misma red</div>

  <div class="card">
    <h2>📥 Archivos compartidos desde la PC</h2>
    <div id="files"><div class="empty">Cargando…</div></div>
    <button id="dlall" class="dl" style="width:100%;margin-top:6px;padding:11px;display:none">⬇ Descargar todo</button>
  </div>

  <div class="card" id="pcmsgcard" style="display:none">
    <h2>💬 Mensajes desde la PC</h2>
    <div id="pcmsgs"></div>
  </div>

  <div class="card">
    <h2>📤 Enviar archivos a la PC</h2>
    <div class="uploadbox">
      <label for="up">Elegir archivos</label>
      <input id="up" type="file" multiple>
      <div id="prog" class="prog"></div>
    </div>
  </div>

  <div class="card">
    <h2>💬 Enviar texto a la PC</h2>
    <textarea id="txt" rows="3" style="width:100%;background:#1a1a1f;color:#e8e8ed;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:10px;font-family:inherit;font-size:14px;resize:vertical"></textarea>
    <button id="sendtxt" class="dl" style="width:100%;margin-top:8px;padding:11px">Enviar texto</button>
    <div id="txtstatus" class="prog"></div>
  </div>

<script>
  const T = new URLSearchParams(location.search).get('t') || '';
  const fmt = b => b < 1024 ? b+' B' : b < 1048576 ? (b/1024).toFixed(1)+' KB' : (b/1048576).toFixed(1)+' MB';

  async function loadFiles() {
    try {
      const r = await fetch('/api/files?t='+T);
      const list = await r.json();
      const el = document.getElementById('files');
      if (!list.length) { el.innerHTML = '<div class="empty">No hay archivos compartidos.</div>'; return; }
      el.innerHTML = list.map(f =>
        '<div class="file"><span class="nm">'+f.name+'</span><span class="sz">'+fmt(f.size)+'</span>'+
        '<a class="dl" href="/download/'+f.id+'?t='+T+'">Bajar</a></div>'
      ).join('');
      const dlall = document.getElementById('dlall');
      dlall.style.display = list.length ? 'block' : 'none';
      dlall.onclick = () => { list.forEach((f, i) => setTimeout(() => { const a = document.createElement('a'); a.href = '/download/'+f.id+'?t='+T; a.download=''; document.body.appendChild(a); a.click(); a.remove(); }, i*400)); };
    } catch(e) { document.getElementById('files').innerHTML = '<div class="empty err">Error al cargar.</div>'; }
  }
  loadFiles();
  setInterval(loadFiles, 4000);

  async function loadPcMessages() {
    try {
      const r = await fetch('/api/pcmessages?t='+T);
      const list = await r.json();
      const card = document.getElementById('pcmsgcard');
      const el = document.getElementById('pcmsgs');
      if (!list.length) { card.style.display='none'; return; }
      card.style.display='block';
      el.innerHTML = list.map(m =>
        '<div class="file"><span class="nm">'+m.text.replace(/[<>&]/g, c=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]))+'</span>'+
        '<button class="dl copybtn" data-t="'+encodeURIComponent(m.text)+'">Copiar</button></div>'
      ).join('');
      el.querySelectorAll('.copybtn').forEach(b => b.onclick = () => { navigator.clipboard.writeText(decodeURIComponent(b.dataset.t)); b.textContent='✓'; setTimeout(()=>b.textContent='Copiar',1200); });
    } catch(e) {}
  }
  loadPcMessages();
  setInterval(loadPcMessages, 4000);

  document.getElementById('sendtxt').addEventListener('click', async () => {
    const ta = document.getElementById('txt'); const st = document.getElementById('txtstatus');
    if (!ta.value.trim()) return;
    try {
      const r = await fetch('/sendtext?t='+T, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text: ta.value }) });
      if (r.ok) { ta.value=''; st.innerHTML='<span class="ok">✓ Texto enviado</span>'; setTimeout(()=>st.innerHTML='',2000); } else st.innerHTML='<span class="err">✗ Error</span>';
    } catch { st.innerHTML='<span class="err">✗ Error</span>'; }
  });

  document.getElementById('up').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    const prog = document.getElementById('prog');
    prog.innerHTML = '';
    for (const file of files) {
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = '<span style="flex:1">'+file.name+'</span><span class="st">…</span>';
      const bar = document.createElement('div'); bar.className='bar'; const fill=document.createElement('div'); bar.appendChild(fill);
      prog.appendChild(row); prog.appendChild(bar);
      try {
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/upload?t='+T);
          xhr.setRequestHeader('X-Filename', encodeURIComponent(file.name));
          xhr.upload.onprogress = ev => { if (ev.lengthComputable) fill.style.width = (ev.loaded/ev.total*100)+'%'; };
          xhr.onload = () => xhr.status===200 ? resolve() : reject();
          xhr.onerror = reject;
          xhr.send(file);
        });
        row.querySelector('.st').innerHTML = '<span class="ok">✓ Enviado</span>';
      } catch { row.querySelector('.st').innerHTML = '<span class="err">✗ Error</span>'; }
    }
    e.target.value = '';
  });
</script>
</body></html>`;
}

function handle(req, res) {
  let urlObj;
  try { urlObj = new URL(req.url, 'http://localhost'); } catch { res.writeHead(400); res.end(); return; }
  const tok = urlObj.searchParams.get('t') || req.headers['x-token'];
  if (tok !== token) { res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Acceso denegado'); return; }
  const pathname = urlObj.pathname;

  if (req.method === 'GET' && pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(pageHtml()); return;
  }
  if (req.method === 'GET' && pathname === '/api/files') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(sharedFiles.map(f => ({ id: f.id, name: f.name, size: f.size }))));
    return;
  }
  if (req.method === 'GET' && pathname === '/api/pcmessages') {
    pruneHistory();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(pcMessages.map(m => ({ id: m.id, text: m.text, ts: m.ts }))));
    return;
  }
  if (req.method === 'GET' && pathname.startsWith('/download/')) {
    const id = decodeURIComponent(pathname.split('/')[2] || '');
    const f = sharedFiles.find(x => x.id === id);
    if (!f || !fs.existsSync(f.path)) { res.writeHead(404); res.end('No encontrado'); return; }
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      'Content-Length': f.size,
    });
    fs.createReadStream(f.path).pipe(res);
    return;
  }
  // Sirve un archivo compartido o recibido INLINE (con su Content-Type real) para
  // poder mostrar miniaturas/preview de imágenes y videos en la app. /file/<scope>/<id>.
  if (req.method === 'GET' && pathname.startsWith('/file/')) {
    const parts = pathname.split('/'); // ['', 'file', scope, id]
    const scope = parts[2]; const id = decodeURIComponent(parts[3] || '');
    const f = scope === 'shared' ? sharedFiles.find(x => x.id === id) : received.find(x => x.id === id);
    if (!f || !f.path || !fs.existsSync(f.path)) { res.writeHead(404); res.end('No encontrado'); return; }
    let size = f.size; try { size = fs.statSync(f.path).size; } catch {}
    res.writeHead(200, {
      'Content-Type': mimeOf(f.name),
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      'Content-Length': size,
      'Cache-Control': 'public, max-age=3600',
    });
    fs.createReadStream(f.path).pipe(res);
    return;
  }
  if (req.method === 'POST' && pathname === '/sendtext') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 100000) req.destroy(); });
    req.on('end', () => {
      try { const { text } = JSON.parse(body || '{}'); if (text && String(text).trim()) received.unshift({ id: newId('rt'), type: 'text', text: String(text).slice(0, 5000), ts: Date.now() }); } catch {}
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true }));
    });
    return;
  }
  if (req.method === 'POST' && pathname === '/upload') {
    const raw = decodeURIComponent(req.headers['x-filename'] || 'archivo');
    const name = uniqueName(sanitize(raw));
    const dest = path.join(downloadDir, name);
    const ws = fs.createWriteStream(dest);
    req.pipe(ws);
    ws.on('finish', () => {
      let size = 0; try { size = fs.statSync(dest).size; } catch {}
      received.unshift({ id: newId('rf'), name, path: dest, size, ts: Date.now() });
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true }));
    });
    ws.on('error', () => { res.writeHead(500); res.end('Error'); });
    req.on('error', () => { try { ws.destroy(); } catch {} });
    return;
  }
  res.writeHead(404); res.end('No encontrado');
}

function start(dir) {
  if (server) {
    // Already running — return the existing info (idempotent for auto-start).
    const ip = localIPv4();
    return Promise.resolve({ ip, port: activePort, url: `http://${ip}:${activePort}/?t=${token}` });
  }
  downloadDir = dir;
  fs.mkdirSync(downloadDir, { recursive: true });
  token = loadOrCreateToken();
  return new Promise((resolve, reject) => {
    const tryListen = (port, allowFallback) => {
      server = http.createServer(handle);
      server.on('error', err => {
        server = null;
        if (allowFallback && err && err.code === 'EADDRINUSE') { tryListen(0, false); }
        else reject(err);
      });
      server.listen(port, '0.0.0.0', () => {
        activePort = server.address().port;
        const ip = localIPv4();
        if (!pruneTimer) pruneTimer = setInterval(pruneHistory, 60000);
        resolve({ ip, port: activePort, url: `http://${ip}:${activePort}/?t=${token}` });
      });
    };
    tryListen(FIXED_PORT, true);
  });
}

function stop() { if (server) { try { server.close(); } catch {} server = null; } if (pruneTimer) { clearInterval(pruneTimer); pruneTimer = null; } activePort = 0; }
function listShared() { return sharedFiles.map(f => ({ id: f.id, name: f.name, size: f.size, ts: f.ts, kind: kindOf(f.name) })); }
function addShared(paths) {
  for (const p of paths || []) {
    if (!p) continue;
    let size = 0;
    try { size = fs.statSync(p).size; } catch { continue; }
    if (sharedFiles.some(f => f.path === p)) continue;
    sharedFiles.push({ id: 'f-' + Date.now() + Math.random().toString(36).slice(2, 6), name: sanitize(path.basename(p)), path: p, size, ts: Date.now() });
  }
  return listShared();
}
function removeShared(id) { sharedFiles = sharedFiles.filter(f => f.id !== id); return listShared(); }
function getShared() { return listShared(); }
function getReceived() { pruneHistory(); return received.map(r => r.type === 'text' ? ({ id: r.id || ('rt-' + r.ts), type: 'text', text: r.text, ts: r.ts }) : ({ id: r.id || ('rf-' + r.ts), name: r.name, size: r.size, ts: r.ts, kind: kindOf(r.name) })); }
function clearReceived() { received = []; pcMessages = []; }
// PC → phone text message (shown on the phone page, copyable).
function addPcText(text) {
  const t = String(text || '').trim();
  if (!t) return getPcMessages();
  pcMessages.unshift({ id: 'pm-' + Date.now(), type: 'text', text: t.slice(0, 5000), ts: Date.now() });
  return getPcMessages();
}
function getPcMessages() { pruneHistory(); return pcMessages.map(m => ({ id: m.id, text: m.text, ts: m.ts })); }
function getDownloadDir() { return downloadDir; }
function isRunning() { return !!server; }

function getStatus() { const ip = localIPv4(); return { running: !!server, ip, port: activePort, url: server ? `http://${ip}:${activePort}/?t=${token}` : '' }; }
module.exports = { start, stop, addShared, removeShared, getShared, getReceived, clearReceived, addPcText, getPcMessages, getDownloadDir, isRunning, getStatus };
