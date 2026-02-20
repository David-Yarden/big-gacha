# Big Gacha -- Structured Implementation Roadmap

Version: 1.1 Purpose: Clear execution guide for implementation in Claude
Code Scope: Frontend, Data Model, State Management, UI/UX

============================================================ SECTION 1
--- DATA MODEL REFACTOR
============================================================

TASK DG-01 --- Character Schema Upgrade Difficulty: Medium Priority:
High

Objectives: - Ensure each character object includes: - id - name -
elements (array, not single value) - weaponType - region (nullable but
validated) - ascensionStat { type, scaling\[\] } - baseStats { level: {
hp, atk, def } } - talents (element-based variants) - constellations
(element-based variants if needed)

Implementation Notes: - Convert single-element characters to array
format for consistency. - Add validation layer to prevent undefined
regions. - Ensure backward compatibility with existing components.

------------------------------------------------------------------------

TASK DG-02 --- Traveler Multi-Element Structure Difficulty: High
Priority: Critical

Characters: - Aether - Lumine - Manekin - Manekina

Objectives: - Replace element field with elementVariants:
elementVariants: { anemo: { talents, constellations }, geo: { talents,
constellations }, electro: { talents, constellations }, etc. }

Implementation Notes: - Use dynamic key lookup for activeElement. -
Default to first unlocked element. - Ensure no "Element: None" fallback
remains.

------------------------------------------------------------------------

TASK DG-03 --- Materials Schema Validation Difficulty: Medium Priority:
High

Objectives: - Validate imagePath exists for all materials. - Add
fallbackImage field. - Correct versionAdded metadata.

Implementation Notes: - Create script to detect missing images. - Ensure
consistent naming convention.

============================================================ SECTION 2
--- ICON SYSTEM CONSOLIDATION
============================================================

TASK UI-01 --- Centralized Icon Mapping Difficulty: Low Priority: Medium

Objectives: - Create single source of truth for: - statIcons -
elementIcons - weaponIcons

Example Structure: iconMap = { HP: "/icons/hp.png", ATK:
"/icons/atk.png", Pyro: "/icons/pyro.png" }

Implementation Notes: - Replace all hardcoded paths. - Enforce
consistent sizing via CSS class.

============================================================ SECTION 3
--- MAIN MENU REWORK
============================================================

TASK MM-01 --- Replace Stats Overview with Title Image Difficulty: Low
Priority: Medium

Current Behavior: - Main menu displays number of characters, weapons,
artifacts, items, etc.

Required Change: - Remove the statistics overview section. - Replace it
with the Genshin title image already added to the project files.

Implementation Notes: - Import the existing title image asset. - Center
the image responsively. - Ensure proper scaling for desktop and
mobile. - Remove unused stats components if no longer needed. - Keep
layout clean and minimal.

============================================================ SECTION 4
--- CHARACTER PAGE ENHANCEMENTS
============================================================

TASK CP-01 --- Ascension Stat Display Difficulty: Medium Priority: High

Objectives: - Display ascension stat in character container. - Add stat
icon. - Ensure correct scaling at selected level.

Logic: finalStat = baseStat + ascensionBonus\[level\]

------------------------------------------------------------------------

TASK CP-02 --- Region Fixes Difficulty: Low Priority: Medium

Objectives: - Prevent blank region rendering. - Add "Others" fallback
category. - Correct Zibai region → Liyue. - Fix Manekin and Manekina
blank region display.

Implementation Notes: - Use conditional fallback: region \|\| "Others"

------------------------------------------------------------------------

TASK CP-03 --- Element Selector Component Difficulty: High Priority:
Critical

Objectives: - Add dropdown/selector inside Traveler pages. - Update
dynamically: - Element icon - Talents - Constellations - Passive skills

Implementation Notes: - Use reactive state variable: activeElement. -
Ensure full re-render of dependent components. - No page reload allowed.

============================================================ SECTION 5
--- ASCENSION PAGE LOGIC
============================================================

TASK AP-01 --- Dynamic Base Stat Scaling Difficulty: Medium Priority:
High

Objectives: - Calculate total base stats per level. - Attach correct
stat icon next to each stat.

Implementation Notes: - Use computed values based on selectedLevel
state. - Avoid recalculation loops.

------------------------------------------------------------------------

TASK AP-02 --- Talent Level Sliders Difficulty: Medium Priority: High

Objectives: - Add slider for: - Normal Attack - Elemental Skill -
Elemental Burst

Implementation Notes: - Range: 1--10 (or 13 if constellations active). -
Dynamically update displayed multipliers.

============================================================ SECTION 6
--- WEAPON PAGE REWORK
============================================================

TASK WP-01 --- Refinement Value Formatting Difficulty: Medium Priority:
Medium

Objectives: - Replace "Value 1", "Value 2", etc. - Display inline
refinement-scaled numbers. - Highlight active refinement values.

UI Rules: - Bold font - Highlight class applied to active refinement
value

Implementation Notes: - Parse scaling array based on selected refinement
level.

============================================================ SECTION 7
--- MATERIALS PAGE FIXES
============================================================

TASK MP-01 --- Image Completion Difficulty: Medium Priority: High

Objectives: - Ensure all materials render images. - Validate paths. -
Apply fallback if missing.

------------------------------------------------------------------------

TASK MP-02 --- Image Placement Difficulty: Low Priority: Medium

Objectives: - Display image beside material name. - Ensure spacing
consistency.

============================================================ SECTION 8
--- FILTERING SYSTEM
============================================================

TASK FS-01 --- Region Filter Implementation Difficulty: Medium Priority:
Medium

Objectives: - Add region filter dropdown. - Include "Others" category. -
Filter dynamically without reload.

Implementation Notes: - Use derived filteredCharacters array. - Maintain
existing sorting logic.

============================================================ EXECUTION
ORDER RECOMMENDATION
============================================================

Phase 1 (Critical Core Logic) - DG-02 Traveler Multi-Element - CP-03
Element Selector - MP-01 Material Image Fixes

Phase 2 (Core Display Accuracy) - DG-01 Schema Upgrade - CP-01 Ascension
Stat Display - AP-01 Base Stat Scaling - AP-02 Talent Sliders

Phase 3 (UI & Polish) - UI-01 Icon Mapping - WP-01 Refinement
Formatting - FS-01 Region Filter - CP-02 Region Fixes - MP-02 Image
Placement - MM-01 Main Menu Rework

============================================================

End of Roadmap
