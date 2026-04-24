import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { calculateRecipe, type Pigment, type RecipeOutputs } from "@/lib/recipe";
import { downloadRecipePDF, downloadRecipeExcel } from "@/lib/exporters";
import { toast } from "sonner";
import { Plus, Trash2, Calculator, FileSpreadsheet, Download, Mail, Save } from "lucide-react";

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
  const [productionToBeDoneKg, setProduction] = useState(1000);
  const [batchVolume, setBatchVolume] = useState(200);
  const [mcNo, setMcNo] = useState("");
  const [noOfPositions, setPositions] = useState(64);
  const [cellulose, setCellulose] = useState(8);
  const [pumpThrow, setPumpThrow] = useState(2.5);
  const [pigments, setPigments] = useState<Pigment[]>(DEFAULT_PIGMENTS);
  const [outputs, setOutputs] = useState<RecipeOutputs | null>(null);
  const [savedRecipe, setSavedRecipe] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const updatePigment = (i: number, k: keyof Pigment, v: any) => {
    const next = [...pigments]; (next[i] as any)[k] = k === "percent" ? Number(v) : v;
    setPigments(next);
  };

  const addPigment = () => setPigments([...pigments, { name: "", percent: 0 }]);
  const removePigment = (i: number) => setPigments(pigments.filter((_, idx) => idx !== i));

  const calculate = () => {
    const out = calculateRecipe({
      shadeName, customerName, shadeNo, denierFilament, cfOnlyCf, sduNo,
      productionToBeDoneKg, batchVolume, mcNo, noOfPositions, cellulose, pumpThrow,
      pigments: pigments.filter((p) => p.name.trim()),
    });
    setOutputs(out);
    setSavedRecipe(null);
    toast.success("Recipe calculated");
  };

  const buildRecord = (out: RecipeOutputs) => ({
    user_id: user!.id,
    shade_name: shadeName, customer_name: customerName, shade_no: shadeNo,
    denier_filament: denierFilament, cf_only_cf: cfOnlyCf, sdu_no: sduNo,
    production_to_be_done_kg: productionToBeDoneKg, batch_volume: batchVolume,
    mc_no: mcNo, no_of_positions: noOfPositions, cellulose, pump_throw: pumpThrow,
    pigments: pigments.filter((p) => p.name.trim()) as any,
    total_shade_loading: out.totalShadeLoading,
    rate_cc_min: out.rateCcMin, rate_lit_hr: out.rateLitHr,
    consumption_per_day: out.consumptionPerDay, days_required: out.daysRequired,
    total_consumption: out.totalConsumption, total_batches: out.totalBatches,
    pigment_conc_full: out.pigmentConcFull, pigment_conc_half: out.pigmentConcHalf,
    water_qty: out.waterQty, total_qty: out.totalQty,
    results: out as any,
  });

  const saveAndEmail = async () => {
    if (!outputs || !user) { toast.error("Calculate first"); return; }
    setBusy(true);
    const record = buildRecord(outputs);
    const { data, error } = await supabase.from("recipes").insert([record]).select().single();
    if (error) { toast.error(error.message); setBusy(false); return; }
    setSavedRecipe(data);
    toast.success("Recipe saved");

    const { data: emailRes, error: emailErr } = await supabase.functions.invoke("send-recipe-email", { body: { recipe: data } });
    if (emailErr) toast.error("Email failed: " + emailErr.message);
    else toast.success(emailRes?.message || `Result sent to ${user.email}`);
    setBusy(false);
  };

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Recipe Calculator</h1>
        <p className="text-muted-foreground mt-1">Enter inputs, get pigment recipe & production metrics</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-card">
          <CardHeader><CardTitle>Inputs</CardTitle><CardDescription>Order & machine details</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Shade Name"><Input value={shadeName} onChange={(e) => setShadeName(e.target.value)} /></Field>
              <Field label="Customer Name"><Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></Field>
              <Field label="Shade No"><Input value={shadeNo} onChange={(e) => setShadeNo(e.target.value)} /></Field>
              <Field label="Denier / Filament"><Input value={denierFilament} onChange={(e) => setDenierFilament(e.target.value)} /></Field>
              <Field label="CF / Only CF"><Input value={cfOnlyCf} onChange={(e) => setCfOnlyCf(e.target.value)} /></Field>
              <Field label="SDU No"><Input value={sduNo} onChange={(e) => setSduNo(e.target.value)} /></Field>
              <Field label="Production To Be Done (Kg)"><Input type="number" value={productionToBeDoneKg} onChange={(e) => setProduction(Number(e.target.value))} /></Field>
              <Field label="Batch Volume (L)"><Input type="number" value={batchVolume} onChange={(e) => setBatchVolume(Number(e.target.value))} /></Field>
              <Field label="M/C No"><Input value={mcNo} onChange={(e) => setMcNo(e.target.value)} /></Field>
              <Field label="No of Positions"><Input type="number" value={noOfPositions} onChange={(e) => setPositions(Number(e.target.value))} /></Field>
              <Field label="Cellulose %"><Input type="number" step="0.1" value={cellulose} onChange={(e) => setCellulose(Number(e.target.value))} /></Field>
              <Field label="Pump Throw (cc/stroke)"><Input type="number" step="0.1" value={pumpThrow} onChange={(e) => setPumpThrow(Number(e.target.value))} /></Field>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Pigments</Label>
                <Button size="sm" variant="outline" onClick={addPigment}><Plus className="h-3 w-3 mr-1" />Add</Button>
              </div>
              <div className="space-y-2">
                {pigments.map((p, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input className="flex-1" placeholder="Pigment name" value={p.name} onChange={(e) => updatePigment(i, "name", e.target.value)} />
                    <Input className="w-28" type="number" step="0.01" placeholder="%" value={p.percent} onChange={(e) => updatePigment(i, "percent", e.target.value)} />
                    <span className="text-sm text-muted-foreground">%</span>
                    <Button size="icon" variant="ghost" onClick={() => removePigment(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>
            </div>

            <Button size="lg" onClick={calculate} className="w-full">
              <Calculator className="h-4 w-4 mr-2" /> Calculate Recipe
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-card lg:sticky lg:top-6 self-start">
          <CardHeader><CardTitle>Outputs</CardTitle><CardDescription>Calculated metrics</CardDescription></CardHeader>
          <CardContent>
            {!outputs ? (
              <div className="text-sm text-muted-foreground py-12 text-center">Enter inputs and click Calculate</div>
            ) : (
              <>
                <div className="space-y-2 text-sm">
                  <Out k="Total Shade Loading" v={`${outputs.totalShadeLoading} %`} />
                  <Out k="Rate (cc/min)" v={outputs.rateCcMin} />
                  <Out k="Rate (lit/hr)" v={outputs.rateLitHr} />
                  <Out k="Consumption / Day" v={`${outputs.consumptionPerDay} L`} />
                  <Out k="Days Required" v={outputs.daysRequired} />
                  <Out k="Total Consumption" v={`${outputs.totalConsumption} L`} />
                  <Out k="Total Batches" v={outputs.totalBatches} />
                  <Out k="Pigment Conc. Full M/C" v={`${outputs.pigmentConcFull} g/L`} />
                  <Out k="Pigment Conc. Half M/C" v={`${outputs.pigmentConcHalf} g/L`} />
                  <Out k="Water Qty / Batch" v={`${outputs.waterQty} ml`} />
                  <Out k="Total Qty / Batch" v={`${outputs.totalQty} ml`} />
                </div>
                <div className="mt-4 pt-4 border-t">
                  <Label className="text-xs uppercase text-muted-foreground">Pigment Quantities (per batch)</Label>
                  {outputs.pigmentQuantities.map((p, i) => (
                    <div key={i} className="flex justify-between text-sm mt-1">
                      <span>{p.name}</span><span className="font-mono">{p.qty} g</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 space-y-2">
                  <Button onClick={saveAndEmail} disabled={busy} className="w-full">
                    <Save className="h-4 w-4 mr-2" />{busy ? "Saving..." : "Save & Email Result"}
                  </Button>
                  {savedRecipe && (
                    <>
                      <Button variant="outline" onClick={() => downloadRecipePDF(savedRecipe)} className="w-full">
                        <Download className="h-4 w-4 mr-2" /> Download PDF
                      </Button>
                      <Button variant="outline" onClick={() => downloadRecipeExcel(savedRecipe)} className="w-full">
                        <FileSpreadsheet className="h-4 w-4 mr-2" /> Download Excel
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="text-xs">{label}</Label>{children}</div>;
}
function Out({ k, v }: { k: string; v: any }) {
  return <div className="flex justify-between py-1 border-b border-border/50"><span className="text-muted-foreground">{k}</span><span className="font-mono font-medium">{v}</span></div>;
}
