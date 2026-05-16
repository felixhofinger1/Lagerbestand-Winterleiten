async function showPrintList() {
  showView('print-list');
  const body = document.getElementById('print-list-body');
  body.innerHTML = '<div class="loading"><div class="spinner"></div>Lade…</div>';
  const { data, error } = await sb.from('items').select('*').order('name');
  if (error) { body.innerHTML = '<div class="loading">Fehler beim Laden.</div>'; return; }
  const items = data || [];

  const rows = items.map(i => {
    const status = i.lent_to ? `Verliehen (${esc(i.lent_to)})` : i.is_defective ? 'Defekt' : 'OK';
    const ort    = [i.location, [i.room, i.shelf, i.box].filter(Boolean).join(' › ')].filter(Boolean).join(' · ');
    return `<tr>
      <td>${esc(i.name)}</td>
      <td>${esc(i.category||'')}</td>
      <td>${esc(ort)}</td>
      <td>${esc(i.quantity||'')}</td>
      <td>${status}</td>
    </tr>`;
  }).join('');

  body.innerHTML = `
    <div class="print-list-actions" style="display:flex;gap:.75rem;margin-bottom:1.25rem;align-items:center">
      <div class="print-list-title" style="margin:0">Inventarliste</div>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:.75rem;color:var(--text2)">${new Date().toLocaleDateString('de-AT')} · ${items.length} Einträge</span>
      <div style="flex:1"></div>
      <button class="btn btn-primary" onclick="window.print()">Drucken</button>
    </div>
    <table class="print-list-table">
      <thead><tr><th>Name</th><th>Kategorie</th><th>Ort</th><th>Menge</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}
