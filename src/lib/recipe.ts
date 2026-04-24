// Recipe calculation logic — reasonable assumptions based on textile dyeing math.
// User can refine formulas later when they share the actual Excel formulas.

export interface Pigment {
  name: string;
  percent: number; // % of total shade
}

export interface RecipeInputs {
  shadeName: string;
  customerName: string;
  shadeNo: string;
  denierFilament: string;
  cfOnlyCf: string;
  sduNo: string;
  productionToBeDoneKg: number;
  batchVolume: number; // litres
  mcNo: string;
  noOfPositions: number;
  cellulose: number; // %
  pumpThrow: number; // cc/stroke
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
  pigmentQuantities: { name: string; qty: number }[];
}

export function calculateRecipe(input: RecipeInputs): RecipeOutputs {
  const totalShadeLoading = input.pigments.reduce((s, p) => s + (p.percent || 0), 0);

  // Pump strokes assumed at 60 strokes/min for full machine
  const strokesPerMin = 60;
  const rateCcMin = input.pumpThrow * strokesPerMin;
  const rateLitHr = (rateCcMin * 60) / 1000;

  // Consumption per day: 24 hours of running
  const consumptionPerDay = rateLitHr * 24;

  // Days required to complete order
  // Production rate assumption: noOfPositions * denier-based factor, simplified
  const productionPerDay = Math.max(1, input.noOfPositions * 50); // kg/day
  const daysRequired = input.productionToBeDoneKg / productionPerDay;

  const totalConsumption = consumptionPerDay * daysRequired;
  const totalBatches = input.batchVolume > 0 ? totalConsumption / input.batchVolume : 0;

  // Pigment solution concentration (g/L) — assume 1% shade = 10 g/L base
  const pigmentConcFull = totalShadeLoading * 10;
  const pigmentConcHalf = pigmentConcFull / 2;

  // Pigment quantities for one batch (grams)
  const pigmentQuantities = input.pigments.map((p) => ({
    name: p.name,
    qty: (p.percent / 100) * input.batchVolume * 10, // grams per batch
  }));

  // Water quantity (per batch) = batch volume - pigment volume (assumed pigment density 1g/ml)
  const totalPigmentMl = pigmentQuantities.reduce((s, p) => s + p.qty, 0);
  const waterQty = Math.max(0, input.batchVolume * 1000 - totalPigmentMl); // ml
  const totalQty = waterQty + totalPigmentMl;

  return {
    totalShadeLoading: round(totalShadeLoading, 3),
    rateCcMin: round(rateCcMin, 2),
    rateLitHr: round(rateLitHr, 2),
    consumptionPerDay: round(consumptionPerDay, 2),
    daysRequired: round(daysRequired, 2),
    totalConsumption: round(totalConsumption, 2),
    totalBatches: round(totalBatches, 2),
    pigmentConcFull: round(pigmentConcFull, 2),
    pigmentConcHalf: round(pigmentConcHalf, 2),
    waterQty: round(waterQty, 2),
    totalQty: round(totalQty, 2),
    pigmentQuantities: pigmentQuantities.map((p) => ({ name: p.name, qty: round(p.qty, 2) })),
  };
}

function round(n: number, d: number) {
  if (!isFinite(n)) return 0;
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}
