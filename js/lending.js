// ── LEND / RETURN / DEFECT ───────────────────────────────
async function lendItem(id) {
  const nameInput = document.getElementById('lend-name-' + id);
  const dueInput  = document.getElementById('lend-due-' + id);
  const name = nameInput?.value?.trim();
  if (!name) { nameInput?.focus(); return; }
  const now    = new Date().toISOString();
  const dueVal = dueInput?.value || null;
  const { error } = await sb.from('items').update({ lent_to: name, lent_at: now, due_date: dueVal, updated_at: now }).eq('id', id);
  if (error) { showToast('Fehler beim Verleihen.', true); return; }
  showToast('Verliehen an ' + name);
  const item = allItems.find(i => i.id === id);
  if (item) { item.lent_to = name; item.lent_at = now; item.due_date = dueVal; }
  updateLentBadge();
  showDetail(id);
}

async function returnItem(id) {
  if (!confirm('Als zurückgegeben markieren?')) return;
  const { error } = await sb.from('items').update({ lent_to: null, lent_at: null, due_date: null, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) { showToast('Fehler.', true); return; }
  showToast('Zurück erhalten ✓');
  const item = allItems.find(i => i.id === id);
  if (item) { item.lent_to = null; item.lent_at = null; item.due_date = null; }
  updateLentBadge();
  showDetail(id);
}

async function toggleDefect(id, value) {
  const { error } = await sb.from('items').update({ is_defective: value, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) { showToast('Fehler.', true); return; }
  showToast(value ? 'Als defekt markiert' : 'Als in Ordnung markiert');
  const item = allItems.find(i => i.id === id);
  if (item) item.is_defective = value;
  showDetail(id);
}

// ── VERLEIH DASHBOARD ────────────────────────────────────
async function showVerliehen() {
  showView('verliehen');
  const body = document.getElementById('verliehen-body');
  body.innerHTML = '<div class="loading"><div class="spinner"></div>Lade…</div>';
  const { data, error } = await sb.from('items').select('*').not('lent_to','is',null).order('lent_at');
  if (error) { body.innerHTML = '<div class="loading">Fehler beim Laden.</div>'; return; }
  const items = data || [];
  if (!items.length) {
    body.innerHTML = '<div class="empty"><div class="empty-icon">✓</div><p>Nichts verliehen. Alles da.</p></div>';
    return;
  }
  const now = Date.now();
  body.innerHTML = '';
  items.forEach(item => {
    const days     = item.lent_at ? Math.floor((now - new Date(item.lent_at)) / 86400000) : 0;
    const overdue  = item.due_date && new Date(item.due_date) < new Date();
    const row      = document.createElement('div');
    row.className  = 'lent-row' + (overdue ? ' lent-row-overdue' : '');
    row.innerHTML  = `
      <div class="lent-info">
        <div class="lent-name">${esc(item.name)}</div>
        <div class="lent-meta">Verliehen an: <strong>${esc(item.lent_to)}</strong></div>
        <div class="lent-meta" style="${overdue?'color:var(--danger)':''}">
          Seit ${item.lent_at ? new Date(item.lent_at).toLocaleDateString('de-AT') : '–'} · <span style="${overdue?'color:var(--danger);font-weight:600':''}">${days} ${days===1?'Tag':'Tage'}</span>
          ${item.due_date ? ` · Fällig: ${new Date(item.due_date).toLocaleDateString('de-AT')}` : ''}
          ${overdue ? ' ⚠ Überfällig' : ''}
        </div>
      </div>
      <button class="btn btn-ok">Zurück</button>`;
    row.querySelector('.lent-name').onclick = () => setHash('detail/' + item.id);
    row.querySelector('button').onclick = () => returnItemFromDashboard(item.id);
    body.appendChild(row);
  });
}

async function returnItemFromDashboard(id) {
  if (!confirm('Als zurückgegeben markieren?')) return;
  const { error } = await sb.from('items').update({ lent_to: null, lent_at: null, due_date: null, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) { showToast('Fehler.', true); return; }
  showToast('Zurück erhalten ✓');
  const item = allItems.find(i => i.id === id);
  if (item) { item.lent_to = null; item.lent_at = null; item.due_date = null; }
  updateLentBadge();
  showVerliehen();
}
