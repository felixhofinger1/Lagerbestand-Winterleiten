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

// Migrations – laufen nur beim ersten Mal, danach ignoriert
try { db.exec(`ALTER TABLE items ADD COLUMN category TEXT DEFAULT NULL`); } catch(e) {}
try { db.exec(`ALTER TABLE items ADD COLUMN lent_to TEXT DEFAULT NULL`); } catch(e) {}
try { db.exec(`ALTER TABLE items ADD COLUMN lent_at DATETIME DEFAULT NULL`); } catch(e) {}
try { db.exec(`ALTER TABLE items ADD COLUMN is_defective INTEGER DEFAULT 0`); } catch(e) {}

const getAll = () =>
  db.prepare('SELECT * FROM items ORDER BY name ASC').all();

const getById = (id) =>
  db.prepare('SELECT * FROM items WHERE id = ?').get(id);

const getCategories = () =>
  db.prepare(`SELECT DISTINCT category FROM items WHERE category IS NOT NULL AND category != '' ORDER BY category`)
    .all().map(r => r.category);

const create = ({ name, description, location, quantity, photo_path, category }) =>
  db.prepare(`
    INSERT INTO items (name, description, location, quantity, photo_path, category)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, description || '', location || '', quantity || '', photo_path || null, category || null);

const update = (id, { name, description, location, quantity, photo_path, category }) =>
  db.prepare(`
    UPDATE items
    SET name = ?, description = ?, location = ?, quantity = ?,
        photo_path = ?, category = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name, description || '', location || '', quantity || '', photo_path ?? null, category || null, id);

const setLent = (id, lent_to) =>
  db.prepare(`UPDATE items SET lent_to = ?, lent_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(lent_to || null, lent_to ? new Date().toISOString() : null, id);

const setDefective = (id, value) =>
  db.prepare(`UPDATE items SET is_defective = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(value ? 1 : 0, id);

const remove = (id) =>
  db.prepare('DELETE FROM items WHERE id = ?').run(id);

module.exports = { getAll, getById, getCategories, create, update, setLent, setDefective, remove };
