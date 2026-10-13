/**
 * "Build" tab: the game's own recommended gear for a character.
 * - ZZZ: Drive Disc sets, main stats of discs 4/5/6, substat priority, alternatives
 * - HSR: Cavern relic sets, Planar ornaments, main stats per slot, substat priority
 * - WuWa: Sonata sets, main stats per echo cost
 * - CZN: Memory Fragment sets, main stats of parts IV–VI, substats (piece_valid_setting)
 * - Genshin: the game has none; link to the community builds of the Genshin Impact Helper
 *   Team. Their content is "all rights reserved" (no copying or rehosting), so it is linked
 *   and credited, never imported.
 */
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { useApiQuery } from "@/hooks/useApiQuery";
import { getCharacter, getEchoSets, getRelics, getWeapons } from "@/lib/api";
import type { Character, Game } from "@/lib/types";

type Build = NonNullable<Character["build"]>;
interface SetGroup {
  label: string;
  names: string[];
}

const COPY: Record<string, { title: string; gear: string; who: string; route: string }> = {
  zzz: { title: "Recommended Drive Discs", gear: "Disc", who: "agent", route: "relics" },
  hsr: { title: "Recommended Relics", gear: "", who: "character", route: "relics" },
  wuwa: { title: "Recommended Echoes", gear: "", who: "Resonator", route: "echosets" },
  endfield: { title: "Recommended Weapons", gear: "", who: "operator", route: "weapons" },
  czn: { title: "Recommended Memory Fragments", gear: "", who: "combatant", route: "relics" },
};

/**
 * The label of a set (or weapon) at position i of a build group: "Best" / "Alternative n" in an
 * ordered list; Endfield gives two unordered lists, "Recommended weapons" and "Alternatives".
 */
export function rankInGroup(group: string, i: number): string {
  if (/^alternatives?$/i.test(group)) return "Alternative";
  if (/^recommended/i.test(group)) return "Recommended";
  return i === 0 ? "Best" : `Alternative ${i}`;
}

/** ZZZ builds are stored in their own shape: the same groups as the other games. */
export function normalizeBuild(build: Build): { sets: SetGroup[]; slots: { slot: string; stats: string[] }[] } {
  if (build.sets || build.slots) return { sets: build.sets ?? [], slots: build.slots ?? [] };
  const sets: SetGroup[] = [];
  if (build.fourPiece) sets.push({ label: "4-Piece", names: [build.fourPiece] });
  if (build.twoPiece?.length) sets.push({ label: "2-Piece", names: build.twoPiece });
  const slots = Object.entries(build.mainStats ?? {}).map(([slot, stat]) => ({ slot: `Disc ${slot}`, stats: [stat] }));
  return { sets, slots };
}

const HELPER_TEAM = "https://genshin-impact-helper-team.github.io/genshin-builds/en";
/** Names that differ from the Helper Team's page slugs */
const HELPER_TEAM_SLUG: Record<string, string | null> = { "Raiden Shogun": "shogun-raiden", Manekin: null, Manekina: null };

function helperTeamUrl(name: string, element?: string | null): string | null {
  if (/^(Aether|Lumine|Traveler)$/.test(name)) return `${HELPER_TEAM}/${(element ?? "anemo").toLowerCase()}-traveler`;
  if (name in HELPER_TEAM_SLUG) return HELPER_TEAM_SLUG[name] ? `${HELPER_TEAM}/${HELPER_TEAM_SLUG[name]}` : null;
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${HELPER_TEAM}/${slug}`;
}

function CommunityBuild({ name, element }: { name: string; element?: string | null }) {
  const url = helperTeamUrl(name, element);
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div>
          <h3 className="text-lg font-semibold">Community builds</h3>
          <p className="text-xs text-muted-foreground">
            Genshin Impact has no in-game build recommendation. The reference community guide is the{" "}
            <strong>Genshin Impact Helper Team</strong>: artifact sets, main stats, substats, weapons and talent priority for
            every role, kept up to date by its contributors.
          </p>
        </div>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
          >
            {name} builds on Genshin Builds (Helper Team) ↗
          </a>
        ) : (
          <p className="text-sm text-muted-foreground">No community build for this character yet.</p>
        )}
        <p className="text-[11px] text-muted-foreground">
          Credit: Genshin Impact Helper Team contributors —{" "}
          <a href={`${HELPER_TEAM}/`} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
            genshin-impact-helper-team.github.io/genshin-builds
          </a>
          . Their builds are not copied here: their license reserves all rights, so this page links to them.
        </p>
      </CardContent>
    </Card>
  );
}

export function BuildTab({ game, name, element }: { game: Game; name: string; element?: string | null }) {
  if (game === "genshin") return <CommunityBuild name={name} element={element} />;
  return <GameBuild game={game} name={name} />;
}

function GameBuild({ game, name }: { game: Game; name: string }) {
  const copy = COPY[game] ?? COPY.hsr;
  const { data: charData } = useApiQuery(() => getCharacter(game, name), [game, name]);
  const { data: setData } = useApiQuery(
    () =>
      copy.route === "echosets"
        ? getEchoSets(game, { limit: 200, fields: "name,images" })
        : copy.route === "weapons"
          ? getWeapons(game, { limit: 100, fields: "name,images" })
          : getRelics(game, { limit: 200, fields: "name,images" }),
    [game]
  );
  const icons = new Map(((setData?.data ?? []) as { name: string; images?: { icon?: string } }[]).map((d) => [d.name, d.images?.icon]));
  const build = charData?.data?.build;

  if (!charData) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!build) return <p className="text-sm text-muted-foreground">The game has no recommended build for this {copy.who}.</p>;
  const { sets, slots } = normalizeBuild(build);

  const SetCard = ({ set, label }: { set: string; label: string }) => (
    <Link
      to={`/${game}/${copy.route}/${encodeURIComponent(set)}`}
      className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-background/40 p-2 pr-4 transition-colors hover:border-primary/40"
    >
      <span className="h-12 w-12 shrink-0">
        <ImageWithFallback src={icons.get(set) ?? null} alt="" className="h-12 w-12 object-contain" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className="block font-semibold">{set}</span>
      </span>
    </Link>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-5 p-5">
          <div>
            <h3 className="text-lg font-semibold">{copy.title}</h3>
            <p className="text-xs text-muted-foreground">The in-game recommendation for this {copy.who}.</p>
          </div>

          {sets.map((group) => (
            <div key={group.label} className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{group.label}</h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.names.map((set, i) => (
                  <SetCard key={set} set={set} label={rankInGroup(group.label, i)} />
                ))}
              </div>
            </div>
          ))}

          {slots.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Main stats</h4>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {slots.map(({ slot, stats }) => (
                  <div key={slot} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                    <span className="block text-xs text-muted-foreground">{slot}</span>
                    <span className="font-semibold">{stats.join(" / ")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {build.substats && build.substats.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Substats priority</h4>
              <p className="text-sm font-medium">{build.substats.join("  ›  ")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {(build.alternatives ?? []).length > 0 && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <h3 className="font-semibold">Alternatives</h3>
            {build.alternatives!.map((alt, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] pb-3 last:border-0 last:pb-0">
                {alt.sets.map((st) => (
                  <Link
                    key={st}
                    to={`/${game}/${copy.route}/${encodeURIComponent(st)}`}
                    className="flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1 text-sm hover:bg-muted"
                  >
                    {icons.get(st) && <ImageWithFallback src={icons.get(st)!} alt="" className="h-6 w-6 object-contain" />}
                    {st}
                  </Link>
                ))}
                {alt.substats.length > 0 && <span className="text-xs text-muted-foreground">Substats: {alt.substats.join(", ")}</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
