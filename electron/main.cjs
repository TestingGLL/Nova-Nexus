const { app, BrowserWindow, ipcMain, shell, Notification: ElectronNotification } = require('electron');
const path = require('path');
const { exec } = require('child_process');

const isDev = !app.isPackaged;

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
    icon: path.join(__dirname, '..', 'public', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
    show: false,
  });

  win.once('ready-to-show', () => win.show());

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

  app.whenReady().then(createWindow);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}
