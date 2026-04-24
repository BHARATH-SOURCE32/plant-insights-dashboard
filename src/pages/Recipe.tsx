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
  batchVolume: number;
  pumpRate: number;
  blackAV: number;
  redGVD: number;
  orangeGRVD: number;
  totalShadeLoading: number;
  concFullPct: number;
  targetShade: number;
  concentration: "Full" | "Half";
}

interface Outputs {
  blackAVVol: number;
  redGVDVol: number;
  orangeGRVDVol: number;
  shadeVolume: number;
  totalPigmentPct: number;
  achievement: number;
  performance: number;
  estimatedBf: number;
  cycleMin: number;
}

// --- Logic ---
function calculate(i: Inputs): Outputs {
  const conc = i.concentration === "Full" ? i.concFullPct : i.concFullPct / 2;
  const tsl = i.totalShadeLoading > 0 ? i.totalShadeLoading : 1;
  const blackAVVol = +(
    (((conc * i.batchVolume) / 100) * i.blackAV) /
    tsl
  ).toFixed(3);
  const redGVDVol = +(
    (((conc * i.batchVolume) / 100) * i.redGVD) /
    tsl
  ).toFixed(3);
  const orangeGRVDVol = +(
    (((conc * i.batchVolume) / 100) * i.orangeGRVD) /
    tsl
  ).toFixed(3);
  const shadeVolume = +(blackAVVol + redGVDVol + orangeGRVDVol).toFixed(3);
  const totalPigmentPct = +(i.blackAV + i.redGVD + i.orangeGRVD).toFixed(3);
  const achievement =
    i.targetShade > 0
      ? +((totalPigmentPct / i.targetShade) * 100).toFixed(2)
      : 0;
  const performance = +Math.min(
    100,
    achievement * 0.92 + i.pumpRate * 1.5,
  ).toFixed(2);
  const estimatedBf = +Math.min(98, 60 + performance * 0.32).toFixed(2);
  const cycleMin =
    i.pumpRate > 0 ? +(i.batchVolume / i.pumpRate).toFixed(1) : 0;
  return {
    blackAVVol,
    redGVDVol,
    orangeGRVDVol,
    shadeVolume,
    totalPigmentPct,
    achievement,
    performance,
    estimatedBf,
    cycleMin,
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

  const [inputs, setInputs] = useState<Inputs>({
    batchVolume: 200,
    pumpRate: 6,
    blackAV: 1.25,
    redGVD: 0.4,
    orangeGRVD: 4,
    totalShadeLoading: 5.65,
    concFullPct: 15,
    targetShade: 5.65,
    concentration: "Full",
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
    const body = encodeURIComponent(
      [
        "Recipe Calculation",
        "",
        `Batch Volume: ${submitted.inputs.batchVolume} L`,
        `Pump Rate: ${submitted.inputs.pumpRate} L/min`,
        `Concentration: ${submitted.inputs.concentration} Machine (${submitted.inputs.concFullPct}%)`,
        `Total Shade Loading: ${submitted.inputs.totalShadeLoading}%`,
        "",
        "Pigments (% on yarn):",
        `  Black AV   = ${submitted.inputs.blackAV}%`,
        `  Red GVD    = ${submitted.inputs.redGVD}%`,
        `  Orange GRVD= ${submitted.inputs.orangeGRVD}%`,
        "",
        "Calculated Volumes (L of pigment solution per batch):",
        `  Black AV   = ${submitted.outputs.blackAVVol} L`,
        `  Red GVD    = ${submitted.outputs.redGVDVol} L`,
        `  Orange GRVD= ${submitted.outputs.orangeGRVDVol} L`,
        `  Total      = ${submitted.outputs.shadeVolume} L`,
        "",
        `Achievement : ${submitted.outputs.achievement}%`,
        `Performance : ${submitted.outputs.performance}%`,
        `Estimated BF: ${submitted.outputs.estimatedBf}%`,
        `Cycle Time  : ${submitted.outputs.cycleMin} min`,
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
              return { ok: true, msg: `Imported ${parsed.length} recipe(s)` };
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
              <Field
                label="Batch Volume (L)"
                value={inputs.batchVolume}
                onChange={(v) => set("batchVolume", v)}
              />
              <Field
                label="Pump Rate (L/min)"
                value={inputs.pumpRate}
                onChange={(v) => set("pumpRate", v)}
                step={0.1}
              />
              <Field
                label="Conc. Full M/C (%)"
                value={inputs.concFullPct}
                onChange={(v) => set("concFullPct", v)}
                step={0.1}
              />
              <Field
                label="Total Shade Loading (%)"
                value={inputs.totalShadeLoading}
                onChange={(v) => set("totalShadeLoading", v)}
                step={0.01}
              />
              <Field
                label="Black AV (% on yarn)"
                value={inputs.blackAV}
                onChange={(v) => set("blackAV", v)}
                step={0.01}
              />
              <Field
                label="Red GVD (% on yarn)"
                value={inputs.redGVD}
                onChange={(v) => set("redGVD", v)}
                step={0.01}
              />
              <Field
                label="Orange GRVD (% on yarn)"
                value={inputs.orangeGRVD}
                onChange={(v) => set("orangeGRVD", v)}
                step={0.01}
              />
              <Field
                label="Target Shade %"
                value={inputs.targetShade}
                onChange={(v) => set("targetShade", v)}
                step={0.01}
              />
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
              <Out
                label="Black AV Vol"
                value={out.blackAVVol}
                unit="L"
                tone="dark"
              />
              <Out
                label="Red GVD Vol"
                value={out.redGVDVol}
                unit="L"
                tone="red"
              />
              <Out
                label="Orange GRVD Vol"
                value={out.orangeGRVDVol}
                unit="L"
                tone="orange"
              />
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <BigStat
                  label="Black AV"
                  v={submitted.outputs.blackAVVol}
                  u="L"
                />
                <BigStat
                  label="Red GVD"
                  v={submitted.outputs.redGVDVol}
                  u="L"
                />
                <BigStat
                  label="Orange GRVD"
                  v={submitted.outputs.orangeGRVDVol}
                  u="L"
                />
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
                        {r.shadeName}
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
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <div>
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <Input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="mt-1 bg-background num h-9"
      />
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
