export interface QualityRecord {
  id: string;
  date: string;
  day: number;
  month: number;
  year: number;
  shadeNo: string;
  colour: string;
  partyName: string;
  denier: string;
  sduUnitNo: string;
  mcNo: string;
  totalShadePct: number;
  pt: number;
  rateLpm: number;
  dispergent: string;
  mixerType: string;
  qualityScore: number;
  bf: number;
  shadeVariation: number;
}

export interface QualityDailyRecord {
  id: string;
  date: string;
  prodDesc: string;
  firstPct: number;
  bfOthersPct: number;
  shvOthersPct: number;
}

export interface RecipeRecord {
  id: string;
  shadeName: string;
  shadeNo: string;
  denier: string;
  sduUnit: string;
  customer: string;
  mcNo: string;
  batchVolume: number;
  productionKg: number;
  blackAV: number;
  redGVD: number;
  orangeGRVD: number;
  blackAVKg: number;
  redGVDKg: number;
  orangeGRVDKg: number;
  waterKg: number;
  totalShadeLoading: number;
  pumpThrow: number;
  rateCcMin: number;
  rateLitHr: number;
  consumptionLitDay: number;
  daysRequired: string | number;
  totalConsumption: number;
  numBatches: number;
  concFullPct: number;
  concHalfPct: number;
  productionPeriod: string;
  cellulose: number;
  productionRunDateFrom?: string;
  productionRunDateTo?: string;
  colorRunDurationDays?: string;
}
