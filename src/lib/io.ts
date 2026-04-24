import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { QualityRecord, QualityDailyRecord, RecipeRecord } from "./types";

// ---- Excel helpers ----
function excelSerialToDate(n: number): string {
  // Excel serial date (days since 1899-12-30)
  const ms = (n - 25569) * 86400 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

function pickKey(row: Record<string, any>, candidates: string[]): any {
  // Tolerant key lookup (trailing spaces, casing)
  const keys = Object.keys(row);
  for (const c of candidates) {
    const target = c.trim().toLowerCase();
    const k = keys.find((k) => k.trim().toLowerCase() === target);
    if (k !== undefined) return row[k];
  }
  return undefined;
}

function toNum(v: any): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function toStr(v: any): string {
  return v === null || v === undefined ? "" : String(v).trim();
}

// ---- Parsers ----
export interface ImportedQuality {
  records: QualityRecord[];
  daily: QualityDailyRecord[];
}

export async function parseQualityFile(file: File): Promise<ImportedQuality> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf);

  // Sheet 1 — main records
  const s1 = wb.Sheets[wb.SheetNames[0]];
  const rows1 = XLSX.utils.sheet_to_json<Record<string, any>>(s1, {
    defval: null,
  });

  const records: QualityRecord[] = rows1
    .filter(
      (r) => pickKey(r, ["Day"]) !== undefined && pickKey(r, ["Day"]) !== null,
    )
    .map((r, i) => {
      const day = toNum(pickKey(r, ["Day"]));
      const month = toNum(pickKey(r, ["Month"])) || 1;
      const year = toNum(pickKey(r, ["Year"])) || 2026;
      const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return {
        id: `Q-${i + 1}`,
        date,
        day,
        month,
        year,
        shadeNo: toStr(pickKey(r, ["Shade No", "Shade No "])),
        colour: toStr(pickKey(r, ["Colour", "Color"])),
        partyName: toStr(pickKey(r, ["Party Name"])),
        denier: toStr(pickKey(r, ["Denier", "Denier "])),
        sduUnitNo: toStr(pickKey(r, ["S.D. Unit No", "SDU No"])),
        mcNo: toStr(pickKey(r, ["M/C No"])),
        totalShadePct: toNum(pickKey(r, ["Total shade %", "Total Shade %"])),
        pt: toNum(pickKey(r, ["P.T."])),
        rateLpm: toNum(
          pickKey(r, ["Rate litres/min", "P.T. Rate (litres/min)"]),
        ),
        dispergent: toStr(pickKey(r, ["Dispergent Used.", "Dispergent Used"])),
        mixerType: toStr(pickKey(r, ["Type Of Mixer"])),
        qualityScore: toNum(pickKey(r, ["Quality", "Quality "])),
        bf: toNum(pickKey(r, ["BF"])),
        shadeVariation: toNum(
          pickKey(r, ["Shade Varaition", "Shade Variation"]),
        ),
      };
    });

  // Sheet 2 — daily aggregates (if present)
  let daily: QualityDailyRecord[] = [];
  if (wb.SheetNames[1]) {
    const s2 = wb.Sheets[wb.SheetNames[1]];
    const rows2 = XLSX.utils.sheet_to_json<Record<string, any>>(s2, {
      defval: null,
    });
    daily = rows2
      .filter((r) => pickKey(r, ["GRAPH DATE", "Date"]) != null)
      .map((r, i) => {
        const raw = pickKey(r, ["GRAPH DATE", "Date"]);
        const date =
          typeof raw === "number" ? excelSerialToDate(raw) : toStr(raw);
        return {
          id: `D-${i + 1}`,
          date,
          prodDesc: toStr(pickKey(r, ["PROD. DESC.", "Prod. Desc."])),
          firstPct: toNum(pickKey(r, ["FIRST %", "First %"])),
          bfOthersPct: toNum(pickKey(r, ["BF. OTH %", "BF %"])),
          shvOthersPct: toNum(pickKey(r, ["SHV OTH %", "SHV Others %"])),
        };
      });
  }

  return { records, daily };
}

// ---- Recipe parser ----
// Recipe file uses repeating template blocks. Each block has:
//   row N:   Pigment Name | Value | %    (header)
//   row N+1: Black AV     | x.xx  | %
//   row N+2: Red GVD      | ...
//   row N+3: Orange GRVD  | ...
// Then weighted block:
//   row M:   Pigment Name | Weight | Kg
//   row M+1: Black AV     | x.xx   | Kg ...
//
// Header context (shade name, denier, customer, etc.) sits 1-2 rows above
// the first "Pigment Name" header of each block-pair.
export async function parseRecipeFile(file: File): Promise<RecipeRecord[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, {
    header: 1,
    defval: null,
  });

  // Find every "Pigment Name" header row
  const pigmentHeaders: number[] = [];
  rows.forEach((r, i) => {
    if (Array.isArray(r) && r[0] === "Pigment Name") pigmentHeaders.push(i);
  });

  const recipes: RecipeRecord[] = [];
  // Pair up % block + Kg block (every two consecutive headers belong to one batch)
  for (let i = 0; i < pigmentHeaders.length; i += 2) {
    const pctIdx = pigmentHeaders[i];
    const kgIdx = pigmentHeaders[i + 1] ?? -1;

    // Header context: rows pctIdx-2 and pctIdx-1
    const ctxLabels = (rows[pctIdx - 2] || []) as any[];
    const ctxValues = (rows[pctIdx - 1] || []) as any[];

    // ctxLabels[0] = shade name, ctxLabels[1] = denier, ctxLabels[2] = sdu/mixer
    const shadeName = toStr(ctxLabels[0]);
    const denier = toStr(ctxLabels[1]);
    const sduUnit = toStr(ctxLabels[2]);
    const customer = toStr(ctxValues[0] ?? ctxValues[7]);

    // The header row 0 has "Shade No.", "Denier / Filament", ... structured
    // values appear in row 1 (for the FIRST batch only). For subsequent
    // batches we extract from local context. As a fallback, we leave blank.
    const shadeNoVal = toStr(ctxValues[4]);
    const productionKg = toNum(ctxValues[10]);
    const batchVolume = toNum(ctxValues[11]) || 200;
    const mcNo = toStr(ctxValues[12]);
    const productionPeriod = toStr(ctxValues[15]);

    // Helper: read pigment % row by name, scanning a few rows after pctIdx
    const findPigment = (name: string, startIdx: number, valueCol: number) => {
      for (let j = startIdx + 1; j < Math.min(startIdx + 8, rows.length); j++) {
        const r = rows[j] || [];
        if (r[0] === name) return toNum(r[valueCol]);
      }
      return 0;
    };

    const blackAV = findPigment("Black AV", pctIdx, 1);
    const redGVD = findPigment("Red GVD", pctIdx, 1);
    const orangeGRVD = findPigment("Orange GRVD", pctIdx, 1);

    // Metrics live in rows pctIdx+5 .. pctIdx+15 (col 0 = label, col 1 = value)
    const findMetric = (label: string) => {
      for (let j = pctIdx + 4; j < Math.min(pctIdx + 18, rows.length); j++) {
        const r = rows[j] || [];
        if (
          typeof r[0] === "string" &&
          r[0].toLowerCase().includes(label.toLowerCase())
        ) {
          return r[1];
        }
      }
      return null;
    };

    const totalShadeLoading = toNum(findMetric("Total shade loading"));
    const pumpThrow = toNum(findMetric("Pump Throw"));
    const rateCcMin = toNum(findMetric("Rate in cc/min"));
    const rateLitHr = toNum(findMetric("Rate in lit"));
    const consumptionLitDay = toNum(findMetric("Consumption per day"));
    const daysRequired = toStr(findMetric("Days required"));
    const totalConsumption = toNum(findMetric("Total consumption"));
    const numBatches = toNum(findMetric("number of batches"));
    const concFullPct = toNum(findMetric("concentration for full"));
    const concHalfPct = toNum(findMetric("concentration for half"));

    // Kg block
    const blackAVKg = kgIdx > 0 ? findPigment("Black AV", kgIdx, 1) : 0;
    const redGVDKg = kgIdx > 0 ? findPigment("Red GVD", kgIdx, 1) : 0;
    const orangeGRVDKg = kgIdx > 0 ? findPigment("Orange GRVD", kgIdx, 1) : 0;
    let waterKg = 0;
    if (kgIdx > 0) {
      for (let j = kgIdx + 1; j < Math.min(kgIdx + 10, rows.length); j++) {
        const r = rows[j] || [];
        if (r[0] === "Water") {
          waterKg = toNum(r[1]);
          break;
        }
      }
    }

    if (!shadeName && !blackAV && !redGVD && !orangeGRVD) continue;

    recipes.push({
      id: `R-${recipes.length + 1}`,
      shadeName: shadeName || `Recipe ${recipes.length + 1}`,
      denier,
      sduUnit,
      customer,
      mcNo: mcNo || shadeNoVal,
      batchVolume,
      productionKg,
      blackAV,
      redGVD,
      orangeGRVD,
      blackAVKg,
      redGVDKg,
      orangeGRVDKg,
      waterKg,
      totalShadeLoading,
      pumpThrow,
      rateCcMin,
      rateLitHr,
      consumptionLitDay,
      daysRequired,
      totalConsumption,
      numBatches,
      concFullPct,
      concHalfPct,
      productionPeriod,
    });
  }

  return recipes;
}

// ---- Exporters ----
export function exportToExcel(
  rows: QualityRecord[],
  filename = "plantops-export.xlsx",
) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Quality Data");
  XLSX.writeFile(wb, filename);
}

export function exportRecipeToPDF(
  inputs: Record<string, any>,
  outputs: Record<string, any>,
  filename = "plantops-recipe.pdf",
) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("PLANTOPS — Recipe Calculation", 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString()}`, 14, 22);

  autoTable(doc, {
    startY: 28,
    head: [["Input", "Value"]],
    headStyles: { fillColor: [40, 50, 65], textColor: 255 },
    styles: { fontSize: 9 },
    body: [
      ["Batch Volume (L)", String(inputs.batchVolume)],
      ["Pump Rate (L/min)", String(inputs.pumpRate)],
      [
        "Concentration",
        `${inputs.concentration} Machine (${inputs.concFullPct}%)`,
      ],
      ["Total Shade Loading (%)", String(inputs.totalShadeLoading)],
      ["Black AV (%)", String(inputs.blackAV)],
      ["Red GVD (%)", String(inputs.redGVD)],
      ["Orange GRVD (%)", String(inputs.orangeGRVD)],
      ["Target Shade (%)", String(inputs.targetShade)],
    ],
  });

  const lastY = (doc as any).lastAutoTable.finalY + 6;
  autoTable(doc, {
    startY: lastY,
    head: [["Output", "Value"]],
    headStyles: { fillColor: [180, 130, 30], textColor: 255 },
    styles: { fontSize: 9 },
    body: [
      ["Black AV Volume (L)", String(outputs.blackAVVol)],
      ["Red GVD Volume (L)", String(outputs.redGVDVol)],
      ["Orange GRVD Volume (L)", String(outputs.orangeGRVDVol)],
      ["Total Shade Volume (L)", String(outputs.shadeVolume)],
      ["Achievement (%)", String(outputs.achievement)],
      ["Performance (%)", String(outputs.performance)],
      ["Estimated BF (%)", String(outputs.estimatedBf)],
      ["Cycle Time (min)", String(outputs.cycleMin)],
    ],
  });

  doc.save(filename);
}

export function exportToPDF(
  rows: QualityRecord[],
  filename = "plantops-report.pdf",
) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text("PLANTOPS — Quality & Recipe Report", 14, 14);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    `Generated ${new Date().toLocaleString()} · ${rows.length} records`,
    14,
    20,
  );

  autoTable(doc, {
    startY: 26,
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [40, 50, 65], textColor: 255 },
    head: [
      [
        "Date",
        "Shade",
        "Colour",
        "Party",
        "M/C",
        "Unit",
        "Shade%",
        "P.T.",
        "Rate",
        "BF",
        "Quality",
      ],
    ],
    body: rows.map((r) => [
      r.date,
      r.shadeNo,
      r.colour,
      r.partyName,
      r.mcNo,
      r.sduUnitNo,
      r.totalShadePct.toFixed(2),
      r.pt.toFixed(2),
      r.rateLpm.toFixed(2),
      r.bf.toFixed(2),
      r.qualityScore.toFixed(2),
    ]),
  });

  doc.save(filename);
}
