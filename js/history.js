async function loadMaintenance(itemId) {
  const { data } = await sb.from('maintenance_logs')
    .select('*').eq('item_id', itemId).order('date', { ascending: false });
  const wrap = document.getElementById('detail-history-' + itemId);
  if (!wrap) return;

  const section = document.createElement('div');
  section.innerHTML = `
    <div class="section-title">Wartungshistorie</div>
    <div class="timeline" id="maint-timeline-${itemId}">
      ${(data||[]).length ? (data||[]).map(e => `
        <div class="timeline-entry">
          <div class="timeline-meta">${new Date(e.date).toLocaleDateString('de-AT')}</div>
          <div class="timeline-text">${esc(e.note || '–')}</div>
        </div>`).join('') : '<div class="timeline-entry" style="color:var(--text2);font-size:.85rem">Noch keine Einträge.</div>'}
    </div>
    <div class="history-form">
      <input class="history-input" id="maint-date-${itemId}" type="date" value="${new Date().toISOString().slice(0,10)}">
      <input class="history-input" id="maint-note-${itemId}" type="text" placeholder="Notiz (z.B. Kette geölt)">
      <button class="btn btn-ghost" onclick="addMaintenance(${itemId})">Eintragen</button>
    </div>`;
  wrap.appendChild(section);
}

async function addMaintenance(itemId) {
  const date = document.getElementById('maint-date-' + itemId).value;
  const note = document.getElementById('maint-note-' + itemId).value.trim();
  if (!date) return;
  const { error } = await sb.from('maintenance_logs').insert({ item_id: itemId, date, note: note || null });
  if (error) { showToast('Fehler.', true); return; }
  showToast('Wartung eingetragen ✓');
  document.getElementById('maint-note-' + itemId).value = '';
  const wrap = document.getElementById('detail-history-' + itemId);
  if (wrap) wrap.innerHTML = '';
  await loadMaintenance(itemId);
  await loadComments(itemId);
}

async function loadComments(itemId) {
  const { data } = await sb.from('item_comments')
    .select('*').eq('item_id', itemId).order('created_at', { ascending: false });
  const wrap = document.getElementById('detail-history-' + itemId);
  if (!wrap) return;

  const section = document.createElement('div');
  section.innerHTML = `
    <div class="section-title">Notizen</div>
    <div class="timeline" id="comments-timeline-${itemId}">
      ${(data||[]).length ? (data||[]).map(e => `
        <div class="timeline-entry">
          <div class="timeline-meta">${new Date(e.created_at).toLocaleString('de-AT')}</div>
          <div class="timeline-text">${esc(e.text)}</div>
        </div>`).join('') : '<div class="timeline-entry" style="color:var(--text2);font-size:.85rem">Noch keine Notizen.</div>'}
    </div>
    <div class="history-form">
      <input class="history-input" id="comment-text-${itemId}" type="text" placeholder="Notiz hinzufügen…" style="flex:2">
      <button class="btn btn-ghost" onclick="addComment(${itemId})">Hinzufügen</button>
    </div>`;
  wrap.appendChild(section);
}

async function addComment(itemId) {
  const input = document.getElementById('comment-text-' + itemId);
  const text  = input.value.trim();
  if (!text) return;
  const { error } = await sb.from('item_comments').insert({ item_id: itemId, text });
  if (error) { showToast('Fehler.', true); return; }
  showToast('Notiz gespeichert ✓');
  input.value = '';
  const wrap = document.getElementById('detail-history-' + itemId);
  if (wrap) wrap.innerHTML = '';
  await loadMaintenance(itemId);
  await loadComments(itemId);
}
