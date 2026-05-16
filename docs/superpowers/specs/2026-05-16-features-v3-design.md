# Design Spec: Lagerbestandsverwaltung v3

**Datum:** 2026-05-16
**Status:** Approved

## Übersicht

v3 erweitert die bestehende Vanilla-JS/Supabase-App um 7 neue Features und refaktoriert `index.html` in separate JS-Dateien für bessere Wartbarkeit.

---

## Architektur: Dateistruktur

`index.html` wird zur Shell (HTML-Struktur + CSS + `<script>`-Tags). Kein Bundler, kein Build-Schritt — plain `<script src="js/...">` in richtiger Reihenfolge. GitHub Pages deployed unverändert.

```
js/
  config.js     — Supabase-Client (URL, KEY), globale Konstanten
  app.js        — Auth, Routing (handleHash), Übersicht, Filter, Sort, Stats, CSV-Export
  items.js      — Detail-View, Formular (CRUD), Ortsfelder, Foto-Slider, QR-Druck
  lending.js    — Verleih-Flow, Dashboard, Fälligkeitsdatum, Überfällig-Highlight
  history.js    — Wartungslog + Kommentare (beide per-item Verlauf)
  scan.js       — Kamera-QR-Scan (html5-qrcode via CDN)
  print.js      — Druckbare Gesamtliste (#print-list View)
```

---

## Datenbank-Änderungen (Supabase)

### Neue Spalten in `items`

| Spalte     | Typ    | Nullable | Beschreibung                        |
|------------|--------|----------|-------------------------------------|
| `due_date` | date   | ja       | Fälligkeitsdatum beim Verleihen     |
| `room`     | text   | ja       | Raum (strukturierter Ort, Ebene 1)  |
| `shelf`    | text   | ja       | Regal (Ebene 2)                     |
| `box`      | text   | ja       | Kiste / Box (Ebene 3)               |

### Neue Tabellen

```sql
item_photos (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid references items(id) on delete cascade,
  url        text not null,
  position   int default 0,
  created_at timestamptz default now()
)

maintenance_logs (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid references items(id) on delete cascade,
  date       date not null,
  note       text,
  created_at timestamptz default now()
)

item_comments (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid references items(id) on delete cascade,
  text       text not null,
  created_at timestamptz default now()
)
```

RLS-Policies für alle drei Tabellen: identisch mit `items` (authenticated user only, alle CRUD-Operationen erlaubt).

### Migration bestehendes `photo_url`-Feld

Das Feld `photo_url` in `items` bleibt erhalten. Beim ersten Laden der Detailseite eines Gegenstands: falls `photo_url` gesetzt und noch kein Eintrag in `item_photos` existiert → automatisch einen Eintrag anlegen (position=0) und `photo_url` auf null setzen.

---

## Feature-Details

### 1. Fälligkeitsdatum beim Verleihen

- Verleih-Modal erhält optionales Datumsfeld "Zurück bis" (date input)
- Wert wird in `items.due_date` gespeichert, beim Zurückgeben auf null gesetzt
- Im Verleih-Dashboard: überfällige Einträge (due_date < heute) werden orange hinterlegt
- Tages-Zähler wechselt bei Überfälligkeit auf rote Farbe
- Keine Notification, keine Badge-Änderungen

### 2. Wartungshistorie

- Neue Sektion "Wartung" auf der Detailseite, unterhalb der Basis-Infos
- Timeline: Einträge aus `maintenance_logs` für diesen Gegenstand, neueste zuerst
- Jeder Eintrag zeigt: Datum (formatiert) + Notiz
- Kurzformular darunter: Datum-Picker (default = heute) + Textfeld + "Eintragen"-Button
- Kein Bearbeiten/Löschen einzelner Einträge

### 3. Mehrere Fotos pro Gegenstand

- Formular: `<input type="file" multiple accept="image/*">` — mehrere Dateien gleichzeitig wählbar
- Upload: jedes Foto → Supabase Storage `fotos/`-Bucket, Eintrag in `item_photos`
- Detailseite: ein Foto groß dargestellt, ← → Pfeile zum Durchblättern
- Punkt-Indikator (•) zeigt aktuelle Position (z.B. 1/3)
- Erstes Foto (position=0) = Hauptfoto für die Kachel in der Übersicht
- Einzelnes Foto löschen: Papierkorb-Icon im Slider, immer sichtbar für eingeloggten Benutzer — löscht Eintrag aus `item_photos` und Datei aus Storage

### 4. Kommentare / Notizen mit Zeitstempel

- Neue Sektion "Notizen" auf der Detailseite, ganz unten
- Timeline: Einträge aus `item_comments`, neueste zuerst
- Jeder Eintrag zeigt: Datum + Uhrzeit + Text
- Textfeld (mehrzeilig) + "Hinzufügen"-Button
- Kein Bearbeiten, kein Löschen einzelner Einträge

### 5. QR-/Barcode-Scan mit Kamera

- Kamera-Icon-Button in der Nav-Leiste (zwischen Export und +Neu)
- Klick öffnet Modal mit Kamera-Preview (html5-qrcode via CDN)
- Scannt ausschließlich die app-eigenen QR-Labels (`#detail/<id>`)
- Bei Erkennung: Modal schließt, Navigation zu `#detail/<id>`
- Bei unbekanntem Code: kurze Fehlermeldung im Modal
- Kamera-Zugriff nur auf HTTPS (GitHub Pages: kein Problem)

### 6. Strukturierte Orte

- Bestehendes "Ort"-Freitextfeld bleibt unverändert
- Im Formular darunter: drei optionale Felder — Raum, Regal, Box (einfache `<input type="text">`)
- Auf der Detailseite: nur angezeigt wenn mindestens eines der drei Felder befüllt ist
- Anzeige-Format: `Raum › Regal › Box` (leere Ebenen werden ausgelassen)
- In der Übersicht/Suche: Raum/Regal/Box werden in die Live-Suche einbezogen

### 7. Druckbare Gesamtliste

- Neuer Button "Liste drucken" in der Nav (neben CSV-Export)
- Öffnet View `#print-list`
- Tabelle aller Gegenstände (gefiltert nach aktiver Kategorie falls gesetzt): Name, Kategorie, Ort / Raum›Regal›Box, Menge, Status (Verfügbar / Verliehen / Defekt)
- Print-CSS: Nav ausgeblendet, A4-optimiertes Layout, schwarze Schrift auf weiß
- Drucken-Button oben rechts + "← Zurück"-Link

---

## Nicht enthalten in v3

- Offline-Support / Service Worker Caching
- Push-Notifications für Fälligkeitsdaten
- Mehrere Benutzer / Rollen
- Barcode-Erstellung für neue Gegenstände
- Löschen einzelner Kommentare oder Wartungseinträge
