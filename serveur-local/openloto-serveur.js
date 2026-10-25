'use strict';

/*
 * OpenLoto — serveur local (salle des fêtes, réseau wifi commun)
 * Lancez-le sur le PC de l'organisateur : les téléphones des joueurs connectés au même wifi
 * suivent le tirage à l'adresse affichée. Aucune dépendance, aucune connexion internet nécessaire.
 *
 * Le fichier OpenLoto servi aux téléphones est le « Loto….html » le plus récent,
 * cherché dans le dossier du serveur, puis dans le dossier parent.
 * La clé de diffusion est créée à chaque lancement ; OpenLoto la récupère tout seul sur ce PC.
 *
 * Variables facultatives : PORT (défaut 8123), LOTO_FILE (chemin du fichier HTML), MAX_CLIENTS (défaut 300).
 */

const http = require('http');
/* Journal de démarrage à côté du programme + fenêtre maintenue ouverte en cas d'erreur */
const LOGF = require('path').join(process.pkg ? require('path').dirname(process.execPath) : __dirname, 'openloto-serveur.log');
function logf(t) { try { require('fs').appendFileSync(LOGF, '[' + new Date().toISOString() + '] ' + t + '\n'); } catch (e) {} }
function fatal(e) {
  logf('ERREUR : ' + (e && e.stack || e));
  console.log('\n  Erreur : ' + (e && e.message || e) + '\n  (détails dans openloto-serveur.log)\n\n  Appuyez sur Entrée pour fermer.');
  try { process.stdin.resume(); process.stdin.on('data', () => process.exit(1)); } catch (x) { setTimeout(() => process.exit(1), 60000); }
}
process.on('uncaughtException', fatal);
process.on('unhandledRejection', fatal);
logf('démarrage ' + process.version + ' ' + process.platform + ' ' + process.arch + ' exe=' + process.execPath);
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const os = require('os');
const PORT = parseInt(process.env.PORT, 10) || 8123;
const HOST = '0.0.0.0';
const KEY = crypto.randomBytes(18).toString('hex');                 /* nouvelle clé à chaque lancement */
const DIR = process.pkg ? path.dirname(process.execPath) : __dirname;   /* dossier de l'exécutable */
function findHtml() {
  if (process.env.LOTO_FILE) return process.env.LOTO_FILE;
  /* le fichier « Loto….html » le plus récent, dans le dossier du serveur, sinon dans le dossier parent */
  for (const dir of [DIR, path.dirname(DIR)]) {
    let best = null, bestT = 0;
    try {
      for (const f of fs.readdirSync(dir)) {
        if (!/^loto.*\.html?$/i.test(f)) continue;
        const t = fs.statSync(path.join(dir, f)).mtimeMs;
        if (t > bestT) { bestT = t; best = path.join(dir, f); }
      }
    } catch (e) {}
    if (best) return best;
  }
  return path.join(DIR, 'Loto.html');
}
const FILE = findHtml();
/* Adresses de ce PC sur le réseau local (wifi, câble) */
function lanUrls() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family !== 'IPv4' && a.family !== 4) continue;
      if (a.internal || /^169\.254\./.test(a.address)) continue;
      const virt = /vmware|virtualbox|vbox|hyper-v|vethernet|docker|wsl|tailscale|zerotier|loopback/i.test(name);
      out.push({ url: 'http://' + a.address + ':' + PORT + '/', name, virt, wifi: /wi-?fi|wlan|wireless|sans fil/i.test(name) });
    }
  }
  out.sort((x, y) => (x.virt - y.virt) || (y.wifi - x.wifi));
  return out;
}
const isLoopback = a => /^(::1|127\.\d+\.\d+\.\d+|::ffff:127\.\d+\.\d+\.\d+)$/.test(a || '');
const MAX_CLIENTS = parseInt(process.env.MAX_CLIENTS, 10) || 300;
const MAX_BODY = 512 * 1024;
const HEARTBEAT_MS = 15000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Loto-Key',
  'Access-Control-Max-Age': '86400'
};

/* ---------- Page HTML : chargée et compressée une seule fois ---------- */
let htmlRaw = null, htmlGz = null, htmlEtag = null;
function loadHtml() {
  try {
    htmlRaw = fs.readFileSync(FILE);
    htmlGz = zlib.gzipSync(htmlRaw, { level: 9 });
    htmlEtag = '"' + crypto.createHash('sha1').update(htmlRaw).digest('hex').slice(0, 24) + '"';
    return true;
  } catch (e) {
    htmlRaw = htmlGz = htmlEtag = null;
    return false;
  }
}

/* ---------- Validation / assainissement de l'état reçu ---------- */
const LOGO_RE = /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[A-Za-z0-9+\/=]+$/i;
const HEX_RE = /^#[0-9a-f]{6}$/i;
const POS = ['left', 'right', 'top', 'both'];
const VERDICTS = ['ok', 'no', 'late'];

const asStr = (v, max) => typeof v === 'string' ? v.slice(0, max) : '';
const asInt = v => Number.isFinite(+v) ? Math.trunc(+v) : null;
const asIntList = (v, max) => Array.isArray(v) ? v.slice(0, max).map(asInt).filter(n => n != null) : [];
const asBool = v => v === true;

function sanitize(msg) {
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return null;
  if (msg.loto !== 'state') return null;
  const out = { loto: 'state' };
  if (msg.t != null) out.t = Number.isFinite(+msg.t) ? +msg.t : null;
  out.titre = asStr(msg.titre, 500);
  if (typeof msg.logo === 'string' && LOGO_RE.test(msg.logo)) out.logo = msg.logo;
  out.logoPos = POS.includes(msg.logoPos) ? msg.logoPos : 'left';
  if (msg.colors != null) {
    if (!Array.isArray(msg.colors) || msg.colors.length > 200) return null;
    out.colors = msg.colors.map(c => typeof c === 'string' && HEX_RE.test(c) ? c : '#cccccc');
  }
  if (msg.notice && typeof msg.notice === 'object')
    out.notice = { on: msg.notice.on !== false, title: asStr(msg.notice.title, 200), text: asStr(msg.notice.text, 2000) };
  if (msg.pubmsg && typeof msg.pubmsg === 'object')
    out.pubmsg = { start: asStr(msg.pubmsg.start, 600), wait: asStr(msg.pubmsg.wait, 600), end: asStr(msg.pubmsg.end, 600), endTitle: asStr(msg.pubmsg.endTitle, 80), demo: asStr(msg.pubmsg.demo, 200), anim: msg.pubmsg.anim !== false };
  if (msg.demo && typeof msg.demo === 'object'){
    const sp = +msg.demo.speed;
    out.demo = { on: msg.demo.on === true, speed: (sp === 3 || sp === 2 || sp === 1.2) ? sp : 2 };
  }
  if (msg.ended === true) {
    out.ended = true;
  } else if (msg.empty === true) {
    out.empty = true;
  } else if (msg.waiting === true) {
    out.waiting = true;
  } else if (msg.annonce && typeof msg.annonce === 'object') {
    out.annonce = { name: asStr(msg.annonce.name, 200) };
  } else if (msg.pause && typeof msg.pause === 'object') {
    out.pause = { name: asStr(msg.pause.name, 200), end: asInt(msg.pause.end) };
  } else {
    if (msg.lot && typeof msg.lot === 'object')
      out.lot = {
        name: asStr(msg.lot.name, 200),
        rule: asStr(msg.lot.rule, 200),
        colors: Array.isArray(msg.lot.colors)
          ? msg.lot.colors.slice(0, 30).filter(c => typeof c === 'string' && HEX_RE.test(c)) : []
      };
    else out.lot = null;
    out.last5 = asIntList(msg.last5, 5);
    if (Array.isArray(msg.drawn)) out.drawn = asIntList(msg.drawn, 200);   /* grille des numéros sur les téléphones */
    if (msg.check === true) out.check = true;                              /* contrôle de carton en cours : grille + carton */
    if (msg.carton && typeof msg.carton === 'object' && Array.isArray(msg.carton.lines)) {
      out.carton = {
        code: asStr(msg.carton.code, 60),
        last: asInt(msg.carton.last),
        verdict: VERDICTS.includes(msg.carton.verdict) ? msg.carton.verdict : '',
        lines: msg.carton.lines.slice(0, 20).map(l => ({
          nums: asIntList(l && l.nums, 12),
          miss: asIntList(l && l.miss, 12),
          done: !!(l && l.done)
        }))
      };
    } else out.carton = null;
  }
  return out;
}

/* ---------- Diffusion ---------- */
let lastState = null;   // état canonique complet, logo inclus (pour les nouvelles connexions)
let lastLogo = '';      // logo courant, pour ne le rediffuser qu'au changement
let lastIngestAt = 0;   // heure (serveur) du dernier état reçu du direct
let lastKey = '';       // contenu du dernier état diffusé (sans l'horodatage) : évite de renvoyer un état identique
const clients = new Set();

function broadcast(payload) {
  const frame = 'data: ' + JSON.stringify(payload) + '\n\n';
  for (const res of clients) {
    try { res.write(frame); } catch (e) { clients.delete(res); }
  }
}

/* Réponse au direct : nombre de téléphones connectés (affiché dans la barre du haut) */
function sendCount(res) {
  send(res, 200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, JSON.stringify({ clients: clients.size }));
}

function send(res, code, headers, body) {
  res.writeHead(code, Object.assign({}, CORS, headers));
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }

  if (req.method === 'GET' && (url === '/' || url === '/Loto.html' || url === '/index.html')) {
    if (!htmlRaw && !loadHtml())
      return send(res, 500, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Fichier HTML introuvable.');
    const inm = req.headers['if-none-match'];
    if (inm && inm.split(',').some(t => t.trim() === htmlEtag)) {
      res.writeHead(304, Object.assign({}, CORS, { 'ETag': htmlEtag, 'Cache-Control': 'no-cache' }));
      return res.end();
    }
    const gz = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    const headers = {
      'Content-Type': 'text/html; charset=utf-8',
      'Vary': 'Accept-Encoding',
      'ETag': htmlEtag,
      'Cache-Control': 'no-cache'
    };
    if (gz) headers['Content-Encoding'] = 'gzip';
    return send(res, 200, headers, gz ? htmlGz : htmlRaw);
  }

  /* OpenLoto ouvert sur ce même PC : récupère la clé et les adresses à donner aux joueurs */
  if (req.method === 'GET' && url === '/openloto-local') {
    if (!isLoopback(req.socket.remoteAddress))
      return send(res, 403, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Réservé au PC de l’organisateur.');
    return send(res, 200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      JSON.stringify({ app: 'openloto-local', key: KEY, port: PORT, urls: lanUrls().filter(u => !u.virt).map(u => u.url), file: path.basename(FILE), clients: clients.size }));
  }

  if (req.method === 'GET' && url === '/events') {
    if (clients.size >= MAX_CLIENTS)
      return send(res, 503, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Trop de connexions.');
    res.writeHead(200, Object.assign({}, CORS, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }));
    res.write(': connected\n\n');
    if (lastState) { try { res.write('data: ' + JSON.stringify(lastState) + '\n\n'); } catch (e) {} }
    clients.add(res);
    const ping = () => 'event: ping\ndata: {"age":' + (lastIngestAt ? Date.now() - lastIngestAt : -1) + '}\n\n';
    try { res.write(ping()); } catch (e) {}
    const hb = setInterval(() => { try { res.write(ping()); } catch (e) {} }, HEARTBEAT_MS);
    req.on('close', () => { clearInterval(hb); clients.delete(res); });
    return;
  }

  if (req.method === 'POST' && url === '/ingest') {
    if (!KEY || req.headers['x-loto-key'] !== KEY)
      return send(res, 403, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Clé refusée.');

    const cl = parseInt(req.headers['content-length'], 10);
    if (Number.isFinite(cl) && cl > MAX_BODY)
      return send(res, 413, { 'Content-Type': 'text/plain; charset=utf-8' }, 'État trop volumineux.');

    req.setEncoding('utf8');   // évite de couper un caractère accentué entre deux paquets
    let body = '', tooBig = false;
    req.on('data', chunk => {
      if (tooBig) return;
      body += chunk;
      if (body.length > MAX_BODY) {
        tooBig = true;
        send(res, 413, { 'Content-Type': 'text/plain; charset=utf-8' }, 'État trop volumineux.');
        req.destroy();
      }
    });
    req.on('end', () => {
      if (tooBig) return;
      let obj;
      try { obj = JSON.parse(body); } catch (e) {
        return send(res, 400, { 'Content-Type': 'text/plain; charset=utf-8' }, 'JSON invalide.');
      }
      const clean = sanitize(obj);
      if (!clean) return send(res, 400, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Format inattendu.');

      // Ordre : ignorer un état plus ancien que le dernier reçu.
      if (clean.t != null && lastState && lastState.t != null && clean.t < lastState.t)
        return send(res, 204, {}, '');

      const logoChanged = clean.logo !== undefined && clean.logo !== lastLogo;
      if (clean.logo !== undefined) lastLogo = clean.logo;

      // État canonique : conserve toujours le logo courant (pour les nouvelles connexions).
      const canonical = Object.assign({}, clean);
      if (canonical.logo === undefined && lastLogo) canonical.logo = lastLogo;
      lastState = canonical;
      lastIngestAt = Date.now();

      // État identique au précédent (signal de vie du direct) : rien à renvoyer aux téléphones,
      // le « ping » toutes les 15 s leur indique déjà que tout va bien.
      const key = JSON.stringify(Object.assign({}, canonical, { t: 0 }));
      if (key === lastKey && !logoChanged) return sendCount(res);
      lastKey = key;

      // Diffusion : le logo n'est renvoyé qu'à la connexion ou quand il change.
      const outbound = Object.assign({}, canonical);
      if (!logoChanged) delete outbound.logo;

      broadcast(outbound);
      sendCount(res);
    });
    req.on('error', () => {});
    return;
  }

  send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Introuvable.');
});

/* ---------- Lancement et affichage dans la fenêtre ---------- */
loadHtml();
try { process.title = 'OpenLoto - serveur local'; } catch (e) {}
function banner() {
  const urls = lanUrls(), main = urls.filter(u => !u.virt);
  const L = [];
  L.push('');
  L.push('  ==========================================================');
  L.push('     OpenLoto  -  serveur local pour les téléphones');
  L.push('  ==========================================================');
  L.push('');
  L.push('  Fichier diffusé : ' + (htmlRaw ? path.basename(FILE) + (path.dirname(FILE) !== DIR ? '  (dossier parent)' : '') : 'INTROUVABLE'));
  if (!htmlRaw) L.push('  -> Placez Loto.html dans le même dossier que ce programme (ou le dossier parent), puis relancez-le.');
  L.push('');
  if (!main.length) {
    L.push('  Aucun réseau détecté : connectez ce PC au wifi de la salle, puis relancez.');
  } else {
    L.push('  Adresse à donner aux joueurs (même wifi que ce PC) :');
    main.forEach((u, i) => L.push('     ' + (i ? '   ou ' : '  >> ') + u.url + '   (' + u.name + ')'));
  }
  L.push('');
  L.push('  Dans OpenLoto, sur ce PC :');
  L.push('     Réglages > Config réseau (téléphones) > « Utiliser le serveur local de ce PC »');
  L.push('     (le lien et le QR code à projeter s’affichent dans cette fenêtre d’OpenLoto)');
  L.push('');
  L.push('  Laissez cette fenêtre ouverte pendant tout le loto. Fermez-la pour arrêter le serveur.');
  L.push('  ==========================================================');
  L.push('');
  console.log(L.join('\n'));
}
let lastCount = -1;
setInterval(() => {
  if (clients.size !== lastCount) {
    lastCount = clients.size;
    const t = new Date().toLocaleTimeString('fr-FR');
    console.log('  [' + t + '] Téléphones connectés : ' + clients.size);
  }
}, 5000);
server.on('error', e => {
  if (e.code === 'EADDRINUSE') console.log('\n  Le port ' + PORT + ' est déjà utilisé : le serveur est peut-être déjà lancé dans une autre fenêtre.\n');
  else console.log('\n  Erreur du serveur : ' + e.message + '\n');
  logf('erreur serveur : ' + e.code + ' ' + e.message);
  console.log('  Appuyez sur Entrée pour fermer.');
  try { process.stdin.resume(); process.stdin.on('data', () => process.exit(1)); } catch (x) { setTimeout(() => process.exit(1), 60000); }
});
server.listen(PORT, HOST, () => { logf('écoute sur le port ' + PORT + ', fichier ' + FILE); banner(); });
