# Big Gacha

A multi-game gacha database with a REST API and React frontend. Currently supports **Genshin Impact** and **Honkai: Star Rail**, with more games planned.

## Prerequisites

- [Node.js 18+](https://nodejs.org/)
- [MongoDB Community Server](https://www.mongodb.com/try/download/community) (local) **or** a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster

### Installing MongoDB locally (Windows)

Open **PowerShell as Administrator** (right-click → Run as Administrator) and run:

```powershell
winget install MongoDB.Server --accept-package-agreements --accept-source-agreements
```

> The installer must run as Administrator — it registers MongoDB as a Windows service. Running without elevation will fail silently with error 1603.

After installation, MongoDB starts automatically. Verify it's running:

```powershell
Get-Service -Name MongoDB
```

If the status is not `Running`, start it:

```powershell
net start MongoDB
```

## Setup

### 1. Clone and install dependencies

```bash
git clone <your-repo-url>
cd big-gacha

# Install backend dependencies
npm install

# Install frontend dependencies
npm install --prefix client
```

### 2. Configure environment

```bash
cp .env.example .env
```

The default `.env` works out of the box for a local MongoDB install:

```
MONGODB_URI=mongodb://localhost:27017/gacha-db
PORT=5000
```

To use Atlas instead, replace `MONGODB_URI` with your Atlas connection string.

### 3. Seed the database

Run the seeders to populate game data. MongoDB must be running before seeding.

```bash
# Genshin Impact
npm run seed:genshin

# Honkai: Star Rail
npm run seed:hsr
```

You should see `MongoDB connected: 127.0.0.1` (not "in-memory") — that confirms data will persist.

### 4. Start the app

```bash
npm run dev:all
```

This starts both servers concurrently:
- **Backend API** → http://localhost:5000
- **Frontend** → http://localhost:3000

---

## Seed Commands

| Command | Description |
|---------|-------------|
| `npm run seed:genshin` | Upsert Genshin data (safe, won't delete existing) |
| `npm run seed:genshin:force` | Drop and re-import all Genshin data |
| `npm run seed:hsr` | Upsert HSR data (safe) |
| `npm run seed:hsr:force` | Drop and re-import all HSR data |

## Updating Data

```bash
# Genshin (pulls from genshin-db npm package)
npm update genshin-db
npm run seed:genshin

# HSR (pulls from Mar-7th/StarRailRes on GitHub)
npm run seed:hsr
```

## Desktop Shortcut (Windows)

Run `Create Shortcut.ps1` once to create a desktop shortcut that launches both servers and opens the browser:

```powershell
# Right-click → "Run with PowerShell"
# or from a PowerShell terminal:
& ".\Create Shortcut.ps1"
```

Then right-click the shortcut on your Desktop and pin it to the taskbar.

---

## API Reference

Base URL: `http://localhost:5000/api`

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api` | API info and available routes |
| GET | `/api/:game/characters` | List characters |
| GET | `/api/:game/characters/:name` | Get character by name |
| GET | `/api/:game/weapons` | List weapons (Genshin) |
| GET | `/api/:game/weapons/:name` | Get weapon by name |
| GET | `/api/:game/artifacts` | List artifact sets (Genshin) |
| GET | `/api/:game/materials` | List materials |
| GET | `/api/:game/talents` | List talent sets (Genshin) |
| GET | `/api/:game/constellations` | List constellations (Genshin) |
| GET | `/api/:game/light-cones` | List light cones (HSR) |
| GET | `/api/:game/relics` | List relic sets (HSR) |
| GET | `/api/:game/traces` | List traces (HSR) |
| GET | `/api/:game/eidolons` | List eidolons (HSR) |
| GET | `/api/:game/stats` | Collection counts for a game |

Replace `:game` with: `genshin` or `hsr`

### Query Parameters

| Param | Example | Description |
|-------|---------|-------------|
| `search` | `?search=hu` | Case-insensitive name search |
| `element` | `?element=Pyro` | Filter by element |
| `rarity` | `?rarity=5` | Filter by rarity |
| `sort` | `?sort=-rarity,name` | Sort (prefix `-` for descending) |
| `fields` | `?fields=name,element,rarity` | Select specific fields |
| `page` | `?page=2` | Page number (default: 1) |
| `limit` | `?limit=10` | Results per page (default: 25, max: 100) |

### Example Requests

```bash
# All 5-star Pyro characters in Genshin
GET /api/genshin/characters?rarity=5&element=Pyro

# HSR characters sorted by version
GET /api/hsr/characters?sort=version

# Search weapons by name
GET /api/genshin/weapons?search=homa
```

---

## Project Structure

```
big-gacha/
├── client/                      # React + Vite frontend (TypeScript)
│   ├── src/
│   │   ├── components/          # Shared UI components
│   │   ├── pages/               # Route-level page components
│   │   ├── hooks/               # Custom React hooks
│   │   └── lib/                 # Utilities
│   └── package.json
├── src/                         # Express backend
│   ├── config/
│   │   └── db.js                # MongoDB connection
│   ├── middleware/
│   │   ├── errorHandler.js
│   │   └── queryBuilder.js      # Filter/sort/paginate middleware
│   ├── models/
│   │   ├── Character.js
│   │   ├── Material.js
│   │   ├── Weapon.js
│   │   ├── Artifact.js
│   │   ├── Talent.js
│   │   ├── Constellation.js
│   │   ├── LightCone.js
│   │   ├── Relic.js
│   │   ├── Trace.js
│   │   ├── Eidolon.js
│   │   └── index.js
│   ├── routes/
│   │   ├── index.js
│   │   └── resourceRouter.js
│   ├── scripts/
│   │   ├── seedGenshin.js
│   │   ├── seedHsr.js
│   │   └── hsrData.js
│   └── server.js
├── Create Shortcut.ps1          # Windows desktop shortcut creator
├── launch.ps1                   # Launches both servers + browser
├── .env.example
└── package.json
```

## Data Sources

| Game | Source | Status |
|------|--------|--------|
| Genshin Impact | [genshin-db](https://github.com/theBowja/genshin-db) (npm) | Ready |
| Honkai: Star Rail | [Mar-7th/StarRailRes](https://github.com/Mar-7th/StarRailRes) (GitHub) | Ready |
| Zenless Zone Zero | — | Planned |
| Wuthering Waves | — | Planned |
| Arknights: Endfield | — | Planned |

## Tech Stack

- **Backend:** Node.js, Express, Mongoose
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, React Router
- **Database:** MongoDB

## License

MIT
