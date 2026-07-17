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
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Nova Nexus · Transferencia</title>
<style>
  :root { color-scheme: dark; --accent:#38bdf8; --recv:#22c55e; }
  * { box-sizing: border-box; }
  html, body { height:100%; }
  body { margin:0; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; background:#16161a; color:#e8e8ed; display:flex; flex-direction:column; }
  header { padding:12px 16px calc(12px); border-bottom:1px solid rgba(255,255,255,.08); background:#1b1b20; position:sticky; top:0; z-index:5; }
  header .ttl { font-size:16px; font-weight:700; display:flex; align-items:center; gap:8px; }
  header .status { display:flex; align-items:center; gap:6px; font-size:12px; color:#8a8a92; margin-top:3px; }
  .dot { width:8px; height:8px; border-radius:50%; background:var(--recv); box-shadow:0 0 0 3px rgba(34,197,94,.2); }
  .filter { display:flex; gap:6px; margin-top:10px; }
  .filter button { flex:1; padding:6px 8px; border:1px solid rgba(255,255,255,.12); background:transparent; color:#8a8a92; border-radius:20px; font-size:12px; font-weight:600; cursor:pointer; }
  .filter button.active { background:var(--accent); border-color:var(--accent); color:#001018; }
  #chat { flex:1; overflow-y:auto; padding:14px 12px 8px; display:flex; flex-direction:column; gap:8px; }
  .empty { color:#8a8a92; font-size:13px; text-align:center; padding:32px 12px; }
  .msg { display:flex; }
  .msg.recv { justify-content:flex-start; }
  .msg.sent { justify-content:flex-end; }
  .bub { max-width:82%; padding:9px 12px; border-radius:14px; font-size:14px; word-break:break-word; }
  .msg.recv .bub { background:rgba(34,197,94,.10); border:1px solid rgba(34,197,94,.28); border-bottom-left-radius:4px; }
  .msg.sent .bub { background:rgba(56,189,248,.12); border:1px solid rgba(56,189,248,.32); border-bottom-right-radius:4px; }
  .bub .txt { white-space:pre-wrap; }
  .bub .meta { display:flex; align-items:center; gap:8px; margin-top:5px; font-size:10px; color:#8a8a92; }
  .bub .fname { font-weight:600; display:flex; align-items:center; gap:6px; }
  .bub img.thumb { max-width:100%; border-radius:8px; margin-bottom:6px; display:block; }
  .lnk { color:var(--accent); text-decoration:none; font-weight:700; font-size:11px; padding:2px 8px; border:1px solid rgba(56,189,248,.4); border-radius:6px; }
  .cbtn { background:rgba(255,255,255,.08); color:var(--accent); border:none; font-size:11px; padding:2px 8px; border-radius:6px; cursor:pointer; }
  .composer { display:flex; align-items:center; gap:8px; padding:10px 12px calc(10px + env(safe-area-inset-bottom)); border-top:1px solid rgba(255,255,255,.08); background:#1b1b20; position:sticky; bottom:0; }
  .composer input[type=text] { flex:1; min-width:0; padding:11px 14px; border:1px solid rgba(255,255,255,.12); background:#111116; color:#e8e8ed; border-radius:22px; font-size:15px; font-family:inherit; }
  .composer input[type=text]:focus { outline:none; border-color:var(--accent); }
  .cir { width:42px; height:42px; flex-shrink:0; border-radius:50%; border:1px solid rgba(255,255,255,.14); background:#26262c; color:#c7c7cf; font-size:20px; display:flex; align-items:center; justify-content:center; cursor:pointer; }
  .cir.send { background:var(--accent); border-color:var(--accent); color:#001018; }
  .cir:disabled { opacity:.45; }
  input[type=file]{ display:none; }
  #toast { position:fixed; left:50%; transform:translateX(-50%); bottom:80px; background:#26262c; border:1px solid rgba(255,255,255,.14); color:#e8e8ed; padding:8px 16px; border-radius:20px; font-size:13px; opacity:0; transition:opacity .2s; pointer-events:none; z-index:10; }
  #toast.show { opacity:1; }
  #toast.err { color:#ef4444; }
</style></head>
<body>
  <header>
    <div class="ttl">🔄 Nova Nexus</div>
    <div class="status"><span class="dot"></span> Transferencia por WiFi · misma red</div>
    <div class="filter">
      <button data-f="all" class="active">Todos</button>
      <button data-f="recv">Recibidos</button>
      <button data-f="sent">Enviados</button>
    </div>
  </header>

  <div id="chat"><div class="empty">Cargando…</div></div>

  <div class="composer">
    <label class="cir" for="up" title="Adjuntar archivo">＋</label>
    <input id="up" type="file" multiple>
    <input id="txt" type="text" placeholder="Escribí un mensaje o adjuntá un archivo…" autocomplete="off">
    <button id="sendtxt" class="cir send" title="Enviar" disabled>➤</button>
  </div>
  <div id="toast"></div>

<script>
  const T = new URLSearchParams(location.search).get('t') || '';
  const fmt = b => b < 1024 ? b+' B' : b < 1048576 ? (b/1024).toFixed(1)+' KB' : (b/1048576).toFixed(1)+' MB';
  const esc = s => String(s).replace(/[<>&]/g, c=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]));
  const tm = ts => { try { return new Date(ts).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}); } catch { return ''; } };
  let filter = 'all';
  let chat = [];

  function toast(msg, err) { const t = document.getElementById('toast'); t.textContent = msg; t.className = 'show' + (err?' err':''); setTimeout(()=>t.className='',2200); }

  function fileBubble(it, scope) {
    const isImg = it.fkind === 'image';
    const thumb = isImg ? '<img class="thumb" src="/file/'+scope+'/'+it.id+'?t='+T+'" alt="">' : '';
    const dl = scope==='shared' ? '<a class="lnk" href="/download/'+it.id+'?t='+T+'">Bajar</a>' : '';
    return thumb + '<div class="fname">📎 '+esc(it.name)+'</div>' +
      '<div class="meta">'+fmt(it.size||0)+' · '+tm(it.ts)+(dl?' ':'')+dl+'</div>';
  }
  function textBubble(text, ts, showCopy) {
    const copy = showCopy ? '<button class="cbtn" data-copy="'+encodeURIComponent(text)+'">Copiar</button>' : '';
    return '<div class="txt">'+esc(text)+'</div><div class="meta">'+copy+tm(ts)+'</div>';
  }

  function render() {
    const el = document.getElementById('chat');
    const vis = filter==='all' ? chat : chat.filter(m => m.dir===filter);
    if (!vis.length) { el.innerHTML = '<div class="empty">'+(chat.length? 'Sin mensajes para este filtro.' : 'Todavía no hay mensajes. Adjuntá un archivo o escribí un texto abajo.')+'</div>'; return; }
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    el.innerHTML = vis.map(m => {
      const inner = m.kind==='file' ? fileBubble(m, m.dir==='recv'?'shared':'received') : textBubble(m.text, m.ts, m.dir==='recv');
      return '<div class="msg '+m.dir+'"><div class="bub">'+inner+'</div></div>';
    }).join('');
    el.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => { navigator.clipboard.writeText(decodeURIComponent(b.dataset.copy)); b.textContent='✓'; setTimeout(()=>b.textContent='Copiar',1200); });
    if (atBottom) el.scrollTop = el.scrollHeight;
  }

  async function load() {
    try {
      const [files, msgs, sent] = await Promise.all([
        fetch('/api/files?t='+T).then(r=>r.json()),
        fetch('/api/pcmessages?t='+T).then(r=>r.json()),
        fetch('/api/sent?t='+T).then(r=>r.json()),
      ]);
      const merged = [];
      // Recibidos (desde la PC): archivos compartidos + mensajes de texto de la PC.
      files.forEach(f => merged.push({ dir:'recv', kind:'file', id:f.id, name:f.name, size:f.size, ts:f.ts||0, fkind:f.kind }));
      msgs.forEach(m => merged.push({ dir:'recv', kind:'text', text:m.text, ts:m.ts }));
      // Enviados (desde el celular): texto y archivos que este teléfono mandó a la PC.
      sent.forEach(s => s.type==='text'
        ? merged.push({ dir:'sent', kind:'text', text:s.text, ts:s.ts })
        : merged.push({ dir:'sent', kind:'file', id:s.id, name:s.name, size:s.size, ts:s.ts, fkind:s.kind }));
      chat = merged.sort((a,b)=>a.ts-b.ts);
      render();
    } catch(e) { /* red intermitente: reintenta en el próximo tick */ }
  }
  load(); setInterval(load, 3000);

  document.querySelectorAll('.filter button').forEach(b => b.onclick = () => {
    filter = b.dataset.f;
    document.querySelectorAll('.filter button').forEach(x=>x.classList.toggle('active', x===b));
    render();
  });

  const txt = document.getElementById('txt');
  const sendBtn = document.getElementById('sendtxt');
  txt.addEventListener('input', () => sendBtn.disabled = !txt.value.trim());
  async function sendText() {
    if (!txt.value.trim()) return;
    const val = txt.value;
    try {
      const r = await fetch('/sendtext?t='+T, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text: val }) });
      if (r.ok) { txt.value=''; sendBtn.disabled=true; load(); } else toast('No se pudo enviar', true);
    } catch { toast('No se pudo enviar', true); }
  }
  sendBtn.addEventListener('click', sendText);
  txt.addEventListener('keydown', e => { if (e.key==='Enter') { e.preventDefault(); sendText(); } });

  document.getElementById('up').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      try {
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/upload?t='+T);
          xhr.setRequestHeader('X-Filename', encodeURIComponent(file.name));
          xhr.onload = () => xhr.status===200 ? resolve() : reject();
          xhr.onerror = reject;
          xhr.send(file);
        });
        toast('✓ '+file.name+' enviado');
      } catch { toast('✗ Error con '+file.name, true); }
    }
    e.target.value = '';
    load();
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
    res.end(JSON.stringify(sharedFiles.map(f => ({ id: f.id, name: f.name, size: f.size, ts: f.ts || 0, kind: kindOf(f.name) }))));
    return;
  }
  if (req.method === 'GET' && pathname === '/api/pcmessages') {
    pruneHistory();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(pcMessages.map(m => ({ id: m.id, text: m.text, ts: m.ts }))));
    return;
  }
  // Lo que el celular envió a la PC (texto y archivos) — para el chat único del celular.
  if (req.method === 'GET' && pathname === '/api/sent') {
    pruneHistory();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getReceived()));
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
