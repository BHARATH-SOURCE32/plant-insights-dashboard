import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  calculateRecipe,
  type Pigment,
  type RecipeOutputs,
} from "@/lib/recipe";
import { downloadRecipePDF, downloadRecipeExcel } from "@/lib/exporters";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Calculator,
  FileSpreadsheet,
  Download,
  Mail,
  Save,
  Upload,
} from "lucide-react";
import * as XLSX from "xlsx";

const RECIPE_FIELD_MAP: Record<string, string> = {
  "Shade Name": "shadeName",
  "Customer Name": "customerName",
  "Shade No": "shadeNo",
  "Denier / Filament": "denierFilament",
  "Denier/Filament": "denierFilament",
  "CF / Only CF": "cfOnlyCf",
  "CF Only CF": "cfOnlyCf",
  "SDU No": "sduNo",
  "Production To Be Done (Tons)": "productionToBeDoneKg",
  "Production (Tons)": "productionToBeDoneKg",
  "Batch Volume (L)": "batchVolume",
  "Batch Volume": "batchVolume",
  "M/C No": "mcNo",
  "MC No": "mcNo",
  "No of Positions": "noOfPositions",
  "No Of Positions": "noOfPositions",
  "Cellulose %": "cellulose",
  Cellulose: "cellulose",
  "Pump Throw (gms / 5 min)": "pumpThrow",
  "Pump Throw": "pumpThrow",
  "Rate (cc/min)": "rateCcMin",
  "Rate cc/min": "rateCcMin",
  "Production / Day (kg)": "productionPerDay",
  "Production Per Day": "productionPerDay",
  "Expected Quality (%)": "expectedQuality",
  "Expected Quality": "expectedQuality",
};

const NUMBER_FIELDS = new Set([
  "productionToBeDoneKg",
  "batchVolume",
  "noOfPositions",
  "cellulose",
  "pumpThrow",
  "rateCcMin",
  "productionPerDay",
  "expectedQuality",
]);

const DEFAULT_PIGMENTS: Pigment[] = [
  { name: "Black AV", percent: 0.5 },
  { name: "Red GVD", percent: 0.3 },
  { name: "Orange GRVD", percent: 0.2 },
];

export default function Recipe() {
  const { user } = useAuth();
  const [shadeName, setShadeName] = useState("Natal Brown - 110 (CF)");
  const [customerName, setCustomerName] = useState("Elite Bizens Algeria");
  const [shadeNo, setShadeNo] = useState("110");
  const [denierFilament, setDenierFilament] = useState("110/48");
  const [cfOnlyCf, setCfOnlyCf] = useState("CF");
  const [sduNo, setSduNo] = useState("");
  const [productionToBeDoneKg, setProduction] = useState(2);
  const [batchVolume, setBatchVolume] = useState(200);
  const [mcNo, setMcNo] = useState("5");
  const [noOfPositions, setPositions] = useState(132);
  const [cellulose, setCellulose] = useState(8.8);
  const [pumpThrow, setPumpThrow] = useState(88);
  const [rateCcMin, setRateCcMin] = useState(77);
  const [productionPerDay, setProductionPerDay] = useState(1000);
  const [expectedQuality, setExpectedQuality] = useState(30);
  const [pigments, setPigments] = useState<Pigment[]>(DEFAULT_PIGMENTS);
  const [outputs, setOutputs] = useState<RecipeOutputs | null>(null);
  const [savedRecipe, setSavedRecipe] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [loadingExcel, setLoadingExcel] = useState(false);

  const updatePigment = (i: number, k: keyof Pigment, v: any) => {
    const next = [...pigments];
    (next[i] as any)[k] = k === "percent" ? Number(v) : v;
    setPigments(next);
  };

  const addPigment = () => setPigments([...pigments, { name: "", percent: 0 }]);
  const removePigment = (i: number) =>
    setPigments(pigments.filter((_, idx) => idx !== i));

  const calculate = () => {
    const out = calculateRecipe({
      shadeName,
      customerName,
      shadeNo,
      denierFilament,
      cfOnlyCf,
      sduNo,
      productionToBeDoneKg,
      batchVolume,
      mcNo,
      noOfPositions,
      cellulose,
      pumpThrow,
      rateCcMin,
      productionPerDay,
      expectedQuality,
      pigments: pigments.filter((p) => p.name.trim()),
    });
    setOutputs(out);
    setSavedRecipe(null);
    toast.success("Recipe calculated");
  };

  const buildRecord = (out: RecipeOutputs) => ({
    user_id: user!.id,
    shade_name: shadeName,
    customer_name: customerName,
    shade_no: shadeNo,
    denier_filament: denierFilament,
    cf_only_cf: cfOnlyCf,
    sdu_no: sduNo,
    production_to_be_done_kg: productionToBeDoneKg,
    batch_volume: batchVolume,
    mc_no: mcNo,
    no_of_positions: noOfPositions,
    cellulose,
    pump_throw: pumpThrow,
    pigments: pigments.filter((p) => p.name.trim()) as any,
    total_shade_loading: out.totalShadeLoading,
    rate_cc_min: out.rateCcMin,
    rate_lit_hr: out.rateLitHr,
    consumption_per_day: out.consumptionPerDay,
    days_required: out.daysRequired,
    total_consumption: out.totalConsumption,
    total_batches: out.totalBatches,
    pigment_conc_full: out.pigmentConcFull,
    pigment_conc_half: out.pigmentConcHalf,
    water_qty: out.waterQty,
    total_qty: out.totalQty,
    results: out as any,
  });

  const saveAndEmail = async () => {
    if (!outputs || !user) {
      toast.error("Calculate first");
      return;
    }
    setBusy(true);
    const record = buildRecord(outputs);
    const { data, error } = await supabase
      .from("recipes")
      .insert([record])
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      setBusy(false);
      return;
    }
    setSavedRecipe(data);
    toast.success("Recipe saved");

    const { data: emailRes, error: emailErr } = await supabase.functions.invoke(
      "send-recipe-email",
      { body: { recipe: data } },
    );
    if (emailErr) toast.error("Email failed: " + emailErr.message);
    else toast.success(emailRes?.message || `Result sent to ${user.email}`);
    setBusy(false);
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingExcel(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];

      // Helper to get cell value by address
      const cell = (addr: string) => {
        const c = ws[addr];
        return c ? c.v : undefined;
      };

      // --- Left block (A1:C27) ---
      // Row 1: A1 = Shade Name, B1 = Denier/Filament, C1 = SDU No
      // Row 2: A2 = Customer Name (in brackets), B2 = Production (Tons), C2 = Type of Mixer
      // Row 9: B9 = Pump Throw
      // Row 10: B10 = Rate cc/min
      // Row 15: B15 = Batch Volume

      const shadeName = cell("A1") ? String(cell("A1")).trim() : "";
      const denierFil = cell("B1") ? String(cell("B1")).trim() : "";
      const sduRaw = cell("C1") ? String(cell("C1")).trim() : ""; // "SDU No. 17"
      const sduNo = sduRaw.replace(/SDU\s*No\.?\s*/i, "").trim();

      const customerRaw = cell("A2") ? String(cell("A2")).trim() : ""; // "(Elite Bizens Algeria)"
      const customerName = customerRaw.replace(/^\(|\)$/g, "").trim();

      const productionRaw = cell("B2") ? String(cell("B2")).trim() : ""; // "2.0T"
      const production = parseFloat(productionRaw) || 0;

      const pumpThrowVal = cell("B9") ? Number(cell("B9")) : 0;
      const rateCcMinVal = cell("B10") ? Number(cell("B10")) : 0;
      const batchVol = cell("B15") ? Number(cell("B15")) : 0;

      // --- Right yellow block (E1:P2) ---
      // Row 2: E2=ShadeNo, F2=Denier/Fil, G2=CF, H2=Customer, I2=SDUNo,
      //        J2=Production, K2=ProductionToBeDoneKg, L2=BatchVolume,
      //        M2=McNo, N2=NoOfPositions, O2=Cellulose, P2=ProductionRunPeriod

      const shadeNo = cell("E2") ? String(cell("E2")).trim() : "";
      const cfOnlyCf = cell("G2") ? String(cell("G2")).trim() : "";
      const mcNo = cell("M2") ? String(cell("M2")).trim() : "";
      const noOfPos = cell("N2") ? Number(cell("N2")) : 0;
      const cellulosePct = cell("O2") ? Number(cell("O2")) : 0;

      // Pigments: Rows 4,5,6 — A=Name, B=Value(%)
      const pigmentRows: Pigment[] = [];
      for (let row = 4; row <= 6; row++) {
        const name = cell(`A${row}`);
        const pct = cell(`B${row}`);
        if (name && pct !== undefined) {
          pigmentRows.push({ name: String(name).trim(), percent: Number(pct) });
        }
      }

      // --- Apply to state ---
      if (shadeName) setShadeName(shadeName);
      if (customerName) setCustomerName(customerName);
      if (shadeNo) setShadeNo(shadeNo);
      if (denierFil) setDenierFilament(denierFil);
      if (cfOnlyCf) setCfOnlyCf(cfOnlyCf);
      if (sduNo) setSduNo(sduNo);
      if (production) setProduction(production);
      if (batchVol) setBatchVolume(batchVol);
      if (mcNo) setMcNo(mcNo);
      if (noOfPos) setPositions(noOfPos);
      if (cellulosePct) setCellulose(cellulosePct);
      if (pumpThrowVal) setPumpThrow(pumpThrowVal);
      if (rateCcMinVal) setRateCcMin(rateCcMinVal);
      if (pigmentRows.length > 0) setPigments(pigmentRows);

      toast.success("Excel data loaded into form fields");
    } catch (err: any) {
      toast.error("Failed to read Excel: " + err.message);
    } finally {
      setLoadingExcel(false);
      e.target.value = "";
    }
  };

  return (
    <AppShell>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: '#0D1B3E' }}>Recipe Calculator</h1>
          <p className="text-muted-foreground mt-1">
            Enter inputs, get pigment recipe &amp; production metrics
          </p>
        </div>
        <label>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            hidden
            onChange={handleExcelUpload}
            disabled={loadingExcel}
          />
          <Button
            asChild
            variant="outline"
            disabled={loadingExcel}
            style={{ borderColor: '#C8102E', color: '#C8102E', background: 'transparent' }}
            className="hover:bg-red-50 cursor-pointer"
          >
            <span>
              <Upload className="h-4 w-4 mr-2" />
              {loadingExcel ? "Reading..." : "Import Excel"}
            </span>
          </Button>
        </label>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-card">
          <CardHeader>
            <CardTitle style={{ color: '#0D1B3E' }}>Inputs</CardTitle>
            <CardDescription>Order &amp; machine details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Shade Name">
                <Input
                  value={shadeName}
                  onChange={(e) => setShadeName(e.target.value)}
                />
              </Field>
              <Field label="Customer Name">
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </Field>
              <Field label="Shade No">
                <Input
                  value={shadeNo}
                  onChange={(e) => setShadeNo(e.target.value)}
                />
              </Field>
              <Field label="Denier / Filament">
                <Input
                  value={denierFilament}
                  onChange={(e) => setDenierFilament(e.target.value)}
                />
              </Field>
              <Field label="CF / Only CF">
                <Input
                  value={cfOnlyCf}
                  onChange={(e) => setCfOnlyCf(e.target.value)}
                />
              </Field>
              <Field label="SDU No">
                <Input
                  value={sduNo}
                  onChange={(e) => setSduNo(e.target.value)}
                />
              </Field>
              <Field label="Production To Be Done (Tons)">
                <Input
                  type="number"
                  step="0.1"
                  value={productionToBeDoneKg}
                  onChange={(e) => setProduction(Number(e.target.value))}
                />
              </Field>
              <Field label="Batch Volume (L)">
                <Input
                  type="number"
                  value={batchVolume}
                  onChange={(e) => setBatchVolume(Number(e.target.value))}
                />
              </Field>
              <Field label="M/C No">
                <Input value={mcNo} onChange={(e) => setMcNo(e.target.value)} />
              </Field>
              <Field label="No of Positions">
                <Input
                  type="number"
                  value={noOfPositions}
                  onChange={(e) => setPositions(Number(e.target.value))}
                />
              </Field>
              <Field label="Cellulose %">
                <Input
                  type="number"
                  step="0.1"
                  value={cellulose}
                  onChange={(e) => setCellulose(Number(e.target.value))}
                />
              </Field>
              <Field label="Pump Throw (gms / 5 min)">
                <Input
                  type="number"
                  step="0.1"
                  value={pumpThrow}
                  onChange={(e) => setPumpThrow(Number(e.target.value))}
                />
              </Field>
              <Field label="Rate (cc/min)">
                <Input
                  type="number"
                  step="0.1"
                  value={rateCcMin}
                  onChange={(e) => setRateCcMin(Number(e.target.value))}
                />
              </Field>
              <Field label="Production / Day (kg)">
                <Input
                  type="number"
                  step="1"
                  value={productionPerDay}
                  onChange={(e) => setProductionPerDay(Number(e.target.value))}
                />
              </Field>
              <Field label="Expected Quality (%)">
                <Input
                  type="number"
                  step="1"
                  value={expectedQuality}
                  onChange={(e) => setExpectedQuality(Number(e.target.value))}
                />
              </Field>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label style={{ color: '#1A1A2E' }}>Pigments</Label>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={addPigment}
                  style={{ color: '#C8102E' }}
                  className="hover:bg-red-50"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
              <div className="space-y-2">
                {pigments.map((p, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      className="flex-1"
                      placeholder="Pigment name"
                      value={p.name}
                      onChange={(e) => updatePigment(i, "name", e.target.value)}
                    />
                    <Input
                      className="w-28"
                      type="number"
                      step="0.01"
                      placeholder="%"
                      value={p.percent}
                      onChange={(e) =>
                        updatePigment(i, "percent", e.target.value)
                      }
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removePigment(i)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Button
              size="lg"
              onClick={calculate}
              className="w-full"
              style={{ background: '#C8102E', color: '#FFFFFF' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#A00D24')}
              onMouseLeave={e => (e.currentTarget.style.background = '#C8102E')}
            >
              <Calculator className="h-4 w-4 mr-2" /> Calculate Recipe
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-card lg:sticky lg:top-6 self-start">
          <CardHeader>
            <CardTitle style={{ color: '#0D1B3E' }}>Outputs</CardTitle>
            <CardDescription>Calculated metrics</CardDescription>
          </CardHeader>
          <CardContent>
            {!outputs ? (
              <div className="text-sm text-muted-foreground py-12 text-center">
                Enter inputs and click Calculate
              </div>
            ) : (
              <>
                <div className="space-y-2 text-sm">
                  <Out
                    k="Total Shade Loading"
                    v={`${outputs.totalShadeLoading} %`}
                  />
                  <Out k="Rate (cc/min)" v={outputs.rateCcMin} />
                  <Out k="Rate (lit/hr)" v={outputs.rateLitHr} />
                  <Out
                    k="Consumption / Day"
                    v={`${outputs.consumptionPerDay} L`}
                  />
                  <Out k="Days Required" v={outputs.daysRequired} />
                  <Out
                    k="Total Consumption"
                    v={`${outputs.totalConsumption} L`}
                  />
                  <Out k="Total Batches" v={outputs.totalBatches} />
                  <Out
                    k="Pigment Conc. Full M/C"
                    v={`${outputs.pigmentConcFull} g/L`}
                  />
                  <Out
                    k="Pigment Conc. Half M/C"
                    v={`${outputs.pigmentConcHalf} g/L`}
                  />
                  <Out k="Water Qty / Batch" v={`${outputs.waterQty} kg`} />
                  <Out k="Total Qty / Batch" v={`${outputs.totalQty} kg`} />
                </div>
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid #E5E7EB' }}>
                  <Label
                    className="text-xs uppercase font-semibold"
                    style={{ color: '#B8860B', letterSpacing: '0.05em' }}
                  >
                    Pigment Qty / Batch
                  </Label>
                  {outputs.pigmentQuantities.map((p, i) => (
                    <div key={i} className="flex justify-between text-sm mt-1">
                      <span style={{ color: '#6B7280' }}>{p.name}</span>
                      <span className="font-mono font-semibold" style={{ color: '#0D1B3E' }}>{p.qty} kg</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid #E5E7EB' }}>
                  <Label
                    className="text-xs uppercase font-semibold"
                    style={{ color: '#B8860B', letterSpacing: '0.05em' }}
                  >
                    Pigment Consumption (full run)
                  </Label>
                  {outputs.pigmentTotalKg.map((p, i) => (
                    <div key={i} className="flex justify-between text-sm mt-1">
                      <span style={{ color: '#6B7280' }}>{p.name}</span>
                      <span className="font-mono font-semibold" style={{ color: '#0D1B3E' }}>{p.qty} kg</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 space-y-2">
                  <Button
                    onClick={saveAndEmail}
                    disabled={busy}
                    className="w-full"
                    style={{ background: '#C8102E', color: '#FFFFFF' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#A00D24')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#C8102E')}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {busy ? "Saving..." : "Save & Email Result"}
                  </Button>
                  {savedRecipe && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => downloadRecipePDF(savedRecipe)}
                        className="w-full"
                      >
                        <Download className="h-4 w-4 mr-2" /> Download PDF
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => downloadRecipeExcel(savedRecipe)}
                        className="w-full"
                      >
                        <FileSpreadsheet className="h-4 w-4 mr-2" /> Download
                        Excel
                      </Button>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 pt-1">
                        <Mail className="h-3 w-3" /> Sent to {user?.email}
                      </p>
                    </>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-xs" style={{ color: '#1A1A2E' }}>{label}</Label>
      {children}
    </div>
  );
}
function Out({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex justify-between py-1" style={{ borderBottom: '1px solid #E5E7EB' }}>
      <span style={{ color: '#6B7280' }}>{k}</span>
      <span className="font-mono font-semibold" style={{ color: '#0D1B3E' }}>{v}</span>
    </div>
  );
}
