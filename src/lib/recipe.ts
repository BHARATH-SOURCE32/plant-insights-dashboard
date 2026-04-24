// Recipe calculation logic — formulas extracted from the client's Excel file.
// Source: Copy_of_Reipe_File.xlsx (Natal Brown - 110 sample)

export interface Pigment {
  name: string;
  percent: number; // % shade loading on yarn
}

export interface RecipeInputs {
  shadeName: string;
  customerName: string;
  shadeNo: string;
  denierFilament: string;
  cfOnlyCf: string;
  sduNo: string;
  productionToBeDoneKg: number;  // J2 in sheet (in T units, e.g. 2 = 2000 kg)
  batchVolume: number;            // L2 (litres)
  mcNo: string;
  noOfPositions: number;          // N2
  cellulose: number;              // O2 (%)
  pumpThrow: number;              // B9 (gms / 5 min)
  rateCcMin: number;              // B10 (cc/min) — measured input, not derived
  productionPerDay: number;       // T-table (kg/day) for the denier
  expectedQuality: number;        // U-table (%) for the denier
  pigments: Pigment[];
}

export interface RecipeOutputs {
  totalShadeLoading: number;
  rateCcMin: number;
  rateLitHr: number;
  consumptionPerDay: number;
  daysRequired: number;
  totalConsumption: number;
  totalBatches: number;
  pigmentConcFull: number;
  pigmentConcHalf: number;
  waterQty: number;
  totalQty: number;
  pigmentQuantities: { name: string; qty: number }[]; // kg per batch
  pigmentTotalKg: { name: string; qty: number }[];    // kg over full run
}

export function calculateRecipe(input: RecipeInputs): RecipeOutputs {
  // B8 = SUM(pigment %)
  const totalShadeLoading = input.pigments.reduce((s, p) => s + (p.percent || 0), 0);

  // B11 = B10 * 60 / 1000  (cc/min → lit/hr)
  const rateLitHr = (input.rateCcMin * 60) / 1000;

  // B12 = B11 * 24
  const consumptionPerDay = rateLitHr * 24;

  // B13 = J2 * 1000 / (T * U / 100)
  // production_kg * 1000 / (production_per_day * expected_quality / 100)
  const denom = (input.productionPerDay * input.expectedQuality) / 100;
  const daysRequired = denom > 0 ? (input.productionToBeDoneKg * 1000) / denom : 0;

  // B14 = B12 * K2 + 25  → K2 in sheet was "days" rounded; we use computed daysRequired
  const totalConsumption = consumptionPerDay * daysRequired + 25;

  // B16 = B14 / B15
  const totalBatches = input.batchVolume > 0 ? totalConsumption / input.batchVolume : 0;

  // B17 = (132 * O2 / 500) * B8 * B9 / B10
  const pigmentConcFull =
    input.rateCcMin > 0
      ? ((132 * input.cellulose) / 500) * totalShadeLoading * input.pumpThrow / input.rateCcMin
      : 0;
  const pigmentConcHalf = pigmentConcFull / 2;

  // Per-batch pigment kg: B22 = B17 * L2 / 100 * pigment% / B8
  const pigmentQuantities = input.pigments.map((p) => ({
    name: p.name,
    qty:
      totalShadeLoading > 0
        ? (pigmentConcFull * input.batchVolume / 100) * (p.percent / totalShadeLoading)
        : 0,
  }));

  const totalPigmentKg = pigmentQuantities.reduce((s, p) => s + p.qty, 0);

  // B26 = batchVolume - SUM(pigments)  (kg)
  const waterQty = Math.max(0, input.batchVolume - totalPigmentKg);

  // B27 = SUM(pigments + water)
  const totalQty = totalPigmentKg + waterQty;

  // F4 = pigment_per_batch * total_batches  (full-run consumption per pigment)
  const pigmentTotalKg = pigmentQuantities.map((p) => ({
    name: p.name,
    qty: p.qty * totalBatches,
  }));

  return {
    totalShadeLoading: round(totalShadeLoading, 3),
    rateCcMin: round(input.rateCcMin, 2),
    rateLitHr: round(rateLitHr, 2),
    consumptionPerDay: round(consumptionPerDay, 2),
    daysRequired: round(daysRequired, 2),
    totalConsumption: round(totalConsumption, 2),
    totalBatches: round(totalBatches, 2),
    pigmentConcFull: round(pigmentConcFull, 2),
    pigmentConcHalf: round(pigmentConcHalf, 2),
    waterQty: round(waterQty, 3),
    totalQty: round(totalQty, 3),
    pigmentQuantities: pigmentQuantities.map((p) => ({ name: p.name, qty: round(p.qty, 3) })),
    pigmentTotalKg: pigmentTotalKg.map((p) => ({ name: p.name, qty: round(p.qty, 3) })),
  };
}

function round(n: number, d: number) {
  if (!isFinite(n)) return 0;
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}
