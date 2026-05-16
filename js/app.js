// ── UTILS ────────────────────────────────────────────────
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function toPath(url) { const m = `/object/public/${BUCKET}/`; const i = url.indexOf(m); return i !== -1 ? url.slice(i + m.length) : null; }

let toastT;
function showToast(msg, err = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (err ? ' err' : '');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('show'), 2500);
}

// ── AUTH ─────────────────────────────────────────────────
async function doLogin() {
  const el = document.getElementById('pw-input');
  const btn = document.querySelector('.login-btn');
  btn.disabled = true; btn.textContent = '…';
  const { error } = await sb.auth.signInWithPassword({ email: 'felix.hofinger@gmx.at', password: el.value });
  btn.disabled = false; btn.textContent = 'Einloggen →';
  if (error) { el.classList.add('error'); setTimeout(() => el.classList.remove('error'), 400); el.value = ''; el.focus(); }
}
document.getElementById('pw-input').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

// ── BOOT ─────────────────────────────────────────────────
function bootApp() {
  document.getElementById('view-login').style.display = 'none';
  document.getElementById('app-nav').style.display    = 'flex';
  document.getElementById('app-main').style.display   = 'block';
  handleHash();
}
sb.auth.onAuthStateChange((_, session) => {
  if (session) bootApp();
  else document.getElementById('pw-input').focus();
});

// ── ROUTING ──────────────────────────────────────────────
window.addEventListener('hashchange', handleHash);
function handleHash() {
  const h = location.hash.slice(1);
  if      (h.startsWith('detail/')) showDetail(+h.slice(7));
  else if (h.startsWith('edit/'))   showForm(+h.slice(5));
  else if (h.startsWith('print/'))  showPrint(+h.slice(6));
  else if (h === 'verliehen')       showVerliehen();
  else if (h === 'print-list')      showPrintList();
  else                              showOverview();
}
function setHash(h) { location.hash = h; }
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + id).classList.add('active');
}

// ── OVERVIEW ─────────────────────────────────────────────
let allItems = [];
let activeCategory = null;
let activeSort = 'newest';

async function showOverview() {
  setHash('');
  showView('overview');
  document.getElementById('search-input').value = '';
  const wrap = document.getElementById('grid-wrap');
  wrap.innerHTML = '<div class="loading"><div class="spinner"></div>Lade…</div>';
  const { data, error } = await sb.from('items').select('*').order('name');
  if (error) { wrap.innerHTML = '<div class="loading">Fehler beim Laden.</div>'; return; }
  allItems = data || [];
  // Load first photo per item for grid thumbnails
  if (allItems.length) {
    const { data: photos } = await sb.from('item_photos')
      .select('item_id, url').order('position');
    const thumbMap = {};
    (photos || []).forEach(p => { if (!thumbMap[p.item_id]) thumbMap[p.item_id] = p.url; });
    allItems.forEach(item => { item._thumb = thumbMap[item.id] || null; });
  }
  activeCategory = null;
  activeSort = 'newest';
  document.getElementById('sort-select').value = 'newest';
  renderStats();
  updateLentBadge();
  renderFilterChips();
  renderGrid(sortItems(allItems));
  setTimeout(() => document.getElementById('search-input').focus(), 80);
}

function renderGrid(items) {
  const wrap = document.getElementById('grid-wrap');
  if (!items.length) {
    wrap.innerHTML = `<div class="empty"><div class="empty-icon">🔧</div><p>Noch keine Gegenstände erfasst.</p><button class="btn btn-primary" onclick="showForm(null)">Ersten Eintrag anlegen</button></div>`;
    return;
  }
  const grid = document.createElement('div');
  grid.className = 'item-grid';
  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.onclick = () => setHash('detail/' + item.id);
    const badges = [
      item.category     ? `<span class="badge badge-category">${esc(item.category)}</span>` : '',
      item.lent_to      ? `<span class="badge badge-lent">Verliehen</span>` : '',
      item.is_defective ? `<span class="badge badge-defect">Defekt</span>` : ''
    ].filter(Boolean).join('');
    card.innerHTML = `
      <div class="item-thumb">${item._thumb ? `<img src="${esc(item._thumb)}" loading="lazy">` : '🔧'}</div>
      <div class="card-body">
        <div class="card-name">${esc(item.name)}</div>
        ${item.location ? `<div class="card-meta">📍 ${esc(item.location)}</div>` : ''}
        ${item.quantity ? `<div class="card-meta">× ${esc(item.quantity)}</div>`  : ''}
        ${badges ? `<div class="card-badges">${badges}</div>` : ''}
      </div>`;
    grid.appendChild(card);
  });
  wrap.innerHTML = '';
  wrap.appendChild(grid);
}

function filterItems() {
  const q = document.getElementById('search-input').value.toLowerCase().trim();
  let items = allItems;
  if (activeCategory) items = items.filter(i => i.category === activeCategory);
  if (q) items = items.filter(i =>
    (i.name+' '+(i.location||'')+' '+(i.category||'')+' '+(i.room||'')+' '+(i.shelf||'')+' '+(i.box||'')).toLowerCase().includes(q)
  );
  renderGrid(sortItems(items));
}

function renderStats() {
  const lent      = allItems.filter(i => i.lent_to).length;
  const defective = allItems.filter(i => i.is_defective).length;
  document.getElementById('stats-total').textContent  = allItems.length;
  document.getElementById('stats-lent').textContent   = lent;
  document.getElementById('stats-defect').textContent = defective;
  document.getElementById('stats-banner').style.display = allItems.length ? 'flex' : 'none';
}

function renderFilterChips() {
  const cats = [...new Set(allItems.map(i => i.category).filter(Boolean))].sort();
  const bar  = document.getElementById('filter-bar');
  const wrap = document.getElementById('filter-chips');
  wrap.innerHTML = '';
  bar.style.display = 'flex';
  if (!cats.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'flex';
  [null, ...cats].forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'chip' + (cat === activeCategory ? ' active' : '');
    btn.textContent = cat || 'Alle';
    btn.onclick = () => { activeCategory = cat; renderFilterChips(); filterItems(); };
    wrap.appendChild(btn);
  });
}

function sortItems(items) {
  const arr = [...items];
  if      (activeSort === 'name-asc')  arr.sort((a, b) => (a.name||'').localeCompare(b.name||'', 'de'));
  else if (activeSort === 'name-desc') arr.sort((a, b) => (b.name||'').localeCompare(a.name||'', 'de'));
  else if (activeSort === 'oldest')    arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  else                                 arr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return arr;
}

function onSortChange() {
  activeSort = document.getElementById('sort-select').value;
  filterItems();
}

function updateLentBadge() {
  const count = allItems.filter(i => i.lent_to).length;
  const btn   = document.getElementById('nav-lent-btn');
  const badge = document.getElementById('nav-lent-badge');
  btn.style.display = count ? 'inline-flex' : 'none';
  badge.textContent = count;
}

// ── CSV EXPORT ───────────────────────────────────────────
function exportCSV() {
  if (!allItems.length) { showToast('Keine Daten — zuerst zur Übersicht navigieren.', true); return; }
  const rows = [['Name','Kategorie','Beschreibung','Ort','Raum','Regal','Box','Menge','Status','Verliehen an','Verliehen seit','Fällig bis','Erstellt am']];
  allItems.forEach(i => {
    const status    = i.lent_to ? 'verliehen' : i.is_defective ? 'defekt' : 'ok';
    const lentSince = i.lent_at  ? new Date(i.lent_at).toLocaleDateString('de-AT')  : '';
    const dueDate   = i.due_date ? new Date(i.due_date).toLocaleDateString('de-AT') : '';
    rows.push([i.name||'', i.category||'', i.description||'', i.location||'',
      i.room||'', i.shelf||'', i.box||'',
      i.quantity!=null?i.quantity:'', status, i.lent_to||'', lentSince, dueDate,
      new Date(i.created_at).toLocaleDateString('de-AT')]);
  });
  const csv  = '﻿' + rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n') + '\r\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `lagerbestand-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Export gestartet ✓');
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
