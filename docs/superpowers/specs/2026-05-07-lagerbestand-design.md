# Lagerbestandsverwaltung — Design-Dokument

**Datum:** 2026-05-07
**Kontext:** Werkstatt und Bauernhof mit vielen Werkzeugen und Utensilien

---

## Ziel

Ein digitaler Katalog, mit dem man auf einen Blick sieht, was vorhanden ist und wo es liegt. Kein komplexes Lagerverwaltungssystem — Fokus auf schnelles Nachschlagen und Finden.

---

## Architektur

**Plattform:** Web-App im lokalen Heimnetz (WLAN)
- Erreichbar von PC, Handy und Tablet ohne Cloud oder externes Konto
- Läuft als Node.js-Prozess auf dem Heim-PC

**Technologie-Stack:**

| Schicht | Technologie |
|---|---|
| Server | Node.js + Express |
| Datenbank | SQLite (einzelne Datei `bestand.db`) |
| Frontend | HTML (EJS-Templates) + CSS + Vanilla JavaScript |
| Fotos | Lokaler Ordner `/fotos` auf dem PC |
| QR-Codes | npm-Paket `qrcode` (serverseitig generiert) |

**Start:** Doppelklick auf `start.bat` — öffnet den Browser automatisch auf `http://localhost:3000`. Der Server erkennt beim Start automatisch die lokale IP-Adresse des PCs und zeigt sie auf der Startseite an. Am Handy/Tablet: QR-Code auf der Startseite scannen (einmalige Einrichtung).

**Datensicherung:** Gesamte App = ein Ordner. Backup = Ordner kopieren (auf externe Festplatte oder USB).

---

## Datenmodell

Tabelle `items`:

| Feld | Typ | Beschreibung |
|---|---|---|
| `id` | INTEGER PRIMARY KEY | Automatisch vergeben |
| `name` | TEXT NOT NULL | z.B. "Kettensäge Stihl MS 250" |
| `description` | TEXT | z.B. "45cm Schwert, benzinbetrieben" |
| `location` | TEXT | z.B. "Werkstatt, Regal links" |
| `quantity` | TEXT | z.B. "1" oder "5 Liter" |
| `photo_path` | TEXT | Pfad zur Fotodatei, optional |
| `created_at` | DATETIME | Automatisch gesetzt |
| `updated_at` | DATETIME | Automatisch bei Änderung gesetzt |

---

## Seiten der App

### 1. Übersicht (`/`)
- Alle Gegenstände als Kacheln oder Liste
- Suchfeld oben: filtert nach Name und Ort (Live-Suche ohne Seitenladen)
- QR-Code der Server-Netzwerkadresse für einmalige Handy-Einrichtung
- Button "Neu hinzufügen"

### 2. Detailansicht (`/items/:id`)
- Foto (falls vorhanden), Name, Beschreibung, Ort, Menge
- Button "Bearbeiten"
- Button "Löschen" (mit Bestätigungsdialog)
- Button "QR-Code drucken"

### 3. QR-Etikett Druckansicht (`/items/:id/print`)
- Druckoptimierte Seite: QR-Code + Name + Ort
- Etikettengröße, zum Ausschneiden und Aufkleben
- QR-Code verlinkt direkt auf die Detailseite des Gegenstands

### 4. Neu hinzufügen (`/items/new`)
- Formular: Name (Pflichtfeld), Beschreibung, Ort, Menge, Foto-Upload
- Foto-Upload funktioniert auch vom Handy (Kamera direkt nutzbar)

### 5. Bearbeiten (`/items/:id/edit`)
- Dasselbe Formular, vorausgefüllt mit bestehenden Daten
- Foto kann ersetzt oder entfernt werden

---

## QR-Code-Integration

- Jeder Gegenstand bekommt eine eindeutige URL: `http://<server-ip>:3000/items/<id>`
- QR-Code wird serverseitig mit dem `qrcode`-Paket generiert und als SVG/PNG ausgeliefert
- Druckansicht zeigt QR-Code + Name auf Etikettengröße
- Workflow: Neuen Gegenstand anlegen → Detailseite → "QR-Code drucken" → ausschneiden → aufkleben

---

## Projektstruktur

```
Lagerbestandsführung/
├── start.bat               # Startet den Server und öffnet den Browser
├── server.js               # Express-Server (Routen, Datenbankzugriff)
├── bestand.db              # SQLite-Datenbank (automatisch erstellt)
├── fotos/                  # Hochgeladene Fotos
├── public/                 # Statische Dateien
│   ├── style.css
│   └── app.js
└── views/                  # HTML-Templates
    ├── index.html
    ├── detail.html
    ├── print.html
    ├── form.html
    └── edit.html
```

---

## Nicht im Scope

- Kategoriesystem (wurde bewusst weggelassen)
- Barcode-Scan bestehender Produktbarcodes
- Mehrbenutzerverwaltung / Login
- Bestandswarnungen bei Mindestmenge
- Cloud-Hosting oder externer Zugriff außerhalb des Heimnetzes
