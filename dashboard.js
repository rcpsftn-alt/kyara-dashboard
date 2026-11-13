'use strict';

const RAR = {
  c: ['C', '#9ca3af'], u: ['U', '#22c55e'], r: ['R', '#3b82f6'],
  e: ['E', '#a855f7'], l: ['L', '#facc15'], m: ['M', '#ef4444'],
};
const $ = id => document.getElementById(id);
const fmt = n => Number(n || 0).toLocaleString('fr-FR');
const dayKey = (t) => {
  const d = t ? new Date(t) : new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

let players = [], days = [], myId = null;
let sortKey = 'opens', sortDir = -1;

async function get(path) {
  const base = self.KYARA_CONFIG.SUPABASE_URL.replace(/\/+$/, '');
  const r = await fetch(base + '/rest/v1/' + path, { headers: self.kyaraHeaders() });
  if (!r.ok) {
    let msg = 'erreur ' + r.status;
    try { const j = await r.json(); msg = j.message || msg; } catch (e) { /* ignore */ }
    throw new Error(msg);
  }
  return r.json();
}

async function load() {
  const problem = self.kyaraConfigProblem();
  if (problem) { showError('Dashboard indisponible : ' + problem + '.'); $('updated').textContent = ''; return; }
  try {
    const since = dayKey(Date.now() - 29 * 864e5);
    const [p, d] = await Promise.all([
      get('players?select=id,pseudo,kyara_id,opens,nouvelles,doublons,c,u,r,e,l,m,since_mythic,top_cards,updated_at&order=updated_at.desc&limit=2000'),
      get('player_days?select=player_id,day,opens,l,m&day=gte.' + since + '&limit=50000'),
    ]);
    // Un même compte Kyara peut avoir plusieurs lignes (extension réinstallée) :
    // on ne garde que la plus récente.
    const seen = new Set();
    players = p.filter(x => {
      if (!x.kyara_id) return true;
      if (seen.has(x.kyara_id)) return false;
      seen.add(x.kyara_id);
      return true;
    });
    const keep = new Set(players.map(x => x.id));
    days = d.filter(x => keep.has(x.player_id));
    $('error').hidden = true;
    render();
    $('updated').textContent = players.length + ' joueur(s) · mis à jour à ' +
      new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    showError('Impossible de charger les données : ' + e.message);
  }
}

function showError(msg) { const el = $('error'); el.hidden = false; el.textContent = msg; }

function ago(t) {
  const s = Math.max(0, (Date.now() - new Date(t).getTime()) / 1000);
  if (s < 60) return 'à l\'instant';
  if (s < 3600) return 'il y a ' + Math.round(s / 60) + ' min';
  if (s < 86400) return 'il y a ' + Math.round(s / 3600) + ' h';
  return 'il y a ' + Math.round(s / 86400) + ' j';
}

// ---------------------------------------------------------------- cartes
function renderCards() {
  const sum = k => players.reduce((a, p) => a + (p[k] || 0), 0);
  const opens = sum('opens'), l = sum('l'), m = sum('m');
  const today = dayKey();
  const todayOpens = days.filter(d => d.day === today).reduce((a, d) => a + d.opens, 0);
  const active = players.filter(p => Date.now() - new Date(p.updated_at).getTime() < 15 * 60e3).length;
  const cards = [
    ['Joueurs', fmt(players.length), active + ' actif(s) maintenant'],
    ['Boosters ouverts', fmt(opens), fmt(todayOpens) + ' aujourd\'hui'],
    ['Légendaires', fmt(l), l ? '1 tous les ' + fmt(Math.round(opens / l)) + ' boosters' : '—'],
    ['Mythiques', fmt(m), m ? '1 tous les ' + fmt(Math.round(opens / m)) + ' boosters' : '—'],
  ];
  const root = $('cards');
  root.innerHTML = '';
  cards.forEach(([k, v, sub]) => {
    const c = document.createElement('div');
    c.className = 'card';
    const kk = document.createElement('div'); kk.className = 'k'; kk.textContent = k;
    const vv = document.createElement('div'); vv.className = 'v'; vv.textContent = v;
    const ss = document.createElement('div'); ss.className = 'k'; ss.textContent = sub;
    c.append(kk, vv, ss);
    root.appendChild(c);
  });
}

// ---------------------------------------------------------------- graphique
function renderChart() {
  const N = 30, W = 900, H = 220, padL = 40, padB = 24, padT = 10;
  const keys = [];
  for (let i = N - 1; i >= 0; i--) keys.push(dayKey(Date.now() - i * 864e5));
  const agg = Object.fromEntries(keys.map(k => [k, { opens: 0, l: 0, m: 0 }]));
  days.forEach(d => { const a = agg[d.day]; if (a) { a.opens += d.opens; a.l += d.l; a.m += d.m; } });
  const max = Math.max(1, ...keys.map(k => agg[k].opens));
  const step = (W - padL) / N, bw = step * 0.62;
  const y = v => H - padB - (v / max) * (H - padB - padT);

  let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" font-family="system-ui" font-size="11">';
  [0, 0.5, 1].forEach(f => {
    const v = Math.round(max * f), yy = y(v);
    svg += '<line x1="' + padL + '" x2="' + W + '" y1="' + yy + '" y2="' + yy + '" stroke="#262b36"/>';
    svg += '<text x="' + (padL - 6) + '" y="' + (yy + 4) + '" fill="#9ca3af" text-anchor="end">' + v + '</text>';
  });
  keys.forEach((k, i) => {
    const a = agg[k], x = padL + i * step + (step - bw) / 2, yy = y(a.opens);
    const tip = k.split('-').reverse().slice(0, 2).join('/') + ' : ' + a.opens + ' boosters, ' + a.l + ' L, ' + a.m + ' M';
    svg += '<g><title>' + tip + '</title>';
    svg += '<rect x="' + x + '" y="' + yy + '" width="' + bw + '" height="' + (H - padB - yy) + '" rx="2" fill="#7c3aed"/>';
    let dotY = Math.min(yy, H - padB) - 6;
    if (a.l) { svg += '<circle cx="' + (x + bw / 2) + '" cy="' + dotY + '" r="' + Math.min(6, 2.5 + a.l) + '" fill="#facc15"/>'; dotY -= 12; }
    if (a.m) { svg += '<circle cx="' + (x + bw / 2) + '" cy="' + dotY + '" r="' + Math.min(7, 3 + a.m) + '" fill="#ef4444"/>'; }
    svg += '</g>';
    if (i % 5 === 4 || i === N - 1) {
      svg += '<text x="' + (x + bw / 2) + '" y="' + (H - 6) + '" fill="#9ca3af" text-anchor="middle">' +
        k.split('-').reverse().slice(0, 2).join('/') + '</text>';
    }
  });
  svg += '</svg>';
  $('chart').innerHTML = svg;   // ne contient que des nombres et des dates : pas de texte venant des joueurs
}

// ---------------------------------------------------------------- tableau
const COLS = [
  { key: 'rank',    label: '#',              cls: 'l', sortable: false },
  { key: 'pseudo',  label: 'Joueur',         cls: 'l' },
  { key: 'opens',   label: 'Boosters' },
  { key: 'today',   label: 'Aujourd\'hui' },
  { key: 'c', label: 'C', color: RAR.c[1] }, { key: 'u', label: 'U', color: RAR.u[1] },
  { key: 'r', label: 'R', color: RAR.r[1] }, { key: 'e', label: 'E', color: RAR.e[1] },
  { key: 'l', label: 'L', color: RAR.l[1] }, { key: 'm', label: 'M', color: RAR.m[1] },
  { key: 'rateM',   label: '1 M tous les' },
  { key: 'since_mythic', label: 'Sans M depuis' },
  { key: 'nouvelles', label: 'Nouvelles' },
  { key: 'updated_at', label: 'Dernière activité' },
];

function rows() {
  const today = dayKey();
  const todayBy = {};
  days.forEach(d => { if (d.day === today) todayBy[d.player_id] = d.opens; });
  return players.map(p => Object.assign({}, p, {
    today: todayBy[p.id] || 0,
    rateM: p.m ? p.opens / p.m : Infinity,
  }));
}

function renderTable() {
  const data = rows();
  data.sort((a, b) => {
    let x = a[sortKey], y = b[sortKey];
    if (sortKey === 'pseudo') return sortDir * String(x).localeCompare(String(y), 'fr');
    if (sortKey === 'updated_at') { x = new Date(x).getTime(); y = new Date(y).getTime(); }
    if (x === y) return b.opens - a.opens;
    return sortDir * (x > y ? 1 : -1);
  });

  const table = $('table');
  table.innerHTML = '';
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  COLS.forEach(c => {
    const th = document.createElement('th');
    th.textContent = c.label + (sortKey === c.key ? (sortDir < 0 ? ' ▼' : ' ▲') : '');
    if (c.cls) th.className = c.cls;
    if (sortKey === c.key) th.classList.add('sorted');
    if (c.color) th.style.color = c.color;
    if (c.sortable !== false) {
      th.onclick = () => {
        if (sortKey === c.key) sortDir = -sortDir;
        else { sortKey = c.key; sortDir = (c.key === 'pseudo' || c.key === 'rateM') ? 1 : -1; }
        renderTable();
      };
    }
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  data.forEach((p, i) => {
    const tr = document.createElement('tr');
    if (p.id === myId) tr.className = 'me';
    const online = Date.now() - new Date(p.updated_at).getTime() < 15 * 60e3;
    const cell = (text, cls, color) => {
      const td = document.createElement('td');
      td.textContent = text;
      if (cls) td.className = cls;
      if (color) td.style.color = color;
      tr.appendChild(td);
      return td;
    };
    cell(String(i + 1), 'l muted');
    const name = cell('', 'l');
    const dot = document.createElement('span'); dot.className = 'dot' + (online ? ' on' : '');
    let label = document.createTextNode(p.pseudo);
    if (p.kyara_id && /^[0-9a-fA-F-]{8,64}$/.test(p.kyara_id)) {
      label = document.createElement('a');
      label.href = 'https://kyara.games/profil/' + p.kyara_id;
      label.target = '_blank';
      label.rel = 'noopener';
      label.style.color = 'inherit';
      label.textContent = p.pseudo;
    }
    name.append(dot, label, document.createTextNode(p.id === myId ? ' (toi)' : ''));
    cell(fmt(p.opens));
    cell(fmt(p.today));
    ['c', 'u', 'r', 'e', 'l', 'm'].forEach(k => cell(fmt(p[k]), '', p[k] ? RAR[k][1] : '#4b5563'));
    cell(isFinite(p.rateM) ? fmt(Math.round(p.rateM)) + ' boosters' : '—');
    cell(fmt(p.since_mythic) + ' boosters');
    cell(fmt(p.nouvelles));
    cell(ago(p.updated_at), 'muted');
    tbody.appendChild(tr);
  });
  if (!data.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = COLS.length; td.className = 'l muted';
    td.textContent = 'Aucun joueur pour l\'instant. Ouvre kyara.games avec l\'extension active pour apparaître ici.';
    tr.appendChild(td); tbody.appendChild(tr);
  }
  table.appendChild(tbody);
}

// ---------------------------------------------------------------- mythiques par joueur
function renderMythChart() {
  const root = $('mythChart');
  root.innerHTML = '';
  const list = players.filter(p => p.m > 0).sort((a, b) => b.m - a.m || a.opens - b.opens).slice(0, 25);
  if (!list.length) {
    const d = document.createElement('div');
    d.className = 'muted';
    d.textContent = 'Personne n\'a encore tiré de Mythique.';
    root.appendChild(d);
    return;
  }
  const max = list[0].m;
  list.forEach(p => {
    const row = document.createElement('div');
    row.className = 'bar-row' + (p.id === myId ? ' me' : '');
    const who = document.createElement('div');
    who.className = 'who';
    who.textContent = p.pseudo;
    who.title = p.pseudo + ' : ' + p.m + ' Mythique(s) en ' + fmt(p.opens) + ' boosters';
    const track = document.createElement('div');
    track.className = 'track';
    const fill = document.createElement('div');
    fill.className = 'fill';
    fill.style.width = (p.m / max * 100) + '%';
    track.appendChild(fill);
    const val = document.createElement('div');
    val.className = 'val';
    val.textContent = p.m;
    row.append(who, track, val);
    root.appendChild(row);
  });
}

// ---------------------------------------------------------------- cartes les plus chères
const RARITY_COLOR = { C: '#9ca3af', U: '#22c55e', R: '#3b82f6', E: '#a855f7', L: '#facc15', M: '#ef4444' };
const SAFE_IMG = /^https:\/\/s4\.anilist\.co\/[A-Za-z0-9/_.-]+$/;

function cardEl(c, owner) {
  const el = document.createElement('a');
  el.className = 'tc';
  el.href = 'https://kyara.games/wiki/' + (Number(c.id) || 0);
  el.target = '_blank';
  el.rel = 'noopener';
  el.style.borderColor = RARITY_COLOR[c.rarity] || '#374151';
  if (c.image && SAFE_IMG.test(c.image)) {
    const img = document.createElement('img');
    img.src = c.image; img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
    el.appendChild(img);
  } else {
    const ph = document.createElement('div'); ph.className = 'ph'; el.appendChild(ph);
  }
  const info = document.createElement('div'); info.className = 'info';
  const name = document.createElement('div'); name.className = 'nm'; name.textContent = c.name || '?';
  const price = document.createElement('div'); price.className = 'pr';
  const r = document.createElement('span'); r.textContent = c.rarity || '?'; r.style.color = RARITY_COLOR[c.rarity] || '#9ca3af';
  price.append(r, document.createTextNode(' · ' + (c.price ? fmt(c.price) + ' ◆' : 'cote inconnue')));
  info.append(name, price);
  if (owner) { const o = document.createElement('div'); o.className = 'ow'; o.textContent = owner; info.appendChild(o); }
  el.appendChild(info);
  el.title = (c.name || '') + (c.series ? ' — ' + c.series : '') + (c.price ? ' · cote ' + c.price + ' ◆' : '');
  return el;
}

function renderTopCards() {
  // Top général
  const all = [];
  players.forEach(p => (Array.isArray(p.top_cards) ? p.top_cards : []).forEach(c => all.push({ c, p })));
  all.sort((a, b) => (b.c.price || 0) - (a.c.price || 0));
  const g = $('topGlobal'); g.innerHTML = '';
  const root = $('topByPlayer'); root.innerHTML = '';
  all.slice(0, 12).forEach(({ c, p }) => g.appendChild(cardEl(c, p.pseudo)));
  if (!all.length) { g.className = 'muted'; g.textContent = 'Aucune carte enregistrée pour l\'instant (il faut l\'extension v0.10).'; return; }
  g.className = 'tc-grid';

  // Par joueur
  players
    .filter(p => Array.isArray(p.top_cards) && p.top_cards.length)
    .sort((a, b) => (b.top_cards[0].price || 0) - (a.top_cards[0].price || 0))
    .forEach(p => {
      const box = document.createElement('div');
      box.className = 'pl' + (p.id === myId ? ' me' : '');
      const h = document.createElement('div'); h.className = 'pl-h';
      const n = document.createElement('b'); n.textContent = p.pseudo;
      const tot = p.top_cards.reduce((a, c) => a + (c.price || 0), 0);
      const s = document.createElement('span'); s.className = 'muted'; s.textContent = ' · top ' + p.top_cards.length + ' : ' + fmt(tot) + ' ◆';
      h.append(n, s);
      const row = document.createElement('div'); row.className = 'tc-row';
      p.top_cards.forEach(c => row.appendChild(cardEl(c)));
      box.append(h, row);
      root.appendChild(box);
    });
}

function render() { renderCards(); renderChart(); renderMythChart(); renderTopCards(); renderTable(); }

$('refresh').onclick = load;
// Ta ligne : l'extension ouvre le dashboard avec #me=<identifiant> dans l'adresse.
const m = /[#&]me=([0-9a-fA-F-]{36})/.exec(location.hash);
if (m) {
  myId = m[1];
  try { localStorage.setItem('kyara_dash_me', myId); } catch (e) { /* ignore */ }
} else {
  try { myId = localStorage.getItem('kyara_dash_me'); } catch (e) { /* ignore */ }
}
load();
setInterval(load, 60000);
