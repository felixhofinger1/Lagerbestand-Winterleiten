const searchInput = document.getElementById('search');
if (searchInput) {
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase().trim();
    document.querySelectorAll('.item-card').forEach(card => {
      const text = card.dataset.search || '';
      card.style.display = !q || text.includes(q) ? '' : 'none';
    });
  });
  searchInput.focus();
}
