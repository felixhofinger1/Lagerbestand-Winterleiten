let qrScanner = null;

function openScanner() {
  const modal = document.getElementById('scan-modal');
  const errEl = document.getElementById('scan-error');
  modal.style.display = 'flex';
  errEl.style.display = 'none';

  qrScanner = new Html5Qrcode('qr-reader');
  qrScanner.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 240, height: 240 } },
    (decoded) => {
      closeScanner();
      const match = decoded.match(/#detail\/(.+)$/);
      if (match) {
        setHash('detail/' + match[1]);
      } else {
        errEl.style.display = 'block';
      }
    },
    () => {}
  ).catch(() => {
    errEl.textContent = 'Kamera konnte nicht geöffnet werden.';
    errEl.style.display = 'block';
  });
}

function closeScanner() {
  if (qrScanner) {
    qrScanner.stop().catch(() => {});
    qrScanner = null;
  }
  document.getElementById('scan-modal').style.display = 'none';
}
