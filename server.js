const express = require('express');
const path = require('path');
const os = require('os');
const fs = require('fs');
const multer = require('multer');
const QRCode = require('qrcode');
const open = require('open');
const db = require('./db');

const PORT = 3000;
const app = express();

function getLocalIP() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /\.(jpg|jpeg|png|gif|webp)$/i.test(file.originalname))
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Overview
app.get('/', async (req, res) => {
  const items = db.getAll();
  const ip = getLocalIP();
  const networkUrl = `http://${ip}:${PORT}`;
  const networkQR = await QRCode.toDataURL(networkUrl, { width: 160 });
  res.render('index', { items, networkUrl, networkQR });
});

// New item form
app.get('/items/new', (req, res) => {
  const categories = db.getCategories();
  res.render('form', { item: null, action: '/items/new', title: 'Neu hinzufügen', categories });
});

app.post('/items/new', upload.single('photo'), (req, res) => {
  const { name, description, location, quantity, category } = req.body;
  const photo_path = req.file ? req.file.filename : null;
  db.create({ name, description, location, quantity, photo_path, category });
  res.redirect('/');
});

// Detail
app.get('/items/:id', (req, res) => {
  const item = db.getById(req.params.id);
  if (!item) return res.status(404).send('Nicht gefunden');
  res.render('detail', { item });
});

// Edit form
app.get('/items/:id/edit', (req, res) => {
  const item = db.getById(req.params.id);
  if (!item) return res.status(404).send('Nicht gefunden');
  const categories = db.getCategories();
  res.render('form', { item, action: `/items/${item.id}/edit`, title: 'Bearbeiten', categories });
});

app.post('/items/:id/edit', upload.single('photo'), (req, res) => {
  const item = db.getById(req.params.id);
  if (!item) return res.status(404).send('Nicht gefunden');
  const { name, description, location, quantity, category } = req.body;
  let photo_path;
  if (req.file) {
    if (item.photo_path) {
      const old = path.join(__dirname, 'uploads', item.photo_path);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    photo_path = req.file.filename;
  } else if (req.body.remove_photo === '1') {
    if (item.photo_path) {
      const old = path.join(__dirname, 'uploads', item.photo_path);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    photo_path = null;
  } else {
    photo_path = item.photo_path;
  }
  db.update(req.params.id, { name, description, location, quantity, photo_path, category });
  res.redirect(`/items/${req.params.id}`);
});

// Delete
app.post('/items/:id/delete', (req, res) => {
  const item = db.getById(req.params.id);
  if (item && item.photo_path) {
    const photoFile = path.join(__dirname, 'uploads', item.photo_path);
    if (fs.existsSync(photoFile)) fs.unlinkSync(photoFile);
  }
  db.remove(req.params.id);
  res.redirect('/');
});

// Verleihen
app.post('/items/:id/lend', (req, res) => {
  const { lent_to } = req.body;
  if (!lent_to || !lent_to.trim()) return res.redirect(`/items/${req.params.id}`);
  db.setLent(req.params.id, lent_to.trim());
  res.redirect(`/items/${req.params.id}`);
});

// Rückgabe
app.post('/items/:id/return', (req, res) => {
  db.setLent(req.params.id, null);
  res.redirect(`/items/${req.params.id}`);
});

// Defekt togglen
app.post('/items/:id/defect', (req, res) => {
  const item = db.getById(req.params.id);
  if (!item) return res.status(404).send('Nicht gefunden');
  db.setDefective(req.params.id, !item.is_defective);
  res.redirect(`/items/${req.params.id}`);
});

// QR print view
app.get('/items/:id/print', async (req, res) => {
  const item = db.getById(req.params.id);
  if (!item) return res.status(404).send('Nicht gefunden');
  const ip = getLocalIP();
  const itemUrl = `http://${ip}:${PORT}/items/${item.id}`;
  const qrDataUrl = await QRCode.toDataURL(itemUrl, { width: 220 });
  res.render('print', { item, qrDataUrl, itemUrl });
});

app.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log(`\nLagerbestandsverwaltung läuft!`);
  console.log(`  Lokal:    http://localhost:${PORT}`);
  console.log(`  Netzwerk: http://${ip}:${PORT}\n`);
  open(`http://localhost:${PORT}`);
});
