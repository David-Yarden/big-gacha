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
// Structure: { [characterName]: { c1: "...", c2: "...", … } }
// Values contain only the text that is new/changed in the Hexerei buffed state.
const HEXEREI_CONSTELLATIONS = {
  Venti: {
    c1: "2 extra arrows that track opponents will be fired per Windsunder Arrow, each dealing 20% of the original arrow's DMG. This effect can be triggered once every 0.25s.",
    c2: "Skyward Sonnet's Anemo and Physical RES reduction is increased to 24% for 10s. After unleashing Wind's Grand Ode, Venti gains the Wherever a Breeze Blows effect and the cooldown for Skyward Sonnet is reset. After a Windsunder Arrow hits an opponent, there is also a 25% chance for Venti to gain the Wherever a Breeze Blows effect.",
    c4: "After unleashing Skyward Sonnet or Wind's Grand Ode, Venti and his own active party members gain a 25% Anemo DMG Bonus for 10s.",
    c6: "The DMG Venti deals to affected opponents gains a CRIT DMG Bonus of 100%.",
  },
  Klee: {
    c1: "For 12s after triggering the above effect, Klee's ATK is increased by 60%.",
    c2: "When Klee's Elemental Skill hits an opponent, that opponent's DEF will be decreased by 23% for 10s.",
    c4: "The explosion also triggers when Sparks 'n' Splash ends. If Klee is on-field when the explosion occurs, its DMG will be increased by 100%.",
    c6: "Klee also gains a 50% Pyro DMG Bonus for 25s after using Sparks 'n' Splash. When Klee uses an Explosive Spark, there is a 50% chance it will not be consumed. While Sparks 'n' Splash is active, Klee's Normal Attacks have a 40% chance on the first and second hits to consume an Explosive Spark, dealing an additional attack equivalent to Boom-Boom Strike to her opponent(s).",
  },
  Albedo: {
    c1: "Using Abiogenesis: Solar Isotoma increases Albedo's DEF by 50% for the next 20s.",
    c2: "When Albedo is not on the field and Fatal Reckoning reaches 4 stacks, all stacks are consumed and 3 Fatal Blossoms are generated near the active character, dealing AoE Geo DMG equal to 300% of Albedo's DEF.",
    c4: "When a nearby active party member jumps near a Silver Isotoma, the Silver Isotoma will be destroyed while greatly increasing the height of that jump, and for the next 3s, said character will deal 30% more Plunging Attack ground impact DMG.",
    c6: "Use of Rite of Progeniture: Tectonic Tide destroys all Silver Isotomas present on the field. Each Silver Isotoma destroyed this way is treated as clearing 4 stacks of Fatal Reckoning.",
  },
  Mona: {
    c1: "When your off-field party members trigger the above effect, the DMG Bonus to the above Hydro-related Elemental Reactions is enhanced to 160% of its original effect.",
    c2: "Within 5s after Mona unleashes her Elemental Burst Stellaris Phantasm, her next Normal Attack that hits an enemy will automatically trigger a Charged Attack. The aforementioned Charged Attack effect can only occur once every 5s. When Mona's Charged Attack hits an opponent, all nearby party members will have their Elemental Mastery increased by 80 for 12s.",
    c4: "When any Hexerei party member attacks an opponent affected by an Omen, their CRIT DMG is increased by 15%.",
    c6: "While Mona is the active character, while she is in the Illusory Torrent state or there are opponents affected by an Omen nearby, she gains a 60% increase to the DMG of her next Charged Attack per second of movement. A maximum DMG Bonus of 180% can be achieved in this manner. The effect lasts for no more than 8s. Additionally, the DMG Mona's Charged Attacks deal to opponents affected by an Omen will be increased to 200% of the original DMG.",
  },
  Fischl: {
    c6: "After Oz performs a coordinated attack, the ATK and Elemental Mastery bonuses from Witch's Eve Rite: Phantasmal Nocturne are further increased by 100% for 10s.",
  },
  Razor: {
    c6: "When Razor gains Electro Sigils through Claw and Thunder, he will gain 3 Sigils instead. For 15s after consuming Electro Sigils, Razor's CRIT Rate is increased by 10% and CRIT DMG by 50%.",
  },
  Sucrose: {
    c6: "Nearby Hexerei characters in the party gain an additional 8.57142% Elemental DMG Bonus for the corresponding absorbed element during the skill's duration.",
  },
};

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
