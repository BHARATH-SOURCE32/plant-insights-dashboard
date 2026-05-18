import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export function downloadRecipePDF(recipe: any) {
  const doc = new jsPDF();
  doc.setFillColor(15, 27, 61);
  doc.rect(0, 0, 210, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text("Recipe Calculation Report", 14, 18);

  doc.setTextColor(15, 27, 61);
  doc.setFontSize(14);
  doc.text(recipe.shade_name || "Recipe", 14, 40);
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Customer: ${recipe.customer_name || "-"}`, 14, 47);
  doc.text(`Date: ${new Date().toLocaleString()}`, 14, 53);

  const inputs = [
    ["Shade No", recipe.shade_no],
    ["Denier / Filament", recipe.denier_filament],
    ["CF / Only CF", recipe.cf_only_cf],
    ["SDU No", recipe.sdu_no],
    ["M/C No", recipe.mc_no],
    ["No of Positions", recipe.no_of_positions],
    ["Cellulose %", recipe.cellulose],
    ["Production to be Done (Kg)", recipe.production_to_be_done_kg],
    ["Batch Volume (L)", recipe.batch_volume],
    ["Pump Throw", recipe.pump_throw],
  ];

  autoTable(doc, {
    startY: 60,
    head: [["Input", "Value"]],
    body: inputs.map(([k, v]) => [k, String(v ?? "-")]),
    headStyles: { fillColor: [59, 111, 160] },
    theme: "grid",
  });

  if (Array.isArray(recipe.pigments) && recipe.pigments.length) {
    autoTable(doc, {
      head: [["Pigment", "%"]],
      body: recipe.pigments.map((p: any) => [p.name, `${p.percent}%`]),
      headStyles: { fillColor: [30, 58, 95] },
      theme: "grid",
    });
  }

  const outputs = [
    ["Total Shade Loading", recipe.total_shade_loading],
    ["Rate (cc/min)", recipe.rate_cc_min],
    ["Rate (lit/hr)", recipe.rate_lit_hr],
    ["Consumption / Day", recipe.consumption_per_day],
    ["Days Required", recipe.days_required],
    ["Total Consumption", recipe.total_consumption],
    ["Total Batches", recipe.total_batches],
    ["Pigment Conc. (full machine)", recipe.pigment_conc_full],
    ["Pigment Conc. (half machine)", recipe.pigment_conc_half],
    ["Water Qty (ml)", recipe.water_qty],
    ["Total Qty (ml)", recipe.total_qty],
  ];

  autoTable(doc, {
    head: [["Output Metric", "Value"]],
    body: outputs.map(([k, v]) => [k, String(v ?? "-")]),
    headStyles: { fillColor: [15, 27, 61] },
    theme: "grid",
  });

  doc.save(`recipe-${recipe.shade_name || "report"}-${Date.now()}.pdf`);
}

export function downloadRecipeExcel(recipe: any) {
  const wb = XLSX.utils.book_new();
  const flat = { ...recipe };
  delete flat.pigments;
  const ws1 = XLSX.utils.json_to_sheet([flat]);
  XLSX.utils.book_append_sheet(wb, ws1, "Recipe");
  if (Array.isArray(recipe.pigments)) {
    const ws2 = XLSX.utils.json_to_sheet(recipe.pigments);
    XLSX.utils.book_append_sheet(wb, ws2, "Pigments");
  }
  XLSX.writeFile(wb, `recipe-${recipe.shade_name || "report"}-${Date.now()}.xlsx`);
}

export function downloadQualityExcel(rows: any[]) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Quality Data");
  XLSX.writeFile(wb, `quality-records-${Date.now()}.xlsx`);
}

export function downloadQualityPDF(rows: any[]) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFillColor(15, 27, 61);
  doc.rect(0, 0, 297, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text("Quality Records Report", 14, 14);

  // Reorder PDF headers to place Party and Denier right after Shade No, matching the UI
  const headers = ["Date", "Shade No", "Party", "Denier", "Colour", "M/C", "Shade %", "BF", "Variation", "Quality"];
  autoTable(doc, {
    startY: 28,
    head: [headers],
    body: rows.map((r) => [
      r.record_date || `${r.day}/${r.month}/${r.year}`,
      // Reordered data columns in PDF output: Party Name and Denier placed after Shade No
      r.shade_no, r.party_name, r.denier, r.colour, r.mc_no,
      r.total_shade_pct, r.bf, r.shade_variation, r.quality,
    ]),
    headStyles: { fillColor: [59, 111, 160] },
    styles: { fontSize: 8 },
    theme: "striped",
  });

  doc.save(`quality-records-${Date.now()}.pdf`);
}
