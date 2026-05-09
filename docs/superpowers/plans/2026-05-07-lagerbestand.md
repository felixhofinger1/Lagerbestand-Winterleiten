# Lagerbestandsverwaltung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-network web app for cataloging workshop and farm tools, accessible from PC, phone, and tablet via home WiFi.

**Architecture:** Node.js/Express server with SQLite database runs on the home PC. EJS templates render server-side HTML. Multer handles photo uploads. The `qrcode` package generates QR codes for each item and for the server's network URL. `start.bat` launches everything with one double-click.

**Tech Stack:** Node.js, Express 4, better-sqlite3, EJS, Multer, qrcode, open@8

---

## File Map

| File | Responsibility |
|---|---|
| `server.js` | Express app, all routes, IP detection, server start |
| `db.js` | SQLite connection, schema creation, CRUD functions |
| `start.bat` | Launch server and open browser on Windows |
| `public/style.css` | All styles, responsive grid |
| `public/app.js` | Client-side live search |
| `views/partials/header.ejs` | HTML head, nav bar |
| `views/partials/footer.ejs` | Closing tags |
| `views/index.ejs` | Overview: item grid + search + network QR |
| `views/detail.ejs` | Single item: photo, info, edit/delete/print buttons |
| `views/form.ejs` | Shared add/edit form with photo upload |
| `views/print.ejs` | Print-optimised QR label page |
| `uploads/` | Uploaded photos (auto-created) |

---

### Task 1: Project setup

**Files:**
- Create: `package.json`
- Create: `uploads/.gitkeep`
- Create: `.gitignore`

- [ ] **Step 1: Initialize npm project**

```bash
cd "D:/Claude_Projekte/Lagerbestandsführung"
npm init -y
```

Expected: `package.json` created.

- [ ] **Step 2: Install dependencies**

```bash
npm install express better-sqlite3 ejs multer qrcode open@8
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 3: Create folder structure**

```bash
mkdir -p uploads public views/partials
touch uploads/.gitkeep
```

- [ ] **Step 4: Create .gitignore**

Write `.gitignore`:
```
node_modules/
bestand.db
uploads/*
!uploads/.gitkeep
.superpowers/
```

- [ ] **Step 5: Verify Node.js can find all packages**

```bash
node -e "require('express'); require('better-sqlite3'); require('ejs'); require('multer'); require('qrcode'); require('open'); console.log('OK')"
```

Expected output: `OK`

---

### Task 2: Database module

**Files:**
- Create: `db.js`

- [ ] **Step 1: Write db.js**

```javascript
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'bestand.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    location TEXT DEFAULT '',
    quantity TEXT DEFAULT '',
    photo_path TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const getAll = () =>
  db.prepare('SELECT * FROM items ORDER BY name ASC').all();

const getById = (id) =>
  db.prepare('SELECT * FROM items WHERE id = ?').get(id);

const create = ({ name, description, location, quantity, photo_path }) =>
  db.prepare(`
    INSERT INTO items (name, description, location, quantity, photo_path)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, description || '', location || '', quantity || '', photo_path || null);

const update = (id, { name, description, location, quantity, photo_path }) =>
  db.prepare(`
    UPDATE items
    SET name = ?, description = ?, location = ?, quantity = ?,
        photo_path = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name, description || '', location || '', quantity || '', photo_path ?? null, id);

const remove = (id) =>
  db.prepare('DELETE FROM items WHERE id = ?').run(id);

module.exports = { getAll, getById, create, update, remove };
```

- [ ] **Step 2: Verify database creates and CRUD works**

```bash
node -e "
const db = require('./db');
const r = db.create({ name: 'Test', description: 'Desc', location: 'Regal', quantity: '1', photo_path: null });
console.log('created id:', r.lastInsertRowid);
const item = db.getById(r.lastInsertRowid);
console.log('fetched:', item.name);
db.remove(r.lastInsertRowid);
console.log('removed OK');
"
```

Expected output:
```
created id: 1
fetched: Test
removed OK
```

- [ ] **Step 3: Delete bestand.db so it starts fresh**

```bash
rm -f bestand.db
```

---

### Task 3: Server (server.js)

**Files:**
- Create: `server.js`

- [ ] **Step 1: Write server.js**

```javascript
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
  res.render('form', { item: null, action: '/items/new', title: 'Neu hinzufügen' });
});

app.post('/items/new', upload.single('photo'), (req, res) => {
  const { name, description, location, quantity } = req.body;
  const photo_path = req.file ? req.file.filename : null;
  db.create({ name, description, location, quantity, photo_path });
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
  res.render('form', { item, action: `/items/${item.id}/edit`, title: 'Bearbeiten' });
});

app.post('/items/:id/edit', upload.single('photo'), (req, res) => {
  const item = db.getById(req.params.id);
  if (!item) return res.status(404).send('Nicht gefunden');
  const { name, description, location, quantity } = req.body;
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
  db.update(req.params.id, { name, description, location, quantity, photo_path });
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
```

- [ ] **Step 2: Verify server module loads without error**

```bash
node -e "
const express = require('express');
const os = require('os');
const db = require('./db');
console.log('all modules loaded OK');
console.log('items in db:', db.getAll().length);
"
```

Expected output:
```
all modules loaded OK
items in db: 0
```

Note: full server start (with browser opening) is verified in Task 11 after all views exist.

---

### Task 4: start.bat

**Files:**
- Create: `start.bat`

- [ ] **Step 1: Write start.bat**

Write `start.bat` (Windows batch file, CRLF line endings):
```bat
@echo off
cd /d "%~dp0"
echo Lagerbestandsverwaltung wird gestartet...
node server.js
pause
```

- [ ] **Step 2: Verify it is executable by double-clicking (manual test)**

User should be able to double-click `start.bat` from Explorer and see the server start in a terminal window with the browser opening automatically.

---

### Task 5: CSS + layout partials

**Files:**
- Create: `views/partials/header.ejs`
- Create: `views/partials/footer.ejs`
- Create: `public/style.css`

- [ ] **Step 1: Write views/partials/header.ejs**

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= title %> – Lagerbestand</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
<nav>
  <a href="/" class="nav-brand">Lagerbestand</a>
  <a href="/items/new" class="nav-btn">+ Neu</a>
</nav>
<main>
```

- [ ] **Step 2: Write views/partials/footer.ejs**

```html
</main>
<script src="/app.js"></script>
</body>
</html>
```

- [ ] **Step 3: Write public/style.css**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #f5f5f5;
  color: #222;
  min-height: 100vh;
}

/* Nav */
nav {
  background: #1565c0;
  color: white;
  padding: 0 1.5rem;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 100;
}
.nav-brand { color: white; text-decoration: none; font-size: 1.2rem; font-weight: 600; }
.nav-btn {
  background: white;
  color: #1565c0;
  border: none;
  padding: 0.4rem 1rem;
  border-radius: 6px;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
}
.nav-btn:hover { background: #e3f2fd; }

/* Main content */
main { max-width: 1100px; margin: 0 auto; padding: 1.5rem; }

/* Search */
.search-bar {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  align-items: center;
}
.search-bar input {
  flex: 1;
  padding: 0.6rem 1rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
  background: white;
}
.search-bar input:focus { outline: 2px solid #1565c0; border-color: transparent; }

/* Item grid */
.item-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}
.item-card {
  background: white;
  border-radius: 10px;
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  transition: box-shadow 0.15s, transform 0.15s;
  display: flex;
  flex-direction: column;
}
.item-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.14); transform: translateY(-2px); }
.item-card-img {
  width: 100%;
  height: 160px;
  object-fit: cover;
  background: #e8eaf6;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9fa8da;
  font-size: 3rem;
}
.item-card-img img { width: 100%; height: 100%; object-fit: cover; }
.item-card-body { padding: 0.9rem 1rem; }
.item-card-name { font-weight: 600; font-size: 0.95rem; margin-bottom: 0.3rem; }
.item-card-location { font-size: 0.82rem; color: #666; }
.item-card-quantity { font-size: 0.82rem; color: #888; margin-top: 0.15rem; }

.empty-state { text-align: center; padding: 4rem 1rem; color: #999; }
.empty-state p { font-size: 1.1rem; margin-bottom: 1rem; }

/* Network QR section */
.network-section {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  background: white;
  border-radius: 10px;
  padding: 1rem 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.network-section img { width: 80px; height: 80px; }
.network-section-text h3 { font-size: 0.95rem; margin-bottom: 0.25rem; }
.network-section-text p { font-size: 0.85rem; color: #666; }
.network-section-text a { color: #1565c0; }

/* Detail page */
.detail-layout { display: flex; gap: 2rem; flex-wrap: wrap; }
.detail-photo {
  width: 280px;
  flex-shrink: 0;
  border-radius: 10px;
  overflow: hidden;
  background: #e8eaf6;
  height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9fa8da;
  font-size: 5rem;
}
.detail-photo img { width: 100%; height: 100%; object-fit: cover; }
.detail-info { flex: 1; min-width: 240px; }
.detail-info h1 { font-size: 1.5rem; margin-bottom: 1rem; }
.info-row { margin-bottom: 0.75rem; }
.info-label { font-size: 0.78rem; text-transform: uppercase; color: #888; letter-spacing: 0.05em; }
.info-value { font-size: 1rem; margin-top: 0.1rem; }
.detail-actions { display: flex; gap: 0.75rem; margin-top: 1.5rem; flex-wrap: wrap; }

/* Buttons */
.btn {
  padding: 0.55rem 1.2rem;
  border-radius: 7px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  border: none;
  display: inline-block;
}
.btn-primary { background: #1565c0; color: white; }
.btn-primary:hover { background: #0d47a1; }
.btn-secondary { background: #eee; color: #333; }
.btn-secondary:hover { background: #ddd; }
.btn-danger { background: #c62828; color: white; }
.btn-danger:hover { background: #b71c1c; }
.btn-outline { background: transparent; border: 1.5px solid #1565c0; color: #1565c0; }
.btn-outline:hover { background: #e3f2fd; }

/* Form */
.form-card { background: white; border-radius: 10px; padding: 1.5rem; box-shadow: 0 1px 4px rgba(0,0,0,0.08); max-width: 560px; }
.form-card h1 { font-size: 1.3rem; margin-bottom: 1.25rem; }
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; font-size: 0.85rem; color: #555; margin-bottom: 0.3rem; font-weight: 500; }
.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.55rem 0.8rem;
  border: 1px solid #ddd;
  border-radius: 7px;
  font-size: 1rem;
  font-family: inherit;
}
.form-group input:focus,
.form-group textarea:focus { outline: 2px solid #1565c0; border-color: transparent; }
.form-group textarea { min-height: 80px; resize: vertical; }
.form-actions { display: flex; gap: 0.75rem; margin-top: 1.25rem; }

.current-photo { margin-top: 0.5rem; }
.current-photo img { border-radius: 6px; max-height: 120px; }
.remove-photo-label { font-size: 0.85rem; color: #c62828; display: flex; align-items: center; gap: 0.3rem; margin-top: 0.4rem; cursor: pointer; }

/* Page header */
.page-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
.page-header h1 { font-size: 1.3rem; }
.back-link { color: #1565c0; text-decoration: none; font-size: 0.9rem; }
.back-link:hover { text-decoration: underline; }

/* Print page */
@media screen {
  .print-page { max-width: 400px; margin: 2rem auto; background: white; border-radius: 10px; padding: 2rem; box-shadow: 0 2px 12px rgba(0,0,0,0.1); text-align: center; }
  .print-page h2 { margin: 1rem 0 0.25rem; font-size: 1.1rem; }
  .print-page .location { color: #666; font-size: 0.9rem; margin-bottom: 0.5rem; }
  .print-page .url { font-size: 0.7rem; color: #aaa; word-break: break-all; }
  .print-actions { margin-top: 1.5rem; display: flex; gap: 0.75rem; justify-content: center; }
}
@media print {
  nav, .print-actions, .page-header { display: none !important; }
  body { background: white; }
  .print-page { box-shadow: none; padding: 0; max-width: 100%; }
  .print-page h2 { font-size: 1.2rem; }
}

@media (max-width: 600px) {
  .network-section { flex-direction: column; text-align: center; }
  .detail-layout { flex-direction: column; }
  .detail-photo { width: 100%; height: 220px; }
  .item-grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 380px) {
  .item-grid { grid-template-columns: 1fr; }
}
```

---

### Task 6: Overview page

**Files:**
- Create: `views/index.ejs`

- [ ] **Step 1: Write views/index.ejs**

```html
<%- include('partials/header', { title: 'Übersicht' }) %>

<div class="network-section">
  <img src="<%= networkQR %>" alt="Netzwerk QR-Code">
  <div class="network-section-text">
    <h3>Handy-Zugriff einrichten</h3>
    <p>QR-Code mit dem Handy scannen oder diese Adresse eingeben:<br>
    <a href="<%= networkUrl %>"><%= networkUrl %></a></p>
  </div>
</div>

<div class="search-bar">
  <input type="search" id="search" placeholder="Suchen nach Name oder Ort…" autocomplete="off">
</div>

<% if (items.length === 0) { %>
  <div class="empty-state">
    <p>Noch keine Gegenstände erfasst.</p>
    <a href="/items/new" class="btn btn-primary">Ersten Gegenstand hinzufügen</a>
  </div>
<% } else { %>
  <div class="item-grid" id="item-grid">
    <% items.forEach(item => { %>
      <a class="item-card"
         href="/items/<%= item.id %>"
         data-search="<%= (item.name + ' ' + item.location).toLowerCase() %>">
        <div class="item-card-img">
          <% if (item.photo_path) { %>
            <img src="/uploads/<%= item.photo_path %>" alt="<%= item.name %>">
          <% } else { %>
            🔧
          <% } %>
        </div>
        <div class="item-card-body">
          <div class="item-card-name"><%= item.name %></div>
          <% if (item.location) { %>
            <div class="item-card-location">📍 <%= item.location %></div>
          <% } %>
          <% if (item.quantity) { %>
            <div class="item-card-quantity">Menge: <%= item.quantity %></div>
          <% } %>
        </div>
      </a>
    <% }) %>
  </div>
<% } %>

<%- include('partials/footer') %>
```

- [ ] **Step 2: Start server and verify overview renders**

```bash
node server.js &
sleep 2
curl -s http://localhost:3000 | grep -c "item-grid\|empty-state"
kill %1
```

Expected: output is `1` (the element exists).

---

### Task 7: Detail page

**Files:**
- Create: `views/detail.ejs`

- [ ] **Step 1: Write views/detail.ejs**

```html
<%- include('partials/header', { title: item.name }) %>

<div class="page-header">
  <a href="/" class="back-link">← Übersicht</a>
</div>

<div class="detail-layout">
  <div class="detail-photo">
    <% if (item.photo_path) { %>
      <img src="/uploads/<%= item.photo_path %>" alt="<%= item.name %>">
    <% } else { %>
      🔧
    <% } %>
  </div>

  <div class="detail-info">
    <h1><%= item.name %></h1>

    <% if (item.description) { %>
      <div class="info-row">
        <div class="info-label">Beschreibung</div>
        <div class="info-value"><%= item.description %></div>
      </div>
    <% } %>

    <% if (item.location) { %>
      <div class="info-row">
        <div class="info-label">Aufbewahrungsort</div>
        <div class="info-value">📍 <%= item.location %></div>
      </div>
    <% } %>

    <% if (item.quantity) { %>
      <div class="info-row">
        <div class="info-label">Menge / Anzahl</div>
        <div class="info-value"><%= item.quantity %></div>
      </div>
    <% } %>

    <div class="info-row">
      <div class="info-label">Erfasst am</div>
      <div class="info-value"><%= new Date(item.created_at).toLocaleDateString('de-AT') %></div>
    </div>

    <div class="detail-actions">
      <a href="/items/<%= item.id %>/edit" class="btn btn-primary">Bearbeiten</a>
      <a href="/items/<%= item.id %>/print" class="btn btn-outline">QR-Etikett drucken</a>
      <form method="POST" action="/items/<%= item.id %>/delete" onsubmit="return confirm('Wirklich löschen?')">
        <button type="submit" class="btn btn-danger">Löschen</button>
      </form>
    </div>
  </div>
</div>

<%- include('partials/footer') %>
```

- [ ] **Step 2: Add a test item and verify detail page**

```bash
node -e "const db = require('./db'); db.create({ name: 'Testgerät', description: 'Test', location: 'Regal 1', quantity: '1', photo_path: null }); console.log('created');"
node server.js &
sleep 2
curl -s http://localhost:3000/items/1 | grep -c "Testgerät"
kill %1
```

Expected: `1`

---

### Task 8: Add/Edit form

**Files:**
- Create: `views/form.ejs`

- [ ] **Step 1: Write views/form.ejs**

```html
<%- include('partials/header', { title: title }) %>

<div class="page-header">
  <% if (item) { %>
    <a href="/items/<%= item.id %>" class="back-link">← Zurück</a>
  <% } else { %>
    <a href="/" class="back-link">← Übersicht</a>
  <% } %>
  <h1><%= title %></h1>
</div>

<div class="form-card">
  <form method="POST" action="<%= action %>" enctype="multipart/form-data">

    <div class="form-group">
      <label for="name">Name *</label>
      <input type="text" id="name" name="name" required
             value="<%= item ? item.name : '' %>" placeholder="z.B. Kettensäge Stihl MS 250">
    </div>

    <div class="form-group">
      <label for="description">Beschreibung</label>
      <textarea id="description" name="description"
                placeholder="z.B. 45cm Schwert, benzinbetrieben"><%= item ? item.description : '' %></textarea>
    </div>

    <div class="form-group">
      <label for="location">Aufbewahrungsort</label>
      <input type="text" id="location" name="location"
             value="<%= item ? item.location : '' %>" placeholder="z.B. Werkstatt, Regal links">
    </div>

    <div class="form-group">
      <label for="quantity">Menge / Anzahl</label>
      <input type="text" id="quantity" name="quantity"
             value="<%= item ? item.quantity : '' %>" placeholder="z.B. 1 oder 5 Liter">
    </div>

    <div class="form-group">
      <label for="photo">Foto</label>
      <input type="file" id="photo" name="photo" accept="image/*">
      <% if (item && item.photo_path) { %>
        <div class="current-photo">
          <img src="/uploads/<%= item.photo_path %>" alt="Aktuelles Foto">
          <label class="remove-photo-label">
            <input type="checkbox" name="remove_photo" value="1"> Foto entfernen
          </label>
        </div>
      <% } %>
    </div>

    <div class="form-actions">
      <button type="submit" class="btn btn-primary"><%= item ? 'Speichern' : 'Hinzufügen' %></button>
      <% if (item) { %>
        <a href="/items/<%= item.id %>" class="btn btn-secondary">Abbrechen</a>
      <% } else { %>
        <a href="/" class="btn btn-secondary">Abbrechen</a>
      <% } %>
    </div>

  </form>
</div>

<%- include('partials/footer') %>
```

- [ ] **Step 2: Verify add form renders and submission creates item**

```bash
node server.js &
sleep 2
# Check form renders
curl -s http://localhost:3000/items/new | grep -c "form-card"
# Submit a new item (no photo)
curl -s -X POST http://localhost:3000/items/new \
  -d "name=Schleifmaschine&description=Exzenterschleifer&location=Werkstatt+links&quantity=1" \
  -L | grep -c "Schleifmaschine"
kill %1
```

Expected: both commands output `1`.

- [ ] **Step 3: Verify edit form pre-fills and saves**

```bash
node server.js &
sleep 2
# Check edit form has the item's name pre-filled
curl -s http://localhost:3000/items/1/edit | grep -c "Testgerät"
kill %1
```

Expected: `1`

---

### Task 9: QR print view

**Files:**
- Create: `views/print.ejs`

- [ ] **Step 1: Write views/print.ejs**

```html
<%- include('partials/header', { title: 'QR-Etikett: ' + item.name }) %>

<div class="page-header">
  <a href="/items/<%= item.id %>" class="back-link">← Zurück</a>
  <h1>QR-Etikett drucken</h1>
</div>

<div class="print-page">
  <img src="<%= qrDataUrl %>" alt="QR-Code" width="220" height="220">
  <h2><%= item.name %></h2>
  <% if (item.location) { %>
    <p class="location">📍 <%= item.location %></p>
  <% } %>
  <p class="url"><%= itemUrl %></p>

  <div class="print-actions">
    <button onclick="window.print()" class="btn btn-primary">Drucken</button>
    <a href="/items/<%= item.id %>" class="btn btn-secondary">Zurück</a>
  </div>
</div>

<%- include('partials/footer') %>
```

- [ ] **Step 2: Verify print view renders with QR code**

```bash
node server.js &
sleep 2
curl -s http://localhost:3000/items/1/print | grep -c "qrDataUrl\|print-page"
kill %1
```

Expected: `1` (the print-page div is present).

---

### Task 10: Live search (app.js)

**Files:**
- Create: `public/app.js`

- [ ] **Step 1: Write public/app.js**

```javascript
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
```

- [ ] **Step 2: Verify app.js is served**

```bash
node server.js &
sleep 2
curl -s http://localhost:3000/app.js | grep -c "searchInput"
kill %1
```

Expected: `1`

---

### Task 11: End-to-end verification

- [ ] **Step 1: Clean up test data**

```bash
node -e "
const db = require('./db');
db.getAll().forEach(item => db.remove(item.id));
console.log('DB cleared');
"
```

- [ ] **Step 2: Start the server**

```bash
node server.js
```

Expected console output:
```
Lagerbestandsverwaltung läuft!
  Lokal:    http://localhost:3000
  Netzwerk: http://192.168.x.x:3000
```

Browser should open automatically to `http://localhost:3000`.

- [ ] **Step 3: Manual end-to-end checklist**

Run through each of these in the browser:

- [ ] Overview page loads, shows empty state with "Ersten Gegenstand hinzufügen" button
- [ ] Click "+ Neu" — form opens
- [ ] Fill in Name, Ort, Menge — submit — item appears in overview
- [ ] Add a second item with a photo (upload from disk) — photo shows in card
- [ ] Search for the item name — only matching card visible, other hidden
- [ ] Click an item card — detail page opens with all fields and photo
- [ ] Click "QR-Etikett drucken" — print page opens with QR code
- [ ] Click browser's back button — back to detail page
- [ ] Click "Bearbeiten" — form pre-filled
- [ ] Change location — save — detail shows new location
- [ ] Click "Löschen" — confirmation dialog, confirm — back to overview, item gone
- [ ] On phone/tablet: scan the QR code on the overview page — app opens correctly
- [ ] On phone/tablet: add a new item using phone camera for photo

- [ ] **Step 4: Commit everything**

```bash
git init
git add server.js db.js start.bat package.json package-lock.json \
        public/ views/ docs/ .gitignore
git commit -m "feat: initial Lagerbestandsverwaltung app"
```
