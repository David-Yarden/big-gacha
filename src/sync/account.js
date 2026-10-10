/**
 * The characters a player shows in their in-game showcase, read from Enka.Network
 * (enka.network/api — Genshin, HSR, ZZZ; WuWa and Endfield have no such service).
 * Used by the planner to start from the player's real levels.
 *
 * Returns [{ character, level, skill, weapon?, weaponLevel? }] with the site's English
 * names. `skill` is the lowest of the main skills (the planner has one skill range per
 * character: starting from the lowest never under-counts).
 */
const { fetchData } = require("./http");

const ENKA = {
  genshin: (uid) => `https://enka.network/api/uid/${uid}`,
  hsr: (uid) => `https://enka.network/api/hsr/uid/${uid}`,
  zzz: (uid) => `https://enka.network/api/zzz/uid/${uid}`,
};
const UID = /^\d{9,10}$/;
const CACHE_MS = 5 * 60 * 1000; // Enka refreshes a profile every few minutes at most
const cache = new Map();

const minOf = (list) => (list.length ? Math.min(...list) : 1);

/** Showcase entries of one game, with numeric ids still to be named. */
function readShowcase(game, json) {
  if (game === "genshin") {
    return (json.avatarInfoList || []).map((a) => {
      const weapon = (a.equipList || []).find((e) => e.weapon);
      return {
        id: a.avatarId,
        level: Number(a.propMap?.["4001"]?.val) || 1,
        // skillLevelMap: normal attack, skill, burst (constellation bonuses are separate)
        skill: minOf(Object.values(a.skillLevelMap || {}).map(Number)),
        weaponId: weapon?.itemId,
        weaponLevel: weapon?.weapon?.level,
      };
    });
  }
  if (game === "hsr") {
    return (json.detailInfo?.avatarDetailList || []).map((a) => {
      const byKind = new Map((a.skillTreeList || []).map((s) => [s.pointId % 1000, s.level]));
      // 1 basic attack (max 6), 2 skill, 3 ultimate, 4 talent
      const main = [byKind.get(2), byKind.get(3), byKind.get(4)].filter((x) => x != null);
      const basic = byKind.get(1);
      if (basic != null && basic < 6) main.push(basic);
      // Major traces and stat nodes (point 1xx–3xx) unlocked: all of them at 13 and more
      const nodes = (a.skillTreeList || []).filter((x) => x.pointId % 1000 >= 100 && x.pointId % 1000 < 400 && x.level >= 1).length;
      return {
        id: a.avatarId,
        level: a.level || 1,
        skill: minOf(main),
        nodesDone: nodes >= 13,
        weaponId: a.equipment?.tid,
        weaponLevel: a.equipment?.level,
      };
    });
  }
  if (game === "zzz") {
    return (json.PlayerInfo?.ShowcaseDetail?.AvatarList || []).map((a) => {
      // Index: 0 basic, 1 special, 2 dodge, 3 chain, 5 core, 6 assist
      const main = (a.SkillLevelList || []).filter((s) => s.Index !== 5).map((s) => s.Level);
      return { id: a.Id, level: a.Level || 1, skill: minOf(main), weaponId: a.Weapon?.Id, weaponLevel: a.Weapon?.Level };
    });
  }
  return [];
}

/** The player's showcase with the site's names. Throws { status } on a bad UID or no profile. */
async function showcase(game, uid) {
  if (!ENKA[game]) throw Object.assign(new Error("No account service for this game"), { status: 400 });
  if (!UID.test(uid)) throw Object.assign(new Error("Invalid UID"), { status: 400 });
  const key = `${game}:${uid}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  let json;
  try {
    json = await fetchData(ENKA[game](uid), { timeout: 20_000, retries: 1 });
  } catch (err) {
    // Enka: 400 bad UID, 404 no such player, 424 game maintenance, 429 rate limit
    const status = err.status === 404 || err.status === 400 ? 404 : 502;
    throw Object.assign(new Error(status === 404 ? "Player not found" : "Enka.Network unreachable"), { status });
  }
  const entries = readShowcase(game, json);

  const { Character, Weapon, LightCone } = require("../models");
  const WeaponModel = game === "hsr" ? LightCone : Weapon;
  const [chars, weapons] = await Promise.all([
    Character.find({ game, sourceId: { $in: entries.map((e) => e.id) } }).select("name sourceId images i18n.fr.name").lean(),
    WeaponModel.find({ game, sourceId: { $in: entries.map((e) => e.weaponId).filter(Boolean) } }).select("name sourceId").lean(),
  ]);
  const charName = new Map(chars.map((c) => [c.sourceId, c.name]));
  const charDoc = new Map(chars.map((c) => [c.name, c]));
  const weaponName = new Map(weapons.map((w) => [w.sourceId, w.name]));
  const nameOf = (id) => {
    if (charName.has(id)) return charName.get(id);
    if (game === "hsr" && id >= 8001 && id <= 8999) return "Trailblazer"; // every path and gender
    return undefined;
  };
  if (game === "hsr" && entries.some((e) => e.id >= 8001 && e.id <= 8999) && !charDoc.has("Trailblazer")) {
    const tb = await Character.findOne({ game, name: "Trailblazer" }).select("name images i18n.fr.name").lean();
    if (tb) charDoc.set(tb.name, tb);
  }

  const data = {
    nickname: json.playerInfo?.nickname ?? json.detailInfo?.nickname ?? json.PlayerInfo?.SocialDetail?.ProfileDetail?.Nickname,
    characters: entries
      .map((e) => ({
        character: nameOf(e.id),
        images: charDoc.get(nameOf(e.id))?.images,
        frName: charDoc.get(nameOf(e.id))?.i18n?.fr?.name,
        level: e.level,
        skill: e.skill,
        nodesDone: e.nodesDone,
        weapon: e.weaponId ? weaponName.get(e.weaponId) : undefined,
        weaponLevel: e.weaponLevel,
      }))
      .filter((e) => e.character),
  };
  cache.set(key, { at: Date.now(), data });
  return data;
}

module.exports = { showcase, readShowcase };
