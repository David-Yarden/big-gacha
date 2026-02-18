import { Card, CardContent } from "@/components/ui/card";
import type { MaterialCostEntry } from "@/lib/materials";

interface TotalCostCalculatorProps {
  ascensionMaterials: MaterialCostEntry[];
  talent1Materials: MaterialCostEntry[];
  talent2Materials: MaterialCostEntry[];
  talent3Materials: MaterialCostEntry[];
  totalMaterials: MaterialCostEntry[];
  charLevel: number;
  talent1Level: number;
  talent2Level: number;
  talent3Level: number;
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
                <td className="px-3 py-1.5">{mat.name}</td>
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
  talent1Materials,
  talent2Materials,
  talent3Materials,
  totalMaterials,
  charLevel,
  talent1Level,
  talent2Level,
  talent3Level,
}: TotalCostCalculatorProps) {
  const hasTalentMaterials =
    talent1Materials.length > 0 ||
    talent2Materials.length > 0 ||
    talent3Materials.length > 0;

  if (ascensionMaterials.length === 0 && !hasTalentMaterials) {
    return null;
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-6">
        <div>
          <h3 className="text-lg font-semibold">Total Material Cost</h3>
          <p className="text-sm text-muted-foreground">
            Lv. {charLevel} / Talents {talent1Level}/{talent2Level}/{talent3Level}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <CostTable
            title="Character Ascension"
            materials={ascensionMaterials}
          />
          {hasTalentMaterials && (
            <CostTable
              title={`Talents (${talent1Level}/${talent2Level}/${talent3Level})`}
              materials={totalMaterials.filter((m) =>
                // Show talent-only materials by checking if they appear in talent lists
                talent1Materials.some((t) => t.name === m.name) ||
                talent2Materials.some((t) => t.name === m.name) ||
                talent3Materials.some((t) => t.name === m.name)
              )}
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
                    <th className="px-3 py-2 text-left font-medium">
                      Material
                    </th>
                    <th className="px-3 py-2 text-right font-medium">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {totalMaterials.map((mat) => (
                    <tr key={mat.name} className="border-b last:border-0">
                      <td className="px-3 py-1.5">{mat.name}</td>
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
