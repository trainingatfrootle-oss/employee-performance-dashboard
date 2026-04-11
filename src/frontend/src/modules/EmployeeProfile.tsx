import { PersonalityPentagon } from "@/components/PersonalityPentagon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  UserCircle2,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEmployees } from "../hooks/useAllEmployeeData";

const MONTH_NAMES = [
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

const CHART_COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

function categoryBadgeClass(cat: string) {
  if (cat === "Star") return "bg-amber-100 text-amber-800 border-amber-200";
  if (cat === "Cash Cow") return "bg-green-100 text-green-800 border-green-200";
  if (cat === "Question Mark")
    return "bg-blue-100 text-blue-800 border-blue-200";
  if (cat === "Dog") return "bg-gray-100 text-gray-700 border-gray-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function getInitials(name: string) {
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatIndianCurrency(amount: number) {
  if (!Number.isFinite(amount) || amount === 0) return "₹0";
  const s = Math.round(amount).toString();
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const formatted = rest
    ? `${rest.replace(/(\d)(?=(\d{2})+$)/g, "$1,")},${last3}`
    : last3;
  return `₹${formatted}`;
}

function CollapsibleSection({
  title,
  subtitle,
  children,
  defaultOpen = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <button
        type="button"
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors rounded-t-lg"
        onClick={() => setOpen((o) => !o)}
        data-ocid="employees.toggle"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-foreground">{title}</span>
          {subtitle && (
            <span className="text-sm text-muted-foreground">{subtitle}</span>
          )}
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {open && <CardContent className="pt-0 pb-4">{children}</CardContent>}
    </Card>
  );
}

// Helper: parse date string to { year, month } safely
function parseSaleDate(dateStr: string | null): {
  year: number;
  month: number;
} {
  if (!dateStr) return { year: Number.NaN, month: Number.NaN };
  // ISO format
  if (dateStr.includes("T")) {
    const d = new Date(dateStr);
    if (!Number.isNaN(d.getTime()))
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }
  const parts = dateStr.split("-").map(Number);
  if (parts.length === 3) {
    if (parts[0] > 31) return { year: parts[0], month: parts[1] }; // YYYY-MM-DD
    return { year: parts[2], month: parts[1] }; // DD-MM-YYYY
  }
  return { year: Number.NaN, month: Number.NaN };
}

export default function EmployeeProfile({
  fiplCode,
  onBack,
}: {
  fiplCode: string;
  onBack: () => void;
}) {
  const { data: employees = [] } = useEmployees();
  const employee = employees.find((e) => e.fiplCode === fiplCode) ?? null;
  const perf = employee?.performance ?? null;
  const swot = employee?.swot ?? null;
  const sales = employee?.sales ?? [];
  const attendance = employee?.attendance ?? [];
  const feedback = employee?.feedback ?? [];

  // Feedback filter state
  const [feedbackFilter, setFeedbackFilter] = useState<
    "all" | "positive" | "negative"
  >("all");
  // Selected feedback for dialog
  const [selectedFeedback, setSelectedFeedback] = useState<
    (typeof feedback)[0] | null
  >(null);

  // Sales filter state (for table)
  const [salesYearFilter, setSalesYearFilter] = useState("all");
  const [salesMonthFilter, setSalesMonthFilter] = useState("all");

  // Attendance filter state
  const [attendanceYear, setAttendanceYear] = useState("all");
  const [attendanceMonth, setAttendanceMonth] = useState("all");

  // Chart tab state
  const [chartYear, setChartYear] = useState("all");

  const efficiencyScore = useMemo(() => {
    if (!perf) return null;
    const avg =
      (perf.salesInfluenceIndex +
        perf.operationalDiscipline +
        perf.productKnowledgeScore +
        perf.softSkillScore) /
      4;
    return Math.round(avg * 10) / 10;
  }, [perf]);

  const totalSales = useMemo(
    () => sales.reduce((s, r) => s + r.amount, 0),
    [sales],
  );

  // Derive available years from sales data
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    for (const s of sales) {
      const { year } = parseSaleDate(s.date);
      if (!Number.isNaN(year)) years.add(year.toString());
    }
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [sales]);

  // Default chartYear to most recent year once data loads
  const effectiveChartYear =
    chartYear === "all" ? (availableYears[0] ?? "all") : chartYear;

  // Derive available months for the selected year (for table filter)
  const availableMonths = useMemo(() => {
    const months = new Set<number>();
    for (const s of sales) {
      const { year, month } = parseSaleDate(s.date);
      if (Number.isNaN(year) || Number.isNaN(month)) continue;
      if (salesYearFilter !== "all" && year.toString() !== salesYearFilter)
        continue;
      months.add(month - 1); // 0-indexed for MONTH_NAMES
    }
    return Array.from(months)
      .sort((a, b) => a - b)
      .map((m) => ({ value: m.toString(), label: MONTH_NAMES[m] }));
  }, [sales, salesYearFilter]);

  // Filtered sales (for table)
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const { year, month } = parseSaleDate(s.date);
      const yearMatch =
        salesYearFilter === "all" || year.toString() === salesYearFilter;
      const monthMatch =
        salesMonthFilter === "all" ||
        month - 1 === Number.parseInt(salesMonthFilter);
      return yearMatch && monthMatch;
    });
  }, [sales, salesYearFilter, salesMonthFilter]);

  const filteredSalesTotal = useMemo(
    () => filteredSales.reduce((s, r) => s + r.amount, 0),
    [filteredSales],
  );

  // ── CHART DATA ────────────────────────────────────────────────────────────

  // Overall: group ALL sales by "Mon YYYY"
  const overallChartData = useMemo(() => {
    const map: Record<string, { amount: number; sortKey: number }> = {};
    for (const rec of sales) {
      const { year, month } = parseSaleDate(rec.date);
      if (Number.isNaN(year) || Number.isNaN(month)) continue;
      const label = `${MONTH_NAMES[month - 1]} ${year}`;
      const sortKey = year * 100 + month;
      if (!map[label]) map[label] = { amount: 0, sortKey };
      map[label].amount += rec.amount;
    }
    return Object.entries(map)
      .sort((a, b) => a[1].sortKey - b[1].sortKey)
      .map(([month, v]) => ({ month, amount: v.amount }));
  }, [sales]);

  // Monthly: bar chart for the selected year (Jan–Dec)
  const monthlyChartData = useMemo(() => {
    const map: Record<number, number> = {};
    for (const rec of sales) {
      const { year, month } = parseSaleDate(rec.date);
      if (Number.isNaN(year) || Number.isNaN(month)) continue;
      if (
        effectiveChartYear !== "all" &&
        year.toString() !== effectiveChartYear
      )
        continue;
      map[month] = (map[month] ?? 0) + rec.amount;
    }
    return MONTH_NAMES.map((label, i) => ({
      month: label,
      amount: map[i + 1] ?? 0,
    }));
  }, [sales, effectiveChartYear]);

  // Comparison: multi-line across years, X = Jan-Dec
  const comparisonChartData = useMemo(() => {
    // years sorted asc
    const years = [...availableYears].reverse();
    // map[month][year] = amount
    const map: Record<number, Record<string, number>> = {};
    for (let m = 1; m <= 12; m++) map[m] = {};
    for (const rec of sales) {
      const { year, month } = parseSaleDate(rec.date);
      if (Number.isNaN(year) || Number.isNaN(month)) continue;
      map[month][year.toString()] =
        (map[month][year.toString()] ?? 0) + rec.amount;
    }
    return {
      data: MONTH_NAMES.map((label, i) => ({
        month: label,
        ...map[i + 1],
      })),
      years,
    };
  }, [sales, availableYears]);

  // Derive available years from attendance data
  const attendanceAvailableYears = useMemo(() => {
    const years = new Set<string>();
    for (const a of attendance) {
      if (!a.date) continue;
      const parts = a.date.split(/[-/]/).map(Number);
      let year: number | null = null;
      if (parts.length === 3) {
        year = parts[0] > 31 ? parts[0] : parts[2];
      }
      if (year && !Number.isNaN(year)) years.add(year.toString());
    }
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [attendance]);

  const attendanceAvailableMonths = useMemo(() => {
    const months = new Set<number>();
    for (const a of attendance) {
      if (!a.date) continue;
      const parts = a.date.split(/[-/]/).map(Number);
      let year: number | null = null;
      let month: number | null = null;
      if (parts.length === 3) {
        if (parts[0] > 31) {
          year = parts[0];
          month = parts[1];
        } else {
          year = parts[2];
          month = parts[1];
        }
      }
      if (!year || !month || Number.isNaN(year) || Number.isNaN(month))
        continue;
      if (attendanceYear !== "all" && year.toString() !== attendanceYear)
        continue;
      months.add(month - 1);
    }
    return Array.from(months)
      .sort((a, b) => a - b)
      .map((m) => ({ value: m.toString(), label: MONTH_NAMES[m] }));
  }, [attendance, attendanceYear]);

  const filteredAttendance = useMemo(() => {
    return attendance.filter((a) => {
      if (!a.date) return attendanceYear === "all" && attendanceMonth === "all";
      const parts = a.date.split(/[-/]/).map(Number);
      let year: number | null = null;
      let month: number | null = null;
      if (parts.length === 3) {
        if (parts[0] > 31) {
          year = parts[0];
          month = parts[1];
        } else {
          year = parts[2];
          month = parts[1];
        }
      }
      const yearMatch =
        attendanceYear === "all" ||
        (year !== null && year.toString() === attendanceYear);
      const monthMatch =
        attendanceMonth === "all" ||
        (month !== null && month - 1 === Number.parseInt(attendanceMonth));
      return yearMatch && monthMatch;
    });
  }, [attendance, attendanceYear, attendanceMonth]);

  // ── Attendance chart ─────────────────────────────────────────────────────
  const filteredFeedback = useMemo(() => {
    if (feedbackFilter === "positive")
      return feedback.filter((f) => f.cesScore > 30);
    if (feedbackFilter === "negative")
      return feedback.filter((f) => f.cesScore < 30);
    return feedback;
  }, [feedback, feedbackFilter]);

  if (!employee) {
    return (
      <div
        className="flex items-center justify-center h-40 text-muted-foreground"
        data-ocid="employees.loading_state"
      >
        Loading employee...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="gap-1.5 text-muted-foreground hover:text-foreground"
        data-ocid="employees.link"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Employees
      </Button>

      {/* Hero card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold shrink-0">
              {employee.avatar || getInitials(employee.name)}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-foreground">
                  {employee.name}
                </h1>
                <Badge
                  variant="outline"
                  className={`border ${categoryBadgeClass(employee.category)}`}
                >
                  {employee.category || "\u2014"}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground font-mono mb-2">
                {employee.fiplCode}
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span>📍 {employee.region || "No region"}</span>
                <span>🏢 {employee.department || "No dept"}</span>
                <span>💼 {employee.role || "No role"}</span>
                {employee.joinDate && (
                  <span>
                    📅 Joined {(() => {
                      try {
                        return new Date(employee.joinDate).toLocaleDateString(
                          "en-IN",
                          { day: "numeric", month: "short", year: "numeric" },
                        );
                      } catch {
                        return employee.joinDate;
                      }
                    })()}
                  </span>
                )}
              </div>
            </div>

            {/* Efficiency score */}
            <div className="flex flex-col items-center shrink-0">
              <div className="text-3xl font-bold text-foreground">
                {efficiencyScore !== null ? efficiencyScore : "\u2014"}
              </div>
              <div className="text-xs text-muted-foreground">
                / 100 Efficiency
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5 pt-5 border-t border-border">
            <div className="text-center">
              <div className="text-lg font-bold text-foreground">
                {formatIndianCurrency(totalSales)}
              </div>
              <div className="text-xs text-muted-foreground">Total Sales</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-foreground">
                {sales.length}
              </div>
              <div className="text-xs text-muted-foreground">Sales Records</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-foreground">
                {attendance.length}
              </div>
              <div className="text-xs text-muted-foreground">
                Attendance Logs
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employee Details: Family, Experience, Vehicle */}
      {(employee.familyDetails ||
        employee.pastExperience ||
        employee.vehicleDetails) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              👤 Employee Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {employee.familyDetails && (
                <div className="rounded-lg border border-pink-200 bg-pink-50 p-4">
                  <div className="font-semibold text-pink-800 text-sm mb-2">
                    👨‍👩‍👧 Family Details
                  </div>
                  <ul className="space-y-1">
                    {employee.familyDetails
                      .split(/[;\n]/)
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((s) => (
                        <li
                          key={s}
                          className="text-xs text-pink-700 flex items-start gap-1"
                        >
                          <span className="mt-0.5">•</span>
                          {s}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
              {employee.pastExperience && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div className="font-semibold text-amber-800 text-sm mb-2">
                    💼 Past Experience
                  </div>
                  <ul className="space-y-1">
                    {employee.pastExperience
                      .split(/[;\n]/)
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((s) => (
                        <li
                          key={s}
                          className="text-xs text-amber-700 flex items-start gap-1"
                        >
                          <span className="mt-0.5">•</span>
                          {s}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
              {employee.vehicleDetails && (
                <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
                  <div className="font-semibold text-teal-800 text-sm mb-2">
                    🚗 Vehicle Details
                  </div>
                  <ul className="space-y-1">
                    {employee.vehicleDetails
                      .split(/[;\n]/)
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((s) => (
                        <li
                          key={s}
                          className="text-xs text-teal-700 flex items-start gap-1"
                        >
                          <span className="mt-0.5">•</span>
                          {s}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Personality Analysis Pentagon */}
      {employee.personalityData?.scores.some((s) => s > 0) && (
        <div className="bg-card rounded-xl border border-border p-5 mb-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <span>🧠</span>
            <span>
              Personality Analysis
              <span className="block text-xs font-normal text-muted-foreground">
                (Submitted by the employee)
              </span>
            </span>
          </h3>
          <PersonalityPentagon
            traitLabels={employee.personalityData.traitLabels}
            scores={employee.personalityData.scores}
          />
        </div>
      )}

      {/* SWOT Analysis */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCircle2 className="w-4 h-4" /> SWOT Analysis(Done Through 1 on
            1 Session)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!swot ? (
            <p className="text-muted-foreground text-sm">
              No SWOT data available.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  label: "💪 Strengths",
                  text: swot.strengths,
                  border: "border-green-200",
                  bg: "bg-green-50",
                  title: "text-green-800",
                  item: "text-green-700",
                  empty: "text-green-600",
                },
                {
                  label: "\u26A0\uFE0F Weaknesses",
                  text: swot.weaknesses,
                  border: "border-red-200",
                  bg: "bg-red-50",
                  title: "text-red-800",
                  item: "text-red-700",
                  empty: "text-red-600",
                },
                {
                  label: "🚀 Opportunities",
                  text: swot.opportunities,
                  border: "border-blue-200",
                  bg: "bg-blue-50",
                  title: "text-blue-800",
                  item: "text-blue-700",
                  empty: "text-blue-600",
                },
                {
                  label: "🔥 Threats",
                  text: swot.threats,
                  border: "border-orange-200",
                  bg: "bg-orange-50",
                  title: "text-orange-800",
                  item: "text-orange-700",
                  empty: "text-orange-600",
                },
              ].map(({ label, text, border, bg, title, item, empty }) => {
                const items =
                  text
                    ?.split(/[;\n]/)
                    .map((s) =>
                      s
                        .trim()
                        .replace(/^[•\u2022\d]+\.?\s*/, "")
                        .trim(),
                    )
                    .filter(Boolean) ?? [];
                return (
                  <div
                    key={label}
                    className={`rounded-lg border ${border} ${bg} p-3`}
                  >
                    <div className={`font-semibold ${title} text-sm mb-2`}>
                      {label}
                    </div>
                    {items.length === 0 ? (
                      <span className={`text-xs ${empty}`}>None listed</span>
                    ) : (
                      <ul className="space-y-1">
                        {items.map((s) => (
                          <li
                            key={s}
                            className={`text-xs ${item} flex items-start gap-1`}
                          >
                            <span className="mt-0.5">•</span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
              {swot.traits && (
                <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 sm:col-span-2">
                  <div className="font-semibold text-purple-800 text-sm mb-2">
                    ⭐ Traits
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {swot.traits
                      .split(/[;\n]/)
                      .map((t) => t.trim())
                      .filter(Boolean)
                      .map((t) => (
                        <span
                          key={t}
                          className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full"
                        >
                          {t}
                        </span>
                      ))}
                  </div>
                </div>
              )}
              {swot.problems && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                  <div className="font-semibold text-rose-800 text-sm mb-2">
                    ⚡ Problems
                  </div>
                  <ul className="space-y-1">
                    {swot.problems
                      .split(/[;\n]/)
                      .map((p) =>
                        p
                          .trim()
                          .replace(/^[•\u2022\d]+\.?\s*/, "")
                          .trim(),
                      )
                      .filter(Boolean)
                      .map((p) => (
                        <li
                          key={p}
                          className="text-xs text-rose-700 flex items-start gap-1"
                        >
                          <span className="mt-0.5">•</span>
                          {p}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
              {swot.feedbacks && (
                <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
                  <div className="font-semibold text-sky-800 text-sm mb-2">
                    💬 Feedbacks
                  </div>
                  <ul className="space-y-1">
                    {swot.feedbacks
                      .split(/[;\n]/)
                      .map((fb) =>
                        fb
                          .trim()
                          .replace(/^[•\u2022\d]+\.?\s*/, "")
                          .trim(),
                      )
                      .filter(Boolean)
                      .map((fb) => (
                        <li
                          key={fb}
                          className="text-xs text-sky-700 flex items-start gap-1"
                        >
                          <span className="mt-0.5">•</span>
                          {fb}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Performance Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!perf ? (
            <p className="text-muted-foreground text-sm">
              No performance data available.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  label: "Sales Influence Index %",
                  value: perf.salesInfluenceIndex,
                  max: 100,
                  isScore: true,
                },
                {
                  label: "Operational Discipline%",
                  value: perf.operationalDiscipline,
                  max: 100,
                  isScore: true,
                },
                {
                  label: "Product Knowledge %",
                  value: perf.productKnowledgeScore,
                  max: 100,
                  isScore: true,
                },
                {
                  label: "Soft Skills %",
                  value: perf.softSkillScore,
                  max: 100,
                  isScore: true,
                },
              ].map((m) => (
                <div key={m.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">{m.label}</span>
                    <span className="font-semibold">{m.value}</span>
                  </div>
                  <Progress value={m.value} className="h-2" />
                </div>
              ))}
              <div className="sm:col-span-2 border-t border-border pt-3 mt-1">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Review Count %", value: perf.reviewCount },
                    { label: "Demo Visits", value: perf.totalDemoVisits },
                    {
                      label: "Complaint Visits",
                      value: perf.totalComplaintVisits,
                    },
                    {
                      label: "Video Call Demos",
                      value: perf.totalVideoCallDemos,
                    },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className="text-center p-2 rounded-lg bg-muted"
                    >
                      <div className="text-xl font-bold text-foreground">
                        {m.value}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {m.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Sales Chart Tabs (full-width) ─────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              Sales Performance
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overall" data-ocid="sales_chart.tab">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <TabsList>
                <TabsTrigger value="overall" data-ocid="sales_chart.tab">
                  Overall
                </TabsTrigger>
                <TabsTrigger value="monthly" data-ocid="sales_chart.tab">
                  Monthly
                </TabsTrigger>
                <TabsTrigger value="comparison" data-ocid="sales_chart.tab">
                  Comparison
                </TabsTrigger>
              </TabsList>

              {/* Year selector for Monthly tab */}
              {availableYears.length > 0 && (
                <Select value={effectiveChartYear} onValueChange={setChartYear}>
                  <SelectTrigger
                    className="w-28 h-8 text-sm"
                    data-ocid="sales_chart.select"
                  >
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Overall: area chart all time grouped by Mon YYYY */}
            <TabsContent value="overall">
              {overallChartData.length === 0 ? (
                <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                  No sales data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart
                    data={overallChartData}
                    margin={{ top: 10, right: 16, bottom: 30, left: 8 }}
                  >
                    <defs>
                      <linearGradient
                        id="overallGradient"
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
                      dataKey="month"
                      tick={{ fontSize: 10 }}
                      angle={-30}
                      textAnchor="end"
                      height={45}
                      interval={0}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v: number) =>
                        v >= 100000
                          ? `₹${(v / 100000).toFixed(0)}L`
                          : v >= 1000
                            ? `₹${(v / 1000).toFixed(0)}K`
                            : `₹${v}`
                      }
                      width={56}
                    />
                    <Tooltip
                      formatter={(v: number) => [
                        formatIndianCurrency(v),
                        "Sales",
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      fill="url(#overallGradient)"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                    />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      dot={{ r: 2, fill: "#6366f1", strokeWidth: 0 }}
                      activeDot={{ r: 4 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </TabsContent>

            {/* Monthly: bar chart for selected year */}
            <TabsContent value="monthly">
              {availableYears.length === 0 ? (
                <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                  No sales data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={monthlyChartData}
                    margin={{ top: 10, right: 16, bottom: 5, left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v: number) =>
                        v >= 100000
                          ? `₹${(v / 100000).toFixed(0)}L`
                          : v >= 1000
                            ? `₹${(v / 1000).toFixed(0)}K`
                            : `₹${v}`
                      }
                      width={56}
                    />
                    <Tooltip
                      formatter={(v: number) => [
                        formatIndianCurrency(v),
                        `Sales ${effectiveChartYear}`,
                      ]}
                    />
                    <Bar dataKey="amount" name="Sales" radius={[4, 4, 0, 0]}>
                      {monthlyChartData.map((entry, index) => (
                        <rect
                          key={`bar-${entry.month}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </TabsContent>

            {/* Comparison: multi-line per year */}
            <TabsContent value="comparison">
              {comparisonChartData.years.length < 2 ? (
                <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                  Only one year of data available \u2014 comparison requires
                  multiple years.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart
                    data={comparisonChartData.data}
                    margin={{ top: 10, right: 16, bottom: 5, left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v: number) =>
                        v >= 100000
                          ? `₹${(v / 100000).toFixed(0)}L`
                          : v >= 1000
                            ? `₹${(v / 1000).toFixed(0)}K`
                            : `₹${v}`
                      }
                      width={56}
                    />
                    <Tooltip
                      formatter={(v: number, name: string) => [
                        formatIndianCurrency(v),
                        name,
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {comparisonChartData.years.map((year, i) => (
                      <Line
                        key={year}
                        type="monotone"
                        dataKey={year}
                        stroke={CHART_COLORS[i % CHART_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        activeDot={{ r: 4 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Sales Dropdown */}
      <CollapsibleSection
        title="Sales Records"
        subtitle={`${filteredSales.length} records \u00b7 ${formatIndianCurrency(filteredSalesTotal)}`}
      >
        {sales.length === 0 ? (
          <p
            className="text-muted-foreground text-sm"
            data-ocid="employees.empty_state"
          >
            No sales records.
          </p>
        ) : (
          <>
            {/* Year + Month filters */}
            <div className="flex flex-wrap gap-3 mb-4">
              <Select
                value={salesYearFilter}
                onValueChange={(v) => {
                  setSalesYearFilter(v);
                  setSalesMonthFilter("all");
                }}
              >
                <SelectTrigger
                  className="w-32 h-8 text-sm"
                  data-ocid="employees.select"
                >
                  <SelectValue placeholder="All Years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {availableYears.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={salesMonthFilter}
                onValueChange={setSalesMonthFilter}
              >
                <SelectTrigger
                  className="w-36 h-8 text-sm"
                  data-ocid="employees.select"
                >
                  <SelectValue placeholder="All Months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  {availableMonths.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(salesYearFilter !== "all" || salesMonthFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setSalesYearFilter("all");
                    setSalesMonthFilter("all");
                  }}
                  data-ocid="employees.secondary_button"
                >
                  Clear
                </Button>
              )}

              <span className="text-xs text-muted-foreground self-center ml-auto">
                {filteredSales.length} of {sales.length} records \u00b7{" "}
                {formatIndianCurrency(filteredSalesTotal)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground text-sm py-6"
                      >
                        No records match the selected filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSales.map((s, i) => (
                      <TableRow
                        key={`${s.date ?? i}-${s.brand}-${s.amount}`}
                        data-ocid={`employees.item.${i + 1}`}
                      >
                        <TableCell className="text-sm">
                          {s.date
                            ? new Date(s.date).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "\u2014"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {s.brand ?? "\u2014"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {s.product ?? "\u2014"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {s.type ?? "\u2014"}
                        </TableCell>
                        <TableCell className="text-sm">{s.quantity}</TableCell>
                        <TableCell className="text-sm font-medium">
                          {formatIndianCurrency(s.amount)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CollapsibleSection>

      {/* Feedback / Call Records + PULSE + PRISM Dropdown */}
      <CollapsibleSection
        title="Feedback & Surveys"
        subtitle={`${feedback.length} call records`}
      >
        <Tabs defaultValue="callrecords">
          <TabsList className="mb-4">
            <TabsTrigger value="callrecords">📞 Call Records</TabsTrigger>
            <TabsTrigger value="pulse">🔵 PULSE</TabsTrigger>
            <TabsTrigger value="prism">🔶 PRISM</TabsTrigger>
          </TabsList>

          {/* ── Call Records Tab ── */}
          <TabsContent value="callrecords">
            {feedback.length === 0 ? (
              <p
                className="text-muted-foreground text-sm"
                data-ocid="employees.empty_state"
              >
                No feedback records found for this employee.
              </p>
            ) : (
              <>
                {/* CES Filter */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {(["all", "positive", "negative"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setFeedbackFilter(opt)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        feedbackFilter === opt
                          ? opt === "positive"
                            ? "bg-green-100 border-green-400 text-green-800"
                            : opt === "negative"
                              ? "bg-red-100 border-red-400 text-red-800"
                              : "bg-indigo-100 border-indigo-400 text-indigo-800"
                          : "bg-muted border-border text-muted-foreground hover:bg-muted/60"
                      }`}
                      data-ocid="employees.toggle"
                    >
                      {opt === "all"
                        ? "All Feedbacks"
                        : opt === "positive"
                          ? "Positive (CES >30)"
                          : "Negative (CES <30)"}
                    </button>
                  ))}
                  <span className="text-xs text-muted-foreground self-center ml-auto">
                    {filteredFeedback.length} records
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Brand</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>CES Score</TableHead>
                        <TableHead>Remark</TableHead>
                        <TableHead>Agent</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFeedback.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-center text-muted-foreground text-sm py-6"
                          >
                            No records match the selected filter.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredFeedback.map((fb, i) => (
                          <TableRow
                            key={`fb-${fb.dateOfCall ?? ""}-${fb.customerName ?? ""}-${i}`}
                            className={
                              fb.cesScore < 30
                                ? "bg-red-50 hover:bg-red-100"
                                : ""
                            }
                            data-ocid={`employees.item.${i + 1}`}
                          >
                            <TableCell className="text-sm">
                              {fb.dateOfCall
                                ? (() => {
                                    const d = new Date(fb.dateOfCall);
                                    return Number.isNaN(d.getTime())
                                      ? fb.dateOfCall
                                      : d.toLocaleDateString("en-IN", {
                                          day: "2-digit",
                                          month: "short",
                                          year: "numeric",
                                        });
                                  })()
                                : "—"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {fb.customerName ?? "—"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {fb.brand ?? "—"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {fb.product ?? "—"}
                            </TableCell>
                            <TableCell className="text-sm">
                              <span
                                className={`font-semibold ${
                                  fb.cesScore < 30
                                    ? "text-red-600"
                                    : fb.cesScore > 30
                                      ? "text-green-600"
                                      : "text-muted-foreground"
                                }`}
                              >
                                {fb.cesScore}
                              </span>
                            </TableCell>
                            <TableCell
                              className="text-sm text-muted-foreground max-w-[200px] truncate cursor-pointer hover:text-primary hover:underline"
                              title="Click to view full remark"
                              onClick={() => setSelectedFeedback(fb)}
                            >
                              {fb.remark ?? "—"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {fb.agent ?? "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </TabsContent>

          {/* ── PULSE Tab ── */}
          <TabsContent value="pulse">
            {!employee.pulseData ||
            Object.keys(employee.pulseData).length === 0 ? (
              <p className="text-muted-foreground text-sm py-4">
                No PULSE survey data available for this employee.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(employee.pulseData).map(
                  ([question, answer]) => (
                    <div
                      key={question}
                      className="rounded-lg border border-blue-200 bg-blue-50 p-3"
                    >
                      <div className="font-semibold text-blue-800 text-xs mb-1">
                        {question}
                      </div>
                      <div className="text-sm text-blue-900">
                        {answer || "—"}
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </TabsContent>

          {/* ── PRISM Tab ── */}
          <TabsContent value="prism">
            {!employee.prismData ||
            Object.keys(employee.prismData).length === 0 ? (
              <p className="text-muted-foreground text-sm py-4">
                No PRISM survey data available for this employee.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(employee.prismData).map(
                  ([question, answer]) => (
                    <div
                      key={question}
                      className="rounded-lg border border-orange-200 bg-orange-50 p-3"
                    >
                      <div className="font-semibold text-orange-800 text-xs mb-1">
                        {question}
                      </div>
                      <div className="text-sm text-orange-900">
                        {answer || "—"}
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CollapsibleSection>

      {/* Feedback detail dialog */}
      {selectedFeedback && (
        <Dialog
          open={!!selectedFeedback}
          onOpenChange={(o) => {
            if (!o) setSelectedFeedback(null);
          }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Feedback Detail</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Customer
                  </p>
                  <p className="font-medium">
                    {selectedFeedback.customerName ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Date
                  </p>
                  <p className="font-medium">
                    {selectedFeedback.dateOfCall
                      ? (() => {
                          const d = new Date(selectedFeedback.dateOfCall);
                          return Number.isNaN(d.getTime())
                            ? selectedFeedback.dateOfCall
                            : d.toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              });
                        })()
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Brand
                  </p>
                  <p className="font-medium">{selectedFeedback.brand ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Product
                  </p>
                  <p className="font-medium">
                    {selectedFeedback.product ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    CES Score
                  </p>
                  <p
                    className={`font-bold ${selectedFeedback.cesScore < 30 ? "text-red-600" : "text-green-600"}`}
                  >
                    {selectedFeedback.cesScore} —{" "}
                    {selectedFeedback.cesScore < 30 ? "Negative" : "Positive"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Agent
                  </p>
                  <p className="font-medium">{selectedFeedback.agent ?? "—"}</p>
                </div>
              </div>
              <div className="border-t pt-3">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
                  Full Remark
                </p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap bg-muted/40 rounded-md p-3">
                  {selectedFeedback.remark ?? "No remark provided."}
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Attendance Dropdown */}
      <CollapsibleSection
        title="Lapses Records"
        subtitle={`${filteredAttendance.length} entries · Total Lapses: ${filteredAttendance.length}`}
      >
        {attendance.length === 0 ? (
          <p
            className="text-muted-foreground text-sm"
            data-ocid="employees.empty_state"
          >
            No attendance records.
          </p>
        ) : (
          <>
            {/* Year + Month filters */}
            <div className="flex flex-wrap gap-3 mb-4">
              <Select
                value={attendanceYear}
                onValueChange={(v) => {
                  setAttendanceYear(v);
                  setAttendanceMonth("all");
                }}
              >
                <SelectTrigger
                  className="w-32 h-8 text-sm"
                  data-ocid="employees.select"
                >
                  <SelectValue placeholder="All Years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {attendanceAvailableYears.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={attendanceMonth}
                onValueChange={setAttendanceMonth}
              >
                <SelectTrigger
                  className="w-36 h-8 text-sm"
                  data-ocid="employees.select"
                >
                  <SelectValue placeholder="All Months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  {attendanceAvailableMonths.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(attendanceYear !== "all" || attendanceMonth !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setAttendanceYear("all");
                    setAttendanceMonth("all");
                  }}
                  data-ocid="employees.secondary_button"
                >
                  Clear
                </Button>
              )}

              <span className="text-xs text-muted-foreground self-center ml-auto">
                Total Lapses: <strong>{filteredAttendance.length}</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Lapses Type</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAttendance.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="text-center text-muted-foreground text-sm py-6"
                      >
                        No records match the selected filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAttendance.map((a, i) => (
                      <TableRow
                        key={`${a.date ?? i}-${a.lapsesType}`}
                        data-ocid={`employees.item.${i + 1}`}
                      >
                        <TableCell className="text-sm">
                          {a.date
                            ? (() => {
                                try {
                                  const d = new Date(a.date);
                                  if (Number.isNaN(d.getTime())) return a.date;
                                  const dd = String(d.getDate()).padStart(
                                    2,
                                    "0",
                                  );
                                  const mm = String(d.getMonth() + 1).padStart(
                                    2,
                                    "0",
                                  );
                                  const yyyy = d.getFullYear();
                                  return `${dd}/${mm}/${yyyy}`;
                                } catch {
                                  return a.date;
                                }
                              })()
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {a.lapsesType ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {a.remarks ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CollapsibleSection>
    </div>
  );
}
