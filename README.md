# 🎮 Gacha DB

A multi-game gacha database API built with the MERN stack. Currently supports **Genshin Impact** with plans for HSR, ZZZ, Wuthering Waves, and Arknights: Endfield.

## Features

- RESTful API with filtering, sorting, pagination, and search
- Data for characters, weapons, artifacts, materials, talents, and constellations
- Multi-game architecture — same endpoints, different games
- Auto-seeding from `genshin-db` npm package
- Designed for easy frontend integration

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB (local or [Atlas free tier](https://www.mongodb.com/cloud/atlas))

### Setup

```bash
# Clone and install
git clone <your-repo-url>
cd gacha-db
npm install

# Configure environment
cp .env.example .env
# Edit .env with your MongoDB URI

# Seed the database with Genshin data
npm run seed:genshin

# Start the server
npm run dev
```

### Seed Commands

```bash
npm run seed:genshin          # Upsert (safe — won't delete existing data)
npm run seed:genshin:force    # Drop all Genshin data and re-import
```

## API Reference

Base URL: `http://localhost:5000/api`

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api` | API info and all available routes |
| GET | `/api/:game/characters` | List characters |
| GET | `/api/:game/characters/:name` | Get character by name |
| GET | `/api/:game/weapons` | List weapons |
| GET | `/api/:game/weapons/:name` | Get weapon by name |
| GET | `/api/:game/artifacts` | List artifact sets |
| GET | `/api/:game/materials` | List materials |
| GET | `/api/:game/talents` | List talent sets |
| GET | `/api/:game/constellations` | List constellations |
| GET | `/api/:game/stats` | Collection counts for a game |

Replace `:game` with: `genshin`, `hsr`, `zzz`, `wuwa`, or `endfield`

### Query Parameters

| Param | Example | Description |
|-------|---------|-------------|
| `search` | `?search=hu` | Case-insensitive name search |
| `element` | `?element=Pyro` | Filter by element |
| `weaponType` | `?weaponType=Polearm` | Filter by weapon type |
| `rarity` | `?rarity=5` | Filter by rarity |
| `region` | `?region=Liyue` | Filter by region |
| `sort` | `?sort=-rarity,name` | Sort (prefix `-` for desc) |
| `fields` | `?fields=name,element,rarity` | Select specific fields |
| `page` | `?page=2` | Page number (default: 1) |
| `limit` | `?limit=10` | Results per page (default: 25, max: 100) |

### Example Requests

```bash
# All 5-star Pyro characters
GET /api/genshin/characters?rarity=5&element=Pyro

# Search weapons by name
GET /api/genshin/weapons?search=homa

# All Liyue characters, sorted by name, only name and element fields
GET /api/genshin/characters?region=Liyue&sort=name&fields=name,element,rarity

# Page 2 of materials, 10 per page
GET /api/genshin/materials?page=2&limit=10
```

## Project Structure

```
gacha-db/
├── src/
│   ├── config/
│   │   └── db.js                # MongoDB connection
│   ├── middleware/
│   │   ├── errorHandler.js      # Global error handler
│   │   └── queryBuilder.js      # Filter/sort/paginate middleware
│   ├── models/
│   │   ├── index.js             # Model exports
│   │   ├── Character.js
│   │   ├── Weapon.js
│   │   ├── Artifact.js
│   │   ├── Material.js
│   │   ├── Talent.js
│   │   └── Constellation.js
│   ├── routes/
│   │   ├── index.js             # Main router
│   │   └── resourceRouter.js    # Generic CRUD factory
│   ├── scripts/
│   │   └── seedGenshin.js       # Genshin data importer
│   └── server.js                # Express app entry
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Data Sources

| Game | Source | Status |
|------|--------|--------|
| Genshin Impact | [genshin-db](https://github.com/theBowja/genshin-db) (npm) | ✅ Ready |
| Honkai: Star Rail | Yatta.moe / StarRailData | 🔜 Planned |
| Zenless Zone Zero | Dimbreath/ZenlessData | 🔜 Planned |
| Wuthering Waves | Dimbreath/WutheringData | 🔜 Planned |
| Arknights: Endfield | Community sources (TBD) | 🔜 Planned |

## Updating Data

When a new Genshin patch drops:

```bash
npm update genshin-db        # Pull latest data from npm
npm run seed:genshin          # Upsert new entries into MongoDB
```

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express
- **Database:** MongoDB + Mongoose
- **Data Source:** genshin-db (npm)

## License

MIT
