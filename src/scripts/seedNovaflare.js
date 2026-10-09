/**
 * Novaflare: Character Enhancement — Data Seeder (HSR)
 *
 * Populates the `novaflare` field on both Eidolon and Trace documents with the
 * enhanced data for each Novaflare character. Only changed/enhanced data is
 * stored; unchanged items fall back to the base data at render time.
 *
 * Eidolons: only the changed e1–e6 slots are stored. Also restores confirmed
 *   pre-Novaflare descriptions to e1–e6 so the "Original" toggle is accurate.
 *
 * Traces: the full current skill kit is fetched from Mar-7th/StarRailRes
 *   (which reflects the current Novaflare-enhanced state) and stored in the
 *   `novaflare` sub-document. The base fields are left untouched.
 *
 * Characters enhanced:
 *   v3.4 — Jingliu, Blade, Kafka, Silver Wolf
 *   v4.0 — Sparkle, Black Swan
 *
 * Run: npm run seed:novaflare
 */

require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const { fetchHsr, cdnUrl } = require("./hsrData");

// ── Novaflare character names (must match the `name` field in the DB) ─────────

const NOVAFLARE_NAMES = [
  "Jingliu",
  "Blade",
  "Kafka",
  "Silver Wolf",
  "Sparkle",
  "Black Swan",
];

// ── Novaflare-enhanced eidolons ───────────────────────────────────────────────
// Only the eidolons whose description changed. UI merges these over base data.

const NOVAFLARE_EIDOLONS = {
  Jingliu: {
    e1: {
      name: "Moon Crashes Tianguan Gate",
      description:
        "When using her Ultimate or Enhanced Skill, Jingliu's CRIT DMG increases by 36% for 1 turn(s). Moreover, additionally deals 1 instance of Ice DMG equal to 80% of Jingliu's Max HP to the primary target.",
    },
    e4: {
      name: "Lunarlance Shines Skyward Dome",
      description:
        "While in the Spectral Transmigration state, each stack of Moonlight additionally increases CRIT DMG by 20%.",
    },
    e6: {
      name: "Eclipse Hollows Corporeal Husk",
      description:
        "When Jingliu enters the Spectral Transmigration state, the Syzygy stack limit increases by 1, and Jingliu obtains 2 stack(s) of Syzygy. While she is in the Spectral Transmigration state, her Ice RES PEN increases by 30%.",
    },
  },
  Blade: {
    e1: {
      name: "Blade Cuts the Deepest in Hell",
      description:
        "Blade's Enhanced Basic ATK and Ultimate deal additionally increased DMG to one designated enemy, with the increased amount equal to 150% of the tally of Blade's HP loss from his Ultimate.",
    },
  },
  Kafka: {
    e1: {
      name: "Da Capo",
      description:
        "When Kafka attacks enemies, there is a 100% base chance to increase the DoT received by the target by 30% for 2 turn(s).",
    },
    e2: {
      name: "Fortississimo",
      description: "While Kafka is on the field, DoT dealt by all allies increases by 33%.",
    },
  },
  "Silver Wolf": {
    e2: {
      name: "Zombie Network",
      description:
        "When any enemy target enters battle, increases their DMG taken by 20%. When an enemy target receives an attack from ally targets, Silver Wolf has a 100% base chance to implant the attacked enemy target with 1 random Bug.",
    },
  },
  Sparkle: {
    e1: {
      name: "Suspension of Disbelief",
      description:
        "The Cipher effect granted by the Ultimate lasts for 1 extra turn. All allies with Cipher have their ATK increased by 40%. When the battle starts or when using Skill, increases Sparkle's SPD by 15%, lasting for 2 turn(s).",
    },
  },
  "Black Swan": {
    e2: {
      name: "Weep Not For Me, My Lamb",
      description: "At the start of battle, inflicts 30 stack(s) of Arcana on all enemies.",
    },
    e4: {
      name: "In Tears We Gift",
      description:
        "While in the Epiphany state, enemy targets have their DMG taken increased by 20%. At the start of each enemy turn or when enemy targets in the Epiphany state are defeated, Black Swan regenerates 8 Energy. This effect is not subject to a 1-time trigger limit.",
    },
    e6: {
      name: "Pantheon Merciful, Masses Pitiful",
      description:
        "When enemy targets get attacked by Black Swan's allies, Black Swan has a 65% base chance of inflicting 1 stack of Arcana on that target, and there is a 50% fixed chance to additionally increase the Arcana stacks applied by 1. The maximum Arcana stack count for enemies is increased by 20.",
    },
  },
};

// ── Original (pre-Novaflare) eidolons ─────────────────────────────────────────
// Restores e1–e6 descriptions to the pre-buff text so the "Original" toggle
// is accurate even if seedHsr.js was run after the Novaflare patch went live.
// Only slots with confirmed original text are included.

const ORIGINAL_EIDOLONS = {
  Jingliu: {
    e1: {
      description:
        "When using her Ultimate or Enhanced Skill, Jingliu's CRIT DMG increases by 24% for 1 turn(s). If only one enemy target is attacked, the target will additionally be dealt Ice DMG equal to 100% of Jingliu's ATK.",
    },
    e4: {
      description:
        "During the Spectral Transmigration state, the ATK gained from consuming allies' HP is additionally increased by 90% of the total HP consumed from the entire team. The cap for ATK gained this way also increases by 30%.",
    },
    e6: {
      description:
        "When Jingliu enters the Spectral Transmigration state, the Syzygy stack limit increases by 1, and Jingliu obtains 1 stack(s) of Syzygy. While she is in the Spectral Transmigration state, her CRIT DMG increases by 50%.",
    },
  },
  Blade: {
    e1: {
      description:
        "Blade's Ultimate deals additionally increased DMG to a single enemy target, with the increased amount equal to 150% of the tally of Blade's HP loss in the current battle.",
    },
  },
  Kafka: {
    e1: {
      description:
        "When the Talent triggers a follow-up attack, there is a 100% base chance to increase the DoT received by the target by 30% for 2 turn(s).",
    },
    e2: {
      description: "While Kafka is on the field, DoT dealt by all allies increases by 25%.",
    },
  },
  "Silver Wolf": {
    e2: {
      description: "When an enemy enters battle, reduces their Effect RES by 20%.",
    },
  },
  "Black Swan": {
    e2: {
      description:
        "When an enemy target afflicted with Arcana is defeated, there is a 100% base chance of inflicting 6 stack(s) of Arcana on adjacent targets.",
    },
  },
  // Sparkle E1 original text unclear — skipping to avoid incorrect data.
  // Black Swan E4 / E6 original text uncertain — skipping.
};

// ── Skill parsing helpers (mirrors seedHsr.js logic) ─────────────────────────

const SKILL_KEY_MAP = {
  "Basic ATK":     "basicAtk",
  "Skill":         "skill",
  "Ultimate":      "ultimate",
  "Talent":        "talent",
  "Technique":     "technique",
  "Elation Skill": "elation",
};

function parseSkillDesc(skill) {
  if (!skill) return null;
  return {
    name:     skill.name,
    maxLevel: skill.max_level,
    desc:     skill.desc,
    params:   skill.params ?? [],
    icon:     cdnUrl(skill.icon),
  };
}

/**
 * Parse a character's skill tree into { basicAtk, skill, ultimate, talent,
 * technique, majorTraces, statBonuses } using the same logic as seedHsr.js.
 */
function parseCharacterTraces(char, skills, skillTrees) {
  const skillData    = {};
  const majorTraces  = [];
  const statBonuses  = [];
  const seenSkillIds = new Set();

  for (const nodeId of char.skill_trees ?? []) {
    const node = skillTrees[nodeId];
    if (!node) continue;

    if (node.level_up_skills?.length > 0) {
      const firstSkillId = node.level_up_skills[0].id;
      if (seenSkillIds.has(firstSkillId)) continue;
      seenSkillIds.add(firstSkillId);

      const firstSkill = skills[firstSkillId];
      if (!firstSkill) continue;

      const key = SKILL_KEY_MAP[firstSkill.type_text];
      if (key) {
        skillData[key] = parseSkillDesc(firstSkill);
      }
    } else {
      const props       = node.levels?.[0]?.properties ?? [];
      const unlockPhase = node.levels?.[0]?.promotion ?? 0;
      if (node.desc) {
        majorTraces.push({
          name:        node.name,
          desc:        node.desc,
          params:      node.params ?? [],
          icon:        cdnUrl(node.icon),
          unlockPhase,
        });
      } else {
        for (const prop of props) {
          statBonuses.push({ stat: prop.type, value: prop.value, unlockPhase });
        }
      }
    }
  }

  // Only store the 5 active skills. majorTraces and statBonuses are excluded because
  // the current API includes both old and new nodes for Novaflare-reworked characters,
  // which would cause doubled rendering on the frontend.
  return { ...skillData };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  await connectDB();
  console.log("Seeding Novaflare: Character Enhancement data...\n");

  // ── Eidolons ──────────────────────────────────────────────────────────────
  console.log("── Eidolons ──");
  const eidolonCol = mongoose.connection.db.collection("eidolons");
  let eidolonCount = 0;

  for (const [name, novaflare] of Object.entries(NOVAFLARE_EIDOLONS)) {
    const setPayload = { novaflare };

    const original = ORIGINAL_EIDOLONS[name];
    if (original) {
      for (const [slot, data] of Object.entries(original)) {
        if (data.description) {
          setPayload[`${slot}.description`] = data.description;
        }
      }
    }

    const result = await eidolonCol.updateOne(
      { game: "hsr", name },
      { $set: setPayload }
    );

    if (result.matchedCount === 0) {
      console.warn(`  ⚠  Eidolon not found: ${name}`);
    } else {
      const slots     = Object.keys(novaflare).join(", ");
      const origSlots = original ? Object.keys(original).join(", ") : "none";
      console.log(`  ✓ ${name}  novaflare: (${slots})  original restored: (${origSlots})`);
      eidolonCount++;
    }
  }

  // ── Traces ────────────────────────────────────────────────────────────────
  console.log("\n── Traces ──");

  let characters, skills, skillTrees;
  try {
    [characters, skills, skillTrees] = await Promise.all([
      fetchHsr("characters.json"),
      fetchHsr("character_skills.json"),
      fetchHsr("character_skill_trees.json"),
    ]);
  } catch (err) {
    console.error("  ✗ Failed to fetch HSR data from Mar-7th/StarRailRes:", err.message);
    console.log("\nSkipping trace seeding — check your internet connection and try again.");
    console.log(`\n✅ Done — ${eidolonCount} eidolon documents updated, 0 trace documents updated.`);
    await mongoose.disconnect();
    return;
  }

  // Build name → character record map (use the first character entry per name)
  const nameToChar = {};
  for (const char of Object.values(characters)) {
    if (!nameToChar[char.name]) {
      nameToChar[char.name] = char;
    }
  }

  const traceCol = mongoose.connection.db.collection("traces");
  let traceCount = 0;

  for (const name of NOVAFLARE_NAMES) {
    const char = nameToChar[name];
    if (!char) {
      console.warn(`  ⚠  Character not found in API data: ${name}`);
      continue;
    }

    const novaflareTraces = parseCharacterTraces(char, skills, skillTrees);
    const keys = Object.keys(novaflareTraces).join(", ");

    if (Object.keys(novaflareTraces).length === 0) {
      console.warn(`  ⚠  No trace data parsed for: ${name}`);
      continue;
    }

    const result = await traceCol.updateOne(
      { game: "hsr", name },
      { $set: { novaflare: novaflareTraces } }
    );

    if (result.matchedCount === 0) {
      console.warn(`  ⚠  Trace document not found: ${name}`);
    } else {
      console.log(`  ✓ ${name}  (${keys})`);
      traceCount++;
    }
  }

  console.log(
    `\n✅ Done — ${eidolonCount} eidolon documents updated, ${traceCount} trace documents updated.`
  );
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
