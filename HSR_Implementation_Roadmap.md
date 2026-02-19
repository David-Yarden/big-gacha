# Honkai: Star Rail — Big Gacha Implementation Roadmap

**Version:** 1.0
**Reference:** Genshin Impact implementation (fully complete) — mirror that structure with HSR-specific differences noted in each task.
**Goal:** Bring HSR to full feature parity with the Genshin section: characters, light cones, relics, materials, traces, eidolons, material cost calculators, CDN icons, filtering/sorting.

---

## KEY DIFFERENCES FROM GENSHIN

Before starting, internalize these structural differences. Every task below accounts for them.

| Concept | Genshin Impact | Honkai: Star Rail |
|---|---|---|
| Character max level | 90 (+ breakthrough 95/100) | 80 (no breakthrough) |
| Ascension breakpoints | 20/40/50/60/70/80/90 | 20/30/40/50/60/70/80 |
| Ascension phases | 6 phases | 6 phases |
| Classification stat | Element + Weapon Type | Element (Combat Type) + Path |
| "Weapons" | Weapons (Sword, Claymore…) | Light Cones (path-locked) |
| "Artifacts" | Artifacts (5-piece sets) | Relics: Cavern Relics (4-piece) + Planar Ornaments (2-piece) |
| "Talents" | Combat1/2/3 + Passives | Basic ATK (lv1–6), Skill, Ultimate, Talent (lv1–10) + Technique |
| "Constellations" | C1–C6 | Eidolons E1–E6 |
| Weapon refinement | R1–R5 | Superimposition S1–S5 |
| Talent max level (base) | 10 | 10 (Basic ATK: 6) |
| EXP books | Hero's Wit (20k), Adv. Exp (5k), Wanderer's Advice (1k) | Traveler's Guide (20k), Adventure Log (5k), Travel Encounters (1k) |
| EXP to Credit ratio | 1 EXP : 0.2 Credits (1:5) | 1 EXP : 0.1 Credits (1:10) |
| Elements | Pyro, Hydro, Anemo, Electro, Dendro, Cryo, Geo | Physical, Fire, Ice, Lightning, Wind, Quantum, Imaginary |
| Paths (char. class) | — (weapon type serves this role) | The Hunt, Destruction, Erudition, Harmony, Nihility, Preservation, Abundance, Remembrance |
| Traveler equivalent | Aether / Lumine (element variants) | Trailblazer (element variants by story progression) |
| Data npm package | genshin-db | starrail.js (+ Mar-7th/StarRailRes JSON) |
| Image CDN | Enka.network + Yatta.moe | Enka.network (HSR endpoint) + Mar-7th/StarRailRes |

---

## PHASE 0 — RESEARCH & DATA SOURCE SETUP

### HSR-00: Verify and Install Data Source Package

**Difficulty:** Low | **Priority:** Critical — blocks everything else

The Genshin seeding uses the `genshin-db` npm package. HSR has no direct equivalent with the same API shape, so the approach is different.

**Recommended stack:**
- **`starrail.js`** npm package (`npm install starrail.js`) — wraps the MiHoMo/Enka.Network API and exposes all characters and light cones. Provides cached static game data from `Dimbreath/StarRailData`.
- **`Mar-7th/StarRailRes`** GitHub repo — provides ready-to-consume JSON files for all game entities. Files can be fetched from raw GitHub URLs at seed time, or the repo can be added as a dependency. Key files:
  - `en/characters.json` — character list (id, name, rarity, path, element)
  - `en/character_ranks.json` — eidolons (E1–E6) per character
  - `en/character_skills.json` — skill descriptions
  - `en/character_skill_trees.json` — trace/stat-node data
  - `en/character_promotions.json` — ascension costs per phase
  - `en/light_cones.json` — light cone list
  - `en/light_cone_ranks.json` — superimposition descriptions
  - `en/light_cone_promotions.json` — light cone ascension costs
  - `en/relics.json` — relic piece info
  - `en/relic_sets.json` — 2pc/4pc set bonuses
  - `en/items.json` — materials/items

**Decision to make before coding:** Choose between:
1. Fetching JSON from `Mar-7th/StarRailRes` raw GitHub URLs (simpler, no npm install, consistent with having a seeding script)
2. Using `starrail.js` to pull data programmatically (more structured but different API shape from genshin-db)

**Recommended:** Fetch from `Mar-7th/StarRailRes` raw URLs (same pattern as how genshin-db internally works — it bundles game JSON). Create a thin helper in `seedHsr.js` to fetch from those URLs.

**Base raw URL:** `https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/`

---

### HSR-01: Document Image CDN URLs

**Difficulty:** Low | **Priority:** Critical

HSR images are served by:
- **Enka.Network HSR endpoint:** `https://enka.network/ui/hsr/{filename}.png`
- **Mar-7th/StarRailRes icon files:** `https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/icon/{category}/{filename}.png`
  - Character icons: `icon/character/{id}.png`
  - Character splash: `icon/character/{id}_full.png` (if available)
  - Light Cone icons: `icon/light_cone/{id}.png`
  - Relic icons: `icon/relic/{id}.png`
  - Path icons: `icon/path/{PathName}.png`
  - Element icons: `icon/element/{ElementName}.png`
  - Skill icons: `icon/skill/{skill_id}.png`
  - Stat icons: `icon/property/{stat_key}.png`

Verify all URL patterns actually resolve for a sample of characters before writing image utility functions.

---

## PHASE 1 — BACKEND: DATA MODELS

All existing Mongoose models already have a `game` enum that includes `"hsr"`. The existing models (Character, Weapon, Artifact, Talent, Constellation, Material) were built for Genshin and store Genshin-shaped data. For HSR:

**Option A (recommended):** Create new HSR-specific models (`LightCone.js`, `Relic.js`, `Trace.js`, `Eidolon.js`) in `src/models/` with HSR field names. Keep Genshin models unchanged.

**Option B:** Extend existing models with optional HSR fields (messier, not recommended).

Proceed with Option A.

---

### HSR-10: Create LightCone Model

**Difficulty:** Low | **Priority:** High
**Genshin equivalent:** `Weapon.js`

```js
// src/models/LightCone.js
{
  game: "hsr",
  sourceId: Number,          // game's internal numeric ID
  name: String,
  description: String,
  path: String,              // The Hunt, Destruction, Erudition, etc.
  rarity: Number,            // 3, 4, or 5
  baseHp: Number,
  baseAtk: Number,
  baseDef: Number,
  effectName: String,        // passive effect name
  effectTemplateRaw: String, // template string with {0}, {1} placeholders
  version: String,
  stats: {                   // pre-computed per level (1–80)
    type: Map,               // level (string) → { hp, atk, def }
  },
  superimpositions: [        // S1–S5
    { description: String, values: [String] }
  ],
  costs: {                   // ascension costs
    ascend1: [{ id, name, count }],
    ascend2: [...],
    ascend3: [...],
    ascend4: [...],
    ascend5: [...],
    ascend6: [...],
  },
  images: { icon: String, ... },
}
```

Key differences from Weapon:
- Three base stats (hp, atk, def) instead of one (atk)
- No `weaponType` — uses `path` instead
- `superimpositions` instead of `refinements`

---

### HSR-11: Create Relic Model

**Difficulty:** Low | **Priority:** High
**Genshin equivalent:** `Artifact.js`

```js
// src/models/Relic.js
{
  game: "hsr",
  sourceId: Number,
  name: String,              // set name
  type: String,              // "cavern" | "planar"
  rarity: [Number],          // [2, 3, 4, 5] or [5] for top-tier
  twoPieceBonus: String,
  fourPieceBonus: String,    // null for Planar Ornaments (2-piece only)
  version: String,
  pieces: {
    // Cavern Relics (4-piece):
    head:   { name, description },
    hands:  { name, description },
    body:   { name, description },
    feet:   { name, description },
    // Planar Ornaments (2-piece only):
    sphere: { name, description },
    rope:   { name, description },
  },
  images: { icon: String, ... },
}
```

Key differences from Artifact:
- Two relic types: Cavern Relics (4-piece: head/hands/body/feet) vs Planar Ornaments (2-piece: sphere/rope)
- Planar Ornaments have no fourPieceBonus

---

### HSR-12: Create Trace Model

**Difficulty:** Medium | **Priority:** High
**Genshin equivalent:** `Talent.js`

Traces are more complex than Genshin talents — they include a skill tree with stat bonus nodes alongside active skills.

```js
// src/models/Trace.js
{
  game: "hsr",
  name: String,              // character name (FK)
  basicAtk: {
    name: String,
    description: String,
    maxLevel: 6,
    attributes: { labels: [...], parameters: {...} }
  },
  skill: {
    name: String,
    description: String,
    maxLevel: 10,
    attributes: { labels: [...], parameters: {...} }
  },
  ultimate: {
    name: String,
    description: String,
    maxLevel: 10,
    attributes: { labels: [...], parameters: {...} }
  },
  talent: {                  // passive, scales with level
    name: String,
    description: String,
    maxLevel: 10,
    attributes: { labels: [...], parameters: {...} }
  },
  technique: {               // fixed passive, no levels
    name: String,
    description: String,
  },
  statBonuses: [             // A2, A4, A6 nodes unlocked at ascension
    { stat: String, value: Number, unlockPhase: Number }
  ],
  costs: {
    // Keyed by skill type + level: "basicAtk_lvl2", "skill_lvl2", etc.
    // Or flat: "lvl2".."lvl10" like Genshin (verify from data source)
  },
  images: {
    basicAtk: String,
    skill: String,
    ultimate: String,
    talent: String,
    technique: String,
  },
  isTraveler: Boolean,
  elementVariants: { ... }   // same pattern as Genshin Travelers
}
```

---

### HSR-13: Create Eidolon Model

**Difficulty:** Low | **Priority:** Medium
**Genshin equivalent:** `Constellation.js`

```js
// src/models/Eidolon.js
{
  game: "hsr",
  name: String,              // character name (FK)
  e1: { name: String, description: String },
  e2: { name: String, description: String },
  e3: { name: String, description: String },
  e4: { name: String, description: String },
  e5: { name: String, description: String },
  e6: { name: String, description: String },
  images: { e1: String, ..., e6: String },
  isTraveler: Boolean,
  elementVariants: { ... }
}
```

---

### HSR-14: Update Character Model for HSR

**Difficulty:** Low | **Priority:** High

The existing `Character.js` model is mostly compatible. Fields that differ:
- `element` — use Combat Type (Physical, Fire, Ice, Lightning, Wind, Quantum, Imaginary)
- `weaponType` — replace/supplement with `path` (The Hunt, Destruction, etc.)
- `stats` — same structure (hp, atk, def + specialized), but `specialized` is SPD for HSR characters; levels go 1–80 not 1–90
- `costs` — same structure (ascend1–ascend6), different item IDs
- `substatType` / `substatText` — use SPD or Energy Regen Rate etc.

Add `path` field to the existing Character schema (it's already flexible via loose schema). Seed it with HSR characters using `game: "hsr"`.

---

### HSR-15: Register HSR Models in Routes

**Difficulty:** Low | **Priority:** High

In `src/routes/index.js`, register the new model types for `game === "hsr"`:
- `/api/hsr/lightcones` → LightCone model
- `/api/hsr/relics` → Relic model
- `/api/hsr/traces/:name` → Trace model
- `/api/hsr/eidolons/:name` → Eidolon model
- `/api/hsr/characters` → Character model (same as Genshin, filtered by game)
- `/api/hsr/materials` → Material model (same as Genshin, filtered by game)

The generic `resourceRouter.js` should handle filtering automatically. Verify `path` field is whitelisted for filtering in `queryBuilder.js`.

---

### HSR-16: Update queryBuilder for HSR Fields

**Difficulty:** Low | **Priority:** Medium

In `src/middleware/queryBuilder.js`, ensure `path` is treated as a string filter (same as `element`, `weaponType`). No numeric casting needed. Verify no field conflicts.

---

## PHASE 2 — BACKEND: SEEDING SCRIPT

### HSR-20: Create seedHsr.js

**Difficulty:** High | **Priority:** Critical
**Genshin equivalent:** `src/scripts/seedGenshin.js`

Create `src/scripts/seedHsr.js`. Follow the same structure: connect to MongoDB, fetch data, upsert records.

**Data fetching pattern:**
```js
const BASE = "https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/";
async function fetchJson(path) {
  const res = await fetch(BASE + path);
  return res.json();
}
// Usage:
const characters = await fetchJson("index_new/en/characters.json");
const promotions = await fetchJson("index_new/en/character_promotions.json");
```

**Seed order:**
1. Materials (items.json) — no dependencies
2. Characters — with pre-computed stats for all 80 levels
3. Traces — after characters (FK by name)
4. Eidolons — after characters
5. Light Cones — with pre-computed stats for all 80 levels
6. Relics — relic_sets.json for bonuses, relics.json for pieces

**Character stat pre-computation:**
- Look up base stats + growth curves from `character_promotions.json`
- For each level 1–80, compute hp/atk/def/spd using the same formula as Genshin (base + growth * level + ascension bonus)
- Store as `stats: { "1": {...}, "2": {...}, ..., "80": {...} }`

**Trailblazer handling:**
- Trailblazer has element variants (Fire, Ice, Imaginary, Remembrance, etc.) — same `isTraveler: true` + `elementVariants` pattern as Genshin's Aether/Lumine

**Add npm scripts to root package.json:**
```json
"seed:hsr":        "node src/scripts/seedHsr.js",
"seed:hsr:force":  "FORCE=true node src/scripts/seedHsr.js"
```

---

## PHASE 3 — FRONTEND: TYPES & CONSTANTS

### HSR-30: Add HSR Types to types.ts

**Difficulty:** Low | **Priority:** High

Add interfaces for:
```ts
// Light Cone (parallel to Weapon)
interface LightCone {
  _id: string;
  sourceId?: number;
  name: string;
  description?: string;
  path?: string;
  rarity: number;
  baseHp?: number;
  baseAtk?: number;
  baseDef?: number;
  effectName?: string;
  effectTemplateRaw?: string;
  version?: string;
  stats?: Record<string, { hp: number; atk: number; def: number }>;
  superimpositions?: Array<{ description?: string; values?: string[] }>;
  costs?: Record<string, MaterialCostEntry[]>;
  images?: Record<string, string>;
}

// Relic (parallel to Artifact)
interface Relic {
  _id: string;
  name: string;
  type?: "cavern" | "planar";
  rarity?: number[];
  twoPieceBonus?: string;
  fourPieceBonus?: string;
  version?: string;
  pieces?: {
    head?:   { name?: string; description?: string };
    hands?:  { name?: string; description?: string };
    body?:   { name?: string; description?: string };
    feet?:   { name?: string; description?: string };
    sphere?: { name?: string; description?: string };
    rope?:   { name?: string; description?: string };
  };
  images?: Record<string, string>;
}

// Trace (parallel to Talent — different structure)
interface TraceSkill {
  name: string;
  description?: string;
  maxLevel?: number;
  attributes?: { labels?: string[]; parameters?: Record<string, number[]> };
}

interface Trace {
  _id: string;
  name: string;
  basicAtk?: TraceSkill;
  skill?: TraceSkill;
  ultimate?: TraceSkill;
  talent?: TraceSkill;
  technique?: { name: string; description?: string };
  statBonuses?: Array<{ stat: string; value: number; unlockPhase: number }>;
  costs?: Record<string, MaterialCostEntry[]>;
  images?: Record<string, string>;
  isTraveler?: boolean;
  elementVariants?: Record<string, Partial<Trace>>;
}

// Eidolon (parallel to Constellation)
interface EidolonLevel {
  name: string;
  description?: string;
}

interface Eidolon {
  _id: string;
  name: string;
  e1?: EidolonLevel;
  e2?: EidolonLevel;
  e3?: EidolonLevel;
  e4?: EidolonLevel;
  e5?: EidolonLevel;
  e6?: EidolonLevel;
  images?: Record<string, string>;
  isTraveler?: boolean;
  elementVariants?: Record<string, Partial<Eidolon>>;
}

// Update GameStats to include HSR-specific counts
interface GameStats {
  characters: number;
  weapons?: number;      // genshin
  lightCones?: number;   // hsr
  artifacts?: number;    // genshin
  relics?: number;       // hsr
  materials: number;
}
```

---

### HSR-31: Add HSR Constants to constants.ts

**Difficulty:** Low | **Priority:** High

```ts
// Elements (Combat Types)
export const HSR_ELEMENTS = [
  "Physical",
  "Fire",
  "Ice",
  "Lightning",
  "Wind",
  "Quantum",
  "Imaginary",
] as const;

// Paths
export const HSR_PATHS = [
  "The Hunt",
  "Destruction",
  "Erudition",
  "Harmony",
  "Nihility",
  "Preservation",
  "Abundance",
  "Remembrance",
] as const;

// Element → Tailwind color class (add custom CSS vars in index.css)
export const HSR_ELEMENT_COLOR_MAP: Record<string, string> = {
  Physical:  "bg-hsr-physical",
  Fire:      "bg-hsr-fire",
  Ice:       "bg-hsr-ice",
  Lightning: "bg-hsr-lightning",
  Wind:      "bg-hsr-wind",
  Quantum:   "bg-hsr-quantum",
  Imaginary: "bg-hsr-imaginary",
};

// Path → Tailwind color class
export const HSR_PATH_COLOR_MAP: Record<string, string> = {
  "The Hunt":  "bg-hsr-hunt",
  Destruction: "bg-hsr-destruction",
  Erudition:   "bg-hsr-erudition",
  Harmony:     "bg-hsr-harmony",
  Nihility:    "bg-hsr-nihility",
  Preservation:"bg-hsr-preservation",
  Abundance:   "bg-hsr-abundance",
  Remembrance: "bg-hsr-remembrance",
};

export const HSR_RARITY_LC = [5, 4, 3] as const;  // light cone rarities
export const HSR_RELIC_TYPES = ["cavern", "planar"] as const;
```

Also add HSR Tailwind color variables to `index.css` for each element and path (same pattern as existing `bg-pyro`, `bg-hydro`, etc.).

---

## PHASE 4 — FRONTEND: IMAGE & ICON CDN

### HSR-40: Add HSR CDN Functions to images.ts

**Difficulty:** Medium | **Priority:** High
**Genshin equivalent:** existing `images.ts` functions

```ts
// Base CDN
const HSR_STARRAILRES = "https://raw.githubusercontent.com/Mar-7th/StarRailRes/master";

// Characters
export function hsrCharacterIconUrl(images?: Record<string, string>): string | null {
  // Try images.avatar or images.icon from seeded data
  return images?.avatar ?? images?.icon ?? null;
}

export function hsrCharacterSplashUrl(images?: Record<string, string>): string | null {
  return images?.large ?? images?.splash ?? null;
}

// Light Cones
export function lightConeIconUrl(images?: Record<string, string>): string | null {
  return images?.icon ?? null;
}

// Relics
export function relicIconUrl(images?: Record<string, string>, piece?: string): string | null {
  if (piece && images?.[piece]) return images[piece];
  return images?.icon ?? null;
}

// Path icons (stored locally at /public/paths/*.webp or from CDN)
const HSR_PATH_ICONS: Record<string, string> = {
  "The Hunt":  `${HSR_STARRAILRES}/icon/path/Hunt.png`,
  Destruction: `${HSR_STARRAILRES}/icon/path/Warrior.png`,
  Erudition:   `${HSR_STARRAILRES}/icon/path/Mage.png`,
  // etc. — verify exact filenames from the repo
};
export function hsrPathIconUrl(path?: string): string | null {
  if (!path) return null;
  return HSR_PATH_ICONS[path] ?? null;
}

// Element (Combat Type) icons
const HSR_ELEMENT_ICONS: Record<string, string> = {
  Physical:  `${HSR_STARRAILRES}/icon/element/Physical.png`,
  Fire:      `${HSR_STARRAILRES}/icon/element/Fire.png`,
  // etc.
};
export function hsrElementIconUrl(element?: string | null): string | null {
  if (!element) return null;
  return HSR_ELEMENT_ICONS[element] ?? null;
}

// Trace skill icons
export function traceIconUrl(images?: Record<string, string>, key?: string): string | null {
  if (!key || !images) return null;
  return images[key] ?? null;
}

// Eidolon icons
export function eidolonIconUrl(images?: Record<string, string>, key?: string): string | null {
  if (!key || !images) return null;
  return images[key] ?? null;
}
```

**Implementation note:** Store icon URLs in the seeded DB record's `images` field wherever possible (same as Genshin), rather than computing them at render time. This avoids needing to know exact CDN filename conventions in the frontend.

---

### HSR-41: Add HSR Stat Icons

**Difficulty:** Low | **Priority:** Medium

Download HSR stat property icons to `client/public/stats/` (or fetch from `Mar-7th/StarRailRes/icon/property/`):
- `HPAddedRatio.png` (HP%)
- `AttackAddedRatio.png` (ATK%)
- `DefenceAddedRatio.png` (DEF%)
- `SpeedDelta.png` (SPD)
- `CriticalChanceBase.png` (CRIT Rate)
- `CriticalDamageBase.png` (CRIT DMG)
- etc.

Update `statIconUrl()` in `images.ts` to handle HSR stat keys (they differ from Genshin's `FIGHT_PROP_*` naming).

---

## PHASE 5 — FRONTEND: API CLIENT

### HSR-50: Add HSR API Functions to api.ts

**Difficulty:** Low | **Priority:** High
**Genshin equivalent:** existing `getWeapons`, `getArtifacts`, etc.

```ts
// Light Cones
export function getLightCones(game: Game, params?: { page?: number; limit?: number; search?: string; path?: string; rarity?: number; sort?: string }) {
  return apiClient.get<PaginatedResponse<LightCone>>(`/${game}/lightcones`, { params: clean(params) });
}
export function getLightCone(game: Game, name: string) {
  return apiClient.get<ApiResponse<LightCone>>(`/${game}/lightcones/${encodeURIComponent(name)}`);
}

// Relics
export function getRelics(game: Game, params?: { page?: number; limit?: number; search?: string; type?: string; rarity?: number; sort?: string }) {
  return apiClient.get<PaginatedResponse<Relic>>(`/${game}/relics`, { params: clean(params) });
}
export function getRelic(game: Game, name: string) {
  return apiClient.get<ApiResponse<Relic>>(`/${game}/relics/${encodeURIComponent(name)}`);
}

// Traces and Eidolons (same pattern as getTalent / getConstellation)
export function getTrace(game: Game, name: string) {
  return apiClient.get<ApiResponse<Trace>>(`/${game}/traces/${encodeURIComponent(name)}`);
}
export function getEidolon(game: Game, name: string) {
  return apiClient.get<ApiResponse<Eidolon>>(`/${game}/eidolons/${encodeURIComponent(name)}`);
}
```

---

## PHASE 6 — FRONTEND: MATERIAL CALCULATIONS

### HSR-60: Add HSR Material Calculation Functions to materials.ts

**Difficulty:** Medium | **Priority:** High
**Genshin equivalent:** `calculateExpMaterials`, `calculateAscensionMaterials`, etc.

**HSR EXP materials:**
| Item | EXP | Credit Cost per use |
|---|---|---|
| Travel Encounters | 1,000 | 100 |
| Adventure Log | 5,000 | 500 |
| Traveler's Guide | 20,000 | 2,000 |

**Credit ratio:** 1 Credit per 10 EXP (ratio is 1:10, vs Genshin's 1:5)

**Cumulative EXP table (levels 1–80):** Extract the full per-level EXP values from `Mar-7th/StarRailRes` game data or the [Fandom wiki Character EXP page](https://honkai-star-rail.fandom.com/wiki/Character_EXP) before hardcoding the table. Follow the same pattern as `CHAR_EXP_CUMULATIVE` in the Genshin implementation.

**HSR ascension levels:**
```ts
export const HSR_ASCENSION_LEVELS = [1, 20, 30, 40, 50, 60, 70, 80] as const;

export function hsrLevelToAscensionPhase(level: number): number {
  if (level <= 20) return 0;
  if (level <= 30) return 1;
  if (level <= 40) return 2;
  if (level <= 50) return 3;
  if (level <= 60) return 4;
  if (level <= 70) return 5;
  return 6;
}
```

**No breakthrough levels for HSR** — level 80 is the hard cap.

**Light cone ascension:** Same level caps (1–80), same 6 ascension phases. Follow `calculateAscensionMaterials` pattern. LC costs come from `light_cone_promotions.json`.

**Trace costs:** Separate per skill type. Costs per level come from `character_skill_trees.json`. There are multiple cost keys per character (one per skill). Implement `calculateTraceMaterials(costs, targetLevel)` — same shape as Genshin's `calculateTalentMaterials`.

---

## PHASE 7 — FRONTEND: NAVIGATION

### HSR-70: Make Navbar Game-Aware

**Difficulty:** Medium | **Priority:** Critical

The current Navbar shows the same nav links for every game: Characters, Weapons, Artifacts, Materials. For HSR, "Weapons" should become "Light Cones" and "Artifacts" should become "Relics".

**Implementation:** In `Navbar.tsx`, define per-game nav link configurations:
```ts
const NAV_LINKS: Record<Game, Array<{ label: string; path: string }>> = {
  genshin: [
    { label: "Characters", path: "characters" },
    { label: "Weapons",    path: "weapons" },
    { label: "Artifacts",  path: "artifacts" },
    { label: "Materials",  path: "materials" },
  ],
  hsr: [
    { label: "Characters", path: "characters" },
    { label: "Light Cones",path: "lightcones" },
    { label: "Relics",     path: "relics" },
    { label: "Materials",  path: "materials" },
  ],
  // other games...
};
```

Use `useParams()` to get the current `game` and select the appropriate link set. Fall back to the Genshin set for unrecognized games.

---

### HSR-71: Add HSR Routes to App.tsx

**Difficulty:** Low | **Priority:** High

Add routes mirroring the Genshin ones:
```tsx
// In the /:game/* route block or alongside existing routes:
<Route path="/:game/lightcones"        element={<LightConesPage />} />
<Route path="/:game/lightcones/:name"  element={<LightConeDetailPage />} />
<Route path="/:game/relics"            element={<RelicsPage />} />
<Route path="/:game/relics/:name"      element={<RelicDetailPage />} />
```

Existing routes (characters, materials) already work for any game value — no changes needed.

---

### HSR-72: Mark HSR Available

**Difficulty:** Trivial | **Priority:** Last (do this after pages are done)

In `constants.ts`, flip HSR to available:
```ts
{ id: "hsr", ..., available: true }
```

Also update `HomePage.tsx` to show the HSR game card with a star rail themed banner image if one is added to `client/public/`.

---

## PHASE 8 — FRONTEND: LIST PAGES

All list pages follow the identical pattern: `FilterBar` + `useInfiniteList` + `ResourceGrid` + item card component. Copy the Genshin equivalents and adjust filters, sort options, and card content.

---

### HSR-80: HSR CharactersPage

**Difficulty:** Low | **Priority:** High
**Genshin equivalent:** `CharactersPage.tsx`

**Filters:**
- Element (Combat Type): Physical, Fire, Ice, Lightning, Wind, Quantum, Imaginary — with HSR element icon
- Path: The Hunt, Destruction, Erudition, Harmony, Nihility, Preservation, Abundance, Remembrance — with path icon
- Rarity: 5★, 4★

**Character card changes:**
- Show element badge (with `hsrElementIconUrl`)
- Show path badge (with `hsrPathIconUrl`) — replaces weapon type badge
- Keep rarity stars

**Sort options:** Name, Release (version) — same as Genshin

---

### HSR-81: LightConesPage

**Difficulty:** Low | **Priority:** High
**Genshin equivalent:** `WeaponsPage.tsx`

**Filters:**
- Path: (same list as character paths — only characters of that path can equip)
- Rarity: 5★, 4★, 3★

**Light cone card:**
- Light cone icon from CDN
- Name, rarity stars, path badge (with icon)

---

### HSR-82: RelicsPage

**Difficulty:** Low | **Priority:** Medium
**Genshin equivalent:** `ArtifactsPage.tsx`

**Filters:**
- Type: Cavern Relics / Planar Ornaments
- Rarity: 5★, 4★ (top-tier relics)

**Relic card:**
- Show set icon (use head/sphere piece icon)
- Name, rarity stars, type badge ("Cavern" / "Planar")

---

### HSR-83: HSR MaterialsPage

**Difficulty:** Trivial | **Priority:** Low
**Genshin equivalent:** `MaterialsPage.tsx`

Same structure — no HSR-specific changes needed at the list level. Filters and card layout carry over directly.

---

## PHASE 9 — FRONTEND: DETAIL PAGES

### HSR-90: HSR CharacterDetailPage

**Difficulty:** High | **Priority:** Critical
**Genshin equivalent:** `CharacterDetailPage.tsx`

**Header section changes:**
- Show Combat Type (element) + Path badges, both with icons
- Stats at selected level: HP, ATK, DEF, SPD (replace Genshin's HP/ATK/DEF + substat)
- No region field for most characters (use faction/affiliation instead)
- No birthday field (most HSR characters lack one)

**Tabs:**
- **Traces** (replaces Talents):
  - 4 leveled skills: Basic ATK (lv1–6), Skill (lv1–10), Ultimate (lv1–10), Talent (lv1–10)
  - 1 fixed passive: Technique (no level slider)
  - Stat bonus nodes (A2, A4, A6) — display as a small table: stat name + value + unlock phase
  - Each skill gets its own level slider (same as Genshin TalentSection component)
- **Eidolons** (replaces Constellations):
  - E1–E6 cards with icon, name, description
  - Same layout as Genshin constellation cards — just rename C→E
- **Ascension** (same tab name):
  - Level slider 1–80 (no breakthrough section)
  - Quick-jump buttons: 1, 20, 30, 40, 50, 60, 70, 80
  - Base stats display at selected level (HP, ATK, DEF, SPD)
  - Material cost table (ascension + EXP books + Credits)

**Material cost calculator:**
- Update `TotalCostCalculator.tsx` or create an HSR-specific variant
- Includes: ascension materials + EXP books (Traveler's Guide / Adventure Log / Travel Encounters) + Credits + trace materials

**Trailblazer handling:**
- Same `isTraveler` + `elementVariants` + element selector UI as Genshin Travelers
- Trailblazer has different skills per element unlock (Fire/Ice/Imaginary/Remembrance)

---

### HSR-91: LightConeDetailPage

**Difficulty:** Medium | **Priority:** High
**Genshin equivalent:** `WeaponDetailPage.tsx`

**Header:**
- Light cone splash art / icon
- Name, rarity, path badge (with path icon)
- Three stats at selected level: Base HP, Base ATK, Base DEF (vs Genshin's single ATK + substat)

**Superimposition section** (replaces Refinement):
- Slider S1–S5 (same mechanic as R1–R5)
- Display passive effect name + description with highlighted values
- Use `renderEffect` template parser — same logic as Genshin weapon

**Ascension Materials section:**
- Slider 1–80 with quick-jump buttons (1, 20, 30, 40, 50, 60, 70, 80)
- Material cost table

---

### HSR-92: RelicDetailPage

**Difficulty:** Low | **Priority:** Medium
**Genshin equivalent:** `ArtifactDetailPage.tsx`

**Changes:**
- Show type badge: "Cavern Relic" or "Planar Ornament"
- For Cavern Relics: show 2-piece + 4-piece bonuses, then 4 piece descriptions (Head, Hands, Body, Feet)
- For Planar Ornaments: show 2-piece bonus only, then 2 piece descriptions (Planar Sphere, Link Rope)
- No `fourPieceBonus` for Planar Ornaments — hide that section conditionally

---

### HSR-93: HSR MaterialDetailPage

**Difficulty:** Trivial | **Priority:** Low
**Genshin equivalent:** `MaterialDetailPage.tsx`

Same structure — carries over with no HSR-specific changes needed.

---

## PHASE 10 — VALIDATION & POLISH

### HSR-100: Data Validation

- Verify all characters seeded with correct element, path, stats (cross-reference with [Prydwen.gg](https://www.prydwen.gg/star-rail/) or [Honkai.gg](https://honkai.gg/database/))
- Verify light cone superimposition descriptions render correctly
- Verify relic set bonuses — check cavern vs planar split
- Verify trace costs match in-game values (cross-reference HoYoLab calculator)
- Verify material cost calculator totals for a sample character

### HSR-101: Image Coverage Audit

- Check which characters/light cones/relics have missing CDN images
- Add fallbacks or placeholder letters where needed (ImageWithFallback handles this already)
- Verify path icons all resolve from CDN

### HSR-102: Color Scheme Tuning

- Finalize Tailwind colors for HSR elements and paths in `index.css`
- HSR has a space/sci-fi aesthetic — element colors should reflect:
  - Physical: grey/silver
  - Fire: red/orange
  - Ice: blue/cyan
  - Lightning: purple/yellow
  - Wind: teal/green
  - Quantum: indigo/violet
  - Imaginary: gold/yellow
- Path colors can be muted neutrals with tinted accent

### HSR-103: Trailblazer Edge Cases

- Trailblazer unlocks elements progressively — ensure element variants that don't exist yet in a user's playthrough are still seeded (all available variants from game data)
- Male (Caelus) and female (Stelle) Trailblazer names — store as "Trailblazer" with gendered option if data supports it

---

## EXECUTION ORDER

### Critical Path (unblock everything)
1. **HSR-00** — Data source decision and setup
2. **HSR-10–HSR-16** — Backend models and routes
3. **HSR-20** — Seeding script (requires HSR-00 + HSR-10)
4. **HSR-30–HSR-31** — Types and constants (can parallel with backend)
5. **HSR-70–HSR-72** — Navigation (unblocks all page work)

### Core Pages (in priority order)
6. **HSR-80** — Characters list
7. **HSR-90** — Character detail (most complex, most value)
8. **HSR-81** — Light Cones list
9. **HSR-91** — Light Cone detail
10. **HSR-82** — Relics list
11. **HSR-92** — Relic detail
12. **HSR-83 / HSR-93** — Materials (trivial carries)

### Supporting Work (parallel with pages)
- **HSR-40–HSR-41** — Image CDN functions (needed by all detail pages)
- **HSR-50** — API client functions
- **HSR-60** — Material calculations

### Final
- **HSR-100–HSR-103** — Validation, image audit, polish
- **HSR-72** — Mark HSR as `available: true` (only after all pages are functional)

---

## REFERENCE LINKS

- [starrail.js npm / GitHub](https://github.com/yuko1101/starrail.js/) — Node.js HSR data wrapper
- [Mar-7th/StarRailRes](https://github.com/Mar-7th/StarRailRes) — Static JSON game data (primary data source)
- [kel-z/HSR-Data](https://github.com/kel-z/HSR-Data) — Pre-parsed single-file JSON alternative
- [Character EXP Wiki](https://honkai-star-rail.fandom.com/wiki/Character_EXP) — EXP table for hardcoding cumulative values
- [Prydwen.gg HSR](https://www.prydwen.gg/star-rail/) — Reference for character stats/traces validation
- [Honkai.gg Database](https://honkai.gg/database/) — Alternative validation reference
- [HoYoLAB Calculator](https://act.hoyolab.com/sr/event/calculator/index.html) — Official material cost reference

---

*End of Roadmap*
