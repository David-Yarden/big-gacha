import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { RarityStars } from "@/components/shared/RarityStars";
import { useApiQuery } from "@/hooks/useApiQuery";
import { getCharacter, getTalent, getConstellation } from "@/lib/api";
import {
  characterSplashUrl,
  characterIconUrl,
  elementIconUrl,
  talentIconUrl,
  constellationIconUrl,
} from "@/lib/images";
import { parseLabel } from "@/lib/formatters";
import {
  ASCENSION_LEVELS,
  levelToAscensionPhase,
  calculateAscensionMaterials,
  calculateTalentMaterials,
  mergeAllMaterials,
} from "@/lib/materials";
import { ELEMENT_COLOR_MAP } from "@/lib/constants";
import type { Game, TalentCombat, Talent, Constellation } from "@/lib/types";
import type { MaterialCostEntry } from "@/lib/materials";
import { TotalCostCalculator } from "@/components/character/TotalCostCalculator";

function TalentSection({
  talent,
  level,
  onLevelChange,
  iconUrl,
}: {
  talent: TalentCombat;
  level: number;
  onLevelChange: (v: number) => void;
  iconUrl?: string | null;
}) {
  const labels = talent.attributes?.labels ?? [];
  const parameters = talent.attributes?.parameters;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {iconUrl && (
          <img
            src={iconUrl}
            alt={talent.name}
            className="h-10 w-10 rounded-lg object-contain bg-muted/40 p-0.5 shrink-0"
          />
        )}
        <div className="flex-1 flex items-center justify-between">
          <h4 className="font-semibold">{talent.name}</h4>
          <span className="text-sm text-muted-foreground">Lv. {level}</span>
        </div>
      </div>
      <Slider
        min={1}
        max={15}
        step={1}
        value={[level]}
        onValueChange={([v]) => onLevelChange(v)}
      />
      {talent.description && (
        <p className="text-sm text-muted-foreground whitespace-pre-line">{talent.description}</p>
      )}
      {labels.length > 0 && (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <tbody>
              {labels.map((label, i) => {
                const parsed = parseLabel(label, parameters, level - 1);
                if (!parsed.value) return null;
                return (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {parsed.name}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      {parsed.value}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PassiveSection({
  passive,
  iconUrl,
}: {
  passive: { name: string; description: string };
  iconUrl?: string | null;
}) {
  return (
    <div className="flex gap-3">
      {iconUrl && (
        <img
          src={iconUrl}
          alt={passive.name}
          className="h-10 w-10 rounded-lg object-contain bg-muted/40 p-0.5 shrink-0 mt-0.5"
        />
      )}
      <div>
        <h4 className="font-semibold">{passive.name}</h4>
        <p className="mt-1 text-sm text-muted-foreground">{passive.description}</p>
      </div>
    </div>
  );
}

function MaterialCostTable({ materials }: { materials: MaterialCostEntry[] }) {
  if (materials.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No materials required</p>
    );
  }

  return (
    <div className="rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="px-3 py-2 text-left font-medium">Material</th>
            <th className="px-3 py-2 text-right font-medium">Count</th>
          </tr>
        </thead>
        <tbody>
          {materials.map((mat) => (
            <tr key={mat.name} className="border-b last:border-0">
              <td className="px-3 py-1.5">{mat.name}</td>
              <td className="px-3 py-1.5 text-right font-mono">
                {mat.count.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CharacterDetailPage() {
  const { game, name } = useParams<{ game: string; name: string }>();

  const [charLevel, setCharLevel] = useState(90);
  const [talent1Level, setTalent1Level] = useState(10);
  const [talent2Level, setTalent2Level] = useState(10);
  const [talent3Level, setTalent3Level] = useState(10);

  const { data: charData, loading: charLoading, error: charError } = useApiQuery(
    () => getCharacter(game as Game, name!),
    [game, name]
  );

  const { data: talentData } = useApiQuery(
    () => getTalent(game as Game, name!),
    [game, name]
  );

  const { data: constellationData } = useApiQuery(
    () => getConstellation(game as Game, name!),
    [game, name]
  );

  const character = charData?.data;
  const talent = talentData?.data as Talent | undefined;
  const constellation = constellationData?.data as Constellation | undefined;

  const ascensionPhase = levelToAscensionPhase(charLevel);
  const ascensionMaterials = useMemo(
    () => calculateAscensionMaterials(character?.costs, ascensionPhase),
    [character?.costs, ascensionPhase]
  );

  const talentCosts = talent?.costs;
  const talent1Materials = useMemo(
    () => calculateTalentMaterials(talentCosts, talent1Level),
    [talentCosts, talent1Level]
  );
  const talent2Materials = useMemo(
    () => calculateTalentMaterials(talentCosts, talent2Level),
    [talentCosts, talent2Level]
  );
  const talent3Materials = useMemo(
    () => calculateTalentMaterials(talentCosts, talent3Level),
    [talentCosts, talent3Level]
  );

  const totalMaterials = useMemo(
    () =>
      mergeAllMaterials(
        ascensionMaterials,
        talent1Materials,
        talent2Materials,
        talent3Materials
      ),
    [ascensionMaterials, talent1Materials, talent2Materials, talent3Materials]
  );

  const closestAscLevel =
    ASCENSION_LEVELS.find((l) => l >= charLevel) ?? 90;

  if (charLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[480px] w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (charError || !character) {
    return (
      <div className="space-y-4">
        <Link to={`/${game}/characters`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {charError ?? "Character not found"}
        </div>
      </div>
    );
  }

  const elementClass = ELEMENT_COLOR_MAP[character.element ?? ""] ?? "bg-muted";
  const elIconUrl = elementIconUrl(character.element);
  const talentImages = talent?.images;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link to={`/${game}/characters`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-1 h-4 w-4" /> Characters
        </Button>
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-6 md:flex-row">
        {/* Splash art */}
        <div className="w-full md:w-72 shrink-0">
          <Card className={`overflow-hidden ${elementClass}/10`}>
            <ImageWithFallback
              src={characterSplashUrl(character.images) ?? characterIconUrl(character.images)}
              alt={character.name}
              className="w-full h-[420px] object-contain object-bottom"
            />
          </Card>
        </div>

        {/* Info panel */}
        <div className="flex-1 space-y-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold">{character.name}</h1>
              <Badge className={`${elementClass} border-0 text-white flex items-center gap-1.5`}>
                {elIconUrl && (
                  <img src={elIconUrl} alt={character.element} className="h-3.5 w-3.5 invert" />
                )}
                {character.element}
              </Badge>
            </div>
            {character.title && (
              <p className="mt-1 text-muted-foreground">{character.title}</p>
            )}
          </div>

          <RarityStars rarity={character.rarity} className="text-lg" />

          <div className="grid grid-cols-2 gap-3 text-sm">
            {character.weaponType && (
              <div>
                <span className="text-muted-foreground">Weapon: </span>
                {character.weaponType}
              </div>
            )}
            {character.region && (
              <div>
                <span className="text-muted-foreground">Region: </span>
                {character.region}
              </div>
            )}
            {character.affiliation && (
              <div>
                <span className="text-muted-foreground">Affiliation: </span>
                {character.affiliation}
              </div>
            )}
            {character.constellation && (
              <div>
                <span className="text-muted-foreground">Constellation: </span>
                {character.constellation}
              </div>
            )}
            {character.birthday && (
              <div>
                <span className="text-muted-foreground">Birthday: </span>
                {character.birthday}
              </div>
            )}
            {character.version && (
              <div>
                <span className="text-muted-foreground">Version: </span>
                {character.version}
              </div>
            )}
          </div>

          {character.cv && (
            <div className="space-y-1 text-sm">
              <p className="font-medium">Voice Actors</p>
              <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                {character.cv.english && <span>EN: {character.cv.english}</span>}
                {character.cv.japanese && <span>JP: {character.cv.japanese}</span>}
                {character.cv.chinese && <span>CN: {character.cv.chinese}</span>}
                {character.cv.korean && <span>KR: {character.cv.korean}</span>}
              </div>
            </div>
          )}

          {character.description && (
            <p className="text-sm text-muted-foreground">
              {character.description}
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="talents">
        <TabsList>
          <TabsTrigger value="talents">Talents</TabsTrigger>
          <TabsTrigger value="constellations">Constellations</TabsTrigger>
          <TabsTrigger value="ascension">Ascension</TabsTrigger>
        </TabsList>

        {/* Talents tab */}
        <TabsContent value="talents">
          <div className="space-y-6">
            {talent?.combat1 && (
              <Card>
                <CardContent className="p-4">
                  <TalentSection
                    talent={talent.combat1}
                    level={talent1Level}
                    onLevelChange={setTalent1Level}
                    iconUrl={talentIconUrl(talentImages, "combat1")}
                  />
                </CardContent>
              </Card>
            )}
            {talent?.combat2 && (
              <Card>
                <CardContent className="p-4">
                  <TalentSection
                    talent={talent.combat2}
                    level={talent2Level}
                    onLevelChange={setTalent2Level}
                    iconUrl={talentIconUrl(talentImages, "combat2")}
                  />
                </CardContent>
              </Card>
            )}
            {talent?.combat3 && (
              <Card>
                <CardContent className="p-4">
                  <TalentSection
                    talent={talent.combat3}
                    level={talent3Level}
                    onLevelChange={setTalent3Level}
                    iconUrl={talentIconUrl(talentImages, "combat3")}
                  />
                </CardContent>
              </Card>
            )}
            {talent?.combatsp && (
              <Card>
                <CardContent className="p-4">
                  <TalentSection
                    talent={talent.combatsp}
                    level={1}
                    onLevelChange={() => {}}
                    iconUrl={talentIconUrl(talentImages, "combatsp")}
                  />
                </CardContent>
              </Card>
            )}

            {/* Passives */}
            {(talent?.passive1 || talent?.passive2 || talent?.passive3) && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Passive Talents</h3>
                {(
                  [
                    ["passive1", talent?.passive1],
                    ["passive2", talent?.passive2],
                    ["passive3", talent?.passive3],
                    ["passive4", talent?.passive4],
                  ] as const
                )
                  .filter(([, p]) => p != null)
                  .map(([key, passive]) => (
                    <Card key={key}>
                      <CardContent className="p-4">
                        <PassiveSection
                          passive={passive!}
                          iconUrl={talentIconUrl(talentImages, key)}
                        />
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Constellations tab */}
        <TabsContent value="constellations">
          <div className="space-y-3">
            {constellation &&
              (
                [
                  ["c1", constellation.c1],
                  ["c2", constellation.c2],
                  ["c3", constellation.c3],
                  ["c4", constellation.c4],
                  ["c5", constellation.c5],
                  ["c6", constellation.c6],
                ] as const
              ).map(([key, c]) =>
                c ? (
                  <Card key={key}>
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        {(() => {
                          const iconUrl = constellationIconUrl(constellation.images, key);
                          return iconUrl ? (
                            <img
                              src={iconUrl}
                              alt={c.name}
                              className="h-10 w-10 rounded-lg object-contain bg-muted/40 p-0.5 shrink-0"
                            />
                          ) : null;
                        })()}
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{key.toUpperCase()}</Badge>
                            <h4 className="font-semibold">{c.name}</h4>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {c.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : null
              )}
          </div>
        </TabsContent>

        {/* Ascension tab */}
        <TabsContent value="ascension">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Character Level</h3>
                <span className="text-sm text-muted-foreground">
                  Lv. {closestAscLevel} (Phase {ascensionPhase})
                </span>
              </div>
              <Slider
                min={1}
                max={90}
                step={1}
                value={[charLevel]}
                onValueChange={([v]) => setCharLevel(v)}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                {ASCENSION_LEVELS.map((l) => (
                  <button
                    key={l}
                    className={`px-1 ${charLevel === l ? "text-primary font-bold" : ""}`}
                    onClick={() => setCharLevel(l)}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <MaterialCostTable materials={ascensionMaterials} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Total Cost Calculator */}
      <TotalCostCalculator
        ascensionMaterials={ascensionMaterials}
        talent1Materials={talent1Materials}
        talent2Materials={talent2Materials}
        talent3Materials={talent3Materials}
        totalMaterials={totalMaterials}
        charLevel={charLevel}
        talent1Level={talent1Level}
        talent2Level={talent2Level}
        talent3Level={talent3Level}
      />
    </div>
  );
}
