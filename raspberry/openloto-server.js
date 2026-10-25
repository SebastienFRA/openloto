'use strict';

/*
 * OpenLoto — service de diffusion de l'écran public vers les téléphones.
 * Aucune dépendance : Node.js pur.
 *
 * Variables d'environnement :
 *   PORT         port d'écoute            (défaut 8123)
 *   HOST         interface d'écoute       (défaut 0.0.0.0)
 *   OPENLOTO_KEY   clé de diffusion         (obligatoire pour /ingest ; ancien nom LOTO_KEY accepté)
 *   OPENLOTO_FILE  chemin du fichier HTML   (défaut ./OpenLoto.html ; ancien nom LOTO_FILE accepté)
 *   MAX_CLIENTS  plafond de téléphones    (défaut 300)
 *
 * Routes :
 *   GET  /            sert le fichier HTML (écran public), gzip + ETag
 *   GET  /events      flux SSE (lecture seule pour les téléphones)
 *                     + événement « ping » toutes les 15 s : { age } = ms depuis le dernier état reçu
 *                       (permet aux téléphones de signaler une connexion instable)
 *   POST /ingest      reçoit l'état du direct (en-tête X-Loto-Key requis)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT, 10) || 8123;
const HOST = process.env.HOST || '0.0.0.0';
const KEY = process.env.OPENLOTO_KEY || process.env.LOTO_KEY || '';
const FILE = process.env.OPENLOTO_FILE || process.env.LOTO_FILE || path.join(__dirname, 'OpenLoto.html');
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

loadHtml();
server.listen(PORT, HOST, () => {
  console.log('OpenLoto à l\'écoute sur http://' + HOST + ':' + PORT + ' (HTML: ' + FILE + ')');
  console.log('HTML compressé : ' + (htmlGz ? htmlGz.length + ' o gzip / ' + htmlRaw.length + ' o, ETag ' + htmlEtag : 'non chargé'));
});
