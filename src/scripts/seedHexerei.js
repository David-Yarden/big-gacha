/**
 * Hexerei: Secret Rite — Data Seeder (Genshin Impact v6.2 / Luna III)
 *
 * Adds hexerei buff text to the affected talent and constellation slots
 * for the 8 Hexerei-designated characters. Does NOT overwrite any existing data;
 * only sets the `hexerei` field on each document.
 *
 * Run: npm run seed:hexerei
 */

require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");

// ── Hexerei talent additions ──────────────────────────────────────────────────
// Keyed by character name → { [slot]: "description" }
// Slots match genshin-db keys: combat1, combat2, combat3, passive1, passive2, passive3

const HEXEREI_TALENTS = {
  Venti: {
    combat1:
      "While Stormseye is active, Venti's Normal and Charged Attacks are infused with Anemo DMG. This infusion cannot be overridden by other elemental infusions.",
    combat3:
      "Wind's Grand Ode deals 135% increased DMG. The Stormeye is now summoned at the location of the targeted opponent.",
  },
  Klee: {
    combat1:
      "Klee's Normal Attack combo no longer resets. When the 3rd Normal Attack in the sequence is used, it consumes an Explosive Spark and triggers a Coordinated Charged Attack, dealing bonus Pyro DMG.",
  },
  Albedo: {
    combat2:
      "Abiogenesis: Solar Isotoma additionally creates Silver Isotomas that also generate Transient Blossoms. All nearby party members' DMG is increased based on Albedo's DEF. Hexerei party members receive an even greater DMG bonus.",
  },
  Mona: {
    combat1:
      "Normal and Charged Attacks that hit opponents afflicted by Omen extend the Omen's remaining duration.",
    combat3:
      "Attacks against opponents afflicted by Omen build up Astral Glow stacks. Each stack increases Vaporize reaction DMG dealt by all party members by 5%, up to a maximum of 5 stacks (25%).",
  },
  Fischl: {
    passive1:
      "While Oz is on the field, triggering Overloaded increases all party members' ATK by 22.5% for 10s. Triggering Electro-Charged increases all party members' Elemental Mastery by 90 for 10s.",
  },
  Razor: {
    combat3:
      "Lightning Fang additionally deals AoE Electro DMG equal to 70% of Razor's ATK. While Lightning Fang is active, Razor periodically calls down additional lightning strikes on nearby opponents.",
  },
  Sucrose: {
    combat2:
      "After Forbidden Creation — Isomer 75 / Type II is created, all party members' Normal Attack, Charged Attack, Plunging Attack, Elemental Skill, and Elemental Burst DMG is increased for 15s. Hexerei party members receive an enhanced bonus.",
  },
  Durin: {
    passive1:
      "All effects of Light Manifest of the Divine Calculus (except its Duration) are increased by 75%.",
  },
};

// ── Hexerei constellation additions ──────────────────────────────────────────
// Populated when exact per-constellation text is confirmed.
// Structure: { [characterName]: { c1: "...", c2: "...", … } }
const HEXEREI_CONSTELLATIONS = {};

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  await connectDB();
  console.log("Seeding Hexerei: Secret Rite data...\n");

  const talentsCol = mongoose.connection.db.collection("talents");
  const constsCol  = mongoose.connection.db.collection("constellations");

  // Talents
  let talentUpdated = 0;
  for (const [name, hexerei] of Object.entries(HEXEREI_TALENTS)) {
    const result = await talentsCol.updateOne(
      { game: "genshin", name },
      { $set: { hexerei } }
    );
    if (result.matchedCount === 0) {
      console.warn(`  ⚠  Talent not found: ${name}`);
    } else {
      console.log(`  ✓ Talent   ${name} (${Object.keys(hexerei).join(", ")})`);
      talentUpdated++;
    }
  }

  // Constellations
  let constUpdated = 0;
  for (const [name, hexerei] of Object.entries(HEXEREI_CONSTELLATIONS)) {
    const result = await constsCol.updateOne(
      { game: "genshin", name },
      { $set: { hexerei } }
    );
    if (result.matchedCount === 0) {
      console.warn(`  ⚠  Constellation not found: ${name}`);
    } else {
      console.log(`  ✓ Const.   ${name} (${Object.keys(hexerei).join(", ")})`);
      constUpdated++;
    }
  }

  console.log(`\n✅ Done — ${talentUpdated} talents, ${constUpdated} constellations updated.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
