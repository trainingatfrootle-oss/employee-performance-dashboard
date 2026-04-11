import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  ChevronDown,
  Search,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLabels } from "../contexts/UILabelsContext";
import { useGoogleSheetEmployees } from "../hooks/useGoogleSheetEmployees";
import { useGoogleSheetSales } from "../hooks/useGoogleSheetSales";

// ─── Constants ───────────────────────────────────────────────────────────────

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

const MONTH_LABELS = [
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

const PAGE_SIZE = 15;
type ViewMode = "yearly" | "half-yearly" | "monthly" | "weekly" | "daily";

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatRupees(n: number): string {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1)}Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n}`;
}

function parseDateParts(dateStr: string): {
  year: number;
  month: number;
  day: number;
} {
  if (!dateStr) return { year: Number.NaN, month: Number.NaN, day: Number.NaN };
  const v = dateStr.trim();
  if (v.includes("T")) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) {
      return {
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        day: d.getDate(),
      };
    }
  }
  const parts = v.split("-").map(Number);
  if (parts[0] > 31) return { year: parts[0], month: parts[1], day: parts[2] };
  return { year: parts[2], month: parts[1], day: parts[0] };
}

function getIsoWeek(dateStr: string): { week: number; year: number } {
  const { year, month, day } = parseDateParts(dateStr);
  if (Number.isNaN(year)) return { week: 0, year: 0 };
  const d = new Date(year, month - 1, day);
  const jan1 = new Date(year, 0, 1);
  const dayOfYear = Math.ceil((d.getTime() - jan1.getTime()) / 86400000) + 1;
  const week = Math.ceil((dayOfYear + jan1.getDay()) / 7);
  return { week, year };
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "—";
  if (dateStr.includes("T")) {
    const d = new Date(dateStr);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
  }
  return dateStr;
}

// ─── Custom FSE Combobox ───────────────────────────────────────────────────────────

interface FSEOption {
  fiplCode: string;
  name: string;
  region: string;
}
interface FSEComboboxProps {
  options: FSEOption[];
  value: string;
  onChange: (code: string) => void;
}

function FSECombobox({ options, value, onChange }: FSEComboboxProps) {
  const [searchText, setSearchText] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedEmployee = options.find((o) => o.fiplCode === value);

  const filtered = useMemo(() => {
    const q = searchText.toLowerCase();
    if (!q) return options.slice(0, 30);
    return options
      .filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.fiplCode.toLowerCase().includes(q),
      )
      .slice(0, 30);
  }, [options, searchText]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        if (!value) setSearchText("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value]);

  return (
    <div ref={wrapperRef} className="relative" data-ocid="fse.select">
      <div
        className="flex items-center gap-2 border border-input bg-background rounded-md px-3 py-2 text-sm cursor-text"
        onClick={() => {
          setOpen(true);
          inputRef.current?.focus();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            setOpen(true);
            inputRef.current?.focus();
          }
        }}
        tabIndex={-1}
      >
        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          className="flex-1 outline-none bg-transparent placeholder:text-muted-foreground text-sm min-w-0"
          placeholder="Search FSE by name or FIPL..."
          value={selectedEmployee ? selectedEmployee.name : searchText}
          onChange={(e) => {
            setSearchText(e.target.value);
            if (value) onChange("");
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          data-ocid="fse.search_input"
        />
        {value ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
              setSearchText("");
              setOpen(false);
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </div>
      {open && (
        <div
          className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-56 overflow-y-auto"
          data-ocid="fse.popover"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
              No matches
            </div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.fiplCode}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2 ${o.fiplCode === value ? "bg-accent" : ""}`}
                onClick={() => {
                  onChange(o.fiplCode);
                  setSearchText("");
                  setOpen(false);
                }}
              >
                <span className="font-medium truncate">{o.name}</span>
                <span className="text-xs text-muted-foreground font-mono shrink-0">
                  {o.fiplCode}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────────────

function RupeesTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg px-4 py-3 shadow-xl text-sm">
      <p className="font-semibold text-foreground mb-2 border-b border-border pb-1.5">
        {label}
      </p>
      {payload.map((p) => (
        <p
          key={p.name}
          style={{ color: p.color ?? "#6366f1" }}
          className="text-xs font-medium"
        >
          {p.name}: ₹{Number(p.value).toLocaleString("en-IN")}
        </p>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────────

export default function SalesTrends() {
  const { labels } = useLabels();
  const { data: employees = [], isLoading: empLoading } =
    useGoogleSheetEmployees();
  const { data: allSales = [], isLoading: salesLoading } =
    useGoogleSheetSales();
  const isLoading = empLoading || salesLoading;

  const empMap = useMemo(() => {
    const m: Record<string, { name: string; region: string }> = {};
    for (const e of employees)
      m[e.fiplCode] = { name: e.name, region: e.region };
    return m;
  }, [employees]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    for (const s of allSales) {
      const { year } = parseDateParts(s.date);
      if (!Number.isNaN(year)) years.add(year);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [allSales]);

  const availableRegions = useMemo(() => {
    const regions = new Set<string>();
    for (const e of employees) if (e.region) regions.add(e.region);
    return Array.from(regions).sort();
  }, [employees]);

  // Filter state
  const [yearFilter, setYearFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [dayFilter, setDayFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [fseFilter, setFseFilter] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");
  // Transaction records additional filters
  const [txDateFilter, setTxDateFilter] = useState("all");
  const [txMonthFilter, setTxMonthFilter] = useState("all");
  const [txYearFilter, setTxYearFilter] = useState("all");
  const [txPage, setTxPage] = useState(0);

  // Filtered sales (for chart/stats)
  const filteredSales = useMemo(() => {
    return allSales.filter((s) => {
      const { year, month, day } = parseDateParts(s.date);
      if (yearFilter !== "all" && year !== Number(yearFilter)) return false;
      if (monthFilter !== "all" && month !== Number(monthFilter)) return false;
      if (dayFilter !== "all" && day !== Number(dayFilter)) return false;
      if (regionFilter !== "all") {
        const region = empMap[s.fiplCode]?.region || "";
        if (region !== regionFilter) return false;
      }
      if (fseFilter && s.fiplCode !== fseFilter) return false;
      return true;
    });
  }, [
    allSales,
    yearFilter,
    monthFilter,
    dayFilter,
    regionFilter,
    fseFilter,
    empMap,
  ]);

  // Available days/years for tx filters
  const txAvailableYears = useMemo(() => {
    const s = new Set<number>();
    for (const sale of filteredSales) {
      const { year } = parseDateParts(sale.date);
      if (!Number.isNaN(year)) s.add(year);
    }
    return Array.from(s).sort((a, b) => b - a);
  }, [filteredSales]);

  const txAvailableDays = useMemo(() => {
    const s = new Set<number>();
    for (const sale of filteredSales) {
      const { day } = parseDateParts(sale.date);
      if (!Number.isNaN(day)) s.add(day);
    }
    return Array.from(s).sort((a, b) => a - b);
  }, [filteredSales]);

  // Transaction-table-specific filtered sales
  const txFilteredSales = useMemo(() => {
    return filteredSales.filter((s) => {
      const { year, month, day } = parseDateParts(s.date);
      if (txYearFilter !== "all" && year !== Number(txYearFilter)) return false;
      if (txMonthFilter !== "all" && month !== Number(txMonthFilter))
        return false;
      if (txDateFilter !== "all" && day !== Number(txDateFilter)) return false;
      return true;
    });
  }, [filteredSales, txYearFilter, txMonthFilter, txDateFilter]);

  // Summary stats
  const totalAmount = useMemo(
    () => filteredSales.reduce((acc, s) => acc + s.amount, 0),
    [filteredSales],
  );
  const totalTransactions = filteredSales.length;
  const avgPerTransaction =
    totalTransactions > 0 ? Math.round(totalAmount / totalTransactions) : 0;

  // Chart 1: Sales Trend grouped by viewMode
  const trendData = useMemo(() => {
    if (viewMode === "weekly") {
      const acc: Record<string, number> = {};
      const order: string[] = [];
      for (const s of filteredSales) {
        const { week, year } = getIsoWeek(s.date);
        if (!week) continue;
        const key = `Wk${week} ${year}`;
        if (!(key in acc)) order.push(key);
        acc[key] = (acc[key] || 0) + s.amount;
      }
      // Sort by year then week
      order.sort((a, b) => {
        const [wa, ya] = a.replace("Wk", "").split(" ").map(Number);
        const [wb, yb] = b.replace("Wk", "").split(" ").map(Number);
        return ya !== yb ? ya - yb : wa - wb;
      });
      return order.map((period) => ({ period, amount: acc[period] }));
    }

    const acc: Record<string, number> = {};
    for (const s of filteredSales) {
      const { year, month, day } = parseDateParts(s.date);
      let key = "";
      if (viewMode === "yearly") {
        key = String(year);
      } else if (viewMode === "half-yearly") {
        const half = month <= 6 ? "H1" : "H2";
        key = yearFilter !== "all" ? half : `${half} ${year}`;
      } else if (viewMode === "monthly") {
        const label = MONTH_LABELS[month - 1];
        key = yearFilter !== "all" ? label : `${label} ${year}`;
      } else if (viewMode === "daily") {
        key = String(day).padStart(2, "0");
      }
      if (key) acc[key] = (acc[key] || 0) + s.amount;
    }
    const entries = Object.entries(acc);
    if (viewMode === "monthly" && yearFilter !== "all") {
      entries.sort(
        (a, b) => MONTH_LABELS.indexOf(a[0]) - MONTH_LABELS.indexOf(b[0]),
      );
    } else if (viewMode === "half-yearly" && yearFilter !== "all") {
      entries.sort((a) => (a[0] === "H1" ? -1 : 1));
    } else if (viewMode === "daily") {
      entries.sort((a, b) => Number(a[0]) - Number(b[0]));
    } else {
      entries.sort((a, b) => a[0].localeCompare(b[0]));
    }
    return entries.map(([period, amount]) => ({ period, amount }));
  }, [filteredSales, viewMode, yearFilter]);

  // All Years multi-line pivot data
  const allYearsData = useMemo(() => {
    if (yearFilter !== "all") return null;
    // Collect unique years in filteredSales
    const yearsSet = new Set<number>();
    for (const s of filteredSales) {
      const { year } = parseDateParts(s.date);
      if (!Number.isNaN(year)) yearsSet.add(year);
    }
    const years = Array.from(yearsSet).sort((a, b) => a - b);

    // Pivot: {month: 'Jan', 2023: amount, 2024: amount, ...}
    const pivot: Record<string, Record<number, number>> = {};
    for (const label of MONTH_LABELS) pivot[label] = {};

    for (const s of filteredSales) {
      const { year, month } = parseDateParts(s.date);
      if (Number.isNaN(year) || Number.isNaN(month)) continue;
      const label = MONTH_LABELS[month - 1];
      pivot[label][year] = (pivot[label][year] || 0) + s.amount;
    }

    const data = MONTH_LABELS.map((month) => {
      const row: Record<string, number | string> = { month };
      for (const y of years) row[String(y)] = pivot[month][y] || 0;
      return row;
    });

    return { data, years };
  }, [filteredSales, yearFilter]);

  const trendAverage = useMemo(() => {
    if (trendData.length === 0) return 0;
    return trendData.reduce((s, d) => s + d.amount, 0) / trendData.length;
  }, [trendData]);

  // Chart 2: Region-wise
  const regionData = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const s of filteredSales) {
      const region = empMap[s.fiplCode]?.region || "Unknown";
      acc[region] = (acc[region] || 0) + s.amount;
    }
    return Object.entries(acc)
      .map(([region, amount]) => ({ region, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredSales, empMap]);

  // Chart 3: FSE-wise top 10
  const fseData = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const s of filteredSales)
      acc[s.fiplCode] = (acc[s.fiplCode] || 0) + s.amount;
    return Object.entries(acc)
      .map(([code, amount]) => ({
        code,
        name: empMap[code]?.name || code,
        amount,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [filteredSales, empMap]);

  // Pagination for transaction records
  const txTotalPages = Math.ceil(txFilteredSales.length / PAGE_SIZE);
  const txPaginatedSales = txFilteredSales.slice(
    txPage * PAGE_SIZE,
    (txPage + 1) * PAGE_SIZE,
  );

  const fseOptions: FSEOption[] = employees.map((e) => ({
    fiplCode: e.fiplCode,
    name: e.name,
    region: e.region,
  }));

  const VIEW_MODES: { value: ViewMode; label: string }[] = [
    { value: "yearly", label: "Yearly" },
    { value: "half-yearly", label: "Half-Yearly" },
    { value: "monthly", label: "Monthly" },
    { value: "weekly", label: "Weekly" },
    { value: "daily", label: "Daily" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {labels.salesTrendsTitle}
            </h1>
            <p className="text-sm text-muted-foreground">
              {filteredSales.length} transactions &middot; ₹
              {totalAmount.toLocaleString("en-IN")} total
            </p>
          </div>
        </div>
      </motion.div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3" data-ocid="filters.panel">
            <Select
              value={yearFilter}
              onValueChange={(v) => {
                setYearFilter(v);
              }}
            >
              <SelectTrigger className="w-32" data-ocid="year.select">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent className="max-h-56 overflow-y-auto">
                <SelectItem value="all">All Years</SelectItem>
                {availableYears.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={monthFilter}
              onValueChange={(v) => {
                setMonthFilter(v);
                setDayFilter("all");
              }}
            >
              <SelectTrigger className="w-36" data-ocid="month.select">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent className="max-h-56 overflow-y-auto">
                <SelectItem value="all">All Months</SelectItem>
                {MONTH_LABELS.map((label, i) => (
                  <SelectItem key={label} value={String(i + 1)}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={dayFilter}
              onValueChange={(v) => {
                setDayFilter(v);
              }}
              disabled={monthFilter === "all"}
            >
              <SelectTrigger className="w-28" data-ocid="day.select">
                <SelectValue placeholder="Day" />
              </SelectTrigger>
              <SelectContent className="max-h-56 overflow-y-auto">
                <SelectItem value="all">All Days</SelectItem>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <SelectItem key={String(d)} value={String(d)}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={regionFilter}
              onValueChange={(v) => {
                setRegionFilter(v);
              }}
            >
              <SelectTrigger className="w-36" data-ocid="region.select">
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent className="max-h-56 overflow-y-auto">
                <SelectItem value="all">All Regions</SelectItem>
                {availableRegions.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="min-w-[220px] flex-1">
              <FSECombobox
                options={fseOptions}
                value={fseFilter}
                onChange={(v) => {
                  setFseFilter(v);
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Mode Toggle */}
      <div
        className="flex gap-1 p-1 bg-muted rounded-lg w-fit"
        data-ocid="view.tab"
      >
        {VIEW_MODES.map(({ value: mode, label }) => (
          <button
            key={mode}
            type="button"
            onClick={() => setViewMode(mode)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              viewMode === mode
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-ocid={`view.${mode}.tab`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {isLoading ? (
          [1, 2, 3].map((k) => (
            <Card key={k}>
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <Card className="border-l-4 border-l-indigo-500">
                <CardContent className="pt-5">
                  <p className="text-2xl font-bold tabular-nums">
                    ₹{totalAmount.toLocaleString("en-IN")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Total Amount
                  </p>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-l-4 border-l-emerald-500">
                <CardContent className="pt-5">
                  <p className="text-2xl font-bold tabular-nums">
                    {totalTransactions.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <BarChart3 className="w-3 h-3" /> Total Transactions
                  </p>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card className="border-l-4 border-l-amber-500">
                <CardContent className="pt-5">
                  <p className="text-2xl font-bold tabular-nums">
                    {avgPerTransaction > 0
                      ? `₹${avgPerTransaction.toLocaleString("en-IN")}`
                      : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Users className="w-3 h-3" /> Avg per Transaction
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </div>

      {/* Chart Tabs */}
      <Tabs defaultValue="trend" data-ocid="charts.tab">
        <TabsList className="mb-4">
          <TabsTrigger value="trend" data-ocid="charts.trend.tab">
            <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
            Sales Trend
          </TabsTrigger>
          <TabsTrigger value="region" data-ocid="charts.region.tab">
            <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
            Region-wise
          </TabsTrigger>
          <TabsTrigger value="fse" data-ocid="charts.fse.tab">
            <Users className="w-3.5 h-3.5 mr-1.5" />
            FSE-wise
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Sales Trend */}
        <TabsContent value="trend">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-500" />
                Total Sales Trend
                <Badge variant="outline" className="text-xs ml-auto capitalize">
                  {yearFilter === "all"
                    ? "All Years (Year vs Year)"
                    : viewMode === "half-yearly"
                      ? "Half-Yearly"
                      : viewMode}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[380px] w-full" />
              ) : yearFilter === "all" && allYearsData ? (
                /* ── All Years: multi-line year vs year comparison ── */
                allYearsData.data.every((d) =>
                  allYearsData.years.every(
                    (y) => (d[String(y)] as number) === 0,
                  ),
                ) ? (
                  <div
                    className="h-[380px] flex items-center justify-center text-muted-foreground text-sm"
                    data-ocid="trend_chart.empty_state"
                  >
                    No data for selected filters
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={380}>
                    <LineChart
                      data={allYearsData.data}
                      margin={{ top: 20, right: 48, bottom: 20, left: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis
                        tickFormatter={(v: number) => formatRupees(v)}
                        tick={{ fontSize: 11 }}
                        width={72}
                      />
                      <Tooltip content={<RupeesTooltip />} />
                      <Legend />
                      {allYearsData.years.map((year, idx) => (
                        <Line
                          key={year}
                          type="monotone"
                          dataKey={String(year)}
                          name={String(year)}
                          stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                          strokeWidth={2.5}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )
              ) : trendData.length === 0 ? (
                <div
                  className="h-[380px] flex items-center justify-center text-muted-foreground text-sm"
                  data-ocid="trend_chart.empty_state"
                >
                  No data for selected filters
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={380}>
                  <ComposedChart
                    data={trendData}
                    margin={{
                      top: 20,
                      right: 48,
                      bottom: trendData.length > 6 ? 50 : 20,
                      left: 10,
                    }}
                  >
                    <defs>
                      <linearGradient
                        id="salesGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#6366f1"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="100%"
                          stopColor="#6366f1"
                          stopOpacity={0.02}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
                    <XAxis
                      dataKey="period"
                      tick={{ fontSize: 12 }}
                      angle={trendData.length > 6 ? -20 : 0}
                      textAnchor={trendData.length > 6 ? "end" : "middle"}
                      height={50}
                    />
                    <YAxis
                      tickFormatter={(v: number) => formatRupees(v)}
                      tick={{ fontSize: 11 }}
                      width={72}
                    />
                    <Tooltip content={<RupeesTooltip />} />
                    <ReferenceLine
                      y={trendAverage}
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      label={{
                        value: "Avg",
                        position: "right",
                        fontSize: 11,
                        fill: "#f59e0b",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      name="Amount"
                      fill="url(#salesGradient)"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                    />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      name="Trend"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "#6366f1", strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: "#6366f1" }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Region-wise */}
        <TabsContent value="region">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-500" />
                Region-wise Sales
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : regionData.length === 0 ? (
                <div
                  className="h-[300px] flex items-center justify-center text-muted-foreground text-sm"
                  data-ocid="region_chart.empty_state"
                >
                  No data for selected filters
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={regionData}
                    margin={{ top: 5, right: 20, bottom: 24, left: 10 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-border"
                    />
                    <XAxis
                      dataKey="region"
                      tick={{ fontSize: 11 }}
                      angle={-15}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis
                      tickFormatter={(v: number) => formatRupees(v)}
                      tick={{ fontSize: 11 }}
                      width={72}
                    />
                    <Tooltip content={<RupeesTooltip />} />
                    <Bar
                      dataKey="amount"
                      name="Amount"
                      radius={[4, 4, 0, 0]}
                      label={{
                        position: "top",
                        formatter: (v: number) => formatRupees(v),
                        fontSize: 10,
                      }}
                    >
                      {regionData.map((entry, index) => (
                        <Cell
                          key={`cell-region-${entry.region}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: FSE-wise */}
        <TabsContent value="fse">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-violet-500" />
                FSE-wise Sales
                <span className="text-xs text-muted-foreground ml-auto">
                  Top 10
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : fseData.length === 0 ? (
                <div
                  className="h-[300px] flex items-center justify-center text-muted-foreground text-sm"
                  data-ocid="fse_chart.empty_state"
                >
                  No data for selected filters
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={fseData}
                    layout="vertical"
                    margin={{ top: 5, right: 60, bottom: 5, left: 10 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-border"
                    />
                    <XAxis
                      type="number"
                      tickFormatter={(v: number) => formatRupees(v)}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      width={120}
                      tickFormatter={(v: string) =>
                        v.length > 15 ? `${v.slice(0, 14)}…` : v
                      }
                    />
                    <Tooltip content={<RupeesTooltip />} />
                    <Bar
                      dataKey="amount"
                      name="Amount"
                      radius={[0, 4, 4, 0]}
                      label={{
                        position: "right",
                        formatter: (v: number) => formatRupees(v),
                        fontSize: 10,
                      }}
                    >
                      {fseData.map((entry, index) => (
                        <Cell
                          key={`cell-fse-${entry.code}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Transaction Records */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Transaction Records</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Transaction-specific filters */}
          <div
            className="flex flex-wrap gap-3 mb-4 pb-4 border-b"
            data-ocid="tx_filters.panel"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Filter records by:
              </span>
            </div>
            {/* Tx Year */}
            <Select
              value={txYearFilter}
              onValueChange={(v) => {
                setTxYearFilter(v);
                setTxPage(0);
              }}
            >
              <SelectTrigger className="w-32" data-ocid="tx_year.select">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent className="max-h-56 overflow-y-auto">
                <SelectItem value="all">All Years</SelectItem>
                {txAvailableYears.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Tx Month */}
            <Select
              value={txMonthFilter}
              onValueChange={(v) => {
                setTxMonthFilter(v);
                setTxPage(0);
              }}
            >
              <SelectTrigger className="w-36" data-ocid="tx_month.select">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent className="max-h-56 overflow-y-auto">
                <SelectItem value="all">All Months</SelectItem>
                {MONTH_LABELS.map((label, i) => (
                  <SelectItem key={label} value={String(i + 1)}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Tx Date */}
            <Select
              value={txDateFilter}
              onValueChange={(v) => {
                setTxDateFilter(v);
                setTxPage(0);
              }}
            >
              <SelectTrigger className="w-28" data-ocid="tx_date.select">
                <SelectValue placeholder="Date" />
              </SelectTrigger>
              <SelectContent className="max-h-56 overflow-y-auto">
                <SelectItem value="all">All Dates</SelectItem>
                {txAvailableDays.map((d) => (
                  <SelectItem key={String(d)} value={String(d)}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center ml-auto">
              <Badge variant="outline" className="text-xs font-normal">
                {txFilteredSales.length} results
              </Badge>
            </div>
          </div>

          {/* Records Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  {[
                    "Date",
                    "FSE",
                    "Region",
                    "Brand",
                    "Product",
                    "Type",
                    "Qty",
                    "Amount (₹)",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap text-xs uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center"
                      data-ocid="records_table.loading_state"
                    >
                      <div className="space-y-2">
                        {[1, 2, 3].map((k) => (
                          <Skeleton key={k} className="h-8 w-full" />
                        ))}
                      </div>
                    </td>
                  </tr>
                ) : txPaginatedSales.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-muted-foreground text-sm"
                      data-ocid="records_table.empty_state"
                    >
                      No records for the selected filters
                    </td>
                  </tr>
                ) : (
                  txPaginatedSales.map((s, idx) => {
                    const emp = empMap[s.fiplCode];
                    return (
                      <tr
                        key={`${s.fiplCode}-${idx}`}
                        className="border-b hover:bg-muted/20 transition-colors"
                        data-ocid={`records_table.item.${idx + 1}`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">
                          {formatDisplayDate(s.date)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-sm">
                            {emp?.name || s.name || s.fiplCode}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {s.fiplCode}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {emp?.region || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="text-xs">
                            {s.brand}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm max-w-[150px] truncate">
                          {s.product}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-xs">
                            {s.type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm tabular-nums">
                          {s.quantity}
                        </td>
                        <td className="px-4 py-3 font-semibold text-sm tabular-nums">
                          ₹{s.amount.toLocaleString("en-IN")}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {txTotalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t mt-4">
              <p className="text-xs text-muted-foreground">
                Page {txPage + 1} of {txTotalPages} &middot;{" "}
                {txFilteredSales.length} results
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-xs px-3 py-1.5 border rounded-md hover:bg-muted disabled:opacity-40 transition-colors"
                  disabled={txPage === 0}
                  onClick={() => setTxPage((p) => p - 1)}
                  data-ocid="records_table.pagination_prev"
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="text-xs px-3 py-1.5 border rounded-md hover:bg-muted disabled:opacity-40 transition-colors"
                  disabled={txPage >= txTotalPages - 1}
                  onClick={() => setTxPage((p) => p + 1)}
                  data-ocid="records_table.pagination_next"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
