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

    // Dynamically locate the yellow header row closest above pctIdx for this recipe block
    let yHeaderIdx = -1;
    for (let j = pctIdx - 1; j >= 0; j--) {
      const r = rows[j] || [];
      if (
        r.some(
          (cell) =>
            typeof cell === "string" && cell.toLowerCase().includes("shade no"),
        )
      ) {
        yHeaderIdx = j;
        break;
      }
    }

    // Dynamic yellow header lookup helper
    const findYellowValue = (labelSub: string): string => {
      if (yHeaderIdx === -1) return "";
      const headerRow = rows[yHeaderIdx] || [];
      const valuesRow = rows[yHeaderIdx + 1] || [];
      const colIdx = headerRow.findIndex(
        (cell) =>
          typeof cell === "string" &&
          cell.toLowerCase().includes(labelSub.toLowerCase()),
      );
      return colIdx !== -1 ? toStr(valuesRow[colIdx]) : "";
    };

    // Scan for shade name / description in the rows above the yellow header
    let shadeName = "";
    if (yHeaderIdx !== -1) {
      for (let j = Math.max(0, yHeaderIdx - 4); j < yHeaderIdx; j++) {
        const r = rows[j] || [];
        const firstVal = r.find(
          (cell) => typeof cell === "string" && cell.trim().length > 3,
        );
        if (firstVal) {
          shadeName = toStr(firstVal);
          break;
        }
      }
    }

    const shadeNoVal = findYellowValue("Shade No");
    const denier = findYellowValue("Denier");
    const sduUnit = findYellowValue("SDU No");
    const customer = findYellowValue("Customer");
    const productionKg = toNum(findYellowValue("Production To Be Done"));
    const batchVolume = toNum(findYellowValue("Batch Volume")) || 200;
    const mcNo = findYellowValue("M/C No");
    const cellulose = toNum(findYellowValue("Cellulose")) || 8.8;
    const productionPeriod = findYellowValue("period");

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

    let productionRunDateFrom = "";
    let productionRunDateTo = "";
    let colorRunDurationDays = "";
    if (productionPeriod) {
      const matches = productionPeriod.match(/\d{1,2}[\.\/-]\d{1,2}[\.\/-]\d{2,4}/g);
      if (matches && matches.length >= 2) {
        const parseDate = (s: string) => {
          const parts = s.split(/[\.\/-]/);
          if (parts.length === 3) {
            let y = parseInt(parts[2]);
            if (y < 100) y += 2000;
            const m = parts[1].padStart(2, '0');
            const d = parts[0].padStart(2, '0');
            return `${y}-${m}-${d}`;
          }
          return "";
        };
        productionRunDateFrom = parseDate(matches[0]);
        productionRunDateTo = parseDate(matches[1]);
        const d1 = new Date(productionRunDateFrom);
        const d2 = new Date(productionRunDateTo);
        if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
          colorRunDurationDays = Math.ceil(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)).toString();
        }
      }
    }

    recipes.push({
      id: `R-${recipes.length + 1}`,
      shadeName: shadeName || `Recipe ${recipes.length + 1}`,
      shadeNo: shadeNoVal || "",
      denier: denier || "",
      sduUnit,
      customer,
      mcNo: mcNo || "",
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
      productionRunDateFrom,
      productionRunDateTo,
      colorRunDurationDays,
      cellulose,
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

  const body = [
    ["Shade No.", String(inputs.shadeNo || "-")],
    ["Party Name", String(inputs.partyName || "-")],
    ["Run Date (From)", String(inputs.productionRunDateFrom || "-")],
    ["Run Date (To)", String(inputs.productionRunDateTo || "-")],
    ["Run Duration (days)", String(inputs.colorRunDurationDays || "0")],
    ["Total Consumption", String(inputs.totalConsumption || "0")],
    ["Denier / Filament", String(inputs.denierFilament || "-")],
    ["Pump Throw", String(inputs.pumpThrow || "0")],
    ["Batch Volume (L)", String(inputs.batchVolume)],
    ["Pump Rate (L/min)", String(inputs.pumpRate)],
    [
      "Concentration",
      `${inputs.concentration} Machine (${outputs.calculatedConcFull ?? inputs.concFullPct}%)`,
    ],
    ["Total Shade Loading (%)", String(inputs.totalShadeLoading)],
  ];

  // Dynamically push all active pigments into the PDF inputs table body
  if (inputs.pigments && Array.isArray(inputs.pigments)) {
    inputs.pigments.forEach((p: any) => {
      body.push([`${p.name} (%)`, String(p.value)]);
    });
  }

  body.push(["Target Shade (%)", String(inputs.targetShade)]);

  autoTable(doc, {
    startY: 28,
    head: [["Input", "Value"]],
    headStyles: { fillColor: [40, 50, 65], textColor: 255 },
    styles: { fontSize: 9 },
    body,
  });

  const lastY = (doc as any).lastAutoTable.finalY + 6;

  const outputBody: string[][] = [];
  // Dynamically push computed volumes of all active pigments into the outputs table body
  if (outputs.pigments && Array.isArray(outputs.pigments)) {
    outputs.pigments.forEach((p: any) => {
      outputBody.push([`${p.name} Volume (L)`, String(p.volume)]);
    });
  }
  outputBody.push(
    ["Total Shade Volume (L)", String(outputs.shadeVolume)],
    ["Achievement (%)", String(outputs.achievement)],
    ["Performance (%)", String(outputs.performance)],
    ["Estimated BF (%)", String(outputs.estimatedBf)],
    ["Cycle Time (min)", String(outputs.cycleMin)],
    ["Total Batches", String(outputs.totalBatches || 0)],
    ["Water (L)", String(outputs.water || 0)],
  );

  autoTable(doc, {
    startY: lastY,
    head: [["Output", "Value"]],
    headStyles: { fillColor: [180, 130, 30], textColor: 255 },
    styles: { fontSize: 9 },
    body: outputBody,
  });

  doc.save(filename);
}

export function exportRecipeToExcel(
  inputs: Record<string, any>,
  outputs: Record<string, any>,
  filename = "plantops-recipe.xlsx",
) {
  const wb = XLSX.utils.book_new();

  // Include top-level metadata in the exported Excel inputs section
  const inputRows = [
    { Metric: "Shade No.", Value: inputs.shadeNo || "-" },
    { Metric: "Party Name", Value: inputs.partyName || "-" },
    { Metric: "Run Date (From)", Value: inputs.productionRunDateFrom || "-" },
    { Metric: "Run Date (To)", Value: inputs.productionRunDateTo || "-" },
    { Metric: "Run Duration (days)", Value: inputs.colorRunDurationDays || "0" },
    { Metric: "Total Consumption", Value: inputs.totalConsumption || 0 },
    { Metric: "Denier / Filament", Value: inputs.denierFilament || "-" },
    { Metric: "Pump Throw", Value: inputs.pumpThrow || 0 },
    { Metric: "Batch Volume (L)", Value: inputs.batchVolume },
    { Metric: "Pump Rate (L/min)", Value: inputs.pumpRate },
    {
      Metric: "Concentration",
      Value: `${inputs.concentration} Machine (${outputs.calculatedConcFull ?? inputs.concFullPct}%)`,
    },
    { Metric: "Total Shade Loading (%)", Value: inputs.totalShadeLoading },
  ];

  // Dynamically push all active pigments into the Excel inputs rows
  if (inputs.pigments && Array.isArray(inputs.pigments)) {
    inputs.pigments.forEach((p: any) => {
      inputRows.push({ Metric: `${p.name} (%)`, Value: p.value });
    });
  }

  inputRows.push({ Metric: "Target Shade (%)", Value: inputs.targetShade });

  const outputRows: { Metric: string; Value: any }[] = [];
  // Dynamically push all computed pigment volumes into the Excel outputs rows
  if (outputs.pigments && Array.isArray(outputs.pigments)) {
    outputs.pigments.forEach((p: any) => {
      outputRows.push({ Metric: `${p.name} Volume (L)`, Value: p.volume });
    });
  }
  outputRows.push(
    { Metric: "Total Shade Volume (L)", Value: outputs.shadeVolume },
    { Metric: "Achievement (%)", Value: outputs.achievement },
    { Metric: "Performance (%)", Value: outputs.performance },
    { Metric: "Estimated BF (%)", Value: outputs.estimatedBf },
    { Metric: "Cycle Time (min)", Value: outputs.cycleMin },
    { Metric: "Total Batches", Value: outputs.totalBatches || 0 },
    { Metric: "Water (L)", Value: outputs.water || 0 },
  );

  const combinedRows = [
    { Metric: "--- INPUTS ---", Value: "" },
    ...inputRows,
    { Metric: "", Value: "" },
    { Metric: "--- OUTPUTS ---", Value: "" },
    ...outputRows,
  ];

  const ws = XLSX.utils.json_to_sheet(combinedRows);

  ws["!cols"] = [{ wch: 25 }, { wch: 20 }];

  XLSX.utils.book_append_sheet(wb, ws, "Recipe Calculation");
  XLSX.writeFile(wb, filename);
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
    // Reordered columns in PDF output: Party is placed directly after Shade
    head: [
      [
        "Date",
        "Shade",
        "Party",
        "Colour",
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
      // Reordered data values: partyName follows shadeNo
      r.partyName,
      r.colour,
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
