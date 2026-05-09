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
