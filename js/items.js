// ── DETAIL ───────────────────────────────────────────────
async function showDetail(id) {
  showView('detail');
  document.getElementById('detail-back').onclick = showOverview;
  const wrap = document.getElementById('detail-body');
  wrap.innerHTML = '<div class="loading"><div class="spinner"></div>Lade…</div>';
  const { data: item, error } = await sb.from('items').select('*').eq('id', id).single();
  if (error || !item) { wrap.innerHTML = '<div class="loading">Nicht gefunden.</div>'; return; }
  const date = new Date(item.created_at).toLocaleDateString('de-AT');

  const defectBtn = item.is_defective
    ? `<button class="btn btn-ok" onclick="toggleDefect(${id}, false)">✓ In Ordnung</button>`
    : `<button class="btn btn-danger" onclick="toggleDefect(${id}, true)">⚠ Defekt melden</button>`;

  const lendSection = item.lent_to
    ? `<button class="btn btn-ghost" onclick="returnItem(${id})">📥 Zurück erhalten</button>`
    : `<div class="lend-form">
         <input class="lend-input" id="lend-name-${id}" type="text" placeholder="An wen verleihen?">
         <input class="lend-input lend-date" id="lend-due-${id}" type="date" title="Zurück bis (optional)">
         <button class="btn btn-ghost" onclick="lendItem(${id})">📤 Verleihen</button>
       </div>`;

  wrap.innerHTML = `
    <div class="detail-layout">
      <div>
        <div id="photo-slider-${id}" class="photo-slider"><div class="photo-slide-empty">🔧</div></div>
      </div>
      <div>
        <div class="item-title">${esc(item.name)}</div>
        ${item.is_defective ? `<div class="status-box status-box-defect"><div class="status-box-icon">⚠️</div><div class="status-box-text"><strong>Als defekt markiert</strong><small>Bitte prüfen oder reparieren lassen</small></div></div>` : ''}
        ${item.lent_to ? `<div class="status-box status-box-lent"><div class="status-box-icon">📤</div><div class="status-box-text"><strong>Verliehen an ${esc(item.lent_to)}</strong><small>Seit ${new Date(item.lent_at).toLocaleDateString('de-AT')}${item.due_date ? ' · Fällig: '+new Date(item.due_date).toLocaleDateString('de-AT') : ''}</small></div></div>` : ''}
        ${item.category ? `<div class="info-block"><div class="info-label">Kategorie</div><div class="info-value"><span class="badge badge-category">${esc(item.category)}</span></div></div>` : ''}
        ${item.description ? `<div class="info-block"><div class="info-label">Beschreibung</div><div class="info-value">${esc(item.description)}</div></div>` : ''}
        ${item.location ? `<div class="info-block"><div class="info-label">Aufbewahrungsort</div><div class="info-value">📍 ${esc(item.location)}</div></div>` : ''}
        ${(item.room||item.shelf||item.box) ? `<div class="info-block"><div class="info-label">Strukturierter Ort</div><div class="info-value">${[item.room,item.shelf,item.box].filter(Boolean).map(esc).join(' › ')}</div></div>` : ''}
        ${item.quantity ? `<div class="info-block"><div class="info-label">Menge / Anzahl</div><div class="info-value">${esc(item.quantity)}</div></div>` : ''}
        <div class="info-block"><div class="info-label">Erfasst am</div><div class="info-value">${date}</div></div>
        <div class="detail-actions">
          <button class="btn btn-primary" onclick="setHash('edit/${id}')">Bearbeiten</button>
          <button class="btn btn-outline" onclick="setHash('print/${id}')">QR-Etikett</button>
          ${defectBtn}
          <button class="btn btn-danger" onclick="deleteItem(${id})">Löschen</button>
        </div>
        ${lendSection}
      </div>
    </div>
    <div id="detail-history-${id}"></div>`;

  loadPhotos(id);
  loadMaintenance(id);
  loadComments(id);
}

// ── PHOTOS (Slider) ──────────────────────────────────────
let currentPhotoIndex = 0;
let currentPhotos = [];

async function loadPhotos(itemId) {
  const { data } = await sb.from('item_photos').select('*').eq('item_id', itemId).order('position');
  currentPhotos = data || [];
  currentPhotoIndex = 0;
  renderSlider(itemId);
}

function renderSlider(itemId) {
  const wrap = document.getElementById('photo-slider-' + itemId);
  if (!wrap) return;
  if (!currentPhotos.length) {
    wrap.innerHTML = '<div class="photo-slide-empty">🔧</div>';
    return;
  }
  const photo = currentPhotos[currentPhotoIndex];
  wrap.innerHTML = `
    <div class="slider-img-wrap">
      <img src="${esc(photo.url)}" alt="" class="slider-img">
      <button class="slider-del" onclick="deletePhoto('${photo.id}', ${itemId})" title="Foto löschen">✕</button>
      ${currentPhotos.length > 1 ? `
        <button class="slider-btn slider-prev" onclick="slidePhoto(${itemId}, -1)">‹</button>
        <button class="slider-btn slider-next" onclick="slidePhoto(${itemId},  1)">›</button>` : ''}
    </div>
    ${currentPhotos.length > 1 ? `<div class="slider-dots">${currentPhotos.map((_,i) =>
      `<span class="dot${i===currentPhotoIndex?' active':''}" onclick="goToPhoto(${itemId},${i})"></span>`).join('')}</div>` : ''}`;
}

function slidePhoto(itemId, dir) {
  currentPhotoIndex = (currentPhotoIndex + dir + currentPhotos.length) % currentPhotos.length;
  renderSlider(itemId);
}

function goToPhoto(itemId, idx) {
  currentPhotoIndex = idx;
  renderSlider(itemId);
}

async function deletePhoto(photoId, itemId) {
  if (!confirm('Foto löschen?')) return;
  const photo = currentPhotos.find(p => p.id === photoId);
  if (photo) { const p = toPath(photo.url); if (p) await sb.storage.from(BUCKET).remove([p]); }
  await sb.from('item_photos').delete().eq('id', photoId);
  currentPhotos = currentPhotos.filter(p => p.id !== photoId);
  currentPhotoIndex = Math.min(currentPhotoIndex, Math.max(0, currentPhotos.length - 1));
  renderSlider(itemId);
  showToast('Foto gelöscht');
}

// ── FORM ─────────────────────────────────────────────────
let editItem = null;
let existingPhotos = [];
let photosToDelete = [];

async function loadCategories() {
  const { data } = await sb.from('items').select('category').not('category','is',null).neq('category','');
  const cats = [...new Set((data||[]).map(r => r.category).filter(Boolean))].sort();
  const dl = document.getElementById('cat-list');
  dl.innerHTML = cats.map(c => `<option value="${esc(c)}">`).join('');
}

async function showForm(id) {
  editItem = null;
  existingPhotos = [];
  photosToDelete = [];
  document.getElementById('item-form').reset();
  document.getElementById('existing-photos-wrap').innerHTML = '';
  document.getElementById('f-id').value = '';
  await loadCategories();

  if (id) {
    showView('form');
    document.getElementById('form-title').textContent = 'Bearbeiten';
    document.getElementById('f-submit').textContent   = 'Speichern';
    document.getElementById('form-back').onclick = () => setHash('detail/' + id);
    document.getElementById('f-cancel').onclick  = () => setHash('detail/' + id);
    const { data: item } = await sb.from('items').select('*').eq('id', id).single();
    if (item) {
      editItem = item;
      document.getElementById('f-id').value       = item.id;
      document.getElementById('f-name').value     = item.name || '';
      document.getElementById('f-category').value = item.category || '';
      document.getElementById('f-desc').value     = item.description || '';
      document.getElementById('f-loc').value      = item.location || '';
      document.getElementById('f-room').value     = item.room || '';
      document.getElementById('f-shelf').value    = item.shelf || '';
      document.getElementById('f-box').value      = item.box || '';
      document.getElementById('f-qty').value      = item.quantity || '';
      const { data: photos } = await sb.from('item_photos').select('*').eq('item_id', id).order('position');
      existingPhotos = photos || [];
      renderExistingPhotos();
    }
  } else {
    showView('form');
    document.getElementById('form-title').textContent = 'Neuer Eintrag';
    document.getElementById('f-submit').textContent   = 'Hinzufügen';
    document.getElementById('form-back').onclick = showOverview;
    document.getElementById('f-cancel').onclick  = showOverview;
  }
}

function renderExistingPhotos() {
  const wrap = document.getElementById('existing-photos-wrap');
  if (!existingPhotos.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = existingPhotos.map(p => `
    <div class="existing-photo" id="ep-${p.id}">
      <img src="${esc(p.url)}" class="current-photo-thumb" alt="">
      <button type="button" class="remove-photo-btn ${photosToDelete.includes(p.id)?'marked':''}"
              onclick="togglePhotoDelete('${p.id}')">
        ${photosToDelete.includes(p.id) ? '↩ Behalten' : '✕ Entfernen'}
      </button>
    </div>`).join('');
}

function togglePhotoDelete(photoId) {
  if (photosToDelete.includes(photoId)) {
    photosToDelete = photosToDelete.filter(id => id !== photoId);
  } else {
    photosToDelete.push(photoId);
  }
  renderExistingPhotos();
}

async function submitForm(e) {
  e.preventDefault();
  const btn = document.getElementById('f-submit');
  let id    = document.getElementById('f-id').value;
  btn.disabled = true; btn.textContent = '…';

  const name        = document.getElementById('f-name').value.trim();
  const category    = document.getElementById('f-category').value.trim() || null;
  const description = document.getElementById('f-desc').value.trim();
  const location    = document.getElementById('f-loc').value.trim();
  const room        = document.getElementById('f-room').value.trim() || null;
  const shelf       = document.getElementById('f-shelf').value.trim() || null;
  const box         = document.getElementById('f-box').value.trim() || null;
  const quantity    = document.getElementById('f-qty').value.trim();
  const files       = document.getElementById('f-photos').files;

  const payload = { name, category, description, location, room, shelf, box, quantity, photo_url: null, updated_at: new Date().toISOString() };
  let error;

  if (id) {
    ({ error } = await sb.from('items').update(payload).eq('id', id));
  } else {
    const { data: newItem, error: insertErr } = await sb.from('items').insert(payload).select('id').single();
    error = insertErr;
    if (!error) id = newItem.id;
  }

  if (error) { btn.disabled = false; btn.textContent = id ? 'Speichern' : 'Hinzufügen'; showToast('Fehler: ' + error.message, true); return; }

  // Delete marked photos
  for (const photoId of photosToDelete) {
    const p = existingPhotos.find(ph => ph.id === photoId);
    if (p) { const path = toPath(p.url); if (path) await sb.storage.from(BUCKET).remove([path]); }
    await sb.from('item_photos').delete().eq('id', photoId);
  }

  // Upload new photos
  const remainingCount = existingPhotos.filter(p => !photosToDelete.includes(p.id)).length;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext  = file.name.split('.').pop().toLowerCase();
    const path = `${Date.now()}-${i}.${ext}`;
    const { error: upErr } = await sb.storage.from(BUCKET).upload(path, file, { upsert: true });
    if (!upErr) {
      const url = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      await sb.from('item_photos').insert({ item_id: id, url, position: remainingCount + i });
    }
  }

  btn.disabled = false; btn.textContent = id ? 'Speichern' : 'Hinzufügen';
  showToast(editItem ? 'Gespeichert!' : 'Hinzugefügt!');
  showOverview();
}

// ── DELETE ───────────────────────────────────────────────
async function deleteItem(id) {
  if (!confirm('Wirklich löschen?')) return;
  const { data: photos } = await sb.from('item_photos').select('url').eq('item_id', id);
  for (const p of (photos || [])) { const path = toPath(p.url); if (path) await sb.storage.from(BUCKET).remove([path]); }
  await sb.from('item_photos').delete().eq('item_id', id);
  const { error } = await sb.from('items').delete().eq('id', id);
  if (error) { showToast('Fehler beim Löschen.', true); return; }
  showToast('Gelöscht.');
  showOverview();
}

// ── QR PRINT ─────────────────────────────────────────────
async function showPrint(id) {
  showView('print');
  document.getElementById('print-back').onclick  = () => setHash('detail/' + id);
  document.getElementById('print-back2').onclick = () => setHash('detail/' + id);
  const { data: item } = await sb.from('items').select('*').eq('id', id).single();
  if (!item) return;
  const base = location.origin + location.pathname;
  const itemUrl = base + '#detail/' + id;
  document.getElementById('print-name').textContent = item.name;
  document.getElementById('print-loc').textContent  = item.location ? '📍 ' + item.location : '';
  document.getElementById('print-url').textContent  = itemUrl;
  const qr = qrcode(0, 'M');
  qr.addData(itemUrl);
  qr.make();
  document.getElementById('qr-container').innerHTML = qr.createImgTag(5, 0);
}
