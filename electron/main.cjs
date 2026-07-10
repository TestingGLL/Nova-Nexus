const { app, BrowserWindow, ipcMain, shell, Notification: ElectronNotification, Tray, Menu, MenuItem, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const transfer = require('./transfer.cjs');

let tray = null;

// ----- Carpetas de datos en Documentos (persistentes, se crean solas) -----
// Documentos/Nova Nexus/{Transferencias, Conversiones}. Se recrean automáticamente
// también en una PC nueva porque se aseguran al iniciar y en cada uso.
function appDocsDir() { return path.join(app.getPath('documents'), 'Nova Nexus'); }
function transfersDir() { return path.join(appDocsDir(), 'Transferencias'); }
function conversionsDir() { return path.join(appDocsDir(), 'Conversiones'); }
function ensureAppFolders() {
  try { fs.mkdirSync(transfersDir(), { recursive: true }); } catch {}
  try { fs.mkdirSync(conversionsDir(), { recursive: true }); } catch {}
}

const isDev = !app.isPackaged;

// Prefer a real .ico for the Windows taskbar/exe icon; fall back to the PNG.
const ICON_ICO = path.join(__dirname, '..', 'dist', 'icon.ico');
const ICON_PNG = path.join(__dirname, '..', 'dist', 'icon.png');
const APP_ICON = require('fs').existsSync(ICON_ICO) ? ICON_ICO : ICON_PNG;
const APP_ID = 'com.novanexus.desktop';

// Allow the Web Audio context to start without a user gesture so the app's audio
// session (and its entry in the Windows volume mixer) is created on launch.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Stable AppUserModelID so Windows groups the running window with the pinned
// taskbar shortcut into a SINGLE icon (instead of showing a duplicate).
try { app.setAppUserModelId(APP_ID); } catch {}

const CHROME_PROGID = 'ChromeHTML';
const EDGE_PROGID = 'MSEdgeHTM';

const FILE_EXTENSIONS = ['.html', '.htm', '.svg', '.webp', '.xhtml', '.shtml'];
const URL_PROTOCOLS = ['http', 'https'];

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Nova Nexus',
    icon: APP_ICON,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: 'no-user-gesture-required',
      spellcheck: true,
      // Keep timers/intervals running at full rate when minimized or in tray so
      // goal alerts, reminders and the countdown timer still fire in background.
      backgroundThrottling: false,
    },
    autoHideMenuBar: true,
    show: false,
  });

  // Bind the taskbar button to the same AppUserModelID + relaunch command as the
  // pinned shortcut, so Windows keeps a SINGLE icon (no duplicate) and pinning the
  // running app produces a shortcut that reuses this instance.
  try {
    win.setAppDetails({
      appId: APP_ID,
      appIconPath: APP_ICON,
      appIconIndex: 0,
      relaunchCommand: `"${process.execPath}"`,
      relaunchDisplayName: 'Nova Nexus',
    });
  } catch {}

  win.webContents.session.setSpellCheckerLanguages(['es']);

  // Right-click spelling suggestions (Español) + edit actions.
  win.webContents.on('context-menu', (_event, params) => {
    const menu = new Menu();
    for (const suggestion of params.dictionarySuggestions) {
      menu.append(new MenuItem({ label: suggestion, click: () => win.webContents.replaceMisspelling(suggestion) }));
    }
    if (params.misspelledWord) {
      if (params.dictionarySuggestions.length) menu.append(new MenuItem({ type: 'separator' }));
      menu.append(new MenuItem({ label: 'Agregar al diccionario', click: () => win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord) }));
    }
    if (params.isEditable || params.selectionText) {
      if (menu.items.length) menu.append(new MenuItem({ type: 'separator' }));
      if (params.editFlags.canCut) menu.append(new MenuItem({ role: 'cut', label: 'Cortar' }));
      if (params.editFlags.canCopy) menu.append(new MenuItem({ role: 'copy', label: 'Copiar' }));
      if (params.editFlags.canPaste) {
        // Dos variantes, consistentes en toda la app:
        //  · Pegar → pegado clásico (mantiene el formato del origen). Igual que Ctrl+V.
        //  · Pegar sin formato → texto plano (pasteAndMatchStyle descarta el formato).
        menu.append(new MenuItem({ role: 'paste', label: 'Pegar' }));
        menu.append(new MenuItem({ role: 'pasteAndMatchStyle', label: 'Pegar sin formato' }));
      }
      if (params.isEditable) menu.append(new MenuItem({ role: 'selectAll', label: 'Seleccionar todo' }));
      // Quitar formato de la selección (aplica al editor de textos; en campos de
      // texto plano es un no-op inofensivo). execCommand dispara 'input', así que
      // el editor persiste el cambio automáticamente.
      if (params.isEditable && params.selectionText) {
        menu.append(new MenuItem({ type: 'separator' }));
        menu.append(new MenuItem({
          label: 'Quitar formato',
          click: () => { win.webContents.executeJavaScript("try{document.execCommand('removeFormat');document.execCommand('unlink');}catch(e){}"); },
        }));
      }
    }
    if (menu.items.length) menu.popup();
  });

  // The renderer can lay out at an intermediate size on first paint (the
  // "UI se arregla al cambiar de sección o esperar" glitch). A real 1px window
  // resize fires a genuine resize event and forces Chromium to re-layout at the
  // final size — far more reliable than a JS-dispatched resize.
  const relayoutNudge = () => {
    try {
      if (!win.isVisible() || win.isMinimized()) return;
      const [w, h] = win.getSize();
      win.setSize(w, h + 1);
      setTimeout(() => { try { win.setSize(w, h); } catch {} }, 45);
    } catch {}
  };
  win.once('ready-to-show', () => {
    win.show();
    setTimeout(relayoutNudge, 120);
    setTimeout(relayoutNudge, 500);
    setTimeout(relayoutNudge, 1200);
  });
  // Also nudge once the SPA bundle has finished loading (content mounts async).
  win.webContents.on('did-finish-load', () => setTimeout(relayoutNudge, 250));

  // Minimize to tray instead of closing
  win.on('close', (e) => {
    const minimizeToTray = true; // TODO: read from config
    if (minimizeToTray && !app.isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  // System tray
  try {
    const fs = require('fs');
    const iconCandidates = [
      path.join(__dirname, '..', 'dist', 'icon.png'),
      path.join(__dirname, '..', 'public', 'icon.png'),
      path.join(__dirname, '..', 'build', 'icon.png'),
      path.join(__dirname, '..', 'resources', 'icon.png'),
    ];
    let trayIcon;
    const found = iconCandidates.find(p => { try { return fs.existsSync(p); } catch { return false; } });
    if (found) {
      trayIcon = nativeImage.createFromPath(found).resize({ width: 16, height: 16 });
    } else {
      trayIcon = nativeImage.createEmpty();
    }
    if (!trayIcon.isEmpty()) {
      tray = new Tray(trayIcon);
    } else {
      tray = new Tray(nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAADklEQVQ4y2NgGAWDEwAAAhAAATH0sOAAAAAASUVORK5CYII='));
    }
    tray.setToolTip('Nova Nexus');
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Abrir Nova Nexus', click: () => { win.show(); win.focus(); } },
      { type: 'separator' },
      { label: 'Salir', click: () => { app.isQuitting = true; app.quit(); } },
    ]);
    tray.setContextMenu(contextMenu);
    tray.on('click', () => { win.show(); win.focus(); });
    tray.on('double-click', () => { win.show(); win.focus(); });
  } catch (trayErr) {
    console.error('Tray creation failed:', trayErr);
  }

  if (isDev) {
    win.loadURL('http://localhost:2000');
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    exec(`powershell -NoProfile -Command "${script}"`, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr || error.message));
      else resolve(stdout.trim());
    });
  });
}

ipcMain.handle('set-file-associations', async (_event, browser) => {
  const progId = browser === 'chrome' ? CHROME_PROGID : EDGE_PROGID;
  const results = [];

  for (const ext of FILE_EXTENSIONS) {
    try {
      const script = `
        $ext = '${ext}';
        $progId = '${progId}';
        $regPath = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\' + $ext + '\\UserChoice';
        try { Remove-Item -Path $regPath -Force -ErrorAction Stop } catch {};
        $assocPath = 'HKCU:\\Software\\Classes\\' + $ext;
        New-Item -Path $assocPath -Force | Out-Null;
        Set-ItemProperty -Path $assocPath -Name '(default)' -Value $progId;
        Write-Output 'ok'
      `.replace(/\n/g, ' ');
      await runPowerShell(script);
      results.push({ ext, status: 'ok' });
    } catch (err) {
      results.push({ ext, status: 'error', detail: String(err) });
    }
  }

  const fs = require('fs');
  const chromePaths = [
    path.join(process.env.ProgramFiles || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ];
  const edgePaths = [
    path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ];
  const searchPaths = browser === 'chrome' ? chromePaths : edgePaths;
  const exePath = searchPaths.find(p => { try { return fs.existsSync(p); } catch { return false; } });

  for (const proto of URL_PROTOCOLS) {
    try {
      const script = [
        "$ucPath = 'HKCU:\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\" + proto + "\\UserChoice'",
        "try { Remove-Item -Path $ucPath -Force -ErrorAction Stop } catch {}",
        "$classPath = 'HKCU:\\Software\\Classes\\" + proto + "'",
        "New-Item -Path $classPath -Force | Out-Null",
        "Set-ItemProperty -Path $classPath -Name '(default)' -Value 'URL:" + proto + " Protocol'",
        "New-Item -Path ($classPath + '\\shell\\open\\command') -Force | Out-Null",
        exePath
          ? "Set-ItemProperty -Path ($classPath + '\\shell\\open\\command') -Name '(default)' -Value '\"" + exePath.replace(/\\/g, '\\\\') + "\" \"%1\"'; Write-Output 'ok'"
          : "Write-Output 'not-found'",
      ].join('; ');
      const out = await runPowerShell(script);
      results.push({ ext: proto + '://', status: out.includes('ok') ? 'ok' : 'partial' });
    } catch (err) {
      results.push({ ext: proto + '://', status: 'error', detail: String(err) });
    }
  }

  try {
    await runPowerShell("ie4uinit.exe -show");
  } catch {}

  return { success: true, browser, results };
});

ipcMain.handle('get-current-associations', async () => {
  const associations = {};
  for (const ext of FILE_EXTENSIONS) {
    try {
      const script = `
        $ext = '${ext}';
        $regPath = 'HKCU:\\Software\\Classes\\' + $ext;
        if (Test-Path $regPath) {
          (Get-ItemProperty -Path $regPath -Name '(default)' -ErrorAction SilentlyContinue).'(default)'
        } else {
          'unknown'
        }
      `.replace(/\n/g, ' ');
      const result = await runPowerShell(script);
      associations[ext] = result || 'unknown';
    } catch {
      associations[ext] = 'unknown';
    }
  }
  return associations;
});

ipcMain.handle('open-browser-settings', async (_event, browser) => {
  try {
    if (browser === 'edge') {
      await shell.openExternal('ms-settings:defaultapps?registeredAppMachine=Microsoft Edge');
    } else {
      await shell.openExternal('ms-settings:defaultapps?registeredAppMachine=Google Chrome');
    }
    return { success: true };
  } catch {
    await shell.openExternal('ms-settings:defaultapps');
    return { success: true };
  }
});

ipcMain.handle('open-external', async (_event, url) => {
  await shell.openExternal(url);
  return { success: true };
});

ipcMain.handle('show-notification', (_event, title, body) => {
  if (ElectronNotification.isSupported()) {
    const n = new ElectronNotification({ title: title || 'Nova Nexus', body: body || '', icon: path.join(__dirname, '..', 'public', 'icon.png') });
    n.show();
  }
  return { success: true };
});

// Empty the Windows Recycle Bin. Triggered only by the user pressing the button
// in the app (with an in-app confirmation). Clear-RecycleBin errors when it's
// already empty, so that case is treated as success.
ipcMain.handle('empty-recycle-bin', async () => {
  return new Promise((resolve) => {
    exec('powershell -NoProfile -NonInteractive -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue; exit 0"', { timeout: 30000 }, (error) => {
      if (error && error.killed) resolve({ success: false, message: 'La operación tardó demasiado.' });
      else resolve({ success: true });
    });
  });
});

// Open the %appdata% (Roaming) folder in Windows Explorer.
ipcMain.handle('open-appdata', async () => {
  const dir = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming');
  const err = await shell.openPath(dir);
  return { success: !err, dir, message: err || undefined };
});

// ----- WiFi file transfer -----
ipcMain.handle('transfer-start', async () => {
  try {
    ensureAppFolders();
    const dir = transfersDir();
    const info = await transfer.start(dir);
    return { success: true, ...info, dir };
  } catch (err) {
    return { success: false, message: String(err && err.message || err) };
  }
});
ipcMain.handle('transfer-stop', () => { transfer.stop(); return { success: true }; });
ipcMain.handle('transfer-add-shared', async () => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return { success: false, files: [] };
  const result = await require('electron').dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'], title: 'Compartir archivos' });
  if (result.canceled || !result.filePaths.length) return { success: false, files: transfer.getShared() };
  return { success: true, files: transfer.addShared(result.filePaths) };
});
ipcMain.handle('transfer-share-paths', (_e, paths) => ({ success: true, files: transfer.addShared(Array.isArray(paths) ? paths : []) }));
ipcMain.handle('transfer-send-text', (_e, text) => ({ success: true, messages: transfer.addPcText(text) }));
ipcMain.handle('transfer-pc-messages', () => transfer.getPcMessages());
ipcMain.handle('transfer-remove-shared', (_e, id) => ({ success: true, files: transfer.removeShared(id) }));
ipcMain.handle('transfer-get-shared', () => transfer.getShared());
ipcMain.handle('transfer-received', () => transfer.getReceived());
ipcMain.handle('transfer-clear-received', () => { transfer.clearReceived(); return { success: true }; });
ipcMain.handle('transfer-status', async () => {
  // Auto-start on first query so the server is up as soon as the app opens.
  if (!transfer.isRunning()) {
    try { ensureAppFolders(); await transfer.start(transfersDir()); } catch {}
  }
  return { ...transfer.getStatus(), dir: transfer.getDownloadDir() };
});
ipcMain.handle('transfer-open-folder', async () => { const d = transfer.getDownloadDir(); if (d) await shell.openPath(d); return { success: !!d }; });

// ----- Conversiones (Edición → Convertidor de Imágenes) -----
// Guarda un archivo convertido (data URL / base64) en Documentos/Nova Nexus/Conversiones.
ipcMain.handle('save-conversion', async (_e, name, base64) => {
  try {
    ensureAppFolders();
    const dir = conversionsDir();
    const safe = (String(name || 'conversion').replace(/[<>:"/\\|?*]/g, '_').trim()) || 'conversion';
    let dest = path.join(dir, safe);
    if (fs.existsSync(dest)) {
      const ext = path.extname(safe); const b = path.basename(safe, ext);
      let n = 1; while (fs.existsSync(path.join(dir, `${b} (${n})${ext}`))) n++;
      dest = path.join(dir, `${b} (${n})${ext}`);
    }
    const data = Buffer.from(String(base64).replace(/^data:[^;]+;base64,/, ''), 'base64');
    fs.writeFileSync(dest, data);
    return { success: true, path: dest };
  } catch (err) {
    return { success: false, message: String((err && err.message) || err) };
  }
});
ipcMain.handle('open-conversions-folder', async () => { ensureAppFolders(); await shell.openPath(conversionsDir()); return { success: true }; });

// ----- Mundial 2026 (ESPN API) -----
function mapMundialEvent(ev) {
  const comp = (ev.competitions && ev.competitions[0]) || {};
  const competitors = comp.competitors || [];
  const home = competitors.find(c => c.homeAway === 'home') || competitors[0] || {};
  const away = competitors.find(c => c.homeAway === 'away') || competitors[1] || {};
  const t = (team) => team && team.team ? team.team : {};
  const st = (ev.status && ev.status.type) || {};
  // Penalty shootout detection (used to alert once and stop goal alerts).
  const penalty = /shootout|penal|penales/i.test(`${st.name || ''} ${st.detail || ''} ${st.description || ''}`);
  return {
    id: ev.id || '',
    home: { name: t(home).displayName || t(home).name || '?', abbr: t(home).abbreviation || '?', score: parseInt(home.score || '0', 10), logo: t(home).logo || '' },
    away: { name: t(away).displayName || t(away).name || '?', abbr: t(away).abbreviation || '?', score: parseInt(away.score || '0', 10), logo: t(away).logo || '' },
    state: st.state || 'pre',
    clock: (ev.status && ev.status.displayClock) || '',
    detail: st.detail || st.description || '',
    startTime: ev.date || '',
    penalty,
  };
}

function fetchEspn(url) {
  const https = require('https');
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 10000, headers: { 'User-Agent': 'NovaNexus/1.0', 'Accept': 'application/json' } }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => { try { resolve({ ok: true, json: JSON.parse(body) }); } catch { resolve({ ok: false }); } });
    });
    req.on('error', () => resolve({ ok: false }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false }); });
  });
}

ipcMain.handle('get-mundial-scores', async () => {
  const r = await fetchEspn('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard');
  if (!r.ok) return { success: false, message: 'Error al procesar datos' };
  return { success: true, matches: (r.json.events || []).map(mapMundialEvent) };
});

// Every confirmed/scheduled Argentina match across the whole tournament window
// (not just today/tomorrow), so upcoming fixtures show up as soon as they're set.
ipcMain.handle('get-mundial-argentina', async () => {
  const fmt = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const now = new Date();
  const end = new Date(now.getTime() + 55 * 24 * 60 * 60 * 1000);
  const r = await fetchEspn(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${fmt(now)}-${fmt(end)}`);
  if (!r.ok) return { success: false, message: 'Error' };
  const matches = (r.json.events || []).map(mapMundialEvent).filter(m => m.home.abbr === 'ARG' || m.away.abbr === 'ARG' || /argentina/i.test(`${m.home.name} ${m.away.name}`));
  return { success: true, matches };
});

// ----- Crypto prices (CoinGecko) -----
ipcMain.handle('get-crypto-prices', async (_e, ids) => {
  const https = require('https');
  // The renderer passes the coin id list; fall back to a default set if absent.
  const idList = (typeof ids === 'string' && ids.trim()) ? ids.trim() : 'bitcoin,pax-gold,hyperliquid,cosmos,solana';
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${idList}&vs_currencies=ars,usd&include_24hr_change=true&include_last_updated_at=true`;
  return new Promise((resolve) => {
    // CoinGecko returns 403 without a descriptive User-Agent header.
    const req = https.get(url, { timeout: 10000, headers: { 'User-Agent': 'NovaNexus/1.0', 'Accept': 'application/json' } }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (res.statusCode !== 200 || (data && data.status && data.status.error_code)) {
            resolve({ success: false, message: (data.status && data.status.error_message) || `HTTP ${res.statusCode}` });
          } else { resolve({ success: true, data }); }
        }
        catch { resolve({ success: false, message: 'Error al procesar datos' }); }
      });
    });
    req.on('error', (e) => resolve({ success: false, message: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ success: false, message: 'Timeout' }); });
  });
});

ipcMain.handle('get-crypto-chart', async (_e, coinId, days) => {
  const https = require('https');
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=ars&days=${days}`;
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 10000, headers: { 'User-Agent': 'NovaNexus/1.0', 'Accept': 'application/json' } }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ success: true, data: JSON.parse(body) }); }
        catch { resolve({ success: false, message: 'Error' }); }
      });
    });
    req.on('error', (e) => resolve({ success: false, message: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ success: false, message: 'Timeout' }); });
  });
});

// ----- Dólar blue (referencia para conversión ARS) -----
ipcMain.handle('get-dolar-blue', async () => {
  const https = require('https');
  const url = 'https://dolarapi.com/v1/dolares/blue';
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 8000, headers: { 'User-Agent': 'NovaNexus/1.0', 'Accept': 'application/json' } }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { const d = JSON.parse(body); resolve({ success: true, compra: d.compra, venta: d.venta }); }
        catch { resolve({ success: false, message: 'Error al procesar datos' }); }
      });
    });
    req.on('error', (e) => resolve({ success: false, message: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ success: false, message: 'Timeout' }); });
  });
});

ipcMain.handle('get-platform', () => {
  return { platform: process.platform, isDesktop: true };
});

// Enumerate present Bluetooth devices (controllers, keyboard, mouse, phone, audio…)
// and their battery level when Windows exposes it (best-effort).
// Real top-level device nodes are: BTHLE\DEV_<addr> (BLE) and BTHENUM\DEV_<addr> (classic).
// Everything else (BTHLEDEVICE\{guid}, BTHENUM\{guid}, BTH\MS_*) are service/profile child nodes.
ipcMain.handle('get-bluetooth-devices', async () => {
  const ps = [
    "$ErrorActionPreference='SilentlyContinue'",
    "$ProgressPreference='SilentlyContinue'",
    "$out=@()",
    "Get-PnpDevice -PresentOnly | Where-Object { $_.FriendlyName -and $_.Status -eq 'OK' -and ($_.InstanceId -match '^BTHLE\\\\DEV_' -or $_.InstanceId -match '^BTHENUM\\\\DEV_') } | ForEach-Object {",
    "  $b=(Get-PnpDeviceProperty -InstanceId $_.InstanceId -KeyName '{104ea319-6ee2-4701-bd47-8ddbf425bbe5} 2').Data",
    "  $lvl=$null; if ($b -ne $null) { $lvl=[int]$b }",
    "  $out += [PSCustomObject]@{ id=$_.InstanceId; name=$_.FriendlyName; battery=$lvl; class=[string]$_.Class }",
    "}",
    // Wireless headsets/headphones (e.g. USB-dongle sets) show up as audio render endpoints, not BTH nodes.
    "Get-PnpDevice -PresentOnly | Where-Object { $_.Class -eq 'AudioEndpoint' -and $_.Status -eq 'OK' -and $_.InstanceId -match '\\{0\\.0\\.0\\.' -and $_.FriendlyName -match 'auricular|headphone|headset|airpod|buds|cascos|freebuds|earbud' } | ForEach-Object {",
    "  $nm=$_.FriendlyName; if ($nm -match '\\((.+)\\)') { $nm=$Matches[1] }",
    "  $out += [PSCustomObject]@{ id=$_.InstanceId; name=$nm; battery=$null; class='audio' }",
    "}",
    "ConvertTo-Json -Compress -InputObject @($out)",
  ].join("\n");
  // Pass as a base64 -EncodedCommand to avoid all quoting/newline issues.
  const encoded = Buffer.from(ps, 'utf16le').toString('base64');
  try {
    const out = await new Promise((resolve, reject) => {
      exec(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`, { timeout: 9000 }, (error, stdout) => {
        if (error) reject(error); else resolve(stdout.trim());
      });
    });
    if (!out) return [];
    // Extract the JSON array/object even if PowerShell emitted CLIXML/progress noise.
    const match = out.match(/(\[.*\]|\{.*\})/s);
    if (!match) return [];
    const parsed = JSON.parse(match[1]);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
});

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  // Clicking the taskbar/pinned icon again (while hidden to tray or minimized)
  // restores and focuses the existing window instead of opening a new instance.
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (!win.isVisible()) win.show();
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    // Auto-start the WiFi transfer server on launch (fixed port + stable token).
    try { ensureAppFolders(); transfer.start(transfersDir()); } catch {}
  });

  app.on('before-quit', () => { app.isQuitting = true; try { transfer.stop(); } catch {} });

  app.on('window-all-closed', () => {
    try { transfer.stop(); } catch {}
    if (process.platform !== 'darwin') { app.isQuitting = true; app.quit(); }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}
