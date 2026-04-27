import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  TrendingUp,
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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ISSUE_CATEGORIES, classifyIssue, formatDisplayDate } from "./Feedback";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DisplayRecord {
  id: string;
  fiplCode: string;
  fseName: string;
  customerName: string;
  brand: string;
  product: string;
  cesScore: number;
  remark: string;
  dateOfVisit: string;
  callDate: string;
  agent: string;
  source: "sheet" | "manual";
  typeOfIssue: string;
  resolution: string;
  region: string;
}

interface Props {
  selectedRegion: string;
  allRecords: DisplayRecord[];
  onBack: () => void;
  onSelectEmployee: (fiplCode: string) => void;
}

// ─── Chart Colors ─────────────────────────────────────────────────────────────

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

function getMonthKey(dateStr: string): string {
  const d = parseCallDate(dateStr);
  if (!d) return "Unknown";
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function getMonthOrder(key: string): number {
  const parts = key.split(" ");
  if (parts.length < 2) return 0;
  const year = Number(parts[1]);
  const month = MONTHS_SHORT.indexOf(parts[0]);
  return year * 12 + month;
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className={`rounded-lg border px-4 py-3 text-center ${color}`}>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs font-medium mt-0.5 opacity-75">{label}</div>
    </div>
  );
}

// ─── Employee Breakdown Card ──────────────────────────────────────────────────

interface FseStats {
  fiplCode: string;
  fseName: string;
  total: number;
  positive: number;
  negative: number;
  avgCes: number;
  topIssue: string;
  records: DisplayRecord[];
}

function EmployeeCard({
  stats,
  onSelectEmployee,
}: {
  stats: FseStats;
  onSelectEmployee: (fiplCode: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const monthlyData = useMemo(() => {
    const map: Record<
      string,
      { month: string; positive: number; negative: number }
    > = {};
    for (const r of stats.records) {
      const key = getMonthKey(r.dateOfVisit);
      if (!map[key]) map[key] = { month: key, positive: 0, negative: 0 };
      if (r.cesScore >= 30) map[key].positive++;
      else map[key].negative++;
    }
    return Object.values(map).sort(
      (a, b) => getMonthOrder(a.month) - getMonthOrder(b.month),
    );
  }, [stats.records]);

  const topIssues = useMemo(() => {
    const freq: Record<string, number> = {};
    for (const r of stats.records) {
      for (const cat of classifyIssue(r.typeOfIssue)) {
        freq[cat] = (freq[cat] ?? 0) + 1;
      }
    }
    return Object.entries(freq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);
  }, [stats.records]);

  const recentRecords = useMemo(
    () =>
      [...stats.records]
        .sort((a, b) => {
          const da = parseCallDate(a.dateOfVisit);
          const db = parseCallDate(b.dateOfVisit);
          return (db?.getTime() ?? 0) - (da?.getTime() ?? 0);
        })
        .slice(0, 3),
    [stats.records],
  );

  const negRate = stats.total > 0 ? stats.negative / stats.total : 0;
  const notablePattern =
    negRate > 0.6
      ? `Majority feedback is negative (${Math.round(negRate * 100)}%). Primary driver: ${stats.topIssue || "unclassified"}.`
      : stats.avgCes >= 30
        ? `Good CES performance. Average score: ${stats.avgCes.toFixed(1)}/40.`
        : "Mixed performance. Monitor closely.";

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="font-semibold text-sm text-primary hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              if (stats.fiplCode) onSelectEmployee(stats.fiplCode);
            }}
          >
            {stats.fseName || stats.fiplCode}
          </button>
          <span className="font-mono text-xs text-muted-foreground">
            {stats.fiplCode}
          </span>
          <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
            {stats.positive} positive
          </span>
          <span className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
            {stats.negative} negative
          </span>
          <span
            className={`text-xs rounded-full px-2 py-0.5 border font-semibold ${
              stats.avgCes >= 30
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-red-50 text-red-700 border-red-200"
            }`}
          >
            Avg {stats.avgCes.toFixed(1)}/40
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-t px-5 py-4 space-y-5 bg-muted/10">
          {/* Mini monthly chart */}
          {monthlyData.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Monthly Trend
              </p>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart
                  data={monthlyData}
                  margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar
                    dataKey="positive"
                    fill="#10b981"
                    name="Positive"
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar
                    dataKey="negative"
                    fill="#ef4444"
                    name="Negative"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top issues */}
          {topIssues.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Top Issues
              </p>
              <div className="flex flex-wrap gap-2">
                {topIssues.map(([key, count]) => {
                  const cat = ISSUE_CATEGORIES.find((c) => c.key === key);
                  return (
                    <span
                      key={key}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                        cat?.color ??
                        "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {cat?.label ?? key}
                      <span className="font-bold">{count}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent feedback */}
          {recentRecords.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Recent Feedback
              </p>
              <div className="space-y-2">
                {recentRecords.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-start gap-3 rounded-lg border bg-background px-3 py-2 text-sm"
                  >
                    <div className="shrink-0 mt-0.5">
                      <CesBadge score={r.cesScore} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
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
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {r.remark || "No remark"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notable pattern */}
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            💡 <span className="font-semibold">Pattern: </span>
            {notablePattern}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main RegionDetailPage ────────────────────────────────────────────────────

export default function RegionDetailPage({
  selectedRegion,
  allRecords,
  onBack,
  onSelectEmployee,
}: Props) {
  // Base filter: only records for this region
  const regionRecords = useMemo(
    () => allRecords.filter((r) => r.region === selectedRegion),
    [allRecords, selectedRegion],
  );

  // Local filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [issueCatFilter, setIssueCatFilter] = useState("all");
  const [cesFilter, setCesFilter] = useState<"all" | "positive" | "negative">(
    "all",
  );
  const [fseSort, setFseSort] = useState<
    "total" | "positive" | "negative" | "avgCes"
  >("negative");

  // Apply local filters on top of region records
  const filtered = useMemo(() => {
    return regionRecords.filter((r) => {
      if (dateFrom || dateTo) {
        const effectiveDate = r.dateOfVisit;
        const d = parseCallDate(effectiveDate);
        if (dateFrom) {
          const from = new Date(dateFrom);
          if (!d || d < from) return false;
        }
        if (dateTo) {
          const to = new Date(dateTo);
          to.setHours(23, 59, 59, 999);
          if (!d || d > to) return false;
        }
      }
      if (issueCatFilter !== "all") {
        const cats = classifyIssue(r.typeOfIssue);
        if (
          !cats.includes(
            issueCatFilter as (typeof ISSUE_CATEGORIES)[number]["key"],
          )
        ) {
          return false;
        }
      }
      if (cesFilter === "positive" && r.cesScore < 30) return false;
      if (cesFilter === "negative" && r.cesScore >= 30) return false;
      return true;
    });
  }, [regionRecords, dateFrom, dateTo, issueCatFilter, cesFilter]);

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setIssueCatFilter("all");
    setCesFilter("all");
  };

  // Summary stats
  const totalCount = filtered.length;
  const positiveCount = filtered.filter((r) => r.cesScore >= 30).length;
  const negativeCount = filtered.filter((r) => r.cesScore < 30).length;
  const avgCes =
    totalCount > 0
      ? filtered.reduce((s, r) => s + r.cesScore, 0) / totalCount
      : 0;

  // Chart 1: Monthly positive vs negative
  const monthlyData = useMemo(() => {
    const map: Record<
      string,
      { month: string; positive: number; negative: number }
    > = {};
    for (const r of filtered) {
      const key = getMonthKey(r.dateOfVisit);
      if (!map[key]) map[key] = { month: key, positive: 0, negative: 0 };
      if (r.cesScore >= 30) map[key].positive++;
      else map[key].negative++;
    }
    return Object.values(map).sort(
      (a, b) => getMonthOrder(a.month) - getMonthOrder(b.month),
    );
  }, [filtered]);

  const worstMonth = useMemo(() => {
    if (!monthlyData.length) return null;
    return monthlyData.reduce((w, m) => (m.negative > w.negative ? m : w));
  }, [monthlyData]);

  // Chart 2: Issue type breakdown
  const issueCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of filtered) {
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
  }, [filtered]);

  const topCategory = issueCounts[0] ?? null;

  // Chart 3: CES score distribution buckets
  const cesBuckets = useMemo(() => {
    const buckets = [
      { label: "0–9", min: 0, max: 9, count: 0, zone: "negative" },
      { label: "10–19", min: 10, max: 19, count: 0, zone: "negative" },
      { label: "20–29", min: 20, max: 29, count: 0, zone: "negative" },
      { label: "30–49", min: 30, max: 49, count: 0, zone: "positive" },
      { label: "50–69", min: 50, max: 69, count: 0, zone: "positive" },
      { label: "70–100", min: 70, max: 100, count: 0, zone: "positive" },
    ];
    for (const r of filtered) {
      for (const b of buckets) {
        if (r.cesScore >= b.min && r.cesScore <= b.max) {
          b.count++;
          break;
        }
      }
    }
    return buckets;
  }, [filtered]);

  // FSE performance table
  const fseStats = useMemo((): FseStats[] => {
    const map: Record<string, FseStats> = {};
    for (const r of filtered) {
      const key = r.fiplCode || r.fseName || "Unknown";
      if (!map[key]) {
        map[key] = {
          fiplCode: r.fiplCode,
          fseName: r.fseName,
          total: 0,
          positive: 0,
          negative: 0,
          avgCes: 0,
          topIssue: "",
          records: [],
        };
      }
      map[key].total++;
      if (r.cesScore >= 30) map[key].positive++;
      else map[key].negative++;
      map[key].records.push(r);
    }
    // Compute avgCes & topIssue
    for (const stats of Object.values(map)) {
      const total = stats.records.reduce((s, r) => s + r.cesScore, 0);
      stats.avgCes =
        stats.records.length > 0 ? total / stats.records.length : 0;
      const freq: Record<string, number> = {};
      for (const r of stats.records) {
        for (const cat of classifyIssue(r.typeOfIssue)) {
          freq[cat] = (freq[cat] ?? 0) + 1;
        }
      }
      const top = Object.entries(freq).sort(([, a], [, b]) => b - a)[0];
      stats.topIssue = top
        ? (ISSUE_CATEGORIES.find((c) => c.key === top[0])?.label ?? top[0])
        : "—";
    }

    const list = Object.values(map);
    return list.sort((a, b) => {
      if (fseSort === "total") return b.total - a.total;
      if (fseSort === "positive") return b.positive - a.positive;
      if (fseSort === "negative") return b.negative - a.negative;
      return b.avgCes - a.avgCes;
    });
  }, [filtered, fseSort]);

  // Recent negative feed (last 10)
  const recentNegative = useMemo(
    () =>
      [...filtered]
        .filter((r) => r.cesScore < 30)
        .sort((a, b) => {
          const da = parseCallDate(a.dateOfVisit);
          const db = parseCallDate(b.dateOfVisit);
          return (db?.getTime() ?? 0) - (da?.getTime() ?? 0);
        })
        .slice(0, 10),
    [filtered],
  );

  const hasFilters =
    dateFrom || dateTo || issueCatFilter !== "all" || cesFilter !== "all";

  if (regionRecords.length === 0) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Feedback
        </button>
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <p className="text-lg font-medium">
            No feedback records found for {selectedRegion}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ─── HEADER ─────────────────────────────────────────────────────── */}
      <div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          data-ocid="region_detail.back_button"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Feedback
        </button>
        <h1 className="text-2xl font-bold tracking-tight">
          📍 {selectedRegion} Region — Feedback Analysis
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Deep-dive into customer feedback, issue patterns, and FSE performance
          for this region
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <SummaryBadge
            label="Total Feedback"
            value={totalCount.toLocaleString()}
            color="bg-card border-border text-foreground"
          />
          <SummaryBadge
            label="Positive (CES ≥30)"
            value={positiveCount.toLocaleString()}
            color="bg-emerald-50 border-emerald-200 text-emerald-800"
          />
          <SummaryBadge
            label="Negative (CES <30)"
            value={negativeCount.toLocaleString()}
            color="bg-red-50 border-red-200 text-red-800"
          />
          <SummaryBadge
            label="Avg CES Score"
            value={`${avgCes.toFixed(1)}/40`}
            color={
              avgCes >= 30
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            }
          />
        </div>
      </div>

      {/* ─── FILTERS ────────────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold">Filters</span>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-muted-foreground hover:text-foreground underline"
              data-ocid="region_detail.clear_filters"
            >
              Clear All
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <label
              htmlFor="date-from"
              className="text-xs text-muted-foreground whitespace-nowrap"
            >
              From
            </label>
            <Input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-36 h-8 text-xs"
              data-ocid="region_detail.date_from"
            />
          </div>
          <div className="flex items-center gap-2">
            <label
              htmlFor="date-to"
              className="text-xs text-muted-foreground whitespace-nowrap"
            >
              To
            </label>
            <Input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-36 h-8 text-xs"
              data-ocid="region_detail.date_to"
            />
          </div>
          <Select value={issueCatFilter} onValueChange={setIssueCatFilter}>
            <SelectTrigger
              className="w-48 h-8 text-xs"
              data-ocid="region_detail.issue_filter"
            >
              <SelectValue placeholder="All Issue Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Issue Types</SelectItem>
              {ISSUE_CATEGORIES.map((cat) => (
                <SelectItem key={cat.key} value={cat.key}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={cesFilter}
            onValueChange={(v) =>
              setCesFilter(v as "all" | "positive" | "negative")
            }
          >
            <SelectTrigger
              className="w-44 h-8 text-xs"
              data-ocid="region_detail.ces_filter"
            >
              <SelectValue placeholder="All Feedbacks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Feedbacks</SelectItem>
              <SelectItem value="positive">Positive (CES ≥30)</SelectItem>
              <SelectItem value="negative">Negative (CES &lt;30)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ─── CHART 1: Monthly Positive vs Negative ──────────────────────── */}
      <div
        className="rounded-xl border bg-card shadow-sm p-5"
        data-ocid="region_detail.monthly_chart"
      >
        <h2 className="text-base font-semibold mb-1">
          📊 Monthly Positive vs Negative Feedback Trend
        </h2>
        {worstMonth && worstMonth.negative > 0 && (
          <p className="text-xs text-muted-foreground mb-4">
            <TrendingDown className="w-3 h-3 inline mr-1 text-red-500" />
            {worstMonth.month} had the highest negative feedback (
            <span className="font-semibold text-red-600">
              {worstMonth.negative}
            </span>{" "}
            cases).
          </p>
        )}
        {monthlyData.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">
            No data for this period
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={monthlyData}
              margin={{ top: 5, right: 20, left: 0, bottom: 30 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11 }}
                angle={-30}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} />
              <Bar
                dataKey="positive"
                name="Positive"
                fill="#10b981"
                radius={[3, 3, 0, 0]}
              />
              <Bar
                dataKey="negative"
                name="Negative"
                fill="#ef4444"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ─── CHARTS 2 & 3: Issue Distribution + CES Distribution ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 2: Issue Type Breakdown */}
        <div
          className="rounded-xl border bg-card shadow-sm p-5"
          data-ocid="region_detail.issue_chart"
        >
          <h2 className="text-base font-semibold mb-1">
            🔍 Issue Type Distribution
          </h2>
          {topCategory && (
            <p className="text-xs text-muted-foreground mb-4">
              <TrendingDown className="w-3 h-3 inline mr-1 text-violet-500" />
              Top issue:{" "}
              <span className="font-semibold text-violet-700">
                {topCategory.name}
              </span>{" "}
              ({topCategory.count} records,{" "}
              {totalCount > 0
                ? Math.round((topCategory.count / totalCount) * 100)
                : 0}
              % of all feedback)
            </p>
          )}
          {issueCounts.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              No issue classifications found
            </p>
          ) : (
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
          )}
        </div>

        {/* Chart 3: CES Score Distribution */}
        <div
          className="rounded-xl border bg-card shadow-sm p-5"
          data-ocid="region_detail.ces_chart"
        >
          <h2 className="text-base font-semibold mb-1">
            📈 CES Score Distribution
          </h2>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs text-muted-foreground">Average CES:</span>
            <span
              className={`text-lg font-bold ${
                avgCes >= 30 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {avgCes.toFixed(1)}/40
            </span>
            {avgCes >= 30 ? (
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={cesBuckets}
              margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" name="Records" radius={[3, 3, 0, 0]}>
                {cesBuckets.map((b) => (
                  <Cell
                    key={b.label}
                    fill={b.zone === "negative" ? "#ef4444" : "#10b981"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="w-3 h-3 rounded-sm bg-red-400 inline-block" />
              Negative zone (&lt;30)
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="w-3 h-3 rounded-sm bg-emerald-400 inline-block" />
              Positive zone (≥30)
            </span>
          </div>
        </div>
      </div>

      {/* ─── FSE PERFORMANCE TABLE ───────────────────────────────────────── */}
      <div
        className="rounded-xl border bg-card shadow-sm overflow-hidden"
        data-ocid="region_detail.fse_table"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-base font-semibold">
            👥 FSE Performance in {selectedRegion}
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Sort by:</span>
            <Select
              value={fseSort}
              onValueChange={(v) =>
                setFseSort(v as "total" | "positive" | "negative" | "avgCes")
              }
            >
              <SelectTrigger
                className="w-36 h-8 text-xs"
                data-ocid="region_detail.sort_select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="total">Total Feedback</SelectItem>
                <SelectItem value="positive">Most Positive</SelectItem>
                <SelectItem value="negative">Most Negative</SelectItem>
                <SelectItem value="avgCes">Avg CES Score</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {fseStats.length === 0 ? (
          <p className="px-5 py-10 text-center text-muted-foreground text-sm">
            No FSE data found for this region
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  {[
                    "FSE Name",
                    "FIPL Code",
                    "Total",
                    "Positive",
                    "Negative",
                    "Avg CES",
                    "Top Issue",
                    "Action",
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
                {fseStats.map((s) => {
                  const negRate = s.total > 0 ? s.negative / s.total : 0;
                  const negCellClass =
                    s.negative > 5
                      ? "text-red-700 font-semibold"
                      : s.negative >= 2
                        ? "text-amber-700 font-semibold"
                        : "text-emerald-700 font-semibold";
                  return (
                    <tr
                      key={s.fiplCode || s.fseName}
                      className="hover:bg-muted/20 transition-colors"
                      data-ocid={`region_detail.fse_row.${(s.fiplCode || "").toLowerCase()}`}
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            s.fiplCode && onSelectEmployee(s.fiplCode)
                          }
                          className="font-medium text-primary hover:underline text-left"
                        >
                          {s.fseName || "—"}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {s.fiplCode}
                      </td>
                      <td className="px-4 py-3 text-center font-medium">
                        {s.total.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center text-emerald-700 font-semibold">
                        {s.positive.toLocaleString()}
                      </td>
                      <td className={`px-4 py-3 text-center ${negCellClass}`}>
                        {s.negative.toLocaleString()}
                      </td>
                      <td
                        className={`px-4 py-3 text-center font-semibold ${
                          s.avgCes >= 30 ? "text-emerald-700" : "text-red-700"
                        }`}
                      >
                        {s.avgCes.toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {s.topIssue}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {negRate > 0.5 ? (
                          <Badge
                            variant="outline"
                            className="text-xs bg-red-50 text-red-700 border-red-300"
                          >
                            ⚠️ Review Required
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-xs bg-emerald-50 text-emerald-700 border-emerald-300"
                          >
                            ✅ On Track
                          </Badge>
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

      {/* ─── INDIVIDUAL EMPLOYEE BREAKDOWN ──────────────────────────────── */}
      <div data-ocid="region_detail.employee_breakdown">
        <h2 className="text-base font-semibold mb-3">
          🔎 Individual Employee Breakdown
        </h2>
        {fseStats.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No employee data available
          </p>
        ) : (
          <div className="space-y-3">
            {fseStats.map((s) => (
              <EmployeeCard
                key={s.fiplCode || s.fseName}
                stats={s}
                onSelectEmployee={onSelectEmployee}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── RECENT NEGATIVE FEEDBACK FEED ──────────────────────────────── */}
      <div
        className="rounded-xl border bg-card shadow-sm overflow-hidden"
        data-ocid="region_detail.recent_negative"
      >
        <div className="px-5 py-4 border-b bg-red-50/60">
          <h2 className="text-base font-semibold text-red-800">
            ⚠️ Recent Negative Feedback (Last 10)
          </h2>
          <p className="text-xs text-red-600 mt-0.5">
            CES &lt;30, sorted by most recent
          </p>
        </div>
        {recentNegative.length === 0 ? (
          <p className="px-5 py-10 text-center text-muted-foreground text-sm">
            No negative feedback records in this view
          </p>
        ) : (
          <div className="divide-y">
            {recentNegative.map((r) => (
              <NegativeFeedItem key={r.id} record={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Negative Feed Item ───────────────────────────────────────────────────────

function NegativeFeedItem({ record: r }: { record: DisplayRecord }) {
  const [expanded, setExpanded] = useState(false);
  const cats = useMemo(() => classifyIssue(r.typeOfIssue), [r.typeOfIssue]);

  return (
    <div
      className="px-5 py-3 hover:bg-red-50/30 transition-colors"
      data-ocid={`region_detail.neg_item.${r.id}`}
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="shrink-0 mt-0.5">
          <CesBadge score={r.cesScore} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground font-medium">
              {formatDisplayDate(r.dateOfVisit)}
            </span>
            <span className="text-sm font-semibold">{r.customerName}</span>
            <span className="text-xs text-muted-foreground">
              FSE: {r.fseName || r.fiplCode}
            </span>
            <span className="text-xs text-muted-foreground">{r.product}</span>
          </div>
          <div className="flex flex-wrap gap-1 mb-1">
            {cats.map((cat) => {
              const category = ISSUE_CATEGORIES.find((c) => c.key === cat);
              return (
                <span
                  key={cat}
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                    category?.color ??
                    "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  {category?.label ?? cat}
                </span>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="text-xs text-muted-foreground hover:text-foreground text-left transition-colors"
          >
            {expanded ? (
              <span>{r.remark || "No remark"}</span>
            ) : (
              <span className="line-clamp-1">
                {r.remark || "No remark"}{" "}
                {r.remark && r.remark.length > 80 && (
                  <span className="text-primary underline">read more</span>
                )}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
