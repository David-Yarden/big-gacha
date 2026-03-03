# Wuthering Waves — Big Gacha Implementation Roadmap

**Version:** 1.0
**Reference:** Genshin Impact (full) + HSR (full) implementations — mirror the shared architecture with WuWa-specific differences noted in each task.
**Goal:** Bring Wuthering Waves to full feature parity: resonators, weapons, echoes (with sonata sets), materials, fortes, resonance chains, and a material cost calculator.

---

## KEY DIFFERENCES FROM GENSHIN & HSR

Before starting, internalize these structural differences. Every task below accounts for them.

| Concept | Genshin Impact | Honkai: Star Rail | Wuthering Waves |
|---|---|---|---|
| Character term | Characters | Characters | **Resonators** |
| Max level | 90 (+ breakthrough 95/100) | 80 | **90 (no breakthrough)** |
| Ascension breakpoints | 20/40/50/60/70/80/90 | 20/30/40/50/60/70/80 | **20/40/50/60/70/80/90** |
| Ascension phases | 6 | 6 | **6** |
| Elements | Pyro, Hydro, Anemo, Electro, Dendro, Cryo, Geo (7) | Physical, Fire, Ice, Lightning, Wind, Quantum, Imaginary (7) | **Glacio, Fusion, Electro, Aero, Spectro, Havoc (6)** |
| Classifier stat | Element + Weapon Type | Element + Path | **Element + Weapon Type** (no "Path" concept) |
| Weapon types | Sword, Claymore, Polearm, Catalyst, Bow | Light Cones (path-locked) | **Sword, Broadblade, Pistols, Gauntlets, Rectifier** |
| "Artifacts" system | Artifacts — 5-slot, piece-typed (flower/plume/sands/goblet/circlet), 2pc/4pc sets | Relics — Cavern 4-piece + Planar Ornament 2-piece | **Echoes — 5-slot cost-budget system, 2pc/5pc sets. No fixed piece types.** |
| "Artifact" set bonus | 2-piece, 4-piece | 2-piece (cavern + planar separate) | **2-piece, 5-piece (Sonata Effects)** |
| "Artifact" equivalent term | Artifact Sets | Relic Sets | **Echo Sets (Sonata Effects)** |
| "Talents" / "Traces" | Talents (combat1/2/3 + passives) | Traces (ATK/Skill/Ult/Talent/Technique) | **Forte (Basic Attack, Resonance Skill, Resonance Liberation, Forte Circuit, Intro Skill)** |
| Forte upgradeable skill count | 3 combat + passives (no level) | 4 active (variable max levels) | **5 active skills (all level 1–10)** |
| Forte passive nodes | C1-based unlocks | Major Traces + Stat Bonuses | **Inherent Skills (2) + Stat Bonus Nodes** |
| "Constellations" | C1–C6 | Eidolons E1–E6 | **Resonance Chain S1–S6** |
| Constellation unlock item | Dupe character | Eidolon fragment (game mechanic) | **Waveband (dupe character, same as Genshin)** |
| Weapon refinement | R1–R5 | Superimposition S1–S5 | **Resonance Chain (weapon) R1–R5** (same mechanical concept) |
| Protagonist variants | Aether/Lumine (element variants) | Trailblazer (element variants) | **Rover (Spectro + Havoc variants currently)** |
| Data source | `genshin-db` npm package | `Mar-7th/StarRailRes` JSON (GitHub CDN) | **No established npm package — custom fetcher needed. See Phase 0.** |
| Image CDN | Enka.network + Yatta.moe | Mar-7th/StarRailRes + Enka.network | **TBD — community sources, see WW-00** |

### WuWa-Exclusive Concepts

- **Echo Classes**: Each echo has a cost value — Common (1), Elite (3), Overlord (4), Calamity (4). The 5 equipped echoes must sum to a cost budget of ≤12.
- **Echo Skill**: Only the first-slot echo's skill activates in combat. The other four provide stats and set bonuses only.
- **Sonata Effects**: Echo set bonuses; unlike Genshin (2/4), they trigger at 2-piece and 5-piece thresholds.
- **SOL3 Phase**: Account-level system that gates ascension; irrelevant to the database (not stored).
- **Concerto Energy**: A combat mechanic for Intro/Outro Skills; irrelevant to the database.
- **Forgery Challenges**: The domain equivalent for skill upgrade materials.

---

## PHASE 0 — RESEARCH & DATA SOURCE SETUP

### WW-00: Identify and Evaluate Data Sources

**Difficulty:** Medium | **Priority:** Critical — blocks everything else

WuWa has no equivalent to `genshin-db`. The data sourcing strategy follows the HSR approach (custom fetcher against community JSON), but the ecosystem is less mature. Evaluate these options:

**Option A: Dimbreath/WutheringData (Recommended for raw data)**
- GitHub: `https://github.com/Dimbreath/WutheringData`
- Contains raw game data in `ConfigDB/` and `TextMap/` directories (binary/CSV/JSON exports directly from game files)
- Most complete, but requires more parsing work — data is in game-internal format, not human-readable keys
- Version tracking via game patches; currently at v3.1+

**Option B: Arikatsu/WutheringWaves_Data**
- GitHub: `https://github.com/Arikatsu/WutheringWaves_Data`
- Datamined data, potentially more structured than Dimbreath
- Same caveat: internal format, requires reverse-engineering key mappings (like `hsrData.js` did for HSR's internal→display name mappings)

**Option C: resonance-rest/api (Archived, for reference only)**
- GitHub: `https://github.com/resonance-rest/api`
- Base URL: `https://api.resonance.rest/`
- **Archived and incomplete.** Do not build against it, but its endpoint shapes reveal the data model for characters, weapons, echoes, and sonatas.
- Useful as a reference for expected field names and data structure.

**Option D: wuthering.gg / wuwacompanion.com scraped data**
- Community databases; not suitable as a seed source (scraping is fragile). Use only for cross-validation.

**Recommended approach:** Use `Dimbreath/WutheringData` as the primary raw source (same pattern as how `Mar-7th/StarRailRes` was used for HSR). Create a `wuwaData.js` helper that fetches from raw GitHub URLs. Build a text map lookup to resolve internal IDs to display strings.

**Action items:**
1. Clone or download `Dimbreath/WutheringData` and inspect `ConfigDB/` structure manually
2. Identify the JSON files for: characters, weapons, echoes, skills, resonance chains, ascension costs, materials
3. Build an ID→name text map from the `TextMap/` directory (similar to how HSR's data needed `Thunder → Lightning` remapping via `hsrData.js`)
4. If Dimbreath's format is too opaque, fall back to Arikatsu's fork and compare

---

### WW-01: Document Image CDN URLs

**Difficulty:** Medium | **Priority:** Critical

WuWa has no established CDN like Enka.network (which had official Genshin/HSR support). Options:

**Option A: soevielofficial/wuwa-assets**
- GitHub: `https://github.com/soevielofficial/wuwa-assets`
- Community-maintained asset repository
- Pros: Stable, versioned
- Cons: Coverage may be incomplete, especially for new characters

**Option B: Direct reference from wuthering.gg**
- Inspect the network requests on `https://wuthering.gg/characters` to identify their CDN asset URLs
- These are typically public and stable

**Option C: Enka.network WuWa support**
- Enka.network added Wuthering Waves support in 2024. Check if they expose a usable CDN URL pattern similar to `https://enka.network/ui/{filename}.png`
- Base URL to check: `https://enka.network/ui/wuwa/` or similar

**For each asset type, confirm working URLs for:**
- Character icon (small square/circle)
- Character splash art (full body gacha portrait)
- Character side icon (cropped bust for lists)
- Weapon icon
- Echo icon (individual echo creature image)
- Element/attribute icons (Glacio, Fusion, Electro, Aero, Spectro, Havoc)
- Weapon type icons (Sword, Broadblade, Pistols, Gauntlets, Rectifier — local static `.webp` in `client/public/weapons/` as fallback)
- Skill/forte icons
- Material icons

---

## PHASE 1 — BACKEND: MODEL UPDATES & NEW MODELS

### WW-02: Update Existing Models for WuWa

**Difficulty:** Low | **Priority:** High

**Character.js** (`src/models/Character.js`):
- The `game` field already includes `"wuwa"` in its enum — no change needed
- Add `"Broadblade"`, `"Pistols"`, `"Gauntlets"`, `"Rectifier"` to the `weaponType` enum (alongside existing Genshin types). Consider using a flat list: `["Sword", "Claymore", "Polearm", "Catalyst", "Bow", "Broadblade", "Pistols", "Gauntlets", "Rectifier"]`
- Add `"Glacio"`, `"Fusion"`, `"Aero"`, `"Spectro"`, `"Havoc"` to the `element` enum (alongside existing values). Note: WuWa also uses `"Electro"` — already present from Genshin
- No `path` field needed (WuWa has no Path mechanic)
- The `region` field can be repurposed: WuWa characters have associated nations/regions (Jinzhou, Huanglong, etc.) — reuse `region` as-is
- The `isTraveler` / `elementVariants` pattern is needed for **Rover** (Spectro + Havoc variants currently; more may be added)

**Weapon.js** (`src/models/Weapon.js`):
- Already game-agnostic; no model changes needed
- WuWa weapons use the same schema: `game`, `name`, `rarity`, `mainStatType`, `effectTemplateRaw`, `superimpositions` (refinements R1-R5), `costs`, `stats` (pre-computed per level), `images`
- The `superimpositions` array for refinements uses the same 5-rank structure

**Material.js** (`src/models/Material.js`):
- Already game-agnostic; no model changes needed
- WuWa material categories will need defining: see `WW-07` (seedMaterials) for the category mapping

---

### WW-03: Create `src/models/Forte.js`

**Difficulty:** Medium | **Priority:** High

This is the WuWa equivalent of `Talent.js` (Genshin) and `Trace.js` (HSR). Key structural difference: WuWa has **5 active skills** (all level 1–10), plus **2 inherent skill** passives (milestone-unlocked, no level) and **stat bonus nodes** scattered through the tree.

```javascript
// Proposed schema
{
  game: "wuwa",
  name: String,          // Resonator name (FK, matches Character.name)
  isTraveler: Boolean,   // true for Rover
  elementVariants: Map,  // Rover: { Spectro: {...}, Havoc: {...} }

  // Five upgradeable active skills (all level 1–10)
  basicAtk: {
    name: String, maxLevel: Number,
    desc: String, params: [[Number]], icon: String
  },
  resonanceSkill: {
    name: String, maxLevel: Number,
    desc: String, params: [[Number]], icon: String
  },
  resonanceLiberation: {     // The "ultimate"
    name: String, maxLevel: Number,
    desc: String, params: [[Number]], icon: String
  },
  forteCircuit: {            // Signature passive mechanic
    name: String, maxLevel: Number,
    desc: String, params: [[Number]], icon: String
  },
  introSkill: {              // Activated by switching to this character
    name: String, maxLevel: Number,
    desc: String, params: [[Number]], icon: String
  },

  // Inherent Skills — unlocked at ascension milestones, no level
  inherentSkill1: { name: String, desc: String, icon: String, unlockPhase: Number },
  inherentSkill2: { name: String, desc: String, icon: String, unlockPhase: Number },

  // Stat bonus nodes unlocked through the tree
  statBonuses: [{ stat: String, value: Number, unlockPhase: Number }],

  // Upgrade costs per skill type (same structure as Trace costs)
  // costs.basicAtk.lvl2 → lvl10, costs.resonanceSkill.lvl2 → lvl10, etc.
  costs: {
    basicAtk:           { lvl2: [...], lvl3: [...], ..., lvl10: [...] },
    resonanceSkill:     { lvl2: [...], ..., lvl10: [...] },
    resonanceLiberation:{ lvl2: [...], ..., lvl10: [...] },
    forteCircuit:       { lvl2: [...], ..., lvl10: [...] },
    introSkill:         { lvl2: [...], ..., lvl10: [...] }
  }
}
```

**Notes:**
- Each skill level upgrade cost uses 3 material types: Forgery Challenge material (3 tiers), enemy drop material (3 tiers), boss material. Plus Shell Credits (currency).
- The `params` array is a 2D array: `params[level][paramIndex]` — same pattern as `Trace.js`.
- `desc` will contain placeholders like `{param1:F2P}` — use the same formatter pattern as HSR's `parseHsrDesc()`.

---

### WW-04: Create `src/models/ResonanceChain.js`

**Difficulty:** Low | **Priority:** High

Direct equivalent of `Constellation.js` (Genshin) and `Eidolon.js` (HSR). WuWa uses S1–S6 naming (Sequences).

```javascript
// Proposed schema — mirrors Eidolon.js almost exactly
{
  game: "wuwa",
  name: String,          // Resonator name (FK)
  isTraveler: Boolean,   // true for Rover
  elementVariants: Map,  // Rover: { Spectro: {...}, Havoc: {...} }

  s1: { name: String, description: String },
  s2: { name: String, description: String },
  s3: { name: String, description: String },
  s4: { name: String, description: String },
  s5: { name: String, description: String },
  s6: { name: String, description: String },

  images: {
    s1: String, s2: String, s3: String,
    s4: String, s5: String, s6: String
  }
}
```

**Notes:**
- No `levelUpSkills` equivalent in WuWa (S3/S5 do NOT grant skill level caps like HSR E3/E5 do — they grant direct buffs like Genshin C1-C6)
- No `novaflare` sub-document needed at this time

---

### WW-05: Create `src/models/Echo.js`

**Difficulty:** Medium | **Priority:** High

This is a **new concept** with no direct equivalent in Genshin or HSR. An Echo is an individual monster that can be equipped. Each echo belongs to a sonata set, has a cost class, and has a usable skill.

```javascript
// Proposed schema
{
  game: "wuwa",
  sourceId: String,      // Game internal ID
  name: String,          // Echo monster name (e.g. "Impermanence Heron")
  description: String,
  element: String,       // The echo's elemental attribute

  // Cost class determines which slot budget it fills
  echoClass: {
    type: String,
    enum: ["Common", "Elite", "Overlord", "Calamity"]
  },
  cost: { type: Number, enum: [1, 3, 4] },

  // The sonata set this echo belongs to
  sonataSet: String,     // References EchoSet.name

  // Echo skill — only active when in slot 1
  skill: {
    name: String,
    desc: String,        // May contain param placeholders
    params: [[Number]],  // params[cd_level][paramIdx] — echoes don't "level" skills, but params vary
    cooldown: Number     // seconds
  },

  // Main stat options for this echo cost class
  // (main stat pool is determined by cost class, not individual echo)
  mainStatOptions: [String],  // e.g. ["HP%", "ATK%", "DEF%", "Glacio DMG Bonus"]

  images: { icon: String }
}
```

**Notes:**
- In WuWa, main stats are determined by the cost class (tier), not by a fixed piece slot (unlike Genshin's flower=HP, plume=ATK). All cost-1 echoes share the same main stat pool, etc.
- Substats are random from a shared pool — no need to store substat data in the model (not pre-deterministic)
- The echo skill description may use parameter placeholders for damage values

---

### WW-06: Create `src/models/EchoSet.js`

**Difficulty:** Low | **Priority:** High

Equivalent to `Artifact.js` (Genshin) and `Relic.js` (HSR), but represents a sonata set's bonuses rather than individual piece slots.

```javascript
// Proposed schema
{
  game: "wuwa",
  sourceId: String,
  name: String,           // e.g. "Freezing Frost", "Molten Rift", "Lingering Tunes"
  description: String,    // Optional flavor text

  twoPieceBonus: String,  // 2-piece set effect description
  fivePieceBonus: String, // 5-piece set effect description (unlike Genshin's 4-piece)

  // Primary element/theme association (for color coding/display)
  element: String,        // e.g. "Glacio" for Freezing Frost

  images: { icon: String } // Representative set icon
}
```

**Known Sonata Sets (as of v3.1):**
- Freezing Frost (Glacio)
- Molten Rift (Fusion)
- Void Thunder (Electro)
- Sierra Gale (Aero)
- Celestial Light (Spectro)
- Sun-Sinking Eclipse (Havoc)
- Lingering Tunes (ATK-focused, no element)
- Rejuvenating Glow (Healing-focused)
- Moonlit Clouds (Energy Regen focused)
- Tidebreaking Courage (new in later patches)
- Additional sets added with each major version

---

## PHASE 2 — BACKEND: ROUTES

### WW-07: Register WuWa-Specific Routes

**Difficulty:** Low | **Priority:** High

Edit `src/routes/index.js` to mount the new WuWa models. The `game` param validation already accepts `"wuwa"`.

**Add these routes:**
```javascript
// Forte (character skill trees) — fetch by name only, like traces/eidolons
router.use("/:game/fortes", createResourceRouter(Forte, "Forte"));

// Resonance Chain — fetch by name only, like eidolons
router.use("/:game/resonancechains", createResourceRouter(ResonanceChain, "ResonanceChain"));

// Echo list + individual echoes
router.use("/:game/echoes", createResourceRouter(Echo, "Echo"));

// Sonata / Echo Sets list
router.use("/:game/echosets", createResourceRouter(EchoSet, "EchoSet"));
```

**Update the `/stats` endpoint** to include echo + echoset counts for WuWa:
```javascript
echos: await Echo.countDocuments({ game }),
echoSets: await EchoSet.countDocuments({ game }),
fortes: await Forte.countDocuments({ game }),
resonanceChains: await ResonanceChain.countDocuments({ game }),
```

---

## PHASE 3 — BACKEND: SEED SCRIPT

### WW-08: Create `src/scripts/wuwaData.js`

**Difficulty:** Medium | **Priority:** Critical

Mirror of `hsrData.js`. This utility module centralizes all WuWa-specific data fetching, mappings, and CDN URL builders.

```javascript
// wuwaData.js structure
const WUWAREPO_BASE = "https://raw.githubusercontent.com/Dimbreath/WutheringData/main/ConfigDB/";
const TEXTMAP_BASE  = "https://raw.githubusercontent.com/Dimbreath/WutheringData/main/TextMap/";

// Fetch JSON from WutheringData repo
async function fetchWuWa(filename) { ... }

// Resolve internal text ID → display string via TextMap
async function resolveText(textId, textMap) { ... }

// Element mappings (internal ID → display name)
// WuWa elements match display names closely — verify during WW-00
const ELEMENT_MAP = {
  "Glacio":  "Glacio",
  "Fusion":  "Fusion",
  "Electro": "Electro",
  "Aero":    "Aero",
  "Spectro": "Spectro",
  "Havoc":   "Havoc"
};

// Weapon type mappings (internal → display)
const WEAPON_TYPE_MAP = {
  "Sword":      "Sword",
  "Broadblade": "Broadblade",
  "Pistols":    "Pistols",
  "Gauntlets":  "Gauntlets",
  "Rectifier":  "Rectifier"
};

// CDN URL builders (fill in after WW-01 research)
function characterIconUrl(id)      { return `${CDN_BASE}/characters/${id}/icon`; }
function characterSplashUrl(id)    { return `${CDN_BASE}/characters/${id}/portrait`; }
function weaponIconUrl(id)         { return `${CDN_BASE}/weapons/${id}/icon`; }
function echoIconUrl(id)           { return `${CDN_BASE}/echoes/${id}/icon`; }
function elementIconUrl(element)   { return `${CDN_BASE}/elements/${element}.png`; }
function materialIconUrl(id)       { return `${CDN_BASE}/items/${id}/icon`; }

// Pre-compute all level stats from promotion data
// (same pattern as computeStats() in hsrData.js)
function computeStats(promotions, maxLevel, statKeys) { ... }

// Build ascension cost objects from raw material arrays
function buildAscensionCosts(ascensionData) { ... }

// Build forte upgrade cost objects
function buildForteCosts(skillTreeData) { ... }
```

---

### WW-09: Create `src/scripts/seedWuwa.js`

**Difficulty:** High | **Priority:** Critical

Main seed script. Mirror the structure of `seedHsr.js`. Execute in dependency-safe order:

```
Materials → Characters → Weapons → Fortes → ResonanceChains → Echoes → EchoSets
```

**`seedMaterials()`**
- Fetch all items from WutheringData
- Filter out: currency, Waveplates, gacha pulls, tutorial items
- Map to categories: `"Resonator Ascension"`, `"Weapon Ascension"`, `"Forte Upgrade"`, `"Boss Material"`, `"Common Enemy Drop"`, `"Local Specialty"`, `"EXP Material"`, `"Shell Credits"`
- Upsert into `Material` collection with `game: "wuwa"`

**`seedCharacters()`**
- Fetch all resonator data
- Map fields: `name`, `title`, `description`, `rarity` (4–5), `element`, `weaponType`, `region`, `version`
- Pre-compute stats for all levels 1–90 using `computeStats()`
- Build `costs` object: `ascend1` through `ascend6` using `buildAscensionCosts()`
- Map `images`: `icon`, `splash`, `preview`
- **Rover handling** (same as Traveler/Trailblazer pattern):
  - Rover has Spectro and Havoc element variants (potentially more in future)
  - Create one document per variant with `isTraveler: true`
  - Store per-element data in `elementVariants[element]`
  - Use `"Rover"` as the canonical `name`

**`seedWeapons()`**
- Fetch all weapon data
- Map fields: `name`, `description`, `rarity`, `weaponType` (Sword/Broadblade/etc.), `mainStatType`, `baseAtkValue`
- Pre-compute stats for all levels using weapon promotion data
- Store refinements as `superimpositions[0..4]` with `description` + `values`
- Build ascension `costs` object

**`seedFortes()`**
- Fetch character skill tree data
- For each character, build a `Forte` document:
  - Parse 5 skill descriptions + params: `basicAtk`, `resonanceSkill`, `resonanceLiberation`, `forteCircuit`, `introSkill`
  - Parse 2 inherent skill descriptions (no level)
  - Parse stat bonus nodes: `{ stat, value, unlockPhase }`
  - Build `costs` object with `buildForteCosts()`
- Handle Rover variants with `elementVariants` pattern

**`seedResonanceChains()`**
- Fetch resonance chain (sequence) data
- Map S1–S6 descriptions and images per character
- Handle Rover with `elementVariants` pattern

**`seedEchoes()`**
- Fetch all echo monster data
- Map fields: `name`, `description`, `element`, `echoClass`, `cost`, `sonataSet` (FK to EchoSet)
- Parse echo skill: `name`, `desc`, `params`, `cooldown`
- Map `mainStatOptions` based on cost class (same pool for all echoes of same class)

**`seedEchoSets()`**
- Fetch all sonata effect data
- Map: `name`, `twoPieceBonus`, `fivePieceBonus`, `element`, `images`
- Upsert by name

**Script execution commands (add to `package.json`):**
```json
"seed:wuwa":       "node src/scripts/seedWuwa.js",
"seed:wuwa:force": "node src/scripts/seedWuwa.js --force",
"seed:wuwa:sync":  "node src/scripts/seedWuwa.js --sync"
```

---

## PHASE 4 — FRONTEND: TYPES & API CLIENT

### WW-10: Update `client/src/lib/types.ts`

**Difficulty:** Low | **Priority:** High

Add WuWa-specific TypeScript interfaces. The `Game` type already includes `"wuwa"`.

**New interfaces:**

```typescript
// Forte (WuWa skill tree)
interface ForteSkill {
  name: string;
  maxLevel: number;
  desc: string;
  params: number[][];
  icon: string;
}

interface ForteInherentSkill {
  name: string;
  desc: string;
  icon: string;
  unlockPhase: number;
}

interface Forte {
  _id: string;
  game: "wuwa";
  name: string;
  isTraveler?: boolean;
  elementVariants?: Record<string, Omit<Forte, "elementVariants" | "isTraveler">>;
  basicAtk: ForteSkill;
  resonanceSkill: ForteSkill;
  resonanceLiberation: ForteSkill;
  forteCircuit: ForteSkill;
  introSkill: ForteSkill;
  inherentSkill1: ForteInherentSkill;
  inherentSkill2: ForteInherentSkill;
  statBonuses: Array<{ stat: string; value: number; unlockPhase: number }>;
  costs: Record<"basicAtk" | "resonanceSkill" | "resonanceLiberation" | "forteCircuit" | "introSkill",
    Record<string, MaterialCostEntry[]>>;  // lvl2...lvl10
}

// Resonance Chain (WuWa constellations)
interface ResonanceChainSequence {
  name: string;
  description: string;
}

interface ResonanceChain {
  _id: string;
  game: "wuwa";
  name: string;
  isTraveler?: boolean;
  elementVariants?: Record<string, Omit<ResonanceChain, "elementVariants" | "isTraveler">>;
  s1: ResonanceChainSequence;
  s2: ResonanceChainSequence;
  s3: ResonanceChainSequence;
  s4: ResonanceChainSequence;
  s5: ResonanceChainSequence;
  s6: ResonanceChainSequence;
  images: Record<"s1" | "s2" | "s3" | "s4" | "s5" | "s6", string>;
}

// Echo (individual echo monster)
type EchoClass = "Common" | "Elite" | "Overlord" | "Calamity";

interface EchoSkill {
  name: string;
  desc: string;
  params: number[][];
  cooldown: number;
}

interface Echo {
  _id: string;
  game: "wuwa";
  sourceId: string;
  name: string;
  description: string;
  element: string;
  echoClass: EchoClass;
  cost: 1 | 3 | 4;
  sonataSet: string;
  skill: EchoSkill;
  mainStatOptions: string[];
  images: { icon: string };
}

// Echo Set / Sonata Effect
interface EchoSet {
  _id: string;
  game: "wuwa";
  sourceId: string;
  name: string;
  description?: string;
  twoPieceBonus: string;
  fivePieceBonus: string;
  element?: string;
  images: { icon: string };
}
```

**Update existing `Character` interface** to add WuWa weapon types and elements to union types (they use the same `Character` interface but with different enum values).

---

### WW-11: Update `client/src/lib/api.ts`

**Difficulty:** Low | **Priority:** High

Add API client methods for WuWa-specific resources:

```typescript
// Forte (by character name only — no list endpoint needed)
getForte(game: Game, name: string): Promise<ApiResponse<Forte>>

// Resonance Chain (by character name only)
getResonanceChain(game: Game, name: string): Promise<ApiResponse<ResonanceChain>>

// Echoes (list + individual)
getEchoes(game: Game, params?: QueryParams): Promise<PaginatedResponse<Echo>>
getEcho(game: Game, name: string): Promise<ApiResponse<Echo>>

// Echo Sets / Sonatas (list + individual)
getEchoSets(game: Game, params?: QueryParams): Promise<PaginatedResponse<EchoSet>>
getEchoSet(game: Game, name: string): Promise<ApiResponse<EchoSet>>
```

---

## PHASE 5 — FRONTEND: IMAGE HELPERS

### WW-12: Update `client/src/lib/images.ts`

**Difficulty:** Low | **Priority:** High

Add WuWa CDN URL builder functions. Fill in actual CDN base URLs after completing WW-01.

```typescript
// Character images
export function wuwaCharacterIconUrl(images: Character["images"]): string
export function wuwaCharacterSplashUrl(images: Character["images"]): string
export function wuwaCharacterSideIconUrl(images: Character["images"]): string

// Element attribute icons
export function wuwaElementIconUrl(element: string): string
// e.g. → `${WUWA_CDN}/elements/${element}.png`

// Weapon type icons
// Try local static files first: /weapons/Icon_WuWa_{Type}.webp
// or share with Genshin's /weapons/Icon_{Type}.webp for "Sword" overlap
export function wuwaWeaponTypeIconUrl(weaponType: string): string

// Weapon images
export function wuwaWeaponIconUrl(images: Weapon["images"]): string

// Material images
export function wuwaMaterialIconUrl(sourceId: string): string

// Echo images
export function wuwaEchoIconUrl(images: Echo["images"]): string

// Forte skill icons
export function wuwaForteSkillIconUrl(icon: string): string

// Echo Set / Sonata icons
export function wuwaEchoSetIconUrl(images: EchoSet["images"]): string

// Stat icons (reuse local /stats/ assets where names overlap, add WuWa-specific ones)
export function wuwaStatIconUrl(statType: string): string
export function wuwaStatName(statType: string): string
```

**Add local static weapon type icons** to `client/public/weapons/`:
- `Icon_WuWa_Broadblade.webp`
- `Icon_WuWa_Pistols.webp`
- `Icon_WuWa_Gauntlets.webp`
- `Icon_WuWa_Rectifier.webp`
- Sword can reuse the existing `Icon_Sword.webp`

---

## PHASE 6 — FRONTEND: CONSTANTS

### WW-13: Update `client/src/lib/constants.ts`

**Difficulty:** Low | **Priority:** High

```typescript
// Mark WuWa as available
GAMES: [
  { id: "genshin", name: "Genshin Impact", available: true },
  { id: "hsr",     name: "Honkai: Star Rail", available: true },
  { id: "wuwa",    name: "Wuthering Waves", available: true },  // ← change to true
  ...
]

// WuWa elements (called "Attributes" in-game but "elements" in our codebase)
export const WUWA_ELEMENTS = [
  "Glacio", "Fusion", "Electro", "Aero", "Spectro", "Havoc"
] as const;

// WuWa weapon types
export const WUWA_WEAPON_TYPES = [
  "Sword", "Broadblade", "Pistols", "Gauntlets", "Rectifier"
] as const;

// WuWa element color classes (define Tailwind classes, add to tailwind config)
export const WUWA_ELEMENT_COLOR_MAP: Record<string, string> = {
  Glacio:  "bg-wuwa-glacio",   // ice blue
  Fusion:  "bg-wuwa-fusion",   // orange-red
  Electro: "bg-wuwa-electro",  // purple
  Aero:    "bg-wuwa-aero",     // teal/green
  Spectro: "bg-wuwa-spectro",  // gold/yellow
  Havoc:   "bg-wuwa-havoc",    // dark purple/crimson
};

// WuWa weapon type color classes (optional, for filter badges)
export const WUWA_WEAPON_TYPE_COLOR_MAP: Record<string, string> = { ... };

// WuWa Forte skill keys (for iteration)
export const WUWA_FORTE_SKILLS = [
  "basicAtk", "resonanceSkill", "resonanceLiberation", "forteCircuit", "introSkill"
] as const;

// WuWa echo cost class display info
export const WUWA_ECHO_CLASSES: Record<string, { label: string; cost: number }> = {
  Common:   { label: "Common",   cost: 1 },
  Elite:    { label: "Elite",    cost: 3 },
  Overlord: { label: "Overlord", cost: 4 },
  Calamity: { label: "Calamity", cost: 4 },
};
```

**Add Tailwind color tokens** for WuWa elements to `tailwind.config.ts`:
```typescript
// In theme.extend.colors:
"wuwa-glacio":  "#6ad4e8",
"wuwa-fusion":  "#f87c4e",
"wuwa-electro": "#bf77f6",
"wuwa-aero":    "#52d1ba",
"wuwa-spectro": "#f5c842",
"wuwa-havoc":   "#9b4dca",
```

---

## PHASE 7 — FRONTEND: CHARACTER DETAIL PAGE

### WW-14: Add WuWa Branch to `CharacterDetailPage.tsx`

**Difficulty:** High | **Priority:** High

The `CharacterDetailPage` already branches on `game` for Genshin vs HSR. Add a third branch for WuWa. The page structure closely mirrors HSR but with WuWa terminology.

**Header section:**
- Splash art background (same layout as existing)
- Character icon, name, title, rarity stars
- Element badge (Glacio, Fusion, etc.) using `wuwaElementIconUrl()`
- Weapon type badge (Sword, Broadblade, etc.) using `wuwaWeaponTypeIconUrl()`
- Region badge (WuWa nation/affiliation)

**Tabs:** Overview | Forte | Resonance Chain | Materials | Stats

**Overview tab:**
- Character description, title, element, weapon type, region
- Short stat summary at current level

**Stats tab:**
- Level slider: 1–90 with ascension breakpoints at 20/40/50/60/70/80
- Ascension phase selector (same UI as HSR)
- Stat table: HP, ATK, DEF, and specialized stat (crit rate, energy regen, etc.)
- Ascension-gated level display: show "Lv. 80 / Phase 5" etc.

**Forte tab:**
- Five skill sections (same component structure as HSR's Trace tab):
  - Basic Attack, Resonance Skill, Resonance Liberation, Forte Circuit, Intro Skill
  - Each: icon, name, level slider (1–10), description with parsed parameters, parameter table
- **Inherent Skills section** (below the 5 skills):
  - Display both inherent skills as milestone-unlocked passives (greyed out until ascension phase met)
  - Similar to HSR's "Major Traces" section
- **Stat Bonus Nodes section**:
  - List all stat bonuses (HP%, ATK%, DEF%, etc.) with their unlock phase
  - Similar to HSR's "Stat Bonuses" section

**Resonance Chain tab:**
- S1–S6 cards in grid layout
- Each card: sequence icon, name, description
- "Locked" overlay for sequences not yet unlocked (static display, no interactive unlock)
- Same design as HSR's Eidolon tab

**Materials tab:**
- Material calculator for:
  - **Ascension** (Phase 0→6): boss material + world material + common drop + currency
  - **Forte upgrades** (per-skill, Level 1→10): Forgery material + enemy drop + boss material + currency
  - **Total** (all skills, all ascensions)
- Phase/level selectors matching the Stats tab
- Material icons using `wuwaMaterialIconUrl()`
- Merge all materials using existing `mergeAllMaterials()` utility

**Rover-specific handling:**
- Same `isTraveler` check and element variant selector as Traveler/Trailblazer
- Show element selector tabs (Spectro | Havoc) in header
- Switch Forte/ResonanceChain data based on selected variant

**Key helper functions to add** (inside `CharacterDetailPage.tsx` or extracted to a utils file):
```typescript
// Parse WuWa skill descriptions (confirm placeholder format — likely similar to HSR)
function parseWuwaDesc(desc: string, params: number[][], level: number): string

// WuWa level → ascension phase (0-6)
function wuwaLevelToAscensionPhase(level: number): number
// Breakpoints: 20→1, 40→2, 50→3, 60→4, 70→5, 80→6

// Format WuWa parameters (reuse formatHsrParam or extend formatters.ts)
function formatWuwaParam(value: number, fmt: string): string
```

---

## PHASE 8 — FRONTEND: ECHO PAGES

### WW-15: Echo Sets List Page

**Difficulty:** Medium | **Priority:** Medium

Create `client/src/pages/EchoSetsPage.tsx` (or integrate into existing `ArtifactsPage.tsx` with game branching).

**Display per set card:**
- Set icon
- Set name
- 2-piece bonus (abbreviated)
- 5-piece bonus (abbreviated)
- Element badge (if applicable)
- Count of echoes belonging to this set (link to filtered echo list)

**Filtering:** Filter by element, search by name

---

### WW-16: Echo Set Detail Page

**Difficulty:** Medium | **Priority:** Medium

Create `client/src/pages/EchoSetDetailPage.tsx`.

**Display:**
- Set name, element, icon
- 2-piece and 5-piece bonus descriptions (full text)
- Gallery of all echoes in this set, grouped by cost class:
  - Overlord/Calamity echoes (cost 4)
  - Elite echoes (cost 3)
  - Common echoes (cost 1)
- Each echo card: icon, name, cost badge, element badge
- Link to individual echo details (optional — may not need a dedicated echo detail page)

---

## PHASE 9 — FRONTEND: MATERIAL CALCULATOR

### WW-17: Extend `client/src/lib/materials.ts` with WuWa Functions

**Difficulty:** Medium | **Priority:** Medium

Add WuWa-specific calculation functions alongside the existing Genshin ones:

```typescript
// WuWa resonator ascension level breakpoints (same as Genshin: 20/40/50/60/70/80/90)
export const WUWA_ASCENSION_LEVELS = [1, 20, 40, 50, 60, 70, 80, 90];

// Map level → ascension phase (0–6)
export function wuwaLevelToAscensionPhase(level: number): number

// Calculate ascension materials from target phase
export function wuwaCalculateAscensionMaterials(
  costs: Character["costs"],
  targetPhase: number
): MaterialCostEntry[]

// Calculate forte upgrade materials for a single skill
export function calculateForteMaterials(
  skillCosts: Record<string, MaterialCostEntry[]>,  // lvl2...lvl10
  targetLevel: number
): MaterialCostEntry[]

// Calculate total forte materials (all 5 skills to target level)
export function calculateAllForteMaterials(
  costs: Forte["costs"],
  targetLevels: Record<string, number>  // { basicAtk: 10, resonanceSkill: 10, ... }
): MaterialCostEntry[]

// WuWa EXP material calculation (pending EXP book names/values for WuWa)
// WuWa uses "Resonance Potion" tiers — verify specific names during WW-08
export function calculateWuwaExpMaterials(targetLevel: number): MaterialCostEntry[]
```

---

## PHASE 10 — POLISH & INTEGRATION

### WW-18: Navigation & Routing Updates

**Difficulty:** Low | **Priority:** Medium

- Add echo/echoset routes to `App.tsx` router:
  ```
  /wuwa/echosets          → EchoSetsPage
  /wuwa/echosets/:name    → EchoSetDetailPage
  ```
- Add WuWa to the game navigation sidebar/header
- Update the home/landing page to show WuWa as available

### WW-19: Filter/Sort Options for WuWa Pages

**Difficulty:** Low | **Priority:** Medium

- **Characters page:** Add WuWa elements and weapon types to filter dropdowns (game-specific filter sets)
- **Weapons page:** Add WuWa weapon types to filter
- **Echo/EchoSets pages:** Add element and cost class filters

### WW-20: Validation & Testing

**Difficulty:** Low | **Priority:** High (do last)

Confirm the following after all phases are complete:

- [ ] All characters seed correctly with pre-computed stats at each level
- [ ] Rover (Spectro/Havoc variants) displays and switches correctly
- [ ] Forte descriptions parse correctly with parameter substitution at each level
- [ ] Resonance Chain S1–S6 display without errors
- [ ] Echo cost budget logic is understood and communicated in the UI (display the 12-cost budget)
- [ ] Echo sets show correct 2pc/5pc bonuses
- [ ] Material calculator produces correct totals for ascension + forte upgrades
- [ ] All CDN image URLs resolve (no broken images)
- [ ] `wuwa` game is marked `available: true` in `constants.ts` GAMES array

---

## IMPLEMENTATION ORDER SUMMARY

```
Phase 0:  WW-00 → WW-01  (Research: data sources + CDN)
Phase 1:  WW-02           (Update existing models)
          WW-03 → WW-06   (New models: Forte, ResonanceChain, Echo, EchoSet)
Phase 2:  WW-07           (Routes)
Phase 3:  WW-08 → WW-09   (Seed: wuwaData.js + seedWuwa.js)
Phase 4:  WW-10 → WW-11   (Frontend: types + API client)
Phase 5:  WW-12           (Frontend: image helpers)
Phase 6:  WW-13           (Frontend: constants + Tailwind tokens)
Phase 7:  WW-14           (Frontend: CharacterDetailPage WuWa branch)
Phase 8:  WW-15 → WW-16   (Frontend: Echo pages)
Phase 9:  WW-17           (Frontend: material calculator)
Phase 10: WW-18 → WW-20   (Polish, routing, validation)
```

**Critical path:** WW-00 → WW-01 → WW-08/WW-09 (data sourcing is the biggest risk; everything else is mechanical work once the data is confirmed)

---

## OPEN QUESTIONS

These need to be answered during WW-00/WW-01 before implementation:

1. **Data source format**: What is the exact JSON structure in `Dimbreath/WutheringData` for characters, weapons, echoes, and skill trees? Are field names in English or are they internal IDs requiring TextMap resolution?

2. **CDN asset availability**: What is a reliable, stable CDN URL pattern for WuWa character/weapon/echo images? Does Enka.network expose WuWa assets at a known path?

3. **Skill description format**: Do WuWa skill descriptions use `{param1:F2P}` placeholders like HSR, or a different format? This affects the `parseWuwaDesc()` implementation.

4. **Forte upgrade material structure**: What are the exact tiers and names of Forgery Challenge materials, enemy drops, and boss materials? Are they structured like HSR trace materials (3-tier rarity)? Are Shell Credits stored per-level?

5. **WuWa EXP book names**: What are the Resonance Potion / EXP material names and values (like Genshin's Hero's Wit 20k / Adventurer's Exp 5k)?

6. **Rover future variants**: Will additional Rover elements be added in future patches? Confirm the `elementVariants` pattern supports this (it does — same as Trailblazer).

7. **Echo skill param format**: Do echo skills use the same parameter placeholder format as forte skills? Echo skills may vary by echo level (0–25) or be static.

8. **Region terminology**: WuWa nations/regions (Jinzhou, Huanglong, Mt. Firmament, etc.) — confirm field name and values during data sourcing.

---

*Sources consulted for this roadmap:*
- *[resonance-rest/api — WuWa REST API reference](https://github.com/resonance-rest/api)*
- *[Dimbreath/WutheringData — Raw game data](https://github.com/Dimbreath/WutheringData)*
- *[Arikatsu/WutheringWaves_Data — Datamined data](https://github.com/Arikatsu/WutheringWaves_Data)*
- *[soevielofficial/wuwa-assets — Asset repository](https://github.com/soevielofficial/wuwa-assets)*
- *[Wuthering Waves Resonator Progression — Game Rant](https://gamerant.com/wuthering-waves-wuwa-ascension-sol-3-phase-guide/)*
- *[Echo Guide — Prima Games](https://primagames.com/gaming/wuthering-waves-echo-guide-cost-sonata-effects-stats-and-upgrading-explained)*
- *[Forte Guide — Game8](https://game8.co/games/Wuthering-Waves/archives/455396)*
