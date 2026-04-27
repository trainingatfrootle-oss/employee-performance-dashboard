import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  BarChart3,
  ChevronDown,
  Download,
  MessageSquare,
  Package,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PasswordGate, usePasswordGate } from "../components/PasswordGate";
import type { EmployeeRecord } from "../hooks/useAllEmployeeData";
import type { GoogleSheetCallRecord } from "../hooks/useGoogleSheetCallRecords";
import { useAllSales } from "../hooks/useGoogleSheetSales";
import { buildFilename, exportToExcel } from "../lib/exportUtils";
import { ISSUE_CATEGORIES, classifyIssue, formatDisplayDate } from "./Feedback";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  selectedRegion: string;
  allRecords: GoogleSheetCallRecord[];
  employees: EmployeeRecord[];
  regionMap: Record<string, string>;
  onBack: () => void;
  onSelectEmployee: (fiplCode: string) => void;
}

type Tab = "employees" | "sales" | "feedback" | "issues" | "emp-feedback";

// ─── Constants ────────────────────────────────────────────────────────────────

const CHART_COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#ec4899",
];

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const normalizeKey = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseCallDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const raw = String(dateStr).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [dd, mm, yyyy] = raw.split("/");
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) {
    const [dd, mm, yyyy] = raw.split("-");
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  }
  if (/^\d+$/.test(raw)) {
    const num = Number(raw);
    return num < 1e12 ? new Date(num * 1000) : new Date(num);
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function CesBadge({ score }: { score: number }) {
  const isLow = score < 30;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border ${
        isLow
          ? "bg-red-100 text-red-700 border-red-300"
          : "bg-emerald-100 text-emerald-700 border-emerald-300"
      }`}
    >
      {score}/40
    </span>
  );
}

function computeEfficiency(emp: EmployeeRecord): number | null {
  const p = emp.performance;
  if (!p) return null;
  const vals = [
    p.salesInfluenceIndex,
    p.reviewCount,
    p.operationalDiscipline,
    p.productKnowledgeScore,
    p.softSkillScore,
  ].filter((v) => v > 0);
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
}

// ─── Tabs bar ─────────────────────────────────────────────────────────────────

const TAB_CONFIG: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "employees", label: "Employees", icon: Users },
  { id: "sales", label: "Sales Analysis", icon: BarChart3 },
  { id: "feedback", label: "Feedback Analysis", icon: MessageSquare },
  { id: "issues", label: "Issue Drilldown", icon: Zap },
  { id: "emp-feedback", label: "Employee Feedback", icon: TrendingDown },
];

// ─── Tab 1: Employees (Active Only) ──────────────────────────────────────────

function EmployeesTab({
  employees,
  onSelectEmployee,
}: {
  employees: EmployeeRecord[];
  onSelectEmployee: (fiplCode: string) => void;
}) {
  const [search, setSearch] = useState("");

  // Only show ACTIVE employees
  const activeEmployees = useMemo(
    () =>
      employees.filter((e) => {
        const s = (e.status ?? "").toLowerCase().replace(/\s+/g, "");
        return s === "active";
      }),
    [employees],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return activeEmployees;
    return activeEmployees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.fiplCode.toLowerCase().includes(q),
    );
  }, [activeEmployees, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            data-ocid="regional.emp.search_input"
            className="pl-9"
            placeholder="Search by name or FIPL code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Badge
          variant="secondary"
          className="text-xs whitespace-nowrap shrink-0"
        >
          Active Employees ({activeEmployees.length})
        </Badge>
      </div>

      {filtered.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 text-muted-foreground"
          data-ocid="regional.emp.empty_state"
        >
          <Users className="w-10 h-10 mb-2 opacity-30" />
          <p>No active employees found</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="px-4 py-2 bg-muted/40 border-b">
            <p className="text-xs text-muted-foreground">
              Showing active employees only. Sales and Feedback data includes
              all employees.
            </p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                {[
                  "#",
                  "Employee Name",
                  "FIPL Code",
                  "Role",
                  "Efficiency Score",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((emp, idx) => {
                const efficiency = computeEfficiency(emp);
                return (
                  <tr
                    key={emp.fiplCode}
                    className="hover:bg-muted/20 transition-colors"
                    data-ocid={`regional.emp.item.${idx + 1}`}
                  >
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onSelectEmployee(emp.fiplCode)}
                        className="font-medium text-primary hover:underline text-left"
                        data-ocid={`regional.emp.link.${idx + 1}`}
                      >
                        {emp.name || "—"}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {emp.fiplCode}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {emp.role || emp.category || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {efficiency !== null ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                            efficiency >= 70
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : efficiency >= 40
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-red-50 text-red-700 border-red-200"
                          }`}
                        >
                          {efficiency}%
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          N/A
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Top-Selling Products Section ─────────────────────────────────────────────

function TopSellingProducts({
  allSales,
  selectedRegion,
}: {
  allSales: Array<{
    fiplCode: string;
    region: string;
    product: string;
    quantity: number;
    amount: number;
    date: string;
  }>;
  selectedRegion: string;
}) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-indexed

  const [productMonth, setProductMonth] = useState(String(currentMonth));
  const [productYear, setProductYear] = useState(String(currentYear));

  // Available years from region sales
  const availableYears = useMemo(() => {
    const set = new Set<string>();
    for (const s of allSales) {
      if (s.region !== selectedRegion) continue;
      const d = parseCallDate(s.date);
      if (d) set.add(String(d.getFullYear()));
    }
    return [...set].sort((a, b) => Number(b) - Number(a));
  }, [allSales, selectedRegion]);

  // Top 5 products for the selected region + month + year — ranked by QUANTITY
  const topProducts = useMemo(() => {
    const regionSales = allSales.filter((s) => s.region === selectedRegion);
    const acc: Record<string, { quantity: number; amount: number }> = {};
    for (const s of regionSales) {
      const d = parseCallDate(s.date);
      if (!d) continue;
      const yr = String(d.getFullYear());
      const mo = d.getMonth() + 1; // 1-indexed

      if (productYear !== "all" && yr !== productYear) continue;
      if (productMonth !== "all" && mo !== Number(productMonth)) continue;

      const product = s.product?.trim() || "Unknown";
      if (!acc[product]) acc[product] = { quantity: 0, amount: 0 };
      acc[product].quantity += s.quantity ?? 0;
      acc[product].amount += s.amount ?? 0;
    }
    const sorted = Object.entries(acc)
      .map(([product, { quantity, amount }]) => ({ product, quantity, amount }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
    const totalQty = sorted.reduce((s, p) => s + p.quantity, 0);
    return sorted.map((p) => ({
      ...p,
      pct: totalQty > 0 ? Math.round((p.quantity / totalQty) * 100) : 0,
    }));
  }, [allSales, selectedRegion, productMonth, productYear]);

  const fmt = (v: number) =>
    `₹${v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v.toLocaleString("en-IN")}`;

  return (
    <div className="rounded-xl border bg-card shadow-sm p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Package className="w-4 h-4 text-amber-500" />
          Top Products by Quantity
        </h3>
        <div className="flex items-center gap-2">
          <Select value={productMonth} onValueChange={setProductMonth}>
            <SelectTrigger
              className="w-32 h-8 text-xs"
              data-ocid="regional.products.month_select"
            >
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent className="max-h-56 overflow-y-auto overscroll-contain">
              <SelectItem value="all">All Months</SelectItem>
              {MONTHS_SHORT.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={productYear} onValueChange={setProductYear}>
            <SelectTrigger
              className="w-28 h-8 text-xs"
              data-ocid="regional.products.year_select"
            >
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent className="max-h-56 overflow-y-auto overscroll-contain">
              <SelectItem value="all">All Years</SelectItem>
              {availableYears.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {topProducts.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No data available for selected period
        </p>
      ) : (
        <div className="space-y-5">
          {/* Ranked bar list */}
          <div className="space-y-3">
            {topProducts.map((p, idx) => {
              const max = topProducts[0].quantity;
              const pct = max > 0 ? Math.round((p.quantity / max) * 100) : 0;
              return (
                <div key={p.product} className="flex items-center gap-3">
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                    style={{
                      backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
                    }}
                  >
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate">
                        {p.product}
                      </span>
                      <span className="text-sm font-semibold ml-2 shrink-0 tabular-nums">
                        {p.quantity} units
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          backgroundColor:
                            CHART_COLORS[idx % CHART_COLORS.length],
                        }}
                      />
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {fmt(p.amount)} sales value · {p.pct}% of total qty
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pie Chart — % share by quantity */}
          <div className="pt-3 border-t">
            <p className="text-xs text-muted-foreground mb-3 font-medium">
              % Share by Quantity Sold
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={topProducts}
                  dataKey="quantity"
                  nameKey="product"
                  cx="50%"
                  cy="50%"
                  outerRadius={85}
                  label={({ name, pct }: { name: string; pct: number }) => {
                    const short =
                      name.length > 14 ? `${name.slice(0, 13)}…` : name;
                    return `${short} (${pct}%)`;
                  }}
                  labelLine={false}
                >
                  {topProducts.map((entry, idx) => (
                    <Cell
                      key={`prod-pie-${entry.product}`}
                      fill={CHART_COLORS[idx % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: number, name: string) => [
                    `${val} units`,
                    name,
                  ]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "11px" }}
                  formatter={(value: string) =>
                    value.length > 20 ? `${value.slice(0, 19)}…` : value
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Regional Comparison Section ──────────────────────────────────────────────

function RegionalComparison({
  allSales,
  allRegions,
  selectedRegion,
}: {
  allSales: Array<{
    fiplCode: string;
    region: string;
    amount: number;
    date: string;
  }>;
  allRegions: string[];
  selectedRegion: string;
}) {
  const [compYearFilter, setCompYearFilter] = useState("all");
  const [compRegion, setCompRegion] = useState("none");

  // Available years from ALL regions' sales
  const availableYears = useMemo(() => {
    const set = new Set<string>();
    for (const s of allSales) {
      const d = parseCallDate(s.date);
      if (d) set.add(String(d.getFullYear()));
    }
    return [...set].sort((a, b) => Number(b) - Number(a));
  }, [allSales]);

  const fmt = (v: number) =>
    `₹${v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v.toLocaleString("en-IN")}`;

  // Chart data depending on year selection
  const chartData = useMemo(() => {
    const regionsToPlot =
      compRegion !== "none" ? [selectedRegion, compRegion] : [selectedRegion];

    if (compYearFilter === "all") {
      // Multi-line chart: one line per (region × year) combination, X-axis = months
      // Collect all years that appear in the two chosen regions' sales
      const yearSet = new Set<string>();
      for (const s of allSales) {
        if (!regionsToPlot.includes(s.region ?? "")) continue;
        const d = parseCallDate(s.date);
        if (d) yearSet.add(String(d.getFullYear()));
      }
      const years = [...yearSet].sort();

      // Build map: region → year → monthIndex → amount
      const dataMap: Record<
        string,
        Record<string, Record<number, number>>
      > = {};
      for (const r of regionsToPlot) {
        dataMap[r] = {};
        for (const yr of years) dataMap[r][yr] = {};
      }
      for (const s of allSales) {
        if (!regionsToPlot.includes(s.region ?? "")) continue;
        const d = parseCallDate(s.date);
        if (!d) continue;
        const yr = String(d.getFullYear());
        const mo = d.getMonth();
        if (!dataMap[s.region]?.[yr]) continue;
        dataMap[s.region][yr][mo] = (dataMap[s.region][yr][mo] ?? 0) + s.amount;
      }

      // Flatten into [{month, "RegionA 2024": 0, "RegionA 2025": 0, ...}]
      const seriesKeys: { key: string; region: string; year: string }[] = [];
      for (const r of regionsToPlot) {
        for (const yr of years) {
          seriesKeys.push({ key: `${r} ${yr}`, region: r, year: yr });
        }
      }

      const monthlyData = MONTHS_SHORT.map((mo, i) => {
        const row: Record<string, string | number> = { month: mo };
        for (const { key, region, year } of seriesKeys) {
          row[key] = dataMap[region]?.[year]?.[i] ?? 0;
        }
        return row;
      });

      return {
        type: "multi-line" as const,
        data: monthlyData,
        series: seriesKeys,
        regions: regionsToPlot,
        years,
      };
    }

    // Line chart: monthly breakdown for selected year per selected + compared region
    const monthlyData = MONTHS_SHORT.map((mo) => {
      const row: Record<string, string | number> = { month: mo };
      for (const r of regionsToPlot) row[r] = 0;
      return row;
    });

    for (const s of allSales) {
      if (!regionsToPlot.includes(s.region ?? "")) continue;
      const d = parseCallDate(s.date);
      if (!d || String(d.getFullYear()) !== compYearFilter) continue;
      const mo = d.getMonth();
      (monthlyData[mo][s.region] as number) += s.amount;
    }

    return {
      type: "line" as const,
      data: monthlyData,
      regions: regionsToPlot,
    };
  }, [allSales, selectedRegion, compYearFilter, compRegion]);

  // When "All Years" is selected but no comparison region picked, prompt the user
  const showAllYearsPrompt = compYearFilter === "all" && compRegion === "none";

  return (
    <div className="rounded-xl border bg-card shadow-sm p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-500" />
          Regional Comparison
          {compYearFilter === "all" && compRegion !== "none" ? (
            <Badge variant="secondary" className="text-[10px]">
              All Years — {selectedRegion} vs {compRegion}
            </Badge>
          ) : compYearFilter !== "all" ? (
            <Badge variant="secondary" className="text-[10px]">
              {compYearFilter} — Line Chart
            </Badge>
          ) : null}
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Always show compare-region selector */}
          <Select value={compRegion} onValueChange={setCompRegion}>
            <SelectTrigger
              className="w-44 h-8 text-xs"
              data-ocid="regional.comp.compare_region_select"
            >
              <SelectValue placeholder="Select region to compare..." />
            </SelectTrigger>
            <SelectContent className="max-h-56 overflow-y-auto overscroll-contain">
              <SelectItem value="none">Select a region…</SelectItem>
              {allRegions
                .filter((r) => r !== selectedRegion)
                .map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select value={compYearFilter} onValueChange={setCompYearFilter}>
            <SelectTrigger
              className="w-32 h-8 text-xs"
              data-ocid="regional.comp.year_select"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-56 overflow-y-auto overscroll-contain">
              <SelectItem value="all">All Years</SelectItem>
              {availableYears.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* "All Years" with no comparison region selected — prompt */}
      {showAllYearsPrompt ? (
        <div className="flex flex-col items-center justify-center py-14 text-muted-foreground gap-3 rounded-xl border-2 border-dashed border-border">
          <BarChart3 className="w-10 h-10 opacity-25" />
          <p className="text-sm font-medium text-foreground">
            Select a region to compare across all years
          </p>
          <p className="text-xs text-center max-w-xs">
            Choose a second region from the dropdown above to see a multi-line
            chart comparing{" "}
            <span className="font-semibold">{selectedRegion}</span> vs your
            chosen region — one line per year.
          </p>
        </div>
      ) : chartData.type === "multi-line" ? (
        /* All Years + comparison region — Multi-line chart */
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Each line represents one year. Solid lines = {selectedRegion} ·
            Dashed lines = {compRegion !== "none" ? compRegion : ""}
          </p>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart
              data={chartData.data}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => fmt(v as number)}
                width={72}
              />
              <Tooltip formatter={(v: number) => [fmt(v), ""]} />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              {chartData.series.map(({ key, region }) => {
                // Blues for region 1 (selectedRegion), ambers for region 2 (compRegion)
                const region1Colors = [
                  "#6366f1",
                  "#818cf8",
                  "#a5b4fc",
                  "#c7d2fe",
                ];
                const region2Colors = [
                  "#f59e0b",
                  "#fb923c",
                  "#fbbf24",
                  "#fcd34d",
                ];
                const isRegion1 = region === selectedRegion;
                const palette = isRegion1 ? region1Colors : region2Colors;
                const yearIdx = chartData.years.indexOf(
                  key.slice(region.length + 1),
                );
                const color = palette[yearIdx % palette.length];
                const isDash = !isRegion1;
                return (
                  <Line
                    key={key}
                    dataKey={key}
                    name={key}
                    stroke={color}
                    strokeWidth={isRegion1 ? 2.5 : 2}
                    strokeDasharray={isDash ? "6 3" : undefined}
                    dot={false}
                    activeDot={{ r: 4 }}
                    isAnimationActive
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
          {/* Legend explainer */}
          <div className="flex flex-wrap gap-3 pt-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="inline-block w-6 h-0.5 bg-indigo-500 rounded" />
              {selectedRegion} (solid)
            </div>
            {compRegion !== "none" && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="inline-block w-6 border-t-2 border-dashed border-amber-500" />
                {compRegion} (dashed)
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Individual year — Line chart: monthly trend per region */
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={chartData.data}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => fmt(v as number)}
              width={72}
            />
            <Tooltip formatter={(v: number) => [fmt(v), ""]} />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            {chartData.regions.map((r, i) => (
              <Line
                key={r}
                dataKey={r}
                name={r}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={r === selectedRegion ? 2.5 : 1.5}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ─── Tab 2: Sales Analysis ────────────────────────────────────────────────────

function SalesAnalysisTab({
  selectedRegion,
  allRegions,
}: {
  selectedRegion: string;
  allRegions: string[];
}) {
  const { data: allSales = [], isLoading } = useAllSales();
  const [yearFilter, setYearFilter] = useState("all");
  const [subTab, setSubTab] = useState<"trend" | "compare">("trend");

  // Available years
  const years = useMemo(() => {
    const set = new Set<string>();
    for (const s of allSales) {
      const d = parseCallDate(s.date);
      if (d) set.add(String(d.getFullYear()));
    }
    return [...set].sort((a, b) => Number(b) - Number(a));
  }, [allSales]);

  // ALL sales for selected region (all employee statuses)
  const regionSales = useMemo(
    () => allSales.filter((s) => s.region === selectedRegion),
    [allSales, selectedRegion],
  );

  // Monthly trend data for Sales Trend sub-tab
  const trendData = useMemo(() => {
    if (yearFilter === "all") {
      const yearMap: Record<string, Record<number, number>> = {};
      for (const s of regionSales) {
        const d = parseCallDate(s.date);
        if (!d) continue;
        const yr = String(d.getFullYear());
        const mo = d.getMonth();
        if (!yearMap[yr]) yearMap[yr] = {};
        yearMap[yr][mo] = (yearMap[yr][mo] ?? 0) + s.amount;
      }
      return {
        type: "multi" as const,
        yearMap,
        years: Object.keys(yearMap).sort(),
      };
    }
    const monthMap: Record<number, number> = {};
    for (const s of regionSales) {
      const d = parseCallDate(s.date);
      if (!d) continue;
      if (String(d.getFullYear()) !== yearFilter) continue;
      const mo = d.getMonth();
      monthMap[mo] = (monthMap[mo] ?? 0) + s.amount;
    }
    return { type: "single" as const, monthMap };
  }, [regionSales, yearFilter]);

  const fmt = (v: number) =>
    `₹${v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v.toLocaleString("en-IN")}`;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Sub-tab toggle */}
      <div className="inline-flex items-center rounded-lg border bg-muted p-1 gap-1">
        <button
          type="button"
          data-ocid="regional.sales.trend_tab"
          onClick={() => setSubTab("trend")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            subTab === "trend"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Sales Trend
        </button>
        <button
          type="button"
          data-ocid="regional.sales.compare_tab"
          onClick={() => setSubTab("compare")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            subTab === "compare"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Region vs Region
        </button>
      </div>

      {subTab === "trend" && (
        <div className="space-y-4">
          {/* Year filter */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">
              Year:
            </span>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger
                className="w-36 h-8 text-xs"
                data-ocid="regional.sales.year_select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-56 overflow-y-auto overscroll-contain">
                <SelectItem value="all">All Years</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Chart */}
          <div className="rounded-xl border bg-card shadow-sm p-5">
            <h3 className="text-sm font-semibold mb-4">
              {yearFilter === "all"
                ? `Monthly Sales — All Years (${selectedRegion})`
                : `Monthly Sales — ${yearFilter} (${selectedRegion})`}
            </h3>
            {regionSales.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-16">
                No sales data available for this region
              </p>
            ) : yearFilter === "all" && trendData.type === "multi" ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={MONTHS_SHORT.map((mo, i) => {
                    const pt: Record<string, string | number> = { month: mo };
                    for (const yr of trendData.years) {
                      pt[yr] = trendData.yearMap[yr]?.[i] ?? 0;
                    }
                    return pt;
                  })}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => fmt(v as number)}
                  />
                  <Tooltip formatter={(v: number) => [fmt(v), ""]} />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  {trendData.years.map((yr, i) => (
                    <Line
                      key={yr}
                      dataKey={yr}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      name={yr}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : trendData.type === "single" ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={MONTHS_SHORT.map((mo, i) => ({
                    month: mo,
                    amount: trendData.monthMap[i] ?? 0,
                  }))}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => fmt(v as number)}
                  />
                  <Tooltip formatter={(v: number) => [fmt(v), "Sales"]} />
                  <Bar
                    dataKey="amount"
                    name="Sales"
                    fill="#6366f1"
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </div>

          {/* Top-Selling Products section */}
          <TopSellingProducts
            allSales={allSales}
            selectedRegion={selectedRegion}
          />
        </div>
      )}

      {subTab === "compare" && (
        <RegionalComparison
          allSales={allSales}
          allRegions={allRegions}
          selectedRegion={selectedRegion}
        />
      )}
    </div>
  );
}

// ─── Tab 3: Feedback Analysis ─────────────────────────────────────────────────

function FeedbackAnalysisTab({
  records,
  employees,
  onSelectEmployee,
}: {
  records: GoogleSheetCallRecord[];
  employees: EmployeeRecord[];
  onSelectEmployee: (fiplCode: string) => void;
}) {
  const totalCount = records.length;
  const positiveCount = records.filter((r) => r.cesScore >= 30).length;
  const negativeCount = records.filter((r) => r.cesScore < 30).length;
  const avgCes =
    totalCount > 0
      ? records.reduce((s, r) => s + r.cesScore, 0) / totalCount
      : 0;

  const nameMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of employees) m[normalizeKey(e.fiplCode)] = e.name;
    return m;
  }, [employees]);

  const empStats = useMemo(() => {
    const map: Record<
      string,
      {
        fiplCode: string;
        name: string;
        total: number;
        pos: number;
        neg: number;
        sum: number;
      }
    > = {};
    for (const r of records) {
      const key = normalizeKey(r.fiplCode);
      if (!map[key]) {
        map[key] = {
          fiplCode: r.fiplCode,
          name: nameMap[key] ?? r.fseName ?? r.fiplCode,
          total: 0,
          pos: 0,
          neg: 0,
          sum: 0,
        };
      }
      map[key].total++;
      map[key].sum += r.cesScore;
      if (r.cesScore >= 30) map[key].pos++;
      else map[key].neg++;
    }
    return Object.values(map)
      .map((s) => ({ ...s, avgCes: s.total > 0 ? s.sum / s.total : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [records, nameMap]);

  const issueCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of records) {
      for (const cat of classifyIssue(r.typeOfIssue)) {
        counts[cat] = (counts[cat] ?? 0) + 1;
      }
    }
    return ISSUE_CATEGORIES.map((cat, i) => ({
      name: cat.label,
      key: cat.key,
      count: counts[cat.key] ?? 0,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }))
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [records]);

  const resolutionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of records) {
      const res = r.resolution?.trim();
      if (res) counts[res] = (counts[res] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);
  }, [records]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Total Feedback",
            value: totalCount,
            color: "bg-card border-border text-foreground",
          },
          {
            label: "Positive (CES ≥30)",
            value: positiveCount,
            color: "bg-emerald-50 border-emerald-200 text-emerald-800",
          },
          {
            label: "Negative (CES <30)",
            value: negativeCount,
            color: "bg-red-50 border-red-200 text-red-800",
          },
          {
            label: "Avg CES Score",
            value: totalCount > 0 ? `${avgCes.toFixed(1)}/40` : "—",
            color:
              avgCes >= 30
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800",
          },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className={`rounded-lg border px-4 py-3 text-center ${color}`}
          >
            <div className="text-xl font-bold">{value}</div>
            <div className="text-xs font-medium mt-0.5 opacity-75">{label}</div>
          </div>
        ))}
      </div>

      {issueCounts.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm p-5">
          <h3 className="text-sm font-semibold mb-4">
            🔍 Most Recurring Issues
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={issueCounts}
              layout="vertical"
              margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e5e7eb"
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={{ fontSize: 11 }}
                allowDecimals={false}
              />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fontSize: 10 }}
                width={130}
              />
              <Tooltip />
              <Bar dataKey="count" name="Records" radius={[0, 3, 3, 0]}>
                {issueCounts.map((entry, idx) => (
                  <Cell
                    key={entry.key}
                    fill={CHART_COLORS[idx % CHART_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {resolutionCounts.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm p-5">
          <h3 className="text-sm font-semibold mb-4">✅ Common Resolutions</h3>
          <div className="space-y-2">
            {resolutionCounts.map(([res, count], idx) => {
              const max = resolutionCounts[0][1];
              return (
                <div key={res} className="flex items-center gap-3 text-sm">
                  <span className="w-5 h-5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-0.5">
                      <span className="text-xs font-medium truncate">
                        {res}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2 shrink-0">
                        {count}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/60 transition-all duration-500"
                        style={{ width: `${Math.round((count / max) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {empStats.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b bg-muted/40">
            <h3 className="text-sm font-semibold">
              👥 Employee-wise CES Summary
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {[
                    "Employee",
                    "FIPL Code",
                    "Total",
                    "Positive",
                    "Negative",
                    "Avg CES",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {empStats.map((s) => (
                  <tr
                    key={s.fiplCode}
                    className="hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onSelectEmployee(s.fiplCode)}
                        className="font-medium text-primary hover:underline text-left text-sm"
                      >
                        {s.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {s.fiplCode}
                    </td>
                    <td className="px-4 py-3 text-center font-medium">
                      {s.total}
                    </td>
                    <td className="px-4 py-3 text-center text-emerald-700 font-semibold">
                      {s.pos}
                    </td>
                    <td className="px-4 py-3 text-center text-red-700 font-semibold">
                      {s.neg}
                    </td>
                    <td
                      className={`px-4 py-3 text-center font-semibold ${
                        s.avgCes >= 30 ? "text-emerald-700" : "text-red-700"
                      }`}
                    >
                      {s.avgCes.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalCount === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <MessageSquare className="w-10 h-10 mb-2 opacity-30" />
          <p>No feedback records for this region</p>
        </div>
      )}
    </div>
  );
}

// ─── Tab 4: Issue Drilldown ────────────────────────────────────────────────────

function IssueDrilldownTab({
  records,
  employees,
  onSelectEmployee,
}: {
  records: GoogleSheetCallRecord[];
  employees: EmployeeRecord[];
  onSelectEmployee: (fiplCode: string) => void;
}) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedRecord, setExpandedRecord] =
    useState<GoogleSheetCallRecord | null>(null);

  const nameMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of employees) m[normalizeKey(e.fiplCode)] = e.name;
    return m;
  }, [employees]);

  const issueCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of records) {
      for (const cat of classifyIssue(r.typeOfIssue)) {
        counts[cat] = (counts[cat] ?? 0) + 1;
      }
    }
    return ISSUE_CATEGORIES.map((cat, i) => ({
      name: cat.label,
      key: cat.key,
      count: counts[cat.key] ?? 0,
      color: CHART_COLORS[i % CHART_COLORS.length],
      chipColor: cat.color,
    }))
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [records]);

  const drilldownRecords = useMemo(() => {
    if (!activeCategory) return [];
    return records.filter((r) =>
      classifyIssue(r.typeOfIssue).includes(
        activeCategory as (typeof ISSUE_CATEGORIES)[number]["key"],
      ),
    );
  }, [records, activeCategory]);

  if (activeCategory) {
    const cat = ISSUE_CATEGORIES.find((c) => c.key === activeCategory);
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setActiveCategory(null)}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-ocid="regional.issues.back_button"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Issue Overview
        </button>

        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold">
            {cat?.label ?? activeCategory}
          </h3>
          <Badge variant="secondary">{drilldownRecords.length} cases</Badge>
        </div>

        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                {[
                  "Date",
                  "Employee",
                  "Customer",
                  "CES",
                  "Remark",
                  "Resolution",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {drilldownRecords.map((r, idx) => (
                <tr
                  key={r.id}
                  className="hover:bg-muted/20 transition-colors"
                  data-ocid={`regional.issues.case.${idx + 1}`}
                >
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDisplayDate(r.dateOfVisit)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onSelectEmployee(r.fiplCode)}
                      className="text-primary hover:underline text-sm"
                    >
                      {nameMap[normalizeKey(r.fiplCode)] ??
                        r.fseName ??
                        r.fiplCode}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs">{r.customerName}</td>
                  <td className="px-4 py-3">
                    <CesBadge score={r.cesScore} />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setExpandedRecord(r)}
                      className="text-xs text-muted-foreground hover:text-foreground line-clamp-2 text-left max-w-[200px]"
                    >
                      {r.remark || "—"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px]">
                    {r.resolution || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Dialog
          open={expandedRecord !== null}
          onOpenChange={(open) => {
            if (!open) setExpandedRecord(null);
          }}
        >
          <DialogContent
            className="max-w-md"
            data-ocid="regional.issues.dialog"
          >
            <DialogHeader>
              <DialogTitle>Case Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-semibold">Employee: </span>
                {nameMap[normalizeKey(expandedRecord?.fiplCode ?? "")] ??
                  expandedRecord?.fseName ??
                  expandedRecord?.fiplCode}
              </div>
              <div>
                <span className="font-semibold">Customer: </span>
                {expandedRecord?.customerName}
              </div>
              <div>
                <span className="font-semibold">Date of Visit: </span>
                {formatDisplayDate(expandedRecord?.dateOfVisit)}
              </div>
              <div>
                <span className="font-semibold">CES: </span>
                <span
                  className={
                    expandedRecord && expandedRecord.cesScore < 30
                      ? "text-red-600 font-semibold"
                      : "text-emerald-600 font-semibold"
                  }
                >
                  {expandedRecord?.cesScore}/40
                </span>
              </div>
              <div>
                <span className="font-semibold">Type of Issue: </span>
                {expandedRecord?.typeOfIssue || "—"}
              </div>
              <div>
                <span className="font-semibold">Resolution: </span>
                {expandedRecord?.resolution || "—"}
              </div>
              <div className="border-t pt-3">
                <span className="font-semibold block mb-1">Full Remark:</span>
                <p className="text-muted-foreground leading-relaxed">
                  {expandedRecord?.remark || "No remark"}
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Click an issue category to view all related cases
      </p>
      {issueCounts.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 text-muted-foreground"
          data-ocid="regional.issues.empty_state"
        >
          <Zap className="w-10 h-10 mb-2 opacity-30" />
          <p>No issues classified for this region</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border bg-card shadow-sm p-5">
            <h3 className="text-sm font-semibold mb-4">Issue Distribution</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={issueCounts}
                layout="vertical"
                margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e5e7eb"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  allowDecimals={false}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 10 }}
                  width={130}
                />
                <Tooltip />
                <Bar
                  dataKey="count"
                  name="Records"
                  radius={[0, 3, 3, 0]}
                  onClick={(d) => setActiveCategory((d as { key: string }).key)}
                >
                  {issueCounts.map((entry, idx) => (
                    <Cell
                      key={entry.key}
                      fill={CHART_COLORS[idx % CHART_COLORS.length]}
                      className="cursor-pointer"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {issueCounts.map((cat, idx) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setActiveCategory(cat.key)}
                data-ocid={`regional.issues.category.${idx + 1}`}
                className="flex items-center justify-between rounded-xl border bg-card shadow-sm px-4 py-3 hover:shadow-md hover:scale-[1.01] transition-all text-left"
              >
                <div>
                  <p className="font-medium text-sm">{cat.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {cat.count} case{cat.count !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{
                      backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
                    }}
                  >
                    {cat.count}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground rotate-[-90deg]" />
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tab 5: Employee Feedback Breakdown ───────────────────────────────────────

function EmpFeedbackBreakdownTab({
  records,
  employees,
  onSelectEmployee,
}: {
  records: GoogleSheetCallRecord[];
  employees: EmployeeRecord[];
  onSelectEmployee: (fiplCode: string) => void;
}) {
  type SortMode = "mostNegative" | "highestCes" | "name";
  const [sortMode, setSortMode] = useState<SortMode>("mostNegative");
  const [activeEmployee, setActiveEmployee] = useState<{
    fiplCode: string;
    name: string;
    records: GoogleSheetCallRecord[];
  } | null>(null);
  const [cesFilter, setCesFilter] = useState<"all" | "positive" | "negative">(
    "all",
  );
  const [search, setSearch] = useState("");

  const nameMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of employees) m[normalizeKey(e.fiplCode)] = e.name;
    return m;
  }, [employees]);

  const empStats = useMemo(() => {
    const map: Record<
      string,
      {
        fiplCode: string;
        name: string;
        total: number;
        pos: number;
        neg: number;
        avgCes: number;
        records: GoogleSheetCallRecord[];
      }
    > = {};
    for (const r of records) {
      const key = normalizeKey(r.fiplCode);
      if (!map[key]) {
        map[key] = {
          fiplCode: r.fiplCode,
          name: nameMap[key] ?? r.fseName ?? r.fiplCode,
          total: 0,
          pos: 0,
          neg: 0,
          avgCes: 0,
          records: [],
        };
      }
      map[key].total++;
      if (r.cesScore >= 30) map[key].pos++;
      else map[key].neg++;
      map[key].records.push(r);
    }
    for (const s of Object.values(map)) {
      s.avgCes =
        s.total > 0
          ? s.records.reduce((sum, r) => sum + r.cesScore, 0) / s.total
          : 0;
    }
    const list = Object.values(map);
    if (sortMode === "mostNegative") return list.sort((a, b) => b.neg - a.neg);
    if (sortMode === "highestCes")
      return list.sort((a, b) => b.avgCes - a.avgCes);
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [records, nameMap, sortMode]);

  const detailRecords = useMemo(() => {
    if (!activeEmployee) return [];
    return activeEmployee.records.filter((r) => {
      if (cesFilter === "positive") return r.cesScore >= 30;
      if (cesFilter === "negative") return r.cesScore < 30;
      return true;
    });
  }, [activeEmployee, cesFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Sort by:</span>
        {(
          [
            { id: "mostNegative", label: "Most Negative" },
            { id: "highestCes", label: "Highest CES" },
            { id: "name", label: "Name" },
          ] as { id: SortMode; label: string }[]
        ).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSortMode(id)}
            data-ocid={`regional.empfb.sort.${id}`}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              sortMode === id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:bg-muted/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {empStats.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 text-muted-foreground"
          data-ocid="regional.empfb.empty_state"
        >
          <Users className="w-10 h-10 mb-2 opacity-30" />
          <p>No employee feedback data for this region</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {empStats.map((s, idx) => (
            <div
              key={s.fiplCode}
              className="rounded-xl border bg-card shadow-sm p-4 space-y-3"
              data-ocid={`regional.empfb.card.${idx + 1}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <button
                    type="button"
                    onClick={() => onSelectEmployee(s.fiplCode)}
                    className="font-semibold text-sm text-primary hover:underline text-left"
                  >
                    {s.name}
                  </button>
                  <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                    {s.fiplCode}
                  </p>
                </div>
                <span
                  className={`text-sm font-bold px-2 py-1 rounded-lg ${
                    s.avgCes >= 30
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {s.avgCes.toFixed(1)}
                </span>
              </div>

              <div className="flex gap-2">
                <span className="flex-1 text-center rounded-lg bg-emerald-50 border border-emerald-200 py-1.5">
                  <div className="text-base font-bold text-emerald-700">
                    {s.pos}
                  </div>
                  <div className="text-[10px] text-emerald-600">Positive</div>
                </span>
                <span className="flex-1 text-center rounded-lg bg-red-50 border border-red-200 py-1.5">
                  <div className="text-base font-bold text-red-700">
                    {s.neg}
                  </div>
                  <div className="text-[10px] text-red-600">Negative</div>
                </span>
                <span className="flex-1 text-center rounded-lg bg-muted border border-border py-1.5">
                  <div className="text-base font-bold text-foreground">
                    {s.total}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Total</div>
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setActiveEmployee({
                    fiplCode: s.fiplCode,
                    name: s.name,
                    records: s.records,
                  });
                  setCesFilter("all");
                  setSearch("");
                }}
                className="w-full text-xs text-primary hover:underline font-medium text-center py-1"
                data-ocid={`regional.empfb.view_details.${idx + 1}`}
              >
                View detailed feedback →
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={activeEmployee !== null}
        onOpenChange={(open) => {
          if (!open) setActiveEmployee(null);
        }}
      >
        <DialogContent
          className="max-w-2xl max-h-[85vh] flex flex-col"
          data-ocid="regional.empfb.dialog"
        >
          <DialogHeader>
            <DialogTitle>
              {activeEmployee?.name} — Detailed Feedback
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-wrap gap-2 mb-3">
            {(["all", "positive", "negative"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setCesFilter(f)}
                data-ocid={`regional.empfb.filter.${f}`}
                className={`px-3 py-1 rounded-lg border text-xs font-medium transition-colors ${
                  cesFilter === f
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-muted-foreground hover:bg-muted/30"
                }`}
              >
                {f === "all"
                  ? "All"
                  : f === "positive"
                    ? "Positive (CES ≥30)"
                    : "Negative (CES <30)"}
              </button>
            ))}
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9 h-8 text-xs"
              placeholder="Search remark, customer, product..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-ocid="regional.empfb.search_input"
            />
          </div>

          <div className="overflow-y-auto flex-1 space-y-2 pr-1">
            {detailRecords
              .filter((r) => {
                const q = search.toLowerCase();
                if (!q) return true;
                return (
                  r.remark.toLowerCase().includes(q) ||
                  r.customerName.toLowerCase().includes(q) ||
                  r.product.toLowerCase().includes(q)
                );
              })
              .map((r) => (
                <div
                  key={r.id}
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    r.cesScore < 30
                      ? "border-red-200 bg-red-50/40"
                      : "border-emerald-200 bg-emerald-50/30"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <CesBadge score={r.cesScore} />
                    <span className="text-xs text-muted-foreground">
                      {formatDisplayDate(r.dateOfVisit)}
                    </span>
                    <span className="text-xs font-medium">
                      {r.customerName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {r.product}
                    </span>
                  </div>
                  {r.typeOfIssue && (
                    <p className="text-xs text-muted-foreground mb-1">
                      <span className="font-medium">Issue: </span>
                      {r.typeOfIssue}
                    </p>
                  )}
                  <p className="text-xs leading-relaxed text-foreground">
                    {r.remark || "No remark"}
                  </p>
                  {r.resolution && (
                    <p className="text-xs text-emerald-700 mt-1">
                      <span className="font-medium">Resolution: </span>
                      {r.resolution}
                    </p>
                  )}
                </div>
              ))}
            {detailRecords.length === 0 && (
              <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
                No records for this filter
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main RegionalDashboard ────────────────────────────────────────────────────

export default function RegionalDashboard({
  selectedRegion,
  allRecords,
  employees,
  regionMap,
  onBack,
  onSelectEmployee,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("employees");
  const { data: allSales = [] } = useAllSales();
  const { granted: exportGranted } = usePasswordGate("export");
  const [pendingExportGate, setPendingExportGate] = useState(false);

  // Filter records for this region — ALL employees (active + inactive)
  const regionRecords = useMemo(
    () =>
      allRecords.filter(
        (r) =>
          (regionMap[normalizeKey(r.fiplCode ?? "")] ?? "") === selectedRegion,
      ),
    [allRecords, selectedRegion, regionMap],
  );

  // Filter employees for this region — ALL employees (tab decides active-only)
  const regionEmployees = useMemo(
    () => employees.filter((e) => e.region === selectedRegion),
    [employees, selectedRegion],
  );

  // Active employees only (for employee list + export)
  const activeRegionEmployees = useMemo(
    () =>
      regionEmployees.filter((e) => {
        const s = (e.status ?? "").toLowerCase().replace(/\s+/g, "");
        return s === "active";
      }),
    [regionEmployees],
  );

  // Count of active employees in region (for header display)
  const activeEmployeeCount = activeRegionEmployees.length;

  // All distinct regions for comparison
  const allRegions = useMemo(
    () =>
      [
        ...new Set(
          employees.map((e) => e.region).filter((r): r is string => Boolean(r)),
        ),
      ].sort(),
    [employees],
  );

  // ── Export handler ─────────────────────────────────────────────────────────

  function handleExportRegion() {
    const currentYear = String(new Date().getFullYear());

    // ── Sheet 1: Region Overview ─────────────────────────────────────────────
    const positiveCount = regionRecords.filter((r) => r.cesScore >= 30).length;
    const negativeCount = regionRecords.filter((r) => r.cesScore < 30).length;
    const avgCes =
      regionRecords.length > 0
        ? regionRecords.reduce((s, r) => s + r.cesScore, 0) /
          regionRecords.length
        : 0;

    // Top issue type
    const issueCounts: Record<string, number> = {};
    for (const r of regionRecords) {
      for (const cat of classifyIssue(r.typeOfIssue)) {
        issueCounts[cat] = (issueCounts[cat] ?? 0) + 1;
      }
    }
    const topIssueCat = Object.entries(issueCounts).sort(
      ([, a], [, b]) => b - a,
    )[0];
    const topIssueLabel = topIssueCat
      ? (ISSUE_CATEGORIES.find((c) => c.key === topIssueCat[0])?.label ??
        topIssueCat[0])
      : "None";

    const overviewData = [
      {
        Field: "Region Name",
        Value: selectedRegion,
      },
      {
        Field: "Total Active Employees",
        Value: activeEmployeeCount,
      },
      {
        Field: "Total Feedback Records",
        Value: regionRecords.length,
      },
      {
        Field: "Positive Feedback (CES ≥30)",
        Value: positiveCount,
      },
      {
        Field: "Negative Feedback (CES <30)",
        Value: negativeCount,
      },
      {
        Field: "Average CES Score",
        Value: avgCes > 0 ? `${avgCes.toFixed(1)}/40` : "—",
      },
      {
        Field: "Top Issue Type",
        Value: topIssueLabel,
      },
    ];

    // ── Sheet 2: Employee List (active only) ─────────────────────────────────
    const employeeData = activeRegionEmployees.map((emp) => {
      const eff = computeEfficiency(emp);
      return {
        "Employee Name": emp.name || "—",
        "FIPL Code": emp.fiplCode,
        "Efficiency Score": eff !== null ? `${eff}%` : "N/A",
      };
    });

    // ── Sheet 3: Sales Analysis (monthly for current year) ───────────────────
    const regionSales = allSales.filter((s) => s.region === selectedRegion);
    const monthlyMap: Record<number, number> = {};
    for (const s of regionSales) {
      const d = parseCallDate(s.date);
      if (!d || String(d.getFullYear()) !== currentYear) continue;
      const mo = d.getMonth();
      monthlyMap[mo] = (monthlyMap[mo] ?? 0) + s.amount;
    }
    const salesData = MONTHS_SHORT.map((mo, i) => ({
      Month: mo,
      "Total Sales Amount (₹)": monthlyMap[i] ?? 0,
    }));

    // ── Sheet 4: Feedback Analysis ────────────────────────────────────────────
    const nameMap: Record<string, string> = {};
    for (const e of regionEmployees) nameMap[normalizeKey(e.fiplCode)] = e.name;

    const feedbackData = regionRecords.map((r) => ({
      "Employee Name":
        nameMap[normalizeKey(r.fiplCode)] ?? r.fseName ?? r.fiplCode,
      "FIPL Code": r.fiplCode,
      "CES Score": r.cesScore,
      "Issue Type": r.typeOfIssue || "—",
      Resolution: r.resolution || "—",
      "Date of Visit": formatDisplayDate(r.dateOfVisit),
      Remarks: r.remark || "—",
    }));

    // ── Sheet 5: Top Products ─────────────────────────────────────────────────
    const prodAcc: Record<string, { quantity: number; amount: number }> = {};
    for (const s of regionSales) {
      const product = s.product?.trim() || "Unknown";
      if (!prodAcc[product]) prodAcc[product] = { quantity: 0, amount: 0 };
      prodAcc[product].quantity += s.quantity ?? 0;
      prodAcc[product].amount += s.amount ?? 0;
    }
    const topProductsData = Object.entries(prodAcc)
      .sort(([, a], [, b]) => b.quantity - a.quantity)
      .slice(0, 10)
      .map(([product, { quantity, amount }]) => ({
        "Product Name": product,
        "Quantity Sold": quantity,
        "Sales Amount (₹)": amount,
      }));

    exportToExcel({
      filename: buildFilename("RegionReport", {
        Region: selectedRegion,
        Year: currentYear,
      }),
      filters: {
        Region: selectedRegion,
        Year: currentYear,
      },
      sheets: [
        {
          name: "Region Overview",
          data: overviewData,
          columns: [
            { key: "Field", header: "Field", width: 28 },
            { key: "Value", header: "Value", width: 30 },
          ],
        },
        {
          name: "Employee List",
          data: employeeData,
          columns: [
            { key: "Employee Name", header: "Employee Name", width: 28 },
            { key: "FIPL Code", header: "FIPL Code", width: 16 },
            { key: "Efficiency Score", header: "Efficiency Score", width: 18 },
          ],
        },
        {
          name: "Sales Analysis",
          data: salesData,
          columns: [
            { key: "Month", header: "Month", width: 12 },
            {
              key: "Total Sales Amount (₹)",
              header: `Total Sales Amount (₹) — ${currentYear}`,
              width: 28,
            },
          ],
        },
        {
          name: "Feedback Analysis",
          data: feedbackData,
          columns: [
            { key: "Employee Name", header: "Employee Name", width: 26 },
            { key: "FIPL Code", header: "FIPL Code", width: 16 },
            { key: "CES Score", header: "CES Score", width: 12 },
            { key: "Issue Type", header: "Issue Type", width: 32 },
            { key: "Resolution", header: "Resolution", width: 32 },
            { key: "Date of Visit", header: "Date of Visit", width: 16 },
            { key: "Remarks", header: "Remarks", width: 50 },
          ],
        },
        {
          name: "Top Products",
          data: topProductsData,
          columns: [
            { key: "Product Name", header: "Product Name", width: 32 },
            { key: "Quantity Sold", header: "Quantity Sold", width: 16 },
            { key: "Sales Amount (₹)", header: "Sales Amount (₹)", width: 20 },
          ],
        },
      ],
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          data-ocid="regional.back_button"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Regional Analysis
        </button>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              📍 {selectedRegion}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {activeEmployeeCount} active employees · {regionRecords.length}{" "}
              feedback records (all employees)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`text-xs ${
                regionRecords.filter((r) => r.cesScore < 30).length > 0
                  ? "border-red-300 text-red-700 bg-red-50"
                  : "border-emerald-300 text-emerald-700 bg-emerald-50"
              }`}
            >
              {regionRecords.filter((r) => r.cesScore < 30).length} negative
              feedback
            </Badge>
            {pendingExportGate && (
              <PasswordGate
                gateKey="export"
                onUnlock={() => {
                  setPendingExportGate(false);
                  handleExportRegion();
                }}
                onCancel={() => setPendingExportGate(false)}
              />
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                if (exportGranted) handleExportRegion();
                else setPendingExportGate(true);
              }}
              data-ocid="regional.export_button"
              className="h-8 px-3 text-xs gap-1.5 border-indigo-300 text-indigo-700 bg-background hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export Region Report
            </Button>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div
        className="flex items-center gap-1 overflow-x-auto pb-1 border-b"
        role="tablist"
      >
        {TAB_CONFIG.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
            data-ocid={`regional.tab.${id}`}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
              activeTab === id
                ? "bg-background text-foreground border border-b-background border-border -mb-px shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div data-ocid={`regional.panel.${activeTab}`}>
        {activeTab === "employees" && (
          <EmployeesTab
            employees={regionEmployees}
            onSelectEmployee={onSelectEmployee}
          />
        )}
        {activeTab === "sales" && (
          <SalesAnalysisTab
            selectedRegion={selectedRegion}
            allRegions={allRegions}
          />
        )}
        {activeTab === "feedback" && (
          <FeedbackAnalysisTab
            records={regionRecords}
            employees={regionEmployees}
            onSelectEmployee={onSelectEmployee}
          />
        )}
        {activeTab === "issues" && (
          <IssueDrilldownTab
            records={regionRecords}
            employees={regionEmployees}
            onSelectEmployee={onSelectEmployee}
          />
        )}
        {activeTab === "emp-feedback" && (
          <EmpFeedbackBreakdownTab
            records={regionRecords}
            employees={regionEmployees}
            onSelectEmployee={onSelectEmployee}
          />
        )}
      </div>
    </div>
  );
}
