/**
 * English / French.
 *
 * - Game texts: the official French texts imported by the sync (`i18n.fr` on each
 *   document, see src/sync/i18n.js) are laid over the English ones as API responses
 *   arrive (`localizeData`, called by the API client). The English name stays in `_name`.
 * - Interface: a dictionary of the site's own labels, applied to the page's text nodes
 *   and to placeholder / title / aria-label attributes (`startUiTranslation`).
 *
 * The choice is kept in the browser; switching reloads the page so every request and
 * label follows it.
 */

export type Lang = "en" | "fr";

const KEY = "big-gacha-lang";

export function getLang(): Lang {
  try {
    return localStorage.getItem(KEY) === "fr" ? "fr" : "en";
  } catch {
    return "en";
  }
}

export function setLang(lang: Lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* private mode: stays for this page only */
  }
  window.location.reload();
}

export const LANG: Lang = getLang();
export const LOCALE = LANG === "fr" ? "fr-FR" : "en-US";

// ── Game texts ───────────────────────────────────────────────────────────────

type Json = unknown;

/** Lay a translation over a value (same rules as textDiff on the server). */
function overlay(base: Json, tr: Json): Json {
  if (tr === null || tr === undefined) return base;
  if (typeof tr !== "object") return tr;
  if (Array.isArray(tr)) {
    if (Array.isArray(base) && base.length === tr.length) return base.map((v, i) => (tr[i] === null ? v : overlay(v, tr[i])));
    return tr;
  }
  const t = tr as Record<string, Json>;
  if ("$replace" in t) return t.$replace;
  const out: Record<string, Json> = base && typeof base === "object" && !Array.isArray(base) ? { ...(base as Record<string, Json>) } : {};
  for (const [k, v] of Object.entries(t)) out[k] = overlay(out[k], v);
  return out;
}

/** Every document of an API response with its French texts (in place where possible). */
export function localizeData<T>(data: T): T {
  if (LANG === "en") return data;
  const walk = (v: Json): Json => {
    if (Array.isArray(v)) return v.map(walk);
    if (!v || typeof v !== "object") return v;
    const o = v as Record<string, Json>;
    let out: Record<string, Json> = o;
    const fr = (o.i18n as Record<string, Json> | undefined)?.fr;
    if (fr && typeof fr === "object") {
      out = overlay(o, fr) as Record<string, Json>;
      if (typeof o.name === "string") out._name = o.name;
    }
    for (const [k, x] of Object.entries(out)) if (k !== "i18n" && x && typeof x === "object") out[k] = walk(x);
    return out;
  };
  return walk(data) as T;
}

/** English name of a localized document (for code that needs the stable key). */
export const keyName = (d: { name: string; _name?: string }) => d._name ?? d.name;

// ── Interface ────────────────────────────────────────────────────────────────

const UI: Record<string, string> = {
  // Navigation and pages
  Characters: "Personnages", Agents: "Agents", Resonators: "Résonateurs", Operators: "Opérateurs",
  Versions: "Versions", Banners: "Bannières", Weapons: "Armes", "Light Cones": "Cônes de lumière",
  "W-Engines": "Moteurs-amplis", Artifacts: "Artéfacts", Relics: "Reliques", "Drive Discs": "Disques",
  "Gear Sets": "Sets d'équipement", Echoes: "Échos", "Sonata Effects": "Effets de sonate", Bangboos: "Bangbous",
  Materials: "Matériaux", Updates: "Mises à jour", "Select Game": "Choisir un jeu", "Back to Home": "Retour à l'accueil",
  "Page not found": "Page introuvable", "Search all games": "Rechercher dans tous les jeux",
  "Search all games…": "Rechercher dans tous les jeux…", "Open menu": "Ouvrir le menu", "Close menu": "Fermer le menu",
  Close: "Fermer", "No result": "Aucun résultat",
  "Search…": "Rechercher…", "Search...": "Rechercher...",
  "Characters, weapons, gear and materials of your gacha games, in one place.":
    "Personnages, armes, équipements et matériaux de tes jeux gacha, au même endroit.",
  "Type at least 2 letters — characters, weapons, sets, echoes, materials…":
    "Tape au moins 2 lettres : personnages, armes, sets, échos, matériaux…",
  "Searching…": "Recherche…", "New data — open Updates": "Nouvelles données : ouvre les mises à jour",
  "Last sync failed — open Updates": "Échec de la dernière synchro : ouvre les mises à jour",
  "Summary from community sources — exact values not verified": "Résumé de sources communautaires, valeurs exactes non vérifiées",
  "Live games": "Jeux disponibles", "Upcoming games": "Jeux à venir",
  // Lists, filters, sorting
  "Sort:": "Tri :", Name: "Nom", Release: "Sortie", All: "Tous", Rarity: "Rareté", Element: "Élément",
  Path: "Voie", Weapon: "Arme", Region: "Région", Faction: "Faction", Class: "Classe", Specialty: "Spécialité",
  Type: "Type", Enhancement: "Amélioration", "No results found": "Aucun résultat",
  "Try adjusting your filters": "Essaie de modifier les filtres", "No characters found": "Aucun personnage trouvé",
  "No weapons found": "Aucune arme trouvée", "No light cones found": "Aucun cône de lumière trouvé",
  "No materials found": "Aucun matériau trouvé", "No sets found": "Aucun set trouvé",
  "No artifact sets found": "Aucun set d'artéfacts trouvé", "No echoes found": "Aucun écho trouvé",
  "No sonata effects found": "Aucun effet de sonate trouvé", "No Bangboo found": "Aucun Bangbou trouvé",
  "Search weapons...": "Rechercher une arme...", "Search light cones...": "Rechercher un cône de lumière...",
  "Search materials...": "Rechercher un matériau...", "Search relic sets...": "Rechercher un set...",
  "Search artifact sets...": "Rechercher un set d'artéfacts...", "Search echoes...": "Rechercher un écho...",
  "Search sonata effects...": "Rechercher un effet de sonate...", "Search Bangboos...": "Rechercher un Bangbou...",
  "Search characters...": "Rechercher un personnage...", "Search agents...": "Rechercher un agent...",
  "Search resonators...": "Rechercher un résonateur...", "Search operators...": "Rechercher un opérateur...",
  "Search combatants...": "Rechercher un combattant...", "Search partners...": "Rechercher un partenaire...",
  "Search memory fragments...": "Rechercher un fragment de mémoire...",
  Planar: "Planaire", Relic: "Relique", "Planar Ornaments": "Ornements planaires", Others: "Autres", Other: "Autre",
  // Character page
  Ascension: "Élévation", "Ascension Materials": "Matériaux d'élévation", "Character Ascension": "Élévation du personnage",
  "Ascension stat": "Stat d'élévation", "Total Material Cost": "Coût total en matériaux", "Grand Total": "Total général",
  "No materials required": "Aucun matériau requis", Material: "Matériau", Count: "Quantité", Level: "Niveau",
  Breakthrough: "Percée", Skills: "Compétences", Talents: "Aptitudes", Constellations: "Constellations",
  Constellation: "Constellation", Traces: "Traces", Trace: "Trace", Eidolons: "Eidolons", Eidolon: "Eidolon",
  Forte: "Forte", Fortes: "Fortes", "Resonance Chain": "Chaîne de résonance", "Resonance Chains": "Chaînes de résonance",
  Potentials: "Potentiels", Build: "Build", Outfits: "Tenues", Outfit: "Tenue", Default: "Par défaut",
  Female: "Femme", Male: "Homme", Unspecified: "Non précisé",
  Gender: "Genre", Birthday: "Anniversaire", Height: "Taille", Affiliation: "Affiliation", Voice: "Voix",
  Signature: "Signature", "Signature of:": "Signature de :", Rank: "Rang", "Attack type": "Type d'attaque",
  Attribute: "Attribut", Skill: "Compétence", Ultimate: "Ultime", Technique: "Technique",
  "Basic ATK": "Attaque normale", "Basic Attack": "Attaque normale", "Battle Skill": "Compétence de combat",
  "Combo Skill": "Compétence d'enchaînement", "Special Attack": "Attaque spéciale", "Chain Attack": "Attaque en chaîne",
  Dodge: "Esquive", Assist: "Soutien", "Core Skill": "Compétence principale", "Core Skill level": "Niveau de la compétence principale",
  "Additional Ability": "Capacité supplémentaire", "Mindscape Cinema": "Cinéma mental", "Passive Talents": "Aptitudes passives",
  "Inherent Skills": "Compétences innées", "Additional Talent": "Aptitude supplémentaire", "Additional Trace": "Trace supplémentaire",
  "Attribute nodes": "Nœuds d'attributs", "Stat Bonuses": "Bonus de stats", "Echo Skill": "Compétence d'écho",
  "Forte Gauge": "Jauge de forte", "Skill Input": "Commandes", Memosprite: "Mémosprite", "Kit view": "Affichage du kit",
  Simple: "Simple", Detailed: "Détaillé", "In-game summaries": "Résumés du jeu",
  "Full descriptions and multipliers": "Descriptions complètes et multiplicateurs",
  "Hide multipliers": "Masquer les multiplicateurs", "Show multipliers": "Afficher les multiplicateurs",
  Show: "Afficher", Hide: "Masquer", "Show more": "Voir plus", "Show less": "Voir moins", "Show fewer": "Voir moins",
  "No talents.": "Aucune aptitude.", "No skill data for this agent yet.": "Pas encore de compétences pour cet agent.",
  "No skill data for this operator yet.": "Pas encore de compétences pour cet opérateur.",
  "No forte data for this resonator yet.": "Pas encore de forte pour ce résonateur.",
  "Constellation upgrades": "Améliorations des constellations",
  // Build tab
  Recommended: "Recommandé", "Recommended Weapons": "Armes recommandées", "Recommended Relics": "Reliques recommandées",
  "Recommended Drive Discs": "Disques recommandés", "Recommended Echoes": "Échos recommandés", Best: "Meilleur",
  Alternatives: "Alternatives", "Main stats": "Stats principales", "Main Stat Options": "Stats principales possibles",
  "Substats priority": "Priorité des sous-stats", "Substat:": "Sous-stat :", "Community builds": "Builds communautaires",
  "No community build for this character yet.": "Pas encore de build communautaire pour ce personnage.",
  Body: "Corps", Feet: "Pieds", Hands: "Mains", Head: "Tête", "Planar Sphere": "Sphère planaire", "Link Rope": "Corde de liaison",
  "Flower of Life": "Fleur de la vie", "Plume of Death": "Plume de la mort", "Sands of Eon": "Sables du temps",
  "Goblet of Eonothem": "Coupe d'Eonothem", "Circlet of Logos": "Diadème de Logos",
  // Gear
  "2-Piece": "2 pièces", "4-Piece": "4 pièces", Pieces: "Pièces", "Artifact stats": "Stats des artéfacts",
  "Relic stats": "Stats des reliques", "Drive Disc stats": "Stats des disques", "Echo stats": "Stats des échos",
  "Main stats & substats": "Stats principales et sous-stats", Universal: "Universel",
  // Materials and versions
  "Used by": "Utilisé par", Source: "Source", Sources: "Sources", "Version:": "Version :", Version: "Version",
  "No release versions known for this game yet.": "Aucune version de sortie connue pour ce jeu.",
  // Banners
  "Live now": "En cours", Upcoming: "À venir", "Banner type": "Type de bannière", Chronicled: "Chroniques",
  Collab: "Collab", "First banner": "Première bannière", "On a banner now": "Sur une bannière en ce moment",
  "Last banner ended": "Dernière bannière terminée il y a", "In the pool": "Dans le pool", "Featured 4★": "4★ mis en avant",
  "All banners →": "Toutes les bannières →", "No banner matches.": "Aucune bannière ne correspond.",
  "No banner yet: they arrive with the next sync.": "Pas encore de bannière : elles arrivent avec la prochaine synchro.",
  "Never featured on a limited banner (standard pool, event or free).":
    "Jamais mis en avant sur une bannière limitée (pool standard, événement ou gratuit).",
  // Farm planner
  Planner: "Planificateur", "Farm Planner": "Planificateur de farm", Add: "Ajouter",
  "Pick who to raise and how far: the materials still to farm are counted below.":
    "Choisis qui monter et jusqu'où : les matériaux qui restent à farmer sont comptés plus bas.",
  "Nothing planned yet: add a character above.": "Rien de prévu pour l'instant : ajoute un personnage ci-dessus.",
  "To farm": "À farmer", "Hide completed": "Masquer les complets", Needed: "Requis", Owned: "Possédé",
  Missing: "Manquant", Remove: "Retirer", Current: "Actuel", Target: "Objectif", Less: "Moins", More: "Plus", Nodes: "Nœuds", "Trace nodes": "Nœuds de traces",
  "Inherent skills & stat nodes": "Aptitudes innées et nœuds de stats", "Attribute nodes": "Nœuds d'attributs",
  "Saved automatically": "Enregistré automatiquement", "Saving…": "Enregistrement…", Saved: "Enregistré",
  "Not saved — server unreachable": "Non enregistré : serveur injoignable",
  "Nothing to farm for this range.": "Rien à farmer pour cette plage.",
  "Import from my account": "Importer depuis mon compte", Import: "Importer", "Not planned yet:": "Pas encore prévus :",
  "Add all": "Tout ajouter", "A UID has 9 or 10 digits.": "Un UID a 9 ou 10 chiffres.", "Player not found.": "Joueur introuvable.",
  "Enka.Network is not answering, try again later.": "Enka.Network ne répond pas, réessaie plus tard.",
  "No character in this player's in-game showcase.": "Aucun personnage dans la vitrine de ce joueur.",
  "Reads the characters shown in your in-game showcase (levels, skills, weapon) · data:":
    "Lit les personnages de ta vitrine en jeu (niveaux, compétences, arme) · données :",
  Events: "Événements", "Data: official in-game announcements": "Données : annonces officielles du jeu",
  // Chaos Zero Nightmare (the game has no French version: game texts stay in English)
  Combatants: "Combattants", Partners: "Partenaires", "Memory Fragments": "Fragments de mémoire", Cards: "Cartes",
  "Starting cards": "Cartes de départ", "Unique cards": "Cartes uniques", "Ego skill": "Compétence d'Ego",
  "Ego Manifestation": "Manifestation d'Ego", "No card data yet.": "Pas encore de données de cartes.",
  "No Ego Manifestation data yet.": "Pas encore de données de Manifestation d'Ego.", "No text yet.": "Pas encore de texte.",
  "Combatant Level": "Niveau du combattant", "Crit Rate": "Taux CRIT", "Crit DMG": "DGT CRIT",
  Species: "Espèce", Talent: "Talent", "Reason for hospitalization": "Motif d'hospitalisation",
  "Community transcription (unverified)": "Transcription communautaire (non vérifiée)",
  "Splash art": "Illustration", Portrait: "Portrait", "Mental breakdown 1": "Effondrement mental 1",
  "Mental breakdown 2": "Effondrement mental 2", "Animated portrait": "Portrait animé", "Alternate portrait": "Portrait alternatif",
  "Mental breakdown (animated)": "Effondrement mental (animé)", "Ego skill cut-in": "Animation de compétence d'Ego",
  "Original file": "Fichier original", "Shut down Big Gacha": "Éteindre Big Gacha", "Shut down?": "Éteindre ?",
  "Click again to shut down": "Clique encore pour éteindre", "Shutting down Big Gacha…": "Extinction de Big Gacha…",
  "Big Gacha is off.": "Big Gacha est éteint.", "You can close this tab. Start it again from its shortcut.": "Tu peux fermer cet onglet. Relance-le depuis son raccourci.",
  "Could not shut down": "Extinction impossible", Back: "Retour", Gallery: "Galerie", Animated: "Animé", Chibi: "Chibi", Illustration: "Illustration", "No artwork yet.": "Pas encore d'illustration.",
  "Divine Epiphany": "Révélation divine", "Common Epiphany": "Révélation commune", Epiphany: "Révélation",
  "All gods": "Tous les dieux", "None for this epiphany.": "Aucune pour cette révélation.", Clear: "Effacer",
  "Loading epiphanies…": "Chargement des révélations…",
  "A choice did not fit this epiphany's type or cost and was removed.": "Un choix ne correspondait pas au type ou au coût de cette révélation et a été retiré.",
  "Search cards...": "Rechercher une carte...", Kind: "Catégorie", "No card matches.": "Aucune carte ne correspond.",
  "Neutral cards": "Cartes neutres", "Monster cards": "Cartes de monstre", "Forbidden cards": "Cartes interdites",
  "Persona cards": "Cartes Persona", "Season 1 cards": "Cartes de la saison 1", "Season 2 cards": "Cartes de la saison 2",
  "Season 3 cards": "Cartes de la saison 3", "Season 4 cards": "Cartes de la saison 4", "Season 5 cards": "Cartes de la saison 5",
  "Other season cards": "Autres cartes de saison", "Event cards": "Cartes d'événement", "Arena cards": "Cartes d'arène", Curses: "Malédictions",
  "Bought or found in Chaos; any combatant can use them unless a class is shown.": "Achetées ou trouvées dans le Chaos ; tout combattant peut les utiliser sauf si une classe est indiquée.",
  "Gained from defeated monsters.": "Obtenues sur les monstres vaincus.",
  "Season 3: a Persona's effect depends on its engravings. Click a Persona to engrave it.": "Saison 3 : l'effet d'une Persona dépend de ses gravures. Clique sur une Persona pour la graver.",
  "Persona engravings": "Gravures de Persona", "Combatant class": "Classe du combattant", Any: "Toutes", Empty: "Vide",
  "No engraving": "Aucune gravure", "Engraving 1": "Gravure 1", "Engraving 2": "Gravure 2",
  // Deck builder (CZN)
  Decks: "Decks", "My decks": "Mes decks", "New deck": "Nouveau deck", "No saved deck yet.": "Aucun deck enregistré.",
  "No team": "Pas d'équipe", Save: "Enregistrer", "Saved.": "Enregistré.", Duplicate: "Dupliquer",
  Picture: "Image", Text: "Texte", "Delete this deck": "Supprimer ce deck", "Deck name": "Nom du deck",
  "Unsaved changes.": "Modifications non enregistrées.", "Copy saved.": "Copie enregistrée.",
  "Deck copied as text.": "Deck copié en texte.", "Picture downloaded.": "Image téléchargée.", "Making the picture…": "Création de l'image…",
  "Add a combatant": "Ajouter un combattant", "Remove from the team (and its cards)": "Retirer de l'équipe (et ses cartes)",
  "Average cost": "Coût moyen", "Cost curve": "Courbe de coût", "Added cards": "Cartes ajoutées", "Add cards": "Ajouter des cartes",
  "Add neutral, season, monster or Persona cards": "Ajouter des cartes neutres, de saison, de monstre ou Persona",
  "Add a copy": "Ajouter une copie", "Remove from the deck": "Retirer du deck", Added: "Ajoutée", "Loading cards…": "Chargement des cartes…",
  "This deck no longer exists.": "Ce deck n'existe plus.",
  "Start with the team: each combatant brings its starting and unique cards. Click a card to choose its epiphanies.":
    "Commence par l'équipe : chaque combattant apporte ses cartes de départ et uniques. Clique sur une carte pour choisir ses révélations.",
  "The deck builder is for Chaos Zero Nightmare.": "Le deck builder est pour Chaos Zero Nightmare.",
  "Where to farm": "Où farmer", "Open today": "Ouvert aujourd'hui", "Other sources": "Autres sources",
  // Updates page
  History: "Historique", "Last check": "Dernière vérification", "Last change": "Dernier changement",
  "Game version": "Version du jeu", "Source version": "Version de la source", "Check all now": "Tout vérifier maintenant",
  "No update recorded yet.": "Aucune mise à jour enregistrée.", "Reload files": "Recharger les fichiers",
  "Enhancement files reloaded": "Fichiers d'améliorations rechargés", "No visible change": "Aucun changement visible",
  "not synced yet": "pas encore synchronisé", Failed: "Échec", Soon: "Bientôt", "Coming later": "Plus tard",
  "No automatic source yet for this game.": "Pas encore de source automatique pour ce jeu.", "How to play": "Comment jouer",
  Instructions: "Instructions", Features: "Fonctionnalités",
};

// Game terms used as filter values (elements, paths, classes, weapon types): the official
// French names, read once in each game's French data (StarRailRes fr, ZZZ / WuWa TextMaps,
// genshin-db French, Endfield I18nTextTable_FR). Per game: the same English word can differ.
const GAME_TERMS: Record<string, Record<string, string>> = {
  genshin: {
    Anemo: "Anémo", Electro: "Électro", Geo: "Géo",
    Sword: "Épée à une main", Claymore: "Épée à deux mains", Polearm: "Arme d'hast", Catalyst: "Catalyseur", Bow: "Arc",
  },
  hsr: {
    Physical: "Physique", Fire: "Feu", Ice: "Glace", Lightning: "Foudre", Wind: "Vent", Quantum: "Quantique", Imaginary: "Imaginaire",
    Destruction: "La Destruction", "The Hunt": "La Chasse", Erudition: "L'Érudition", Harmony: "L'Harmonie",
    Nihility: "La Nihilité", Preservation: "La Préservation", Abundance: "L'Abondance", Remembrance: "Le Souvenir",
    Elation: "L'Allégresse",
  },
  zzz: {
    Physical: "Physique", Fire: "Feu", Ice: "Glace", Electric: "Électrique", Ether: "Éther", Wind: "Vent",
    Frost: "Givre", "Auric Ink": "Sépia", Lumiflux: "Lumen", "Honed Edge": "Lame affûtée",
    Attack: "Attaque", Stun: "Confusion", Anomaly: "Anomalie", Support: "Soutien", Defense: "Défense", Rupture: "Rupture",
    Slash: "Entaille", Strike: "Frappe", Pierce: "Perforation", "S-Rank": "Rang S", "A-Rank": "Rang A", "B-Rank": "Rang B",
  },
  wuwa: {
    Broadblade: "Épée", Sword: "Sabre", Pistols: "Pistolets", Gauntlets: "Gantelets", Rectifier: "Amplificateur",
  },
  endfield: {
    Physical: "Physique", Heat: "Thermique", Cryo: "Cryogénique", Electric: "Électrique", Nature: "Naturel",
    Guard: "Garde", Caster: "Magicien", Defender: "Défenseur", Supporter: "Soutien", Striker: "Attaquant", Vanguard: "Avant-garde",
    Sword: "Épée", Greatsword: "Espadon", Polearm: "Arme d'hast", Handcannon: "Canon portatif", "Arts Unit": "Unité des Arts",
    "Endfield Industries": "Industries Endfield",
  },
};

const currentGame = () => (typeof window === "undefined" ? "" : window.location.pathname.split("/")[1] ?? "");

// Labels with a variable part
const PATTERNS: Array<[RegExp, (...m: string[]) => string]> = [
  [/^Live · (\d+) days? left$/, (d) => `En cours · ${d} j restants`],
  [/^Live · (\d+) h left$/, (h) => `En cours · ${h} h restantes`],
  [/^Live · no end date announced$/, () => "En cours · pas de date de fin annoncée"],
  [/^In (\d+) days?$/, (d) => `Dans ${d} j`],
  [/^In (\d+) h$/, (h) => `Dans ${h} h`],
  [/^Show all (\d+) banners$/, (n) => `Voir les ${n} bannières`],
  [/^(\d+) \/ (\d+) materials complete$/, (a, b) => `${a} / ${b} matériaux complets`],
  [/^(?:(.+) · )?(\d+) in the showcase, (\d+) updated$/, (nick, n, u) => `${nick ? `${nick} · ` : ""}${n} dans la vitrine, ${u} mis à jour`],
  [/^Epiphanies \((\d+)\)$/, (n) => `Révélations (${n})`],
  [/^Epiphany (\d+)$/, (n) => `Révélation ${n}`],
  [/^Epiphany ([IVX]+)$/, (n) => `Révélation ${n}`],
  [/^(\d+) possible for a (\d+)-cost (\w+)$/, (n, c, t) => `${n} possibles pour une carte ${t} de coût ${c}`],
  [/^(\d+) possible$/, (n) => `${n} possibles`],
  [/^Card art \((\d+)\)$/, (n) => `Illustrations des cartes (${n})`],
  [/^Ego skill: (.+)$/, (n) => `Compétence Ego : ${n}`],
  [/^Loading (\d+) cards?…$/, (n) => `Chargement de ${n} carte(s)…`],
  [/^Not saved: (.+)$/, (e) => `Non enregistré : ${e}`],
  [/^Picture failed: (.+)$/, (e) => `Échec de l'image : ${e}`],
  [/^(\d+) engravings for a (\w*) Persona$/, (n, t) => `${n} gravures pour une Persona ${t}`],
  [/^Ends in (.+)$/, (d) => `Fin dans ${d}`],
  [/^Starts in (.+)$/, (d) => `Début dans ${d}`],
  [/^Show all (\d+) events$/, (n) => `Voir les ${n} événements`],
  [/^Today: (.+)$/, (d) => `Aujourd'hui : ${d}`],
  [/^Next: (.+)$/, (d) => `Prochain : ${d}`],
  [/^(\d+) total$/, (n) => `${n} au total`],
  [/^All (\d+) (.+) loaded$/, (n) => `Les ${n} éléments sont chargés`],
  [/^(\d+) days? ago$/, (d) => `${d} j`],
  [/^(\d+) months ago$/, (m) => `${m} mois`],
  [/^([\d.]+) years ago$/, (y) => `${y} ans`],
  [/^today ago$/, () => "aujourd'hui"],
  [/^runs?$/, () => "passage(s)"],
  [/^Version ([\d.]+)$/, (v) => `Version ${v}`],
  [/^Unlocked at (.+)$/, (p) => `Débloqué à ${p}`],
  [/^Promotion (I|II|III|IV)$/, (p) => `Promotion ${p}`],
  [/^Lv\. (\d+)$/, (n) => `Niv. ${n}`],
  [/^Coming back on (.+)$/, (d) => `De retour le ${d}`],
  [/^Every limited (.+) banner with its dates and featured (.+)$/, (g) => `Toutes les bannières limitées de ${g}, avec leurs dates et leurs vedettes`],
  [/^Search a banner or a character…$/, () => "Rechercher une bannière ou un personnage…"],
  [/^Search a banner or an operator…$/, () => "Rechercher une bannière ou un opérateur…"],
  [/^What each (.*) update added$/, (g) => `Ce que chaque mise à jour de ${g} a ajouté`],
];

export function translateUi(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const hit = GAME_TERMS[currentGame()]?.[trimmed] ?? UI[trimmed];
  if (hit) return text.replace(trimmed, hit);
  for (const [re, fn] of PATTERNS) {
    const m = trimmed.match(re);
    if (m) return text.replace(trimmed, fn(...m.slice(1)));
  }
  return null;
}

/** t("Characters") in code (labels built in JS, document titles…) */
export function t(text: string): string {
  return LANG === "fr" ? translateUi(text) ?? text : text;
}

const ATTRS = ["placeholder", "title", "aria-label"];
// Never touch typed text or code
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "CODE", "PRE"]);

function translateNode(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement;
    if (!parent || SKIP.has(parent.tagName) || parent.closest("[data-no-translate]")) return;
    const next = translateUi(node.nodeValue ?? "");
    if (next !== null && next !== node.nodeValue) node.nodeValue = next;
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;
  if (SKIP.has(el.tagName) && el.tagName !== "INPUT" && el.tagName !== "TEXTAREA") return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v) {
      const next = translateUi(v);
      if (next !== null && next !== v) el.setAttribute(a, next);
    }
  }
  if (SKIP.has(el.tagName)) return;
  for (const child of Array.from(el.childNodes)) translateNode(child);
}

/** Translate the interface labels now and whenever React renders new ones (French only). */
export function startUiTranslation() {
  if (LANG !== "fr" || typeof MutationObserver === "undefined") return;
  document.documentElement.lang = "fr";
  translateNode(document.body);
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "characterData") translateNode(r.target);
      else if (r.type === "attributes") translateNode(r.target);
      else r.addedNodes.forEach(translateNode);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
