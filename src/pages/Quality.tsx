import { useEffect, useState, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Download, FileSpreadsheet, Trash2, Search, SlidersHorizontal, X, Loader2, Upload } from "lucide-react";
import { downloadQualityExcel, downloadQualityPDF } from "@/lib/exporters";
import { useAuth } from "@/hooks/useAuth";

const FIELD_MAP: Record<string, string> = {
  "Day": "day", "Month": "month", "Year": "year",
  "Shade No": "shade_no", "Colour": "colour", "Color": "colour",
  "Party Name": "party_name", "Denier": "denier",
  "S.D. Unit No": "sd_unit_no", "SD Unit No": "sd_unit_no",
  "M/C No": "mc_no", "MC No": "mc_no",
  "Total shade %": "total_shade_pct", "Total Shade %": "total_shade_pct",
  "P.T.": "pt", "PT": "pt",
  "Rate litres/min": "rate_litres_min", "Rate Litres/min": "rate_litres_min",
  "Dispergent Used.": "dispergent_used", "Dispergent Used": "dispergent_used",
  "Type Of Mixer": "type_of_mixer", "Type of Mixer": "type_of_mixer",
  "Quality": "quality", "BF": "bf",
  "Shade Varaition": "shade_variation", "Shade Variation": "shade_variation",
};

export default function Quality() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [shadeFilter, setShadeFilter] = useState("");
  const [partyFilter, setPartyFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [machineFilter, setMachineFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase.from("quality_records").select("*").order("created_at", { ascending: false });
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(ws);
      
      const parsedRecords = json.map((r) => {
        const rec: any = { user_id: user.id };
        Object.entries(r).forEach(([k, v]) => {
          const rawKey = k.trim().replace(/\s+/g, " ");
          let key = FIELD_MAP[rawKey];
          if (!key && rawKey.toLowerCase() === "id") key = "id";
          if (!key && rawKey.toLowerCase() === "record date") key = "record_date";
          if (key) rec[key] = v;
        });
        if (rec.day && rec.month && rec.year) {
          const d = new Date(Number(rec.year), Number(rec.month) - 1, Number(rec.day));
          if (!isNaN(d.getTime())) rec.record_date = d.toISOString().slice(0, 10);
        }
        return rec;
      }).filter((r) => r.shade_no || r.party_name);

      if (parsedRecords.length === 0) { 
        toast.error("No valid rows found. Check column names."); 
        return; 
      }

      // Fetch existing records for duplicate matching
      const { data: existing } = await supabase.from("quality_records").select("id, record_date, mc_no, shade_no, party_name");
      const existingList = existing || [];

      const toUpdate: any[] = [];
      const toInsert: any[] = [];

      parsedRecords.forEach((rec) => {
        let match = null;
        if (rec.id) {
          match = existingList.find((e: any) => e.id === rec.id);
        }
        if (!match && rec.record_date && rec.mc_no && rec.shade_no) {
          match = existingList.find((e: any) => 
            e.record_date === rec.record_date && 
            String(e.mc_no) === String(rec.mc_no) && 
            String(e.shade_no) === String(rec.shade_no) &&
            String(e.party_name || "") === String(rec.party_name || "")
          );
        }
        
        if (match) {
          toUpdate.push({ ...rec, id: match.id });
        } else {
          const newRec = { ...rec };
          delete newRec.id; // Ensure we don't insert invalid IDs
          toInsert.push(newRec);
        }
      });

      if (toInsert.length > 0) {
        const { error } = await supabase.from("quality_records").insert(toInsert);
        if (error) { toast.error("Insert error: " + error.message); return; }
      }
      
      if (toUpdate.length > 0) {
        const { error } = await supabase.from("quality_records").upsert(toUpdate);
        if (error) { toast.error("Update error: " + error.message); return; }
      }

      toast.success(`Synced: ${toInsert.length} added, ${toUpdate.length} updated`);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  const handleManualAdd = async () => {
    if (!user) return;
    const rec: any = { user_id: user.id, ...form };
    if (rec.day && rec.month && rec.year) {
      const d = new Date(Number(rec.year), Number(rec.month) - 1, Number(rec.day));
      rec.record_date = d.toISOString().slice(0, 10);
    }
    const { error } = await supabase.from("quality_records").insert([rec]);
    if (error) { toast.error(error.message); return; }
    toast.success("Record added");
    setForm({}); setDialogOpen(false); load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("quality_records").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    load();
  };

  const shades = useMemo(() => Array.from(new Set(rows.map((r) => String(r.shade_no || "")))).filter(Boolean).sort(), [rows]);
  const parties = useMemo(() => Array.from(new Set(rows.map((r) => String(r.party_name || "")))).filter(Boolean).sort(), [rows]);
  const months = useMemo(() => Array.from(new Set(rows.map((r) => String(r.month || "")))).filter(Boolean).sort(), [rows]);
  const machines = useMemo(() => Array.from(new Set(rows.map((r) => String(r.mc_no || "")))).filter(Boolean).sort(), [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (shadeFilter && String(r.shade_no) !== shadeFilter) return false;
    if (partyFilter && String(r.party_name) !== partyFilter) return false;
    if (monthFilter && String(r.month) !== monthFilter) return false;
    if (machineFilter && String(r.mc_no) !== machineFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(s))) return false;
    }
    return true;
  }), [rows, shadeFilter, partyFilter, monthFilter, machineFilter, search]);

  const resetFilters = () => {
    setSearch("");
    setShadeFilter("");
    setPartyFilter("");
    setMonthFilter("");
    setMachineFilter("");
  };

  return (
    <AppShell>
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Quality Data
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Browse, filter & log production records
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleUpload} disabled={loading} />
          <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={loading} className="h-9 border-primary/20 text-primary hover:bg-primary/5 hover:text-primary">
            {loading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
            {loading ? "Importing..." : "Import Excel"}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9 hover:bg-primary/90">
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Entry
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Add Quality Record</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  ["day", "Day", "number"], ["month", "Month", "number"], ["year", "Year", "number"],
                  ["shade_no", "Shade No"], ["colour", "Colour"], ["party_name", "Party Name"],
                  ["denier", "Denier"], ["sd_unit_no", "SD Unit No"], ["mc_no", "M/C No"],
                  ["total_shade_pct", "Total Shade %", "number"], ["pt", "P.T.", "number"], ["rate_litres_min", "Rate L/min", "number"],
                  ["dispergent_used", "Dispergent"], ["type_of_mixer", "Type of Mixer"], ["quality", "Quality"],
                  ["bf", "BF", "number"], ["shade_variation", "Shade Variation", "number"],
                ].map(([k, lbl, type]) => (
                  <div key={k}>
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{lbl}</Label>
                    <Input 
                      type={type || "text"} 
                      value={form[k] ?? ""} 
                      onChange={(e) => setForm({ ...form, [k]: type === "number" ? Number(e.target.value) : e.target.value })} 
                      className="mt-1 h-9 bg-background"
                    />
                  </div>
                ))}
              </div>
              <Button onClick={handleManualAdd} className="w-full mt-4 hover:bg-primary/90">Save Record</Button>
            </DialogContent>
          </Dialog>
          <Button size="sm" variant="outline" onClick={() => downloadQualityExcel(filtered)} disabled={!filtered.length} className="h-9">
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" /> Excel
          </Button>
          <Button size="sm" variant="outline" onClick={() => downloadQualityPDF(filtered)} disabled={!filtered.length} className="h-9">
            <Upload className="h-3.5 w-3.5 mr-1.5" /> PDF
          </Button>
        </div>
      </header>

      <div>
        {/* FiltersBar style inline filter */}
        <Card className="mb-6 shadow-sm">
          <CardContent className="p-3 md:p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 pr-3 border-r border-border">
                <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                  <SlidersHorizontal className="h-4 w-4" />
                </div>
                <div className="leading-tight">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-foreground">Filters</div>
                  <div className="text-[10px] text-muted-foreground">
                    {filtered.length} / {rows.length}
                  </div>
                </div>
              </div>

              <div className="relative min-w-[200px] flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input className="pl-8 h-9 bg-background text-sm" placeholder="Search any field..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>

              <FilterSelect label="Shade" value={shadeFilter} onChange={setShadeFilter} options={shades} />
              <FilterSelect label="Machine" value={machineFilter} onChange={setMachineFilter} options={machines} />
              <FilterSelect label="Month" value={monthFilter} onChange={setMonthFilter} options={months} />
              <FilterSelect label="Party" value={partyFilter} onChange={setPartyFilter} options={parties} />

              <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 text-xs ml-auto text-primary hover:text-primary hover:bg-primary/10">
                <X className="h-3 w-3 mr-1" /> Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold tracking-tight">Records</h3>
              <p className="text-[11px] text-muted-foreground num mt-0.5">{filtered.length} match filters</p>
            </div>
          </div>
          <div className="overflow-auto max-h-[calc(100vh-260px)]">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 sticky top-0 backdrop-blur z-10">
                <tr className="text-left border-b border-border">
                  {["Date","Shade","Colour","Party","Denier","M/C","Shade %","BF","Var.","Quality",""].map((h) => (
                    <th key={h} className="px-3 py-2.5 font-medium uppercase tracking-wider text-[10px] text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="num">
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border hover:bg-secondary/40 transition-colors group">
                    <td className="px-3 py-2.5 whitespace-nowrap">{r.record_date || `${r.day}/${r.month}/${r.year}`}</td>
                    <td className="px-3 py-2.5 font-medium text-primary">{r.shade_no}</td>
                    <td className="px-3 py-2.5 font-sans truncate max-w-[120px]" title={r.colour}>{r.colour}</td>
                    <td className="px-3 py-2.5 font-sans truncate max-w-[120px]" title={r.party_name}>{r.party_name}</td>
                    <td className="px-3 py-2.5">{r.denier}</td>
                    <td className="px-3 py-2.5">{r.mc_no}</td>
                    <td className="px-3 py-2.5">{r.total_shade_pct}</td>
                    <td className="px-3 py-2.5">{r.bf}</td>
                    <td className="px-3 py-2.5">{r.shade_variation}</td>
                    <td className="px-3 py-2.5">{r.quality}</td>
                    <td className="px-3 py-2.5 w-10">
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)} className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={11} className="px-3 py-12 text-center text-muted-foreground">No records match current filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ─── Filter select helper ─────────────────────────────────────────────────────
function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 min-w-[110px] rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
