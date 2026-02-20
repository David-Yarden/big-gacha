import { Card, CardContent } from "@/components/ui/card";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { materialIconUrlById, materialFallbackIconUrlById } from "@/lib/images";
import { mergeAllMaterials } from "@/lib/materials";
import type { MaterialCostEntry } from "@/lib/materials";

export interface SkillSection {
  label: string;
  materials: MaterialCostEntry[];
  level: number;
}

interface TotalCostCalculatorProps {
  ascensionMaterials: MaterialCostEntry[];
  skillSections: SkillSection[];
  skillsLabel?: string;
  totalMaterials: MaterialCostEntry[];
  charLevel: number;
}

function CostTable({
  title,
  materials,
}: {
  title: string;
  materials: MaterialCostEntry[];
}) {
  if (materials.length === 0) return null;

  return (
    <div>
      <h4 className="text-sm font-medium text-muted-foreground mb-2">
        {title}
      </h4>
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <tbody>
            {materials.map((mat) => (
              <tr key={mat.name} className="border-b last:border-0">
                <td className="px-3 py-1.5">
                  <span className="flex items-center gap-2">
                    <ImageWithFallback
                      src={materialIconUrlById(mat.id)}
                      fallbackSrc={materialFallbackIconUrlById(mat.id)}
                      alt={mat.name}
                      className="h-6 w-6 shrink-0 object-contain"
                    />
                    {mat.name}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right font-mono">
                  {mat.count.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TotalCostCalculator({
  ascensionMaterials,
  skillSections,
  skillsLabel = "Skills",
  totalMaterials,
  charLevel,
}: TotalCostCalculatorProps) {
  const allSkillMaterials = mergeAllMaterials(...skillSections.map((s) => s.materials));
  const hasSkillMaterials = allSkillMaterials.length > 0;

  if (ascensionMaterials.length === 0 && !hasSkillMaterials) return null;

  const levelStr = skillSections.map((s) => s.level).join("/");

  return (
    <Card>
      <CardContent className="p-4 space-y-6">
        <div>
          <h3 className="text-lg font-semibold">Total Material Cost</h3>
          <p className="text-sm text-muted-foreground">
            Lv. {charLevel} / {skillsLabel} {levelStr}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <CostTable title="Character Ascension" materials={ascensionMaterials} />
          {hasSkillMaterials && (
            <CostTable
              title={`${skillsLabel} (${levelStr})`}
              materials={allSkillMaterials}
            />
          )}
        </div>

        {totalMaterials.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="font-semibold mb-2">Grand Total</h4>
            <div className="rounded-lg border bg-muted/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-3 py-2 text-left font-medium">Material</th>
                    <th className="px-3 py-2 text-right font-medium">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {totalMaterials.map((mat) => (
                    <tr key={mat.name} className="border-b last:border-0">
                      <td className="px-3 py-1.5">
                        <span className="flex items-center gap-2">
                          <ImageWithFallback
                            src={materialIconUrlById(mat.id)}
                            fallbackSrc={materialFallbackIconUrlById(mat.id)}
                            alt={mat.name}
                            className="h-6 w-6 shrink-0 object-contain"
                          />
                          {mat.name}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono font-semibold">
                        {mat.count.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
