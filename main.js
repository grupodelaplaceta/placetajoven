const { app, BrowserWindow, ipcMain, powerMonitor, shell, Menu, screen, globalShortcut } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), crypto = require('crypto');

/* ---- Configuración ---- */
const CFG = {
  match: 'maskot',        // fragmento del nombre del proceso (sin .exe). Ajusta si el .exe se llama distinto.
  idleMax: 120,           // s sin teclado/ratón tras los que se pausa el contador
  appUrl: '',             // p. ej. https://joven.laplaceta.org  (vacío = interfaz local app/index.html). Necesario para iniciar sesión con PlacetaID.
  serverUrl: '',          // p. ej. https://api.tudominio.es/heartbeat  (vacío = sin servidor)
  tiers: [{ ms: 300000, pz: 12 }, { ms: 900000, pz: 37 }, { ms: 1800000, pz: 75 }],
  allowOpen: /^https:\/\/(remullagames\.itch\.io|[a-z0-9-]+\.itch\.io|laplaceta\.org|placetaid-web-plan2027\.vercel\.app)\//
};

if (!app.requestSingleInstanceLock()) app.quit();   // sesión única

const file = () => path.join(app.getPath('userData'), 'progress.json');
let P = { ms: 0, installId: crypto.randomUUID() };
try { P = { ...P, ...JSON.parse(fs.readFileSync(file(), 'utf8')) }; } catch (_) {}
const save = () => { try { fs.writeFileSync(file(), JSON.stringify(P)); } catch (_) {} };

let ov, moveMode = false, win, running = false, focused = false, supported = process.platform === 'win32';

/* Vigilante de procesos: un único PowerShell persistente. Solo se publica si el proceso coincide con alguno de los juegos
   del catálogo (los envía la interfaz con setGames); no se guarda ni se envía la lista de procesos. */
let games = [{ id: '', match: CFG.match }], gameId = '', wgen = 0, wchild = null;
const okName = s => /^[A-Za-z0-9_.-]{2,40}$/.test(s), okId = s => /^[a-z0-9_-]{0,60}$/.test(s);
function watch() {
  if (!supported) return;
  const my = ++wgen; if (wchild) { try { wchild.kill(); } catch (_) {} }
  const arr = games.map(g => `@{i='${g.id}';m='*${g.match}*'}`).join(',');
  const ps = `$G=@(${arr});Add-Type 'using System;using System.Runtime.InteropServices;public class W{[DllImport(\"user32.dll\")]public static extern IntPtr GetForegroundWindow();[DllImport(\"user32.dll\")]public static extern int GetWindowThreadProcessId(IntPtr h,out int p);}';
  while($true){$fp='';try{$p=0;[void][W]::GetWindowThreadProcessId([W]::GetForegroundWindow(),[ref]$p);$fp=(Get-Process -Id $p -ErrorAction Stop).ProcessName}catch{}
  $names=@(Get-Process -ErrorAction SilentlyContinue | ForEach-Object {$_.ProcessName});$o='0|0|'
  foreach($g in $G){if($fp -like $g.m){$o='1|1|'+$g.i;break}elseif($o -eq '0|0|' -and ($names | Where-Object {$_ -like $g.m})){$o='1|0|'+$g.i}}
  Write-Output $o;Start-Sleep -Seconds 2}`;
  const c = spawn('powershell', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', ps], { windowsHide: true });
  wchild = c;
  c.stdout.on('data', d => { const l = String(d).trim().split(/\r?\n/).pop().split('|'); running = l[0] === '1'; focused = l[1] === '1'; gameId = l[2] || ''; });
  c.on('exit', () => { if (my === wgen) setTimeout(watch, 5000); });
  app.on('quit', () => c.kill());
}
ipcMain.on('games', (_e, list) => {
  if (!Array.isArray(list)) return;
  const g = list.slice(0, 50).filter(x => x && okId(String(x.id)) && okName(String(x.match))).map(x => ({ id: String(x.id), match: String(x.match) }));
  if (g.length) { games = g; watch(); }
});

/* Contador: sólo suma si el juego está abierto, en primer plano y hay actividad real */
let last = Date.now(), n = 0;
setInterval(() => {
  const now = Date.now(), dt = Math.min(1500, now - last); last = now;
  const idle = powerMonitor.getSystemIdleTime();
  const active = supported && running && focused && idle < CFG.idleMax;
  if (active) P.ms += dt;
  if (++n % 10 === 0) save();
  if (n % 60 === 0 && active && CFG.serverUrl)      // latido: el servidor debe validar y firmar
    fetch(CFG.serverUrl, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ installId: P.installId, ms: P.ms, ts: now }) }).catch(() => {});
  const st = { supported, running, focused, idle, active, ms: P.ms, tiers: CFG.tiers, gameId };
  if (win && !win.isDestroyed()) win.webContents.send('status', st);
  if (ov && !ov.isDestroyed()) {
    ov.webContents.send('status', st);
    const show = (running || moveMode) && !P.hide;
    if (show && !ov.isVisible()) ov.showInactive(); else if (!show && ov.isVisible()) ov.hide();
  }
}, 1000);

ipcMain.on('open', (_e, url) => { if (CFG.allowOpen.test(url)) shell.openExternal(url); });

function makeOverlay() {
  const wa = screen.getPrimaryDisplay().workArea;
  ov = new BrowserWindow({ width: 320, height: 150, x: P.ox ?? wa.x + wa.width - 340, y: P.oy ?? wa.y + 20,
    transparent: true, frame: false, alwaysOnTop: true, focusable: false, skipTaskbar: true, resizable: false, hasShadow: false, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required' } });
  ov.setAlwaysOnTop(true, 'screen-saver');
  ov.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  ov.setIgnoreMouseEvents(true);                      // transparente a los clics: no molesta al jugar
  ov.loadFile(path.join(__dirname, 'overlay.html'));
  ov.on('moved', () => { const [x, y] = ov.getPosition(); P.ox = x; P.oy = y; save(); });
  globalShortcut.register('Control+Shift+H', () => { P.hide = !P.hide; save(); });                // ocultar/mostrar
  globalShortcut.register('Control+Shift+M', () => { moveMode = !moveMode; ov.setIgnoreMouseEvents(!moveMode); ov.webContents.send('mode', moveMode); }); // mover
}
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({ width: 1280, height: 800, minWidth: 380, backgroundColor: '#0B0913',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false } });
  if (CFG.appUrl) {
    const origin = new URL(CFG.appUrl).origin;
    win.loadURL(CFG.appUrl);
    // solo se permite navegar a la web de la app y a PlacetaID (login); todo lo demás se abre fuera
    win.webContents.on('will-navigate', (e, url) => { const o = new URL(url).origin; if (o !== origin && o !== 'https://placetaid-web-plan2027.vercel.app') { e.preventDefault(); if (CFG.allowOpen.test(url)) shell.openExternal(url); } });
  } else win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { if (CFG.allowOpen.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  makeOverlay();
  watch();
});
app.on('second-instance', () => { if (win) { win.restore(); win.focus(); } });
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { save(); app.quit(); });
