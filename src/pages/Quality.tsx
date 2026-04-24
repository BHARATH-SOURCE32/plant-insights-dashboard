import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, Plus, Download, FileSpreadsheet, Trash2, Search } from "lucide-react";
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
  const [shadeFilter, setShadeFilter] = useState("all");
  const [partyFilter, setPartyFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [machineFilter, setMachineFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<any>({});

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
      const records = json.map((r) => {
        const rec: any = { user_id: user.id };
        Object.entries(r).forEach(([k, v]) => {
          const key = FIELD_MAP[k.trim().replace(/\s+/g, " ")];
          if (key) rec[key] = v;
        });
        if (rec.day && rec.month && rec.year) {
          const d = new Date(Number(rec.year), Number(rec.month) - 1, Number(rec.day));
          if (!isNaN(d.getTime())) rec.record_date = d.toISOString().slice(0, 10);
        }
        return rec;
      }).filter((r) => r.shade_no || r.party_name);

      if (records.length === 0) { toast.error("No valid rows found. Check column names."); return; }
      const { error } = await supabase.from("quality_records").insert(records);
      if (error) { toast.error(error.message); return; }
      toast.success(`Imported ${records.length} records`);
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

  const shades = Array.from(new Set(rows.map((r) => r.shade_no).filter(Boolean)));
  const parties = Array.from(new Set(rows.map((r) => r.party_name).filter(Boolean)));
  const months = Array.from(new Set(rows.map((r) => r.month).filter(Boolean))).sort();
  const machines = Array.from(new Set(rows.map((r) => r.mc_no).filter(Boolean)));

  const filtered = rows.filter((r) => {
    if (shadeFilter !== "all" && r.shade_no !== shadeFilter) return false;
    if (partyFilter !== "all" && r.party_name !== partyFilter) return false;
    if (monthFilter !== "all" && String(r.month) !== monthFilter) return false;
    if (machineFilter !== "all" && r.mc_no !== machineFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(s))) return false;
    }
    return true;
  });

  return (
    <AppShell>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Quality Data</h1>
          <p className="text-muted-foreground mt-1">{filtered.length} of {rows.length} records</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label>
            <input type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleUpload} disabled={loading} />
            <Button asChild variant="outline" disabled={loading}>
              <span><Upload className="h-4 w-4 mr-2" />{loading ? "Importing..." : "Import Excel"}</span>
            </Button>
          </label>
          <Button variant="outline" onClick={() => downloadQualityExcel(filtered)} disabled={!filtered.length}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
          </Button>
          <Button variant="outline" onClick={() => downloadQualityPDF(filtered)} disabled={!filtered.length}>
            <Download className="h-4 w-4 mr-2" /> PDF
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Add Entry</Button></DialogTrigger>
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
                    <Label className="text-xs">{lbl}</Label>
                    <Input type={type || "text"} value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: type === "number" ? Number(e.target.value) : e.target.value })} />
                  </div>
                ))}
              </div>
              <Button onClick={handleManualAdd}>Save Record</Button>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <Card className="mb-4">
        <CardHeader className="pb-3"><CardTitle className="text-base">Search & Filter</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search any field..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={shadeFilter} onValueChange={setShadeFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Shade No" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Shades</SelectItem>{shades.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={partyFilter} onValueChange={setPartyFilter}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Party" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Parties</SelectItem>{parties.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Month" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Months</SelectItem>{months.map((m) => <SelectItem key={String(m)} value={String(m)}>Month {m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={machineFilter} onValueChange={setMachineFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Machine" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Machines</SelectItem>{machines.map((m) => <SelectItem key={m} value={m}>M/C {m}</SelectItem>)}</SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[65vh]">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>Date</TableHead><TableHead>Shade</TableHead><TableHead>Colour</TableHead>
                  <TableHead>Party</TableHead><TableHead>Denier</TableHead><TableHead>M/C</TableHead>
                  <TableHead>Shade %</TableHead><TableHead>BF</TableHead><TableHead>Var.</TableHead>
                  <TableHead>Quality</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                    No records. Import an Excel file or add an entry above.
                  </TableCell></TableRow>
                ) : filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{r.record_date || `${r.day}/${r.month}/${r.year}`}</TableCell>
                    <TableCell className="font-medium">{r.shade_no}</TableCell>
                    <TableCell>{r.colour}</TableCell>
                    <TableCell className="text-xs">{r.party_name}</TableCell>
                    <TableCell>{r.denier}</TableCell>
                    <TableCell>{r.mc_no}</TableCell>
                    <TableCell>{r.total_shade_pct}</TableCell>
                    <TableCell>{r.bf}</TableCell>
                    <TableCell>{r.shade_variation}</TableCell>
                    <TableCell>{r.quality}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
