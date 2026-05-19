import { useState, useRef } from "react";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FlaskConical,
  Beaker,
  Download,
  Mail,
  Sparkles,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Plus,
  Trash2,
} from "lucide-react";
import {
  exportRecipeToPDF,
  exportRecipeToExcel,
  parseRecipeFile,
} from "@/lib/io";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// --- Types ---
interface Inputs {
  // Metadata fields for shade info and pump throw (can be uploaded via excel or typed manually)
  shadeNo: string;
  pumpThrow: number;
  denierFilament: string;
  batchVolume: number;
  pumpRate: number;
  // A dynamic pigments list
  pigments: { id: string; name: string; value: number; weight?: number }[];
  totalShadeLoading: number;
  concFullPct: number;
  targetShade: number;
  concentration: "Full" | "Half";
  // Added cellulose and rateCcMin to dynamically calculate concentration from formulas
  cellulose: number;
  rateCcMin: number;

  // New fields
  partyName: string;
  productionRunDateFrom: string;
  productionRunDateTo: string;
  colorRunDurationDays: string;
  totalConsumption: number;
}

interface OutputPigment {
  name: string;
  value: number;
  volume: number;
}

interface Outputs {
  calculatedConcFull: number;
  pigments: OutputPigment[];
  shadeVolume: number;
  totalPigmentPct: number;
  achievement: number;
  performance: number;
  estimatedBf: number;
  cycleMin: number;
  totalBatches: number;
  water: number;
}

// --- Logic ---
function calculate(i: Inputs): Outputs {
  const cell = (+i.cellulose || 0) > 0 ? +i.cellulose || 0 : 8.8;
  const rateCc = (+i.rateCcMin || 0) > 0 ? +i.rateCcMin || 0 : 77;
  const tsl = (+i.totalShadeLoading || 0) > 0 ? +i.totalShadeLoading || 0 : 1;
  const pumpThrow = +i.pumpThrow || 0;
  const batchVolume = +i.batchVolume || 0;
  const pumpRate = +i.pumpRate || 0;
  const targetShade = +i.targetShade || 0;

  // Calculate Concentration dynamically using the client's formula: (132 * Cellulose / 500) * Total Shade Loading * Pump Throw / Rate in cc/min
  const calculatedConcFull =
    pumpThrow > 0 && rateCc > 0
      ? +(
          (((132 * cell) / 500) * (+i.totalShadeLoading || 0) * pumpThrow) /
          rateCc
        ).toFixed(2)
      : +i.concFullPct || 0;

  const conc =
    i.concentration === "Full" ? calculatedConcFull : calculatedConcFull / 2;

  let totalPigmentPct = 0;
  // Dynamically calculate pigment solution volumes for each active pigment
  const outputPigments = (i.pigments || []).map((p) => {
    const val = +p.value || 0;
    const vol = +((((conc * batchVolume) / 100) * val) / tsl).toFixed(3);
    totalPigmentPct += val;
    return {
      name: p.name,
      value: val,
      volume: vol,
    };
  });

  totalPigmentPct = +totalPigmentPct.toFixed(3);
  const shadeVolume = +outputPigments
    .reduce((sum, p) => sum + p.volume, 0)
    .toFixed(3);

  const achievement =
    targetShade > 0 ? +((totalPigmentPct / targetShade) * 100).toFixed(2) : 0;
  const performance = +Math.min(
    100,
    achievement * 0.92 + pumpRate * 1.5,
  ).toFixed(2);
  const estimatedBf = +Math.min(98, 60 + performance * 0.32).toFixed(2);
  const cycleMin = pumpRate > 0 ? +(batchVolume / pumpRate).toFixed(1) : 0;

  const totalBatches =
    batchVolume > 0 ? +((i.totalConsumption || 0) / batchVolume).toFixed(2) : 0;
  const totalPigmentWeight = outputPigments.reduce(
    (sum, p) => sum + p.volume,
    0,
  );
  const water = +(200 - totalPigmentWeight).toFixed(2);

  return {
    calculatedConcFull,
    pigments: outputPigments,
    shadeVolume,
    totalPigmentPct,
    achievement,
    performance,
    estimatedBf,
    cycleMin,
    totalBatches,
    water,
  };
}

// --- Import Button ---
function ImportExcelButton({
  label = "Import Excel",
  variant = "outline",
  onParse,
}: any) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(
    null,
  );

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await onParse(f);
      setStatus(res);
    } catch (err) {
      setStatus({ ok: false, msg: (err as Error).message });
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
      setTimeout(() => setStatus(null), 4000);
    }
  };

  return (
    <div className="relative inline-flex flex-col items-end gap-1">
      <input
        ref={ref}
        type="file"
        accept=".xlsx,.xls"
        onChange={onChange}
        className="hidden"
      />
      <Button
        size="sm"
        variant={variant}
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="h-9 border-primary/20 text-primary hover:bg-primary/5 hover:text-primary"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Download className="h-4 w-4 mr-2" />
        )}
        {label}
      </Button>
      {status && (
        <div
          className={cn(
            "absolute top-full mt-1 right-0 z-10 text-[11px] px-2 py-1 rounded-md whitespace-nowrap flex items-center gap-1 shadow-md border",
            status.ok
              ? "bg-success/15 text-success border-success/30"
              : "bg-destructive/15 text-destructive border-destructive/30",
          )}
        >
          {status.ok ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <AlertCircle className="h-3 w-3" />
          )}
          {status.msg}
        </div>
      )}
    </div>
  );
}

export default function Recipe() {
  const [recipes, setRecipes] = useState<any[]>([]);

  // Setup default state containing the new metadata fields and dynamic pigments
  const [inputs, setInputs] = useState<Inputs>({
    shadeNo: "0",
    pumpThrow: 0,
    denierFilament: "0",
    batchVolume: 0,
    pumpRate: 0,
    pigments: [
      { id: "blackAV", name: "Black AV", value: 0, weight: 0 },
      { id: "redGVD", name: "Red GVD", value: 0, weight: 0 },
      { id: "orangeGRVD", name: "Orange GRVD", value: 0, weight: 0 },
    ],
    totalShadeLoading: 0,
    concFullPct: 0,
    targetShade: 0,
    concentration: "Full",
    cellulose: 0,
    rateCcMin: 0,
    partyName: "",
    productionRunDateFrom: "",
    productionRunDateTo: "",
    colorRunDurationDays: "",
    totalConsumption: 0,
  });
  const [submitted, setSubmitted] = useState<{
    inputs: Inputs;
    outputs: Outputs;
  } | null>(null);
  const [emailTo, setEmailTo] = useState("");

  const out = calculate(inputs);

  const set = <K extends keyof Inputs>(k: K, v: Inputs[K]) =>
    setInputs((s) => ({ ...s, [k]: v }));

  const onSubmit = () => {
    setSubmitted({ inputs, outputs: out });
    toast.success("Recipe calculated and logged");
  };

  const onExportPDF = () => {
    if (!submitted) return;
    exportRecipeToPDF(submitted.inputs, submitted.outputs);
    toast.success("PDF downloaded");
  };

  const onExportExcel = () => {
    if (!submitted) return;
    const filename = `report_recipe_${new Date().toISOString().slice(0, 10)}.xlsx`;
    exportRecipeToExcel(submitted.inputs, submitted.outputs, filename);
    toast.success("Excel downloaded");
  };

  const onEmail = () => {
    if (!submitted) return;
    if (!emailTo) {
      toast.error("Enter a recipient email");
      return;
    }
    const subject = encodeURIComponent("PlantOps — Recipe Calculation");

    // Dynamically format input and output pigments lists in email body
    const pigmentsInputStr = (submitted.inputs.pigments || [])
      .map((p: any) => `  ${p.name.padEnd(12)} = ${p.value}%`)
      .join("\n");
    const pigmentsOutputStr = (submitted.outputs.pigments || [])
      .map((p: any) => `  ${p.name.padEnd(12)} = ${p.volume} L`)
      .join("\n");

    const body = encodeURIComponent(
      [
        "Recipe Calculation",
        "",
        `Shade No: ${submitted.inputs.shadeNo || "-"}`,
        `Denier / Filament: ${submitted.inputs.denierFilament || "-"}`,
        `Pump Throw: ${submitted.inputs.pumpThrow || "-"}`,
        `Batch Volume: ${submitted.inputs.batchVolume} L`,
        `Pump Rate: ${submitted.inputs.pumpRate} L/min`,
        `Concentration: ${submitted.inputs.concentration} Machine (${submitted.inputs.concFullPct}%)`,
        `Total Shade Loading: ${submitted.inputs.totalShadeLoading}%`,
        "",
        "Pigments (% on yarn):",
        pigmentsInputStr,
        "",
        "Calculated Volumes (L of pigment solution per batch):",
        pigmentsOutputStr,
        `  Total      = ${submitted.outputs.shadeVolume} L`,
        "",
        `Achievement : ${submitted.outputs.achievement}%`,
        `Performance : ${submitted.outputs.performance}%`,
        `Cycle Time  : ${submitted.outputs.cycleMin} min`,
        `Party Name  : ${submitted.inputs.partyName || "-"}`,
        `Run Date    : ${submitted.inputs.productionRunDateFrom} to ${submitted.inputs.productionRunDateTo}`,
        `Duration    : ${submitted.inputs.colorRunDurationDays} days`,
        `Total Batches: ${submitted.outputs.totalBatches}`,
        `Water       : ${submitted.outputs.water}`,
      ].join("\n"),
    );
    window.location.href = `mailto:${emailTo}?subject=${subject}&body=${body}`;
  };

  return (
    <AppShell>
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Recipe Engine</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Calculate pigment volumes &amp; performance from recipe inputs
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ImportExcelButton
            label="Import Recipe Excel"
            onParse={async (file: File) => {
              const parsed = await parseRecipeFile(file);
              if (!parsed.length)
                return { ok: false, msg: "No recipe blocks found" };
              setRecipes(parsed);

              // Immediately populate the calculator inputs state with the parsed Excel record on upload
              const r = parsed[0];
              setInputs({
                shadeNo: r.shadeNo || r.shadeName || "",
                denierFilament: r.denier || "",
                pumpThrow: r.pumpThrow || 0,
                batchVolume: r.batchVolume || 200,
                pumpRate: r.rateLitHr || 6,
                // Pre-fill the dynamic pigments list from spreadsheet column data
                pigments: [
                  {
                    id: "blackAV",
                    name: "Black AV",
                    value: r.blackAV || 0,
                    weight: r.blackAVKg || 0,
                  },
                  {
                    id: "redGVD",
                    name: "Red GVD",
                    value: r.redGVD || 0,
                    weight: r.redGVDKg || 0,
                  },
                  {
                    id: "orangeGRVD",
                    name: "Orange GRVD",
                    value: r.orangeGRVD || 0,
                    weight: r.orangeGRVDKg || 0,
                  },
                ],
                totalShadeLoading: r.totalShadeLoading || 0,
                concFullPct: r.concFullPct || 15,
                targetShade: r.totalShadeLoading || 0,
                concentration: "Full",
                cellulose: r.cellulose || 8.8,
                rateCcMin: r.rateCcMin || 77.0,
                partyName: r.customer || "",
                productionRunDateFrom: r.productionRunDateFrom || "",
                productionRunDateTo: r.productionRunDateTo || "",
                colorRunDurationDays: r.colorRunDurationDays || "",
                totalConsumption: r.totalConsumption || 0,
              });

              return {
                ok: true,
                msg: `Imported ${parsed.length} recipe(s) & loaded to calculator`,
              };
            }}
          />
        </div>
      </header>
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* INPUTS */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border">
              <div className="h-10 w-10 rounded-lg accent-gradient text-white flex items-center justify-center shadow">
                <FlaskConical className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold tracking-tight text-navy">
                  Recipe Inputs
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Enter pigment & batch parameters
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Display Shade No., Denier / Filament, and Pump Throw at the top using standard, individual Field components */}
              <Field
                label="Shade No."
                value={inputs.shadeNo}
                onChange={(v) => set("shadeNo", v)}
                type="text"
              />
              <Field
                label="Party Name"
                value={inputs.partyName}
                onChange={(v) => set("partyName", v)}
                type="text"
              />
              <div className="col-span-2 grid grid-cols-2 gap-3">
                <Field
                  label="Run Date (From)"
                  value={inputs.productionRunDateFrom}
                  onChange={(v) => {
                    set("productionRunDateFrom", v);
                    // Calculate days if both dates are present
                    if (v && inputs.productionRunDateTo) {
                      const d1 = new Date(v);
                      const d2 = new Date(inputs.productionRunDateTo);
                      if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
                        const days = Math.ceil(
                          Math.abs(d2.getTime() - d1.getTime()) /
                            (1000 * 60 * 60 * 24),
                        );
                        set("colorRunDurationDays", days.toString());
                      }
                    }
                  }}
                  type="date"
                />
                <Field
                  label="Run Date (To)"
                  value={inputs.productionRunDateTo}
                  onChange={(v) => {
                    set("productionRunDateTo", v);
                    // Calculate days if both dates are present
                    if (inputs.productionRunDateFrom && v) {
                      const d1 = new Date(inputs.productionRunDateFrom);
                      const d2 = new Date(v);
                      if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
                        const days = Math.ceil(
                          Math.abs(d2.getTime() - d1.getTime()) /
                            (1000 * 60 * 60 * 24),
                        );
                        set("colorRunDurationDays", days.toString());
                      }
                    }
                  }}
                  type="date"
                />
              </div>
              <Field
                label="Run Duration (days)"
                value={inputs.colorRunDurationDays}
                onChange={(v) => set("colorRunDurationDays", v)}
                type="text"
              />
              <Field
                label="Denier / Filament"
                value={inputs.denierFilament}
                onChange={(v) => set("denierFilament", v)}
                type="text"
              />
              <Field
                label="Pump Throw"
                value={inputs.pumpThrow}
                onChange={(v) => set("pumpThrow", v)}
                step={0.01}
              />
              <Field
                label="Cellulose"
                value={inputs.cellulose}
                onChange={(v) => set("cellulose", v)}
                step={0.1}
              />
              <Field
                label="Rate (cc/min)"
                value={inputs.rateCcMin}
                onChange={(v) => set("rateCcMin", v)}
                step={0.1}
              />
              <Field
                label="Pump Rate (L/min)"
                value={inputs.pumpRate}
                onChange={(v) => set("pumpRate", v)}
                step={0.1}
              />
              <Field
                label="Total Batches"
                value={out.totalBatches}
                onChange={() => {}}
                disabled
              />
              <Field
                label="Water"
                value={out.water}
                onChange={() => {}}
                disabled
              />
              <Field
                label="Batch Volume (L)"
                value={inputs.batchVolume}
                onChange={(v) => set("batchVolume", v)}
              />
              {/* <Field
                label="Conc. Full M/C (%)"
                value={out.calculatedConcFull}
                onChange={(v) => set("concFullPct", v)}
                step={0.01}
                disabled
              /> */}
              <Field
                label="Total Shade Loading (%)"
                value={inputs.totalShadeLoading}
                onChange={(v) => set("totalShadeLoading", v)}
                step={0.01}
              />

              {/* <Field
                label="Target Shade %"
                value={inputs.targetShade}
                onChange={(v) => set("targetShade", v)}
                step={0.01}
              /> */}

              <Field
                label="Total Consumption"
                value={inputs.totalConsumption}
                onChange={(v) => set("totalConsumption", v)}
              />

              {/* Dynamic Pigment Section with dynamically added fields, customizable names, and live calculation */}
              <div className="col-span-2 border-t border-b border-border py-4 my-2 bg-muted/20 px-3 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[11px] uppercase tracking-wider font-bold text-primary">
                    Pigment Section (% on yarn)
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const newPigments = [
                        ...inputs.pigments,
                        {
                          id: `custom-${Date.now()}`,
                          name: `Pigment ${inputs.pigments.length + 1}`,
                          value: 0,
                          weight: 0,
                        },
                      ];
                      // Calculate the sum of all pigments dynamically to update the shade loading
                      const sum = +newPigments
                        .reduce((acc, curr) => acc + curr.value, 0)
                        .toFixed(3);
                      setInputs({
                        ...inputs,
                        pigments: newPigments,
                        totalShadeLoading: sum,
                        targetShade: sum,
                      });
                    }}
                    className="h-7 text-[10px] px-2.5 border-primary/20 text-primary hover:bg-primary/5 hover:text-primary whitespace-nowrap"
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add Pigment
                  </Button>
                </div>
                <div className="space-y-3">
                  {inputs.pigments.map((p, idx) => (
                    <div
                      key={p.id || idx}
                      className="grid grid-cols-12 gap-2 items-end"
                    >
                      <div className="col-span-6">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Pigment Name
                        </Label>
                        <Input
                          type="text"
                          value={p.name}
                          onChange={(e) => {
                            const newPigments = [...inputs.pigments];
                            newPigments[idx] = { ...p, name: e.target.value };
                            setInputs({ ...inputs, pigments: newPigments });
                          }}
                          className="mt-1 bg-background h-9 text-xs font-semibold"
                          placeholder="e.g. Black AV"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          % on yarn
                        </Label>
                        <Input
                          type="text"
                          value={p.value === 0 ? "" : p.value}
                          onChange={(e) => {
                            const val = e.target.value;
                            const newPigments = [...inputs.pigments];
                            const parsedVal =
                              val === "" ? 0 : parseFloat(val) || 0;
                            newPigments[idx] = { ...p, value: parsedVal };
                            // Calculate the sum of all pigments dynamically to update the shade loading
                            const sum = +newPigments
                              .reduce((acc, curr) => acc + (curr.value || 0), 0)
                              .toFixed(3);
                            setInputs({
                              ...inputs,
                              pigments: newPigments,
                              totalShadeLoading: sum,
                              targetShade: sum,
                            });
                          }}
                          className="mt-1 bg-background num h-9 text-xs"
                          placeholder="0.00"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Weight (Kg)
                        </Label>
                        <Input
                          type="text"
                          value={out.pigments[idx]?.volume || 0}
                          disabled
                          className="mt-1 bg-muted num h-9 text-xs cursor-not-allowed font-semibold text-muted-foreground"
                          placeholder="0.00"
                        />
                      </div>
                      <div className="col-span-2 flex justify-end pb-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const newPigments = inputs.pigments.filter(
                              (_, i) => i !== idx,
                            );
                            // Calculate the sum of all pigments dynamically to update the shade loading
                            const sum = +newPigments
                              .reduce((acc, curr) => acc + curr.value, 0)
                              .toFixed(3);
                            setInputs({
                              ...inputs,
                              pigments: newPigments,
                              totalShadeLoading: sum,
                              targetShade: sum,
                            });
                          }}
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={inputs.pigments.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="col-span-2">
                <Label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                  Machine Concentration
                </Label>
                <div className="mt-1.5 flex gap-2">
                  {(["Full", "Half"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => set("concentration", c)}
                      className={`flex-1 py-2 text-sm font-medium rounded-md border transition-all ${
                        inputs.concentration === c
                          ? "bg-primary text-primary-foreground border-primary shadow"
                          : "bg-background border-input text-foreground hover:bg-muted"
                      }`}
                    >
                      {c} Machine
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button
              className="w-full mt-5 h-11 text-sm font-semibold hover:bg-primary/90"
              onClick={onSubmit}
            >
              <Sparkles className="h-4 w-4 mr-2" /> Calculate & Log Recipe
            </Button>
          </div>

          {/* LIVE PREVIEW */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border">
              <div className="h-10 w-10 rounded-lg brand-gradient text-white flex items-center justify-center shadow">
                <Beaker className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold tracking-tight text-navy">
                  Live Preview
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Updates as you type
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Render dynamic calculated outputs for all pigments */}
              {(out.pigments || []).map((p, idx) => (
                <Out
                  key={idx}
                  label={`${p.name} Vol`}
                  value={p.volume}
                  unit="L"
                  tone={
                    p.name.toLowerCase().includes("black")
                      ? "dark"
                      : p.name.toLowerCase().includes("red")
                        ? "red"
                        : p.name.toLowerCase().includes("orange")
                          ? "orange"
                          : undefined
                  }
                />
              ))}
              <Out
                label="Shade Volume"
                value={out.shadeVolume}
                unit="L"
                highlight
              />
              <Out
                label="Achievement"
                value={out.achievement}
                unit="%"
                highlight
              />
              <Out label="Performance" value={out.performance} unit="%" />
            </div>

            <div className="mt-5 pt-4 border-t border-border">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                Performance Indicator
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full accent-gradient transition-all"
                  style={{ width: `${Math.min(100, out.performance)}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-muted-foreground num">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        </div>

        {/* SUBMITTED OUTPUT + EXPORT/EMAIL */}
        {submitted && (
          <div className="rounded-xl border-2 border-primary/30 bg-card overflow-hidden shadow-md">
            <div className="brand-gradient px-5 py-4 text-white">
              <div className="text-[11px] uppercase tracking-[0.2em] font-semibold text-gold">
                Calculated Recipe Output
              </div>
              <h3 className="text-xl font-bold tracking-tight mt-1">
                {submitted.inputs.shadeNo
                  ? `Shade ${submitted.inputs.shadeNo} · `
                  : ""}
                {submitted.inputs.concentration} Machine ·{" "}
                {submitted.inputs.batchVolume} L batch
              </h3>
              <p className="text-xs text-white/80 mt-1">
                Total pigment vol:{" "}
                <span className="num font-semibold text-gold">
                  {submitted.outputs.shadeVolume} L
                </span>{" "}
                · Achievement:{" "}
                <span className="num font-semibold text-gold">
                  {submitted.outputs.achievement}%
                </span>
              </p>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-5">
                {/* Dynamically render stats for any number of dynamic pigments */}
                {(submitted.outputs.pigments || []).map((p, idx) => (
                  <BigStat key={idx} label={p.name} v={p.volume} u="L" />
                ))}
                <BigStat
                  label="Total Volume"
                  v={submitted.outputs.shadeVolume}
                  u="L"
                  highlight
                />
                <BigStat
                  label="Achievement"
                  v={submitted.outputs.achievement}
                  u="%"
                />
                <BigStat
                  label="Performance"
                  v={submitted.outputs.performance}
                  u="%"
                />
                <BigStat
                  label="Estimated BF"
                  v={submitted.outputs.estimatedBf}
                  u="%"
                />
                <BigStat
                  label="Cycle Time"
                  v={submitted.outputs.cycleMin}
                  u="min"
                />
                <BigStat
                  label="Total Batches"
                  v={submitted.outputs.totalBatches}
                  u=""
                />
                <BigStat label="Water" v={submitted.outputs.water} u="L" />
              </div>

              <div className="border-t border-border pt-4 grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
                <div>
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Send results to email
                  </Label>
                  <Input
                    type="email"
                    placeholder="recipient@plant.com"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    className="mt-1 bg-background h-10"
                  />
                </div>
                <Button
                  variant="outline"
                  className="h-10 border-primary/40 text-primary hover:bg-primary/5 hover:text-primary"
                  onClick={onExportPDF}
                >
                  <Upload className="h-4 w-4 mr-2" /> Export PDF
                </Button>
                <Button
                  variant="outline"
                  className="h-10 border-primary/40 text-primary hover:bg-primary/5 hover:text-primary"
                  onClick={onExportExcel}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" /> Export Excel
                </Button>
                <Button className="h-10 hover:bg-primary/90" onClick={onEmail}>
                  <Mail className="h-4 w-4 mr-2" /> Send Email
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* IMPORTED RECIPES */}
        {recipes.length > 0 && (
          <div className="mt-6 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold tracking-tight">
                Imported Recipes
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5 num">
                {recipes.length} recipe(s) loaded
              </p>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr className="text-left">
                    {[
                      "Shade",
                      "Denier",
                      "Customer",
                      "M/C",
                      "Batch (L)",
                      "Black AV %",
                      "Red GVD %",
                      "Orange GRVD %",
                      "Pump (g/5m)",
                      "Conc Full %",
                      "Total Cons (L)",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2.5 font-medium uppercase tracking-wider text-[10px] text-muted-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="num">
                  {recipes.map((r, i) => (
                    <tr
                      key={r.id || i}
                      className="border-t border-border hover:bg-secondary/40 transition-colors"
                    >
                      <td className="px-3 py-2 font-sans font-medium text-primary">
                        {r.shadeNo || r.shadeName}
                      </td>
                      <td className="px-3 py-2">{r.denier}</td>
                      <td className="px-3 py-2 font-sans">{r.customer}</td>
                      <td className="px-3 py-2">{r.mcNo}</td>
                      <td className="px-3 py-2">{r.batchVolume}</td>
                      <td className="px-3 py-2">{r.blackAV?.toFixed(2)}</td>
                      <td className="px-3 py-2">{r.redGVD?.toFixed(2)}</td>
                      <td className="px-3 py-2">{r.orangeGRVD?.toFixed(2)}</td>
                      <td className="px-3 py-2">{r.pumpThrow}</td>
                      <td className="px-3 py-2">{r.concFullPct?.toFixed(2)}</td>
                      <td className="px-3 py-2">
                        {r.totalConsumption?.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

// --- Internal UI components ---
function Field({
  label,
  value,
  onChange,
  step = 1,
  type = "number",
  disabled = false,
  placeholder = "0",
}: {
  label: string;
  value: any;
  onChange: (v: any) => void;
  step?: number;
  type?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </Label>
      {type === "date" ? (
        <Input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-9 bg-background text-xs"
        />
      ) : type === "text" ? (
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className="h-9 bg-background text-xs"
        />
      ) : (
        <Input
          type="number"
          step={step}
          value={value === 0 && !disabled ? "" : value}
          onChange={(e) => {
            const val = e.target.value;
            onChange(val === "" ? 0 : parseFloat(val) || 0);
          }}
          disabled={disabled}
          placeholder={placeholder}
          className="h-9 bg-background num text-xs"
        />
      )}
    </div>
  );
}

function Out({
  label,
  value,
  unit,
  highlight,
  tone,
}: {
  label: string;
  value: number | string;
  unit: string;
  highlight?: boolean;
  tone?: "dark" | "red" | "orange";
}) {
  const toneClass =
    tone === "dark"
      ? "border-l-4 border-l-navy"
      : tone === "red"
        ? "border-l-4 border-l-primary"
        : tone === "orange"
          ? "border-l-4 border-l-gold"
          : "";
  return (
    <div
      className={`rounded-md border p-3 transition-all ${highlight ? "border-primary/40 bg-primary/5" : "border-border bg-background"} ${toneClass}`}
    >
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span
          className={`text-xl font-bold num ${highlight ? "text-primary" : "text-navy"}`}
        >
          {value}
        </span>
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

function BigStat({
  label,
  v,
  u,
  highlight,
}: {
  label: string;
  v: number;
  u: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${highlight ? "border-primary/50 bg-primary/10" : "border-border bg-background"}`}
    >
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span
          className={`text-2xl font-bold num ${highlight ? "text-primary" : "text-navy"}`}
        >
          {v}
        </span>
        <span className="text-xs text-muted-foreground">{u}</span>
      </div>
    </div>
  );
}
