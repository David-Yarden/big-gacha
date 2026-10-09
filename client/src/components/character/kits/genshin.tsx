import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useApiQuery } from "@/hooks/useApiQuery";
import { getTalent, getConstellation } from "@/lib/api";
import { talentIconUrl, constellationIconUrl } from "@/lib/images";
import { calculateTalentMaterials } from "@/lib/materials";
import type { Talent, Constellation } from "@/lib/types";
import {
  TalentSection,
  PassiveSection,
  NumberedEntryCard,
} from "@/components/character/shared";
import {
  useCharacterEnhancements,
  EnhancementControls,
  EnhancementAdditions,
} from "@/components/character/enhancements";
import { BuildTab } from "@/components/character/BuildTab";
import type { CharacterKit, KitArgs } from "./types";

const PASSIVE_KEYS = ["passive1", "passive2", "passive3", "passive4"] as const;
const CONSTELLATION_KEYS = ["c1", "c2", "c3", "c4", "c5", "c6"] as const;

export function useGenshinKit({ game, name, activeElement }: KitArgs): CharacterKit {
  const [levels, setLevels] = useState({ combat1: 10, combat2: 10, combat3: 10 });
  const setLevel = (key: keyof typeof levels) => (v: number) => setLevels((l) => ({ ...l, [key]: v }));

  const enh = useCharacterEnhancements(game, name);
  const { data: talentData } = useApiQuery(() => getTalent(game, name), [game, name]);
  const { data: constellationData } = useApiQuery(() => getConstellation(game, name), [game, name]);
  const talent = talentData?.data as Talent | undefined;
  const constellation = constellationData?.data as Constellation | undefined;

  // Travelers: talents / constellations come from the selected element
  const talentVariant = talent?.isTraveler && activeElement ? talent.elementVariants?.[activeElement] : null;
  const activeTalent = talentVariant ?? talent;
  const talentImages = talentVariant?.images ?? talent?.images;

  const constVariant = constellation?.isTraveler && activeElement ? constellation.elementVariants?.[activeElement] : null;
  const activeConstellation = constVariant ?? constellation;
  const constImages = constVariant?.images ?? constellation?.images;

  const costs = activeTalent?.costs;
  const skillSections = useMemo(
    () => [
      { label: "Combat 1", materials: calculateTalentMaterials(costs, levels.combat1), level: levels.combat1 },
      { label: "Combat 2", materials: calculateTalentMaterials(costs, levels.combat2), level: levels.combat2 },
      { label: "Combat 3", materials: calculateTalentMaterials(costs, levels.combat3), level: levels.combat3 },
    ],
    [costs, levels]
  );

  const combats = [
    { key: "combat1" as const, data: activeTalent?.combat1, level: levels.combat1, onChange: setLevel("combat1") },
    { key: "combat2" as const, data: activeTalent?.combat2, level: levels.combat2, onChange: setLevel("combat2") },
    { key: "combat3" as const, data: activeTalent?.combat3, level: levels.combat3, onChange: setLevel("combat3") },
    { key: "combatsp" as const, data: activeTalent?.combatsp, level: 1, onChange: () => {} },
  ];
  const passives = PASSIVE_KEYS.map((key) => [key, activeTalent?.[key]] as const).filter(([, p]) => p != null);

  const talentsTab = (
    <div className="space-y-6">
      {combats.map(({ key, data, level, onChange }) =>
        data ? (
          <Card key={key}>
            <CardContent className="p-4">
              <TalentSection
                talent={data}
                level={level}
                onLevelChange={onChange}
                iconUrl={talentIconUrl(talentImages, key)}
              />
              <EnhancementAdditions enh={enh} target={`talent.${key}`} />
            </CardContent>
          </Card>
        ) : null
      )}
      {enh.additions("talent.extra").length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h4 className="font-semibold">Additional Talent</h4>
            <EnhancementAdditions enh={enh} target="talent.extra" />
          </CardContent>
        </Card>
      )}
      {passives.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Passive Talents</h3>
          {passives.map(([key, passive]) => (
            <Card key={key}>
              <CardContent className="p-4">
                <PassiveSection passive={passive!} iconUrl={talentIconUrl(talentImages, key)} />
                <EnhancementAdditions enh={enh} target={`talent.${key}`} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const constellationsTab = (
    <div className="space-y-3">
      {activeConstellation &&
        CONSTELLATION_KEYS.map((key) => {
          const c = activeConstellation[key];
          if (!c) return null;
          return (
            <NumberedEntryCard
              key={key}
              tag={key.toUpperCase()}
              name={c.name}
              description={c.description}
              iconUrl={constellationIconUrl(constImages, key)}
            >
              <EnhancementAdditions enh={enh} target={`constellation.${key}`} />
            </NumberedEntryCard>
          );
        })}
      {enh.additions("constellation.all").length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h4 className="font-semibold">Constellation upgrades</h4>
            <EnhancementAdditions enh={enh} target="constellation.all" />
          </CardContent>
        </Card>
      )}
    </div>
  );

  return {
    tabs: [
      { value: "talents", label: "Talents", content: talentsTab },
      { value: "constellations", label: "Constellations", content: constellationsTab },
      { value: "build", label: "Build", content: <BuildTab game={game} name={name} element={activeElement} /> },
    ],
    skillSections,
    skillsLabel: "Talents",
    controls: <EnhancementControls enh={enh} />,
  };
}
