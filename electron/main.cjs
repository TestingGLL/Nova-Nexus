const { app, BrowserWindow, ipcMain, shell, Notification: ElectronNotification, Tray, Menu, MenuItem, nativeImage } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const transfer = require('./transfer.cjs');

let tray = null;

const isDev = !app.isPackaged;

// Allow the Web Audio context to start without a user gesture so the app's audio
// session (and its entry in the Windows volume mixer) is created on launch.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

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
    icon: path.join(__dirname, '..', 'dist', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: 'no-user-gesture-required',
      spellcheck: true,
    },
    autoHideMenuBar: true,
    show: false,
  });

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
      if (params.editFlags.canPaste) menu.append(new MenuItem({ role: 'paste', label: 'Pegar' }));
      if (params.isEditable) menu.append(new MenuItem({ role: 'selectAll', label: 'Seleccionar todo' }));
    }
    if (menu.items.length) menu.popup();
  });

  win.once('ready-to-show', () => win.show());

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
    const dir = path.join(app.getPath('downloads'), 'Nova Nexus');
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
ipcMain.handle('transfer-remove-shared', (_e, id) => ({ success: true, files: transfer.removeShared(id) }));
ipcMain.handle('transfer-get-shared', () => transfer.getShared());
ipcMain.handle('transfer-received', () => transfer.getReceived());
ipcMain.handle('transfer-clear-received', () => { transfer.clearReceived(); return { success: true }; });
ipcMain.handle('transfer-status', async () => {
  // Auto-start on first query so the server is up as soon as the app opens.
  if (!transfer.isRunning()) {
    try { const dir = path.join(app.getPath('downloads'), 'Nova Nexus'); await transfer.start(dir); } catch {}
  }
  return { ...transfer.getStatus(), dir: transfer.getDownloadDir() };
});
ipcMain.handle('transfer-open-folder', async () => { const d = transfer.getDownloadDir(); if (d) await shell.openPath(d); return { success: !!d }; });

// ----- Mundial 2026 live scores (ESPN API) -----
ipcMain.handle('get-mundial-scores', async () => {
  const https = require('https');
  const url = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 8000 }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          const matches = (json.events || []).map(ev => {
            const comp = (ev.competitions && ev.competitions[0]) || {};
            const competitors = comp.competitors || [];
            const home = competitors.find(c => c.homeAway === 'home') || competitors[0] || {};
            const away = competitors.find(c => c.homeAway === 'away') || competitors[1] || {};
            const t = (team) => team && team.team ? team.team : {};
            return {
              id: ev.id || '',
              home: { name: t(home).displayName || t(home).name || '?', abbr: t(home).abbreviation || '?', score: parseInt(home.score || '0', 10), logo: t(home).logo || '' },
              away: { name: t(away).displayName || t(away).name || '?', abbr: t(away).abbreviation || '?', score: parseInt(away.score || '0', 10), logo: t(away).logo || '' },
              state: (ev.status && ev.status.type && ev.status.type.state) || 'pre',
              clock: (ev.status && ev.status.displayClock) || '',
              detail: (ev.status && ev.status.type && (ev.status.type.detail || ev.status.type.description)) || '',
              startTime: ev.date || '',
            };
          });
          resolve({ success: true, matches });
        } catch (_e) {
          resolve({ success: false, message: 'Error al procesar datos' });
        }
      });
    });
    req.on('error', (e) => resolve({ success: false, message: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ success: false, message: 'Timeout' }); });
  });
});

// ----- Crypto prices (CoinGecko) -----
ipcMain.handle('get-crypto-prices', async () => {
  const https = require('https');
  const ids = 'bitcoin,pax-gold,hyperliquid,cosmos,solana';
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=ars,usd&include_24hr_change=true&include_last_updated_at=true`;
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
        catch (_e) { resolve({ success: false, message: 'Error al procesar datos' }); }
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
        catch (_e2) { resolve({ success: false, message: 'Error' }); }
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
    "Get-PnpDevice -PresentOnly | Where-Object { $_.FriendlyName -and ($_.InstanceId -match '^BTHLE\\\\DEV_' -or $_.InstanceId -match '^BTHENUM\\\\DEV_') } | ForEach-Object {",
    "  $b=(Get-PnpDeviceProperty -InstanceId $_.InstanceId -KeyName '{104ea319-6ee2-4701-bd47-8ddbf425bbe5} 2').Data",
    "  $lvl=$null; if ($b -ne $null) { $lvl=[int]$b }",
    "  $out += [PSCustomObject]@{ id=$_.InstanceId; name=$_.FriendlyName; battery=$lvl; class=[string]$_.Class }",
    "}",
    // Wireless headsets/headphones (e.g. USB-dongle sets) show up as audio render endpoints, not BTH nodes.
    "Get-PnpDevice -PresentOnly | Where-Object { $_.Class -eq 'AudioEndpoint' -and $_.InstanceId -match '\\{0\\.0\\.0\\.' -and $_.FriendlyName -match 'auricular|headphone|headset|airpod|buds|cascos|freebuds|earbud' } | ForEach-Object {",
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
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    // Auto-start the WiFi transfer server on launch (fixed port + stable token).
    try { transfer.start(path.join(app.getPath('downloads'), 'Nova Nexus')); } catch {}
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
