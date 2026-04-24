import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppShell from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Database,
  Calculator,
  TrendingUp,
  FlaskConical,
  SlidersHorizontal,
  X,
  Search,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  ZAxis,
  ComposedChart,
  Legend,
} from "recharts";
import { format } from "date-fns";

// ─── Tooltip / grid shared styles ────────────────────────────────────────────
const tooltipStyle = {
  backgroundColor: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  fontSize: 12,
};
const GRID = "#e5e7eb";
const tickStyle = { fontSize: 11, fill: "#6b7280" };

// ─── Stat card (top row) ──────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-5">
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
          {label}
        </div>
        <div className="flex items-end gap-3 mt-1">
          <span className="text-3xl font-semibold tracking-tight text-foreground">
            {value}
          </span>
        </div>
        <div
          className="mt-3 h-0.5 w-8 rounded-full"
          style={{ backgroundColor: accent }}
        />
      </CardContent>
    </Card>
  );
}

// ─── Chart wrapper ────────────────────────────────────────────────────────────
function ChartCard({
  title,
  subtitle,
  children,
  height = 280,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  height?: number;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        )}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          {children as React.ReactElement}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function Empty() {
  return (
    <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
      No data yet — add quality records to see charts
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [quality, setQuality] = useState<any[]>([]);
  const [recipeCount, setRecipeCount] = useState(0);

  // Filter state
  const [search, setSearch] = useState("");
  const [shadeFilter, setShadeFilter] = useState<string>("");
  const [machineFilter, setMachineFilter] = useState<string>("");
  const [denierFilter, setDenierFilter] = useState<string>("");
  const [partyFilter, setPartyFilter] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data: q } = await supabase
        .from("quality_records")
        .select("*")
        .order("record_date", { ascending: true });
      const { count } = await supabase
        .from("recipes")
        .select("*", { count: "exact", head: true });
      setQuality(q || []);
      setRecipeCount(count || 0);
    })();
  }, []);

  // Unique option lists
  const shades = useMemo(
    () =>
      Array.from(
        new Set(quality.map((q) => q.shade_no).filter(Boolean)),
      ).sort(),
    [quality],
  );
  const machines = useMemo(
    () =>
      Array.from(new Set(quality.map((q) => q.mc_no).filter(Boolean))).sort(),
    [quality],
  );
  const deniers = useMemo(
    () =>
      Array.from(new Set(quality.map((q) => q.denier).filter(Boolean))).sort(),
    [quality],
  );
  const parties = useMemo(
    () =>
      Array.from(
        new Set(quality.map((q) => q.party_name).filter(Boolean)),
      ).sort(),
    [quality],
  );

  // Filtered data
  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return quality.filter((q) => {
      if (shadeFilter && q.shade_no !== shadeFilter) return false;
      if (machineFilter && q.mc_no !== machineFilter) return false;
      if (denierFilter && q.denier !== denierFilter) return false;
      if (partyFilter && q.party_name !== partyFilter) return false;
      if (s) {
        const haystack = [q.shade_no, q.mc_no, q.party_name, q.denier]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(s)) return false;
      }
      return true;
    });
  }, [quality, search, shadeFilter, machineFilter, denierFilter, partyFilter]);

  const resetFilters = () => {
    setSearch("");
    setShadeFilter("");
    setMachineFilter("");
    setDenierFilter("");
    setPartyFilter("");
  };

  // ── Derived chart data ──────────────────────────────────────────────────────

  // 1. BF & Shade Variation Trend (line)
  const bfTrend = useMemo(
    () =>
      filtered.map((q) => ({
        date: q.record_date
          ? format(new Date(q.record_date), "MMM d")
          : `${q.day}/${q.month}`,
        BF: Number(q.bf) || 0,
        Variation: Number(q.shade_variation) || 0,
      })),
    [filtered],
  );

  // 2. Shade-wise distribution (bar) — avg shade_variation per shade_no
  const shadeDist = useMemo(() => {
    const m = new Map<string, { sum: number; n: number }>();
    filtered.forEach((r) => {
      const shade = r.shade_no ?? "?";
      const e = m.get(shade) ?? { sum: 0, n: 0 };
      e.sum += Number(r.shade_variation) || 0;
      e.n += 1;
      m.set(shade, e);
    });
    return Array.from(m.entries())
      .map(([shade, v]) => ({ shade, total: +(v.sum / v.n).toFixed(3) }))
      .sort((a, b) => String(a.shade).localeCompare(String(b.shade)))
      .slice(0, 20);
  }, [filtered]);

  // 3. Pump Rate vs BF (scatter)
  // const pumpVsBf = useMemo(
  //   () =>
  //     filtered.map((r) => ({
  //       pt: Number(r.rate_lpm) || 0,
  //       bf: Number(r.bf) || 0,
  //     })),
  //   [filtered],
  // );

  // 4. Production Trend — avg shade_variation per date (line)
  const productionTrend = useMemo(() => {
    const m = new Map<string, { sum: number; n: number }>();
    filtered.forEach((r) => {
      const key = r.record_date
        ? format(new Date(r.record_date), "MM-dd")
        : `${r.month}-${r.day}`;
      const e = m.get(key) ?? { sum: 0, n: 0 };
      e.sum += Number(r.shade_variation) || 0;
      e.n += 1;
      m.set(key, e);
    });
    return Array.from(m.entries())
      .map(([date, v]) => ({ date, total: +(v.sum / v.n).toFixed(2) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filtered]);

  // 5. Quality Analysis — avg BF per shade_no (bar)
  const qualityByShade = useMemo(() => {
    const m = new Map<string, { sum: number; n: number }>();
    filtered.forEach((r) => {
      const shade = r.shade_no ?? "?";
      const e = m.get(shade) ?? { sum: 0, n: 0 };
      e.sum += Number(r.bf) || 0;
      e.n += 1;
      m.set(shade, e);
    });
    return Array.from(m.entries())
      .map(([shade, v]) => ({ shade, bf: +(v.sum / v.n).toFixed(2) }))
      .sort((a, b) => String(a.shade).localeCompare(String(b.shade)))
      .slice(0, 20);
  }, [filtered]);

  // 6. Machine Performance — avg shade variation + avg BF per machine (composed)
  const machinePerf = useMemo(() => {
    const m = new Map<string, { sumS: number; sumB: number; n: number }>();
    filtered.forEach((r) => {
      const mc = r.mc_no ?? "?";
      const e = m.get(mc) ?? { sumS: 0, sumB: 0, n: 0 };
      e.sumS += Number(r.shade_variation) || 0;
      e.sumB += Number(r.bf) || 0;
      e.n += 1;
      m.set(mc, e);
    });
    return Array.from(m.entries())
      .map(([mc, v]) => ({
        mc,
        shade: +(v.sumS / v.n).toFixed(3),
        bf: +(v.sumB / v.n).toFixed(2),
      }))
      .sort((a, b) => String(a.mc).localeCompare(String(b.mc)));
  }, [filtered]);

  // Summary stats
  const avgBF = filtered.length
    ? (
        filtered.reduce((s, r) => s + (Number(r.bf) || 0), 0) / filtered.length
      ).toFixed(2)
    : "0";
  const avgShade = filtered.length
    ? (
        filtered.reduce((s, r) => s + (Number(r.shade_variation) || 0), 0) /
        filtered.length
      ).toFixed(3)
    : "0";

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <AppShell>
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          Dashboard
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Real-time plant production &amp; recipe analytics
        </p>
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          icon={Database}
          label="Records"
          value={filtered.length}
          accent="#ef4444"
        />
        <StatCard
          icon={Calculator}
          label="Avg Shade %"
          value={`${avgShade} %`}
          accent="#eab308"
        />
        <StatCard
          icon={TrendingUp}
          label="Avg BF"
          value={avgBF}
          accent="#22c55e"
        />
        <StatCard
          icon={FlaskConical}
          label="Active Machines"
          value={machines.length}
          accent="#f97316"
        />
      </div>

      {/* Filters */}
      <Card className="mb-6 shadow-sm">
        <CardContent className="p-3 md:p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter label */}
            <div className="flex items-center gap-2 pr-3 border-r border-border">
              <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                <SlidersHorizontal className="h-4 w-4" />
              </div>
              <div className="leading-tight">
                <div className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                  Filters
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {filtered.length} / {quality.length}
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="relative min-w-[200px] flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search shade, party, machine…"
                className="pl-8 h-9 bg-background text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Dropdowns */}
            <FilterSelect
              label="Shade"
              value={shadeFilter}
              onChange={setShadeFilter}
              options={shades}
            />
            <FilterSelect
              label="Machine"
              value={machineFilter}
              onChange={setMachineFilter}
              options={machines}
            />
            <FilterSelect
              label="Denier"
              value={denierFilter}
              onChange={setDenierFilter}
              options={deniers}
            />
            <FilterSelect
              label="Party"
              value={partyFilter}
              onChange={setPartyFilter}
              options={parties}
            />

            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-9 text-xs ml-auto text-primary hover:text-primary hover:bg-primary/10"
            >
              <X className="h-3 w-3 mr-1" /> Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Charts grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* 1. Shade-wise Distribution */}
        {shadeDist.length === 0 ? (
          <Card className="shadow-sm">
            <Empty />
          </Card>
        ) : (
          <ChartCard
            title="Shade-wise Distribution"
            subtitle="Avg Shade Variation per Shade No"
          >
            <BarChart
              data={shadeDist}
              margin={{ top: 8, right: 12, left: 0, bottom: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis
                dataKey="shade"
                tick={tickStyle}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={55}
              />
              <YAxis tick={tickStyle} />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: "rgba(239,68,68,0.06)" }}
              />
              <Bar dataKey="total" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartCard>
        )}

        {/* 2. Pump Rate vs BF (scatter) */}
        {/* {pumpVsBf.length === 0 ? (
          <Card className="shadow-sm">
            <Empty />
          </Card>
        ) : (
          <ChartCard
            title="Pump Rate vs Quality"
            subtitle="P.T. Rate (L/min) × BF"
          >
            <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis
                type="number"
                dataKey="pt"
                name="Rate"
                unit=" L/min"
                tick={tickStyle}
              />
              <YAxis type="number" dataKey="bf" name="BF" tick={tickStyle} />
              <ZAxis range={[40, 80]} />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ strokeDasharray: "3 3" }}
              />
              <Scatter data={pumpVsBf} fill="#0f1b3d" />
            </ScatterChart>
          </ChartCard>
        )} */}

        {/* 3. Production Trend */}
        {productionTrend.length === 0 ? (
          <Card className="shadow-sm">
            <Empty />
          </Card>
        ) : (
          <ChartCard
            title="Production Trend"
            subtitle="Date × Avg Shade Variation"
          >
            <LineChart
              data={productionTrend}
              margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis
                dataKey="date"
                tick={tickStyle}
                interval="preserveStartEnd"
              />
              <YAxis tick={tickStyle} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#eab308"
                strokeWidth={2}
                dot={{ r: 2 }}
              />
            </LineChart>
          </ChartCard>
        )}

        {/* 4. Quality Analysis — shade vs avg BF */}
        {qualityByShade.length === 0 ? (
          <Card className="shadow-sm">
            <Empty />
          </Card>
        ) : (
          <ChartCard title="Quality Analysis" subtitle="Shade No × Avg BF">
            <BarChart
              data={qualityByShade}
              margin={{ top: 8, right: 12, left: 0, bottom: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis
                dataKey="shade"
                tick={tickStyle}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={55}
              />
              <YAxis tick={tickStyle} />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: "rgba(20,184,166,0.08)" }}
              />
              <Bar dataKey="bf" fill="#14b8a6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartCard>
        )}

        {/* 5. BF & Shade Variation Trend */}
        {bfTrend.length === 0 ? (
          <Card className="shadow-sm">
            <Empty />
          </Card>
        ) : (
          <ChartCard title="BF & Shade Variation Trend" subtitle="Over time">
            <LineChart
              data={bfTrend}
              margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey="date" tick={tickStyle} />
              <YAxis tick={tickStyle} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="BF"
                stroke="#0f1b3d"
                strokeWidth={2}
                dot={{ r: 2 }}
              />
              <Line
                type="monotone"
                dataKey="Variation"
                stroke="#3b6fa0"
                strokeWidth={2}
                dot={{ r: 2 }}
              />
            </LineChart>
          </ChartCard>
        )}

        {/* 6. Machine Performance */}
        {machinePerf.length === 0 ? (
          <Card className="shadow-sm">
            <Empty />
          </Card>
        ) : (
          <ChartCard
            title="Machine Performance"
            subtitle="M/C No × Avg Shade Variation + Avg BF"
            height={300}
          >
            <ComposedChart
              data={machinePerf}
              margin={{ top: 8, right: 32, left: 0, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey="mc" tick={tickStyle} />
              <YAxis yAxisId="l" tick={tickStyle} />
              <YAxis yAxisId="r" orientation="right" tick={tickStyle} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                yAxisId="l"
                dataKey="shade"
                name="Avg Shade %"
                fill="#ef4444"
                radius={[3, 3, 0, 0]}
              />
              <Line
                yAxisId="r"
                dataKey="bf"
                name="Avg BF"
                stroke="#0f1b3d"
                strokeWidth={2}
              />
            </ComposedChart>
          </ChartCard>
        )}
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
