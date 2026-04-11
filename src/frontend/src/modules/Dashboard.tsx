import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { useMemo } from "react";
import { useLabels } from "../contexts/UILabelsContext";
import { useGoogleSheetData } from "../hooks/useGoogleSheetData";
import { useAllSales } from "../hooks/useGoogleSheetSales";

function formatLastRefreshed(date: Date | null): string {
  if (!date) return "Never";
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 10) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

function formatRupeeAmount(amount: number): string {
  if (amount >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(1)}Cr`;
  if (amount >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount}`;
}

function parseSaleYear(dateStr: string): number {
  if (!dateStr) return Number.NaN;
  const v = dateStr
    .replace(/\uFEFF|\u00A0|\u200B|\u200C|\u200D|\uFFFE|\r|\t/g, "")
    .trim();
  // ISO with T — extract YYYY from date portion (local, not UTC)
  if (v.includes("T")) return Number.parseInt(v.split("T")[0].split("-")[0]);
  // YYYY-MM-DD
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return Number.parseInt(iso[1]);
  // DD-MM-YYYY or DD/MM/YYYY
  const ddmm = v.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (ddmm) return Number.parseInt(ddmm[3]);
  return Number.NaN;
}

function parseSaleYearMonth(dateStr: string): { year: number; month: number } {
  if (!dateStr) return { year: Number.NaN, month: Number.NaN };
  const v = dateStr
    .replace(/\uFEFF|\u00A0|\u200B|\u200C|\u200D|\uFFFE|\r|\t/g, "")
    .trim();
  if (!v) return { year: Number.NaN, month: Number.NaN };

  // ISO string with T — parse the date portion before T (local date, avoids UTC shift)
  if (v.includes("T")) {
    const datePart = v.split("T")[0]; // "YYYY-MM-DD"
    const parts = datePart.split("-").map(Number);
    if (parts.length >= 3 && parts[0] > 31)
      return { year: parts[0], month: parts[1] };
    // Fallback to UTC
    const d = new Date(v);
    if (!Number.isNaN(d.getTime()))
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
    return { year: Number.NaN, month: Number.NaN };
  }
  // DD-MM-YYYY or DD/MM/YYYY
  const ddmm = v.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (ddmm)
    return { year: Number.parseInt(ddmm[3]), month: Number.parseInt(ddmm[2]) };
  // YYYY-MM-DD
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso)
    return { year: Number.parseInt(iso[1]), month: Number.parseInt(iso[2]) };
  return { year: Number.NaN, month: Number.NaN };
}

function StatCard({
  title,
  value,
  icon: Icon,
  loading,
  accent,
  onClick,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  loading?: boolean;
  accent?: string;
  onClick?: () => void;
}) {
  return (
    <Card
      className={`flex-1 ${onClick ? "cursor-pointer hover:shadow-md transition-shadow hover:ring-1 hover:ring-primary/30" : ""}`}
      onClick={onClick}
      data-ocid={onClick ? "dashboard.clickable_stat" : undefined}
    >
      <CardContent className="pt-5 pb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
              {title}
            </p>
            {loading ? (
              <Skeleton className="h-8 w-20 mt-1" />
            ) : (
              <p
                className={`text-3xl font-bold ${accent ?? "text-foreground"}`}
              >
                {value}
              </p>
            )}
            {onClick && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <span>View Sales Trend →</span>
              </p>
            )}
          </div>
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              accent ? "bg-current/10" : "bg-muted"
            }`}
          >
            <Icon size={20} className={accent ?? "text-muted-foreground"} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getRankRowClass(rank: number): string {
  if (rank === 1) return "bg-amber-50/50 dark:bg-amber-950/20";
  if (rank === 2) return "bg-slate-50/50 dark:bg-slate-900/20";
  if (rank === 3) return "bg-orange-50/50 dark:bg-orange-950/20";
  return "";
}

function getRankBadge(rank: number) {
  if (rank === 1)
    return <span className="text-amber-500 font-bold text-base">🥇</span>;
  if (rank === 2)
    return <span className="text-slate-400 font-bold text-base">🥈</span>;
  if (rank === 3)
    return <span className="text-orange-500 font-bold text-base">🥉</span>;
  return (
    <span className="text-muted-foreground text-sm font-medium">#{rank}</span>
  );
}

export default function Dashboard({
  onSelectEmployee,
  onNavigateToSales,
}: {
  onSelectEmployee?: (fiplCode: string) => void;
  onNavigateToSales?: () => void;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching, isError } = useGoogleSheetData();
  const { data: allSalesRecords = [], isLoading: salesLoading } = useAllSales();

  const activeCount = data?.activeCount ?? 0;
  const topPerformers = data?.topPerformers ?? [];

  const { labels } = useLabels();

  // ── Sales KPIs ────────────────────────────────────────────────────────────
  const { lastMonthSales, lastMonthLabel, currentYearSales } = useMemo(() => {
    const currentYear = new Date().getFullYear();
    let currentYearTotal = 0;

    // Find max year+month using year*12+month for unambiguous numeric comparison
    let maxNumeric = -1;
    let maxYear = -1;
    let maxMonth = -1;
    for (const s of allSalesRecords) {
      const { year, month } = parseSaleYearMonth(s.date);
      if (Number.isNaN(year) || Number.isNaN(month)) continue;
      if (year < 1900 || month < 1 || month > 12) continue;
      const numeric = year * 12 + month;
      if (numeric > maxNumeric) {
        maxNumeric = numeric;
        maxYear = year;
        maxMonth = month;
      }
    }

    let lastMonthTotal = 0;
    const MONTHS = [
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

    for (const s of allSalesRecords) {
      const { year, month } = parseSaleYearMonth(s.date);
      if (Number.isNaN(year)) continue;
      if (year === maxYear && month === maxMonth) lastMonthTotal += s.amount;
      const sYear = parseSaleYear(s.date);
      if (sYear === currentYear) currentYearTotal += s.amount;
    }

    const lbl =
      maxYear > 0 && maxMonth > 0 ? `${MONTHS[maxMonth - 1]} ${maxYear}` : "—";

    return {
      lastMonthSales: lastMonthTotal,
      lastMonthLabel: lbl,
      currentYearSales: currentYearTotal,
    };
  }, [allSalesRecords]);

  const combinedLoading = isLoading || salesLoading;

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ["allEmployeeData"] });
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
            data-ocid="dashboard.primary_button"
            className="gap-2"
          >
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
            Refresh
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{labels.dashboardTitle}</h1>
            <p className="text-sm text-muted-foreground">
              {labels.dashboardSubtitle}
            </p>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Last updated:{" "}
          <span className="font-medium">
            {formatLastRefreshed(data?.lastRefreshed ?? null)}
          </span>
        </div>
      </div>

      {/* Error Banner */}
      {isError && (
        <div
          data-ocid="dashboard.error_state"
          className="flex items-center gap-2 px-4 py-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm"
        >
          <AlertTriangle size={16} className="shrink-0" />
          Could not load data from Google Sheets. Retrying automatically.
        </div>
      )}

      {/* Stat Cards — 3 cards: Active, Last Month Sales, This Year Sales */}
      <div className="flex gap-4">
        <StatCard
          title={labels.statActiveCount}
          value={combinedLoading ? "—" : activeCount.toString()}
          icon={Activity}
          loading={combinedLoading}
          accent="text-emerald-600"
        />
        <StatCard
          title={`Total Sales (${lastMonthLabel})`}
          value={combinedLoading ? "—" : formatRupeeAmount(lastMonthSales)}
          icon={TrendingUp}
          loading={combinedLoading}
          accent="text-indigo-600"
          onClick={onNavigateToSales}
        />
        <StatCard
          title={`Total Sales (${new Date().getFullYear()})`}
          value={combinedLoading ? "—" : formatRupeeAmount(currentYearSales)}
          icon={TrendingUp}
          loading={combinedLoading}
          accent="text-violet-600"
          onClick={onNavigateToSales}
        />
      </div>

      {/* Top 10 Performers — Read from "Top Performers" sheet */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Trophy size={16} className="text-amber-500" />
              {labels.topPerformersSectionHeader}
            </CardTitle>
            <Badge
              variant="secondary"
              className="text-xs font-normal shrink-0"
              data-ocid="dashboard.performers_source_badge"
            >
              Live Sheet
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {combinedLoading ? (
            <div className="space-y-3 p-4">
              {["a", "b", "c", "d", "e"].map((k) => (
                <Skeleton key={k} className="h-10" />
              ))}
            </div>
          ) : topPerformers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm">
              <Trophy size={32} className="opacity-20 mb-2" />
              No sales data available for top performers calculation.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs w-14">Rank</TableHead>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">FIPL Code</TableHead>
                    <TableHead className="text-xs">Region</TableHead>
                    <TableHead className="text-xs text-right">
                      Total Sales (₹)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topPerformers.map((p, i) => {
                    const rank = p.rank || i + 1;
                    return (
                      <TableRow
                        key={p.fiplCode}
                        className={getRankRowClass(rank)}
                        data-ocid={`dashboard.item.${i + 1}`}
                      >
                        <TableCell>{getRankBadge(rank)}</TableCell>
                        <TableCell className="font-medium text-sm">
                          {onSelectEmployee && p.fiplCode ? (
                            <button
                              type="button"
                              className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer font-medium text-left"
                              onClick={() => onSelectEmployee(p.fiplCode)}
                              data-ocid={`dashboard.performer_name.${i + 1}`}
                            >
                              {p.name}
                            </button>
                          ) : (
                            p.name
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {p.fiplCode}
                        </TableCell>
                        <TableCell className="text-sm">
                          {p.region || (
                            <span className="text-muted-foreground text-xs">
                              N/A
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-right font-semibold">
                          ₹{p.totalSales.toLocaleString("en-IN")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
