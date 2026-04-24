import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppShell from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Database, Calculator, TrendingUp, FlaskConical } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from "recharts";
import { format } from "date-fns";

const COLORS = ["#0f1b3d", "#1e3a5f", "#3b6fa0", "#6b9bc7", "#a8c5e0"];

export default function Dashboard() {
  const [quality, setQuality] = useState<any[]>([]);
  const [recipeCount, setRecipeCount] = useState(0);
  const [partyFilter, setPartyFilter] = useState<string>("all");
  const [machineFilter, setMachineFilter] = useState<string>("all");

  useEffect(() => {
    (async () => {
      const { data: q } = await supabase.from("quality_records").select("*").order("record_date", { ascending: true });
      const { count } = await supabase.from("recipes").select("*", { count: "exact", head: true });
      setQuality(q || []);
      setRecipeCount(count || 0);
    })();
  }, []);

  const parties = Array.from(new Set(quality.map((q) => q.party_name).filter(Boolean)));
  const machines = Array.from(new Set(quality.map((q) => q.mc_no).filter(Boolean)));

  const filtered = quality.filter((q) =>
    (partyFilter === "all" || q.party_name === partyFilter) &&
    (machineFilter === "all" || q.mc_no === machineFilter)
  );

  const bfTrend = filtered.map((q) => ({
    date: q.record_date ? format(new Date(q.record_date), "MMM d") : `${q.day}/${q.month}`,
    BF: Number(q.bf) || 0,
    Variation: Number(q.shade_variation) || 0,
  }));

  const byMachine = machines.map((m) => {
    const recs = filtered.filter((q) => q.mc_no === m);
    return {
      machine: m,
      avgVariation: recs.length ? recs.reduce((s, r) => s + (Number(r.shade_variation) || 0), 0) / recs.length : 0,
    };
  });

  const byParty = parties.slice(0, 8).map((p) => ({
    party: p,
    count: filtered.filter((q) => q.party_name === p).length,
  }));

  const byQuality = ["A", "B", "C", "D"].map((g) => ({
    name: `Grade ${g}`,
    value: filtered.filter((q) => (q.quality || "").toUpperCase().startsWith(g)).length,
  })).filter((x) => x.value > 0);

  const avgBF = filtered.length ? (filtered.reduce((s, r) => s + (Number(r.bf) || 0), 0) / filtered.length).toFixed(2) : "0";

  return (
    <AppShell>
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Plant operations overview</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Database} label="Quality Records" value={quality.length} />
        <StatCard icon={Calculator} label="Saved Recipes" value={recipeCount} />
        <StatCard icon={TrendingUp} label="Avg BF" value={avgBF} />
        <StatCard icon={FlaskConical} label="Active Machines" value={machines.length} />
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Select value={partyFilter} onValueChange={setPartyFilter}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Party" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Parties</SelectItem>
              {parties.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={machineFilter} onValueChange={setMachineFilter}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Machine" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Machines</SelectItem>
              {machines.map((m) => <SelectItem key={m} value={m}>M/C {m}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-card">
          <CardHeader><CardTitle>BF & Shade Variation Trend</CardTitle></CardHeader>
          <CardContent>
            {bfTrend.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={bfTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Legend />
                  <Line type="monotone" dataKey="BF" stroke="#0f1b3d" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Variation" stroke="#3b6fa0" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader><CardTitle>Avg Shade Variation by Machine</CardTitle></CardHeader>
          <CardContent>
            {byMachine.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={byMachine}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="machine" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="avgVariation" fill="#3b6fa0" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader><CardTitle>Production Volume by Party</CardTitle></CardHeader>
          <CardContent>
            {byParty.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={byParty} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis dataKey="party" type="category" stroke="hsl(var(--muted-foreground))" fontSize={11} width={120} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="count" fill="#0f1b3d" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader><CardTitle>Quality Grade Distribution</CardTitle></CardHeader>
          <CardContent>
            {byQuality.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={byQuality} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {byQuality.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function StatCard({ icon: Icon, label, value }: any) {
  return (
    <Card className="shadow-card gradient-card">
      <CardContent className="p-5 flex items-center gap-4">
        <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
          <div className="text-2xl font-semibold text-foreground">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Empty() {
  return <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">No data yet — add quality records to see charts</div>;
}
