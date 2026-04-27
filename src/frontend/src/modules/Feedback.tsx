import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { XLSX } from "@/lib/xlsxShim";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  Plus,
  Search,
  TableIcon,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { PasswordGate, usePasswordGate } from "../components/PasswordGate";
import { useLabels } from "../contexts/UILabelsContext";
import { useEmployees } from "../hooks/useAllEmployeeData";
import { useGoogleSheetCallRecords } from "../hooks/useGoogleSheetCallRecords";
import {
  Variant_tineco_ecovacs_coway_kuvings_instant,
  useAddFeedback,
  useAllEmployees,
  useAllFeedback,
  useBatchFeedbackUpload,
} from "../hooks/useQueries";
import type { FeedbackEntry } from "../hooks/useQueries";
import { buildFilename, exportToExcel } from "../lib/exportUtils";
import RegionDetailPage from "./RegionDetailPage";

// ─── Constants ───────────────────────────────────────────────────────────────

const BRANDS = ["Ecovacs", "Kuvings", "Coway", "Tineco", "Instant"] as const;

const KNOWN_ISSUE_TYPES = [
  "FSE Issue",
  "Operations & Scheduling Issue",
  "Brand Issue",
  "Technical/Product Issue",
  "After-Sales & Support Issue",
];

// ─── Issue Category Classification ───────────────────────────────────────────

export const ISSUE_CATEGORIES = [
  {
    key: "FSE Issue",
    label: "FSE Issue",
    color:
      "bg-indigo-100 text-indigo-800 border-indigo-300 hover:bg-indigo-200",
    accent: "#6366f1",
    bgLight: "bg-indigo-50",
    textAccent: "text-indigo-700",
    borderAccent: "border-indigo-300",
  },
  {
    key: "Operation and Scheduling Issue",
    label: "Operation & Scheduling",
    color: "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200",
    accent: "#f59e0b",
    bgLight: "bg-amber-50",
    textAccent: "text-amber-700",
    borderAccent: "border-amber-300",
  },
  {
    key: "Brand Issue",
    label: "Brand Issue",
    color: "bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200",
    accent: "#f43f5e",
    bgLight: "bg-rose-50",
    textAccent: "text-rose-700",
    borderAccent: "border-rose-300",
  },
  {
    key: "Technical and Product Issue",
    label: "Technical & Product",
    color:
      "bg-violet-100 text-violet-800 border-violet-300 hover:bg-violet-200",
    accent: "#8b5cf6",
    bgLight: "bg-violet-50",
    textAccent: "text-violet-700",
    borderAccent: "border-violet-300",
  },
  {
    key: "After-Sales Issue",
    label: "After-Sales Issue",
    color:
      "bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200",
    accent: "#f97316",
    bgLight: "bg-orange-50",
    textAccent: "text-orange-700",
    borderAccent: "border-orange-300",
  },
] as const;

type CategoryKey = (typeof ISSUE_CATEGORIES)[number]["key"];

/**
 * Classify a raw typeOfIssue string into one or more broad category keys.
 * A record can match multiple categories.
 */
export function classifyIssue(rawText: string): CategoryKey[] {
  if (!rawText) return [];
  const t = rawText.toLowerCase();
  const matched: CategoryKey[] = [];
  if (t.includes("fse")) matched.push("FSE Issue");
  if (t.includes("operat") || t.includes("schedul"))
    matched.push("Operation and Scheduling Issue");
  if (t.includes("brand")) matched.push("Brand Issue");
  if (t.includes("tech") || t.includes("product"))
    matched.push("Technical and Product Issue");
  if (t.includes("after") || t.includes("support"))
    matched.push("After-Sales Issue");
  return matched;
}

// Action suggestions per issue category
const ISSUE_ACTIONS: Record<string, string> = {
  "FSE Issue": "Focus on FSE skill development & accountability",
  "Operation and Scheduling Issue": "Review scheduling & logistics processes",
  "Brand Issue": "Coordinate with brand team for product improvements",
  "Technical and Product Issue": "Escalate technical issues to product support",
  "After-Sales Issue": "Strengthen after-sales follow-up process",
};

// Category key → color for chips in region analysis
const CATEGORY_CHIP_COLORS: Record<string, string> = {
  "FSE Issue": "bg-indigo-100 text-indigo-800 border-indigo-300",
  "Operation and Scheduling Issue":
    "bg-amber-100 text-amber-800 border-amber-300",
  "Brand Issue": "bg-rose-100 text-rose-800 border-rose-300",
  "Technical and Product Issue":
    "bg-violet-100 text-violet-800 border-violet-300",
  "After-Sales Issue": "bg-orange-100 text-orange-800 border-orange-300",
};

function getCategoryLabel(key: string): string {
  return ISSUE_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

function getCategoryMeta(key: string) {
  return ISSUE_CATEGORIES.find((c) => c.key === key);
}

const BRAND_COLORS: Record<string, string> = {
  ecovacs: "bg-blue-100 text-blue-700 border-blue-200",
  kuvings: "bg-orange-100 text-orange-700 border-orange-200",
  coway: "bg-green-100 text-green-700 border-green-200",
  tineco: "bg-purple-100 text-purple-700 border-purple-200",
  instant: "bg-red-100 text-red-700 border-red-200",
};

function brandColorClass(brand: string): string {
  return (
    BRAND_COLORS[brand.toLowerCase()] ??
    "bg-slate-100 text-slate-700 border-slate-200"
  );
}

const PAGE_SIZE = 15;

// ─── Date Formatting ─────────────────────────────────────────────────────────

export function formatDisplayDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const raw = String(dateStr).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
  if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) return raw.replace(/-/g, "/");
  if (/^\d+$/.test(raw)) {
    const num = Number(raw);
    const d = num < 1e12 ? new Date(num * 1000) : new Date(num);
    if (!Number.isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
  }
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
  return raw;
}

/** Parse a date string to a local-time Date object (returns null on failure) */
function parseDateLocal(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const raw = String(dateStr).trim();
  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = raw.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    return new Date(
      Number(dmyMatch[3]),
      Number(dmyMatch[2]) - 1,
      Number(dmyMatch[1]),
    );
  }
  // Pure numeric timestamp
  if (/^\d+$/.test(raw)) {
    const num = Number(raw);
    return num < 1e12 ? new Date(num * 1000) : new Date(num);
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Return "Mon YYYY" from a date string */
function toMonthYear(dateStr: string | null | undefined): string {
  const d = parseDateLocal(dateStr);
  if (!d) return "Unknown";
  return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

// ─── Unified display type ─────────────────────────────────────────────────────

interface DisplayRecord {
  id: string;
  fiplCode: string;
  fseName: string;
  customerName: string;
  contact?: string;
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

// ─── Helpers ───────────────────────────────────────────────────────────────

function CesBadge({ score }: { score: number }) {
  const isLow = score < 30;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
        isLow
          ? "bg-red-100 text-red-700 border-red-300"
          : "bg-emerald-100 text-emerald-700 border-emerald-300"
      }`}
    >
      {score}/40
    </span>
  );
}

const normalizeKey = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// ─── Region Analysis ─────────────────────────────────────────────────────────

interface RegionStat {
  region: string;
  negativeCount: number;
  totalCount: number;
  topIssueKey: string | null;
  topIssueLabel: string;
  action: string;
}

function computeRegionStats(records: DisplayRecord[]): RegionStat[] {
  const negRecords = records.filter((r) => r.cesScore < 30);
  const regionNegCount: Record<string, number> = {};
  const regionTotalCount: Record<string, number> = {};
  const regionIssueFreq: Record<string, Record<string, number>> = {};

  for (const r of records) {
    const reg = r.region || "Unknown";
    regionTotalCount[reg] = (regionTotalCount[reg] ?? 0) + 1;
  }
  for (const r of negRecords) {
    const reg = r.region || "Unknown";
    regionNegCount[reg] = (regionNegCount[reg] ?? 0) + 1;
    for (const cat of classifyIssue(r.typeOfIssue)) {
      if (!regionIssueFreq[reg]) regionIssueFreq[reg] = {};
      regionIssueFreq[reg][cat] = (regionIssueFreq[reg][cat] ?? 0) + 1;
    }
  }

  const allRegions = new Set([
    ...Object.keys(regionNegCount),
    ...Object.keys(regionTotalCount),
  ]);

  const stats: RegionStat[] = [];
  for (const region of allRegions) {
    if (!region) continue;
    const negCount = regionNegCount[region] ?? 0;
    const total = regionTotalCount[region] ?? 0;
    const freqMap = regionIssueFreq[region] ?? {};
    let topIssueKey: string | null = null;
    let topIssueFreq = 0;
    for (const [key, freq] of Object.entries(freqMap)) {
      if (freq > topIssueFreq) {
        topIssueFreq = freq;
        topIssueKey = key;
      }
    }
    const topIssueLabel = topIssueKey ? getCategoryLabel(topIssueKey) : "—";
    const action =
      topIssueKey != null
        ? (ISSUE_ACTIONS[topIssueKey] ??
          "Review and address recurring complaints")
        : "No negative feedback";
    stats.push({
      region,
      negativeCount: negCount,
      totalCount: total,
      topIssueKey,
      topIssueLabel,
      action,
    });
  }
  return stats.sort((a, b) => b.negativeCount - a.negativeCount);
}

function RegionAnalysisPanel({
  records,
  onSelectRegion,
}: {
  records: DisplayRecord[];
  onSelectRegion: (region: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const stats = useMemo(() => computeRegionStats(records), [records]);
  const maxNeg = useMemo(
    () => Math.max(1, ...stats.map((s) => s.negativeCount)),
    [stats],
  );
  if (stats.length === 0) return null;

  return (
    <div
      className="rounded-xl border bg-card shadow-sm overflow-hidden"
      data-ocid="feedback.region_analysis"
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-5 py-3 bg-muted/40 hover:bg-muted/60 transition-colors border-b"
        data-ocid="feedback.region_analysis_toggle"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-tight">
            📍 Region Analysis
          </span>
          <Badge variant="secondary" className="text-xs">
            {stats.filter((s) => s.negativeCount > 0).length} regions with
            negative feedback
          </Badge>
        </div>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {!collapsed && (
        <div className="divide-y">
          {stats.map((s, idx) => {
            const isWorst = idx === 0 && s.negativeCount > 0;
            const pct = Math.round((s.negativeCount / maxNeg) * 100);
            const chipColor =
              s.topIssueKey != null
                ? (CATEGORY_CHIP_COLORS[s.topIssueKey] ??
                  "bg-muted text-muted-foreground border-border")
                : "bg-muted text-muted-foreground border-border";
            return (
              <button
                key={s.region}
                type="button"
                onClick={() => onSelectRegion(s.region)}
                className={`w-full flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 transition-colors cursor-pointer text-left ${
                  isWorst
                    ? "bg-red-50/60 dark:bg-red-950/20 border-l-4 border-l-red-500 hover:bg-red-100/60"
                    : "hover:bg-muted/30"
                }`}
                data-ocid={`feedback.region.${s.region.toLowerCase().replace(/\s+/g, "_")}`}
              >
                <div className="flex items-center gap-2 min-w-[160px]">
                  <span className="font-semibold text-sm">{s.region}</span>
                  {isWorst && (
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 border border-red-300 uppercase tracking-wide">
                      ⚠️ Priority
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 min-w-[130px]">
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border bg-red-100 text-red-700 border-red-300 shrink-0">
                    {s.negativeCount} negative
                  </span>
                  <span className="text-xs text-muted-foreground">
                    / {s.totalCount} total
                  </span>
                </div>
                <div className="flex-1 min-w-[80px]">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-red-400 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <div className="min-w-[140px]">
                  {s.topIssueKey ? (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${chipColor}`}
                    >
                      {s.topIssueLabel}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      No issues classified
                    </span>
                  )}
                </div>
                <div className="flex-1 text-xs text-muted-foreground italic min-w-[200px]">
                  → {s.action}
                </div>
                <span className="text-xs font-medium text-primary hover:underline shrink-0">
                  View Details →
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Issue Insights Dashboard ─────────────────────────────────────────────────

interface IssueInsightData {
  key: CategoryKey;
  label: string;
  count: number;
  pctOfTotal: number;
  topRegions: string[];
  barWidth: number; // 0-100 relative to max
  accent: string;
  color: string;
  bgLight: string;
  textAccent: string;
  borderAccent: string;
}

function computeIssueInsights(
  records: DisplayRecord[],
  filterRegion: string,
  filterSearch: string,
): IssueInsightData[] {
  const q = filterSearch.trim().toLowerCase();
  const src = records.filter((r) => {
    const matchRegion = !filterRegion || r.region === filterRegion;
    return matchRegion;
  });

  const counts: Record<CategoryKey, number> = {
    "FSE Issue": 0,
    "Operation and Scheduling Issue": 0,
    "Brand Issue": 0,
    "Technical and Product Issue": 0,
    "After-Sales Issue": 0,
  };
  const regionFreq: Record<CategoryKey, Record<string, number>> = {
    "FSE Issue": {},
    "Operation and Scheduling Issue": {},
    "Brand Issue": {},
    "Technical and Product Issue": {},
    "After-Sales Issue": {},
  };

  for (const r of src) {
    for (const cat of classifyIssue(r.typeOfIssue)) {
      counts[cat]++;
      const reg = r.region || "Unknown";
      regionFreq[cat][reg] = (regionFreq[cat][reg] ?? 0) + 1;
    }
  }

  const total = src.length || 1;
  const maxCount = Math.max(1, ...Object.values(counts));

  return (ISSUE_CATEGORIES as unknown as (typeof ISSUE_CATEGORIES)[number][])
    .map((cat) => {
      const key = (cat as (typeof ISSUE_CATEGORIES)[number]).key as CategoryKey;
      const count = counts[key] ?? 0;
      const topRegions = Object.entries(regionFreq[key] ?? {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([r]) => r);
      const item: IssueInsightData = {
        key,
        label: cat.label,
        count,
        pctOfTotal: Math.round((count / total) * 100),
        topRegions,
        barWidth: Math.round((count / maxCount) * 100),
        accent: (cat as { accent: string }).accent,
        color: cat.color,
        bgLight: (cat as { bgLight: string }).bgLight,
        textAccent: (cat as { textAccent: string }).textAccent,
        borderAccent: (cat as { borderAccent: string }).borderAccent,
      };
      return item;
    })
    .filter((d) => !q || d.label.toLowerCase().includes(q))
    .sort((a, b) => b.count - a.count);
}

// ─── Drill-down helpers ───────────────────────────────────────────────────────

function getImpactLevel(records: DisplayRecord[]): {
  label: string;
  color: string;
} {
  if (records.length === 0)
    return { label: "No Data", color: "bg-muted text-muted-foreground" };
  const negPct = records.filter((r) => r.cesScore < 30).length / records.length;
  if (negPct > 0.5)
    return {
      label: "High Impact",
      color: "bg-red-100 text-red-700 border border-red-300",
    };
  if (negPct >= 0.25)
    return {
      label: "Medium Impact",
      color: "bg-amber-100 text-amber-700 border border-amber-300",
    };
  return {
    label: "Low Impact",
    color: "bg-emerald-100 text-emerald-700 border border-emerald-300",
  };
}

function buildTrendData(
  records: DisplayRecord[],
): { month: string; count: number }[] {
  const freq: Record<string, number> = {};
  for (const r of records) {
    const m = toMonthYear(r.dateOfVisit);
    freq[m] = (freq[m] ?? 0) + 1;
  }
  // Sort by date
  const entries = Object.entries(freq).map(([month, count]) => {
    const d = parseDateLocal(
      records.find((r) => toMonthYear(r.dateOfVisit) === month)?.dateOfVisit,
    );
    return { month, count, ts: d?.getTime() ?? 0 };
  });
  entries.sort((a, b) => a.ts - b.ts);
  return entries.slice(-12).map(({ month, count }) => ({ month, count }));
}

function buildResolutionData(
  records: DisplayRecord[],
): { name: string; count: number; pct: number }[] {
  const freq: Record<string, number> = {};
  for (const r of records) {
    const res = r.resolution?.trim() || "Not Specified";
    freq[res] = (freq[res] ?? 0) + 1;
  }
  const total = records.length || 1;
  return Object.entries(freq)
    .map(([name, count]) => ({
      name,
      count,
      pct: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

// Pie chart colors
const PIE_COLORS = [
  "#6366f1",
  "#f59e0b",
  "#f43f5e",
  "#8b5cf6",
  "#f97316",
  "#10b981",
  "#0ea5e9",
  "#eab308",
];

// ─── Remark Categories (defined outside component for stable reference) ──────

interface RemarkCategory {
  name: string;
  keywords: string[];
  color: string;
  bgColor: string;
  borderColor: string;
}

const REMARK_CATEGORIES: RemarkCategory[] = [
  {
    name: "Service Quality",
    keywords: [
      "service",
      "support",
      "helpful",
      "professional",
      "staff",
      "behavior",
      "attitude",
      "rude",
      "polite",
      "cooperative",
    ],
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  {
    name: "Product Issues",
    keywords: [
      "product",
      "defect",
      "quality",
      "damaged",
      "broken",
      "malfunction",
      "faulty",
      "poor quality",
    ],
    color: "text-rose-700",
    bgColor: "bg-rose-50",
    borderColor: "border-rose-200",
  },
  {
    name: "Delivery & Visit Issues",
    keywords: [
      "delay",
      "late",
      "visit",
      "arrive",
      "schedule",
      "time",
      "appointment",
      "missed",
    ],
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  {
    name: "Documentation & Process",
    keywords: [
      "form",
      "document",
      "process",
      "paperwork",
      "record",
      "update",
      "portal",
    ],
    color: "text-violet-700",
    bgColor: "bg-violet-50",
    borderColor: "border-violet-200",
  },
  {
    name: "Communication Issues",
    keywords: [
      "call",
      "contact",
      "response",
      "follow up",
      "inform",
      "communication",
      "message",
    ],
    color: "text-cyan-700",
    bgColor: "bg-cyan-50",
    borderColor: "border-cyan-200",
  },
  {
    name: "Resolution & Follow-up",
    keywords: [
      "resolve",
      "pending",
      "complaint",
      "issue",
      "problem",
      "follow up",
      "unresolved",
      "callback",
    ],
    color: "text-orange-700",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
  },
  {
    name: "Positive Feedback",
    keywords: [
      "good",
      "great",
      "excellent",
      "satisfied",
      "happy",
      "pleased",
      "well done",
      "perfect",
      "amazing",
      "wonderful",
    ],
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
  },
];

const OTHER_REMARK_CAT: RemarkCategory = {
  name: "Other",
  keywords: [],
  color: "text-slate-700",
  bgColor: "bg-slate-50",
  borderColor: "border-slate-200",
};

// ─── Issue Drill-down Component ───────────────────────────────────────────────

function IssueDrillDown({
  categoryKey,
  allRecords,
  onBack,
  onSelectEmployee,
}: {
  categoryKey: CategoryKey;
  allRecords: DisplayRecord[];
  onBack: () => void;
  onSelectEmployee?: (fiplCode: string) => void;
}) {
  const meta = getCategoryMeta(categoryKey);
  const records = useMemo(
    () =>
      allRecords.filter((r) =>
        classifyIssue(r.typeOfIssue).includes(categoryKey),
      ),
    [allRecords, categoryKey],
  );

  const total = records.length;
  const totalAll = allRecords.length || 1;
  const repeatPct = Math.round((total / totalAll) * 100);
  const impact = getImpactLevel(records);
  const avgCes =
    total > 0 ? records.reduce((s, r) => s + r.cesScore, 0) / total : 0;

  // Affected regions
  const affectedRegions = useMemo(() => {
    const freq: Record<string, number> = {};
    for (const r of records) {
      const reg = r.region || "Unknown";
      freq[reg] = (freq[reg] ?? 0) + 1;
    }
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .map(([r]) => r);
  }, [records]);

  // Top FSE
  const topFSE = useMemo(() => {
    const freq: Record<string, { name: string; count: number }> = {};
    for (const r of records) {
      const key = r.fiplCode || r.fseName || "Unknown";
      if (!freq[key])
        freq[key] = { name: r.fseName || r.fiplCode || "Unknown", count: 0 };
      freq[key].count++;
    }
    const sorted = Object.values(freq).sort((a, b) => b.count - a.count);
    return sorted[0] ?? null;
  }, [records]);

  // Trend
  const trendData = useMemo(() => buildTrendData(records), [records]);

  // ─── Categorized Remarks ──────────────────────────────────────────────────
  // Assign each record's remark to categories
  const categorizedRemarks = useMemo(() => {
    const catMap: Record<
      string,
      { cat: RemarkCategory; records: DisplayRecord[] }
    > = {};
    for (const cat of REMARK_CATEGORIES) {
      catMap[cat.name] = { cat, records: [] };
    }
    catMap.Other = { cat: OTHER_REMARK_CAT, records: [] };

    for (const rec of records) {
      if (!rec.remark?.trim()) continue;
      const remarkLower = rec.remark.toLowerCase();
      let matched = false;
      for (const cat of REMARK_CATEGORIES) {
        if (cat.keywords.some((kw) => remarkLower.includes(kw))) {
          catMap[cat.name].records.push(rec);
          matched = true;
        }
      }
      if (!matched) catMap.Other.records.push(rec);
    }
    return Object.values(catMap).filter((c) => c.records.length > 0);
  }, [records]);

  // Brand breakdown
  const brandData = useMemo(() => {
    const freq: Record<string, number> = {};
    for (const r of records) {
      const b = r.brand || "Unknown";
      freq[b] = (freq[b] ?? 0) + 1;
    }
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }));
  }, [records]);

  // Product breakdown
  const productData = useMemo(() => {
    const freq: Record<string, number> = {};
    for (const r of records) {
      const p = r.product || "Unknown";
      freq[p] = (freq[p] ?? 0) + 1;
    }
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }));
  }, [records]);

  // Resolution data
  const resolutionData = useMemo(() => buildResolutionData(records), [records]);

  // Employee table
  const employeeData = useMemo(() => {
    const map: Record<
      string,
      {
        name: string;
        fiplCode: string;
        region: string;
        count: number;
        cesSum: number;
      }
    > = {};
    for (const r of records) {
      const k = r.fiplCode || r.fseName || "Unknown";
      if (!map[k])
        map[k] = {
          name: r.fseName || r.fiplCode || "Unknown",
          fiplCode: r.fiplCode,
          region: r.region,
          count: 0,
          cesSum: 0,
        };
      map[k].count++;
      map[k].cesSum += r.cesScore;
    }
    return Object.values(map)
      .map((e) => ({ ...e, avgCes: e.count > 0 ? e.cesSum / e.count : 0 }))
      .sort((a, b) => b.count - a.count);
  }, [records]);

  const maxBrandCount = Math.max(1, ...brandData.map((d) => d.count));
  const maxProductCount = Math.max(1, ...productData.map((d) => d.count));
  const [selectedRemarkCategory, setSelectedRemarkCategory] = useState<
    string | null
  >(null);

  // Password gate for export in drilldown
  const { granted: exportGranted } = usePasswordGate("export");
  const [pendingExportGate, setPendingExportGate] = useState(false);

  const runExport = () => {
    const filename = buildFilename(`Issue_${meta?.label ?? categoryKey}`);
    exportToExcel({
      filename,
      filters: { "Issue Type": meta?.label ?? categoryKey },
      sheets: [
        {
          name: "Issue Detail",
          data: records.map((r) => ({
            "Employee Name": r.fseName || r.fiplCode || "—",
            "FIPL Code": r.fiplCode,
            "Customer Name": r.customerName,
            "CES Score": r.cesScore,
            "Date of Visit": formatDisplayDate(r.dateOfVisit),
            Agent: r.agent || "—",
            "Type of Issue": r.typeOfIssue || "—",
            Resolution: r.resolution || "—",
            Remarks: r.remark || "—",
          })),
          columns: [
            { key: "Employee Name", header: "Employee Name", width: 22 },
            { key: "FIPL Code", header: "FIPL Code", width: 14 },
            { key: "Customer Name", header: "Customer Name", width: 22 },
            { key: "CES Score", header: "CES Score", width: 12 },
            { key: "Date of Visit", header: "Date of Visit", width: 14 },
            { key: "Agent", header: "Agent", width: 18 },
            { key: "Type of Issue", header: "Type of Issue", width: 28 },
            { key: "Resolution", header: "Resolution", width: 28 },
            { key: "Remarks", header: "Remarks", width: 45 },
          ],
        },
      ],
    });
  };

  const handleExportClick = () => {
    if (exportGranted) {
      runExport();
    } else {
      setPendingExportGate(true);
    }
  };

  return (
    <div className="space-y-6" data-ocid="feedback.issue_drilldown">
      {/* Back + heading */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          data-ocid="feedback.issue_drilldown_back"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Issues Overview
        </Button>
        <button
          type="button"
          data-ocid="feedback.issue_drilldown_export_button"
          onClick={handleExportClick}
          className="inline-flex items-center gap-1.5 rounded-md border border-indigo-300 bg-background px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-colors shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          Export This Issue
        </button>
      </div>
      {pendingExportGate && (
        <PasswordGate
          gateKey="export"
          onUnlock={() => {
            setPendingExportGate(false);
            runExport();
          }}
          onCancel={() => setPendingExportGate(false)}
        />
      )}

      {/* SECTION 1 — OVERVIEW */}
      <div
        className={`rounded-xl border shadow-sm overflow-hidden ${meta?.bgLight ?? "bg-card"}`}
        data-ocid="feedback.issue_overview"
      >
        <div
          className={`px-6 py-4 border-b ${meta?.borderAccent ?? "border-border"}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2
                className={`text-xl font-bold tracking-tight ${meta?.textAccent ?? "text-foreground"}`}
              >
                {meta?.label ?? categoryKey}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Detailed analysis for this issue type
              </p>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${impact.color}`}
            >
              {impact.label}
            </span>
          </div>
        </div>

        <div className="p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Total Cases */}
          <div className="flex flex-col items-center justify-center bg-card rounded-lg border p-4 shadow-sm text-center">
            <span className="text-3xl font-bold text-foreground">{total}</span>
            <span className="text-xs text-muted-foreground mt-1 font-medium">
              Total Cases
            </span>
          </div>
          {/* Repeat % */}
          <div className="flex flex-col items-center justify-center bg-card rounded-lg border p-4 shadow-sm text-center">
            <span className="text-3xl font-bold text-foreground">
              {repeatPct}%
            </span>
            <span className="text-xs text-muted-foreground mt-1 font-medium">
              of All Feedback
            </span>
          </div>
          {/* Avg CES */}
          <div className="flex flex-col items-center justify-center bg-card rounded-lg border p-4 shadow-sm text-center">
            <span
              className={`text-3xl font-bold ${avgCes < 30 ? "text-red-600" : "text-emerald-600"}`}
            >
              {avgCes.toFixed(1)}
            </span>
            <span className="text-xs text-muted-foreground mt-1 font-medium">
              Avg CES Score
            </span>
          </div>
          {/* Top FSE */}
          <div className="flex flex-col items-center justify-center bg-card rounded-lg border p-4 shadow-sm text-center">
            <span className="text-sm font-bold text-foreground truncate max-w-full">
              {topFSE?.name ?? "—"}
            </span>
            <span className="text-xs text-muted-foreground mt-1 font-medium">
              Top FSE {topFSE ? `(${topFSE.count} cases)` : ""}
            </span>
          </div>
          {/* Affected regions */}
          <div className="flex flex-col items-start justify-center bg-card rounded-lg border p-4 shadow-sm col-span-2 sm:col-span-1 lg:col-span-1">
            <span className="text-xs text-muted-foreground font-medium mb-2">
              Affected Regions
            </span>
            <div className="flex flex-wrap gap-1">
              {affectedRegions.slice(0, 4).map((reg) => (
                <span
                  key={reg}
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border bg-card text-foreground border-border"
                >
                  {reg}
                </span>
              ))}
              {affectedRegions.length > 4 && (
                <span className="text-xs text-muted-foreground">
                  +{affectedRegions.length - 4} more
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2 — TRENDS */}
      <div
        className="rounded-xl border bg-card shadow-sm p-6"
        data-ocid="feedback.issue_trend"
      >
        <h3 className="text-base font-semibold mb-4">
          📈 Issue Trend Over Time
        </h3>
        {trendData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No dated records found
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={trendData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                stroke={meta?.accent ?? "#6366f1"}
                strokeWidth={2}
                dot={{ r: 4, fill: meta?.accent ?? "#6366f1" }}
                name="Cases"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* SECTION 3 — ROOT CAUSES */}
      <div
        className="rounded-xl border bg-card shadow-sm p-6 space-y-6"
        data-ocid="feedback.issue_root_causes"
      >
        <h3 className="text-base font-semibold">🔍 Root Causes & Context</h3>

        {/* Top Remarks — Categorized */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-muted-foreground">
              Top Remarks
            </p>
            {selectedRemarkCategory && (
              <button
                type="button"
                onClick={() => setSelectedRemarkCategory(null)}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" /> Back to categories
              </button>
            )}
          </div>

          {categorizedRemarks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No remarks available
            </p>
          ) : selectedRemarkCategory ? (
            /* Detail view: all remarks in selected category */
            (() => {
              const catData = categorizedRemarks.find(
                (c) => c.cat.name === selectedRemarkCategory,
              );
              if (!catData) return null;
              return (
                <div className="space-y-2">
                  <div
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border mb-2 ${catData.cat.bgColor} ${catData.cat.color} ${catData.cat.borderColor}`}
                  >
                    {catData.cat.name}
                    <span className="opacity-60">
                      ({catData.records.length})
                    </span>
                  </div>
                  <div
                    className="space-y-2 overflow-y-auto pr-1"
                    style={{ maxHeight: 320 }}
                  >
                    {catData.records.map((rec, ri) => (
                      <div
                        key={`${rec.id}-${ri}`}
                        className={`rounded-lg border p-3 ${catData.cat.bgColor} ${catData.cat.borderColor}`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-foreground">
                            {rec.fseName || rec.fiplCode || "—"}
                          </span>
                          <div className="flex items-center gap-2">
                            <CesBadge score={rec.cesScore} />
                            <span className="text-xs text-muted-foreground">
                              {formatDisplayDate(rec.dateOfVisit)}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mb-1">
                          Customer: {rec.customerName || "—"} &nbsp;·&nbsp;
                          Issue: {rec.typeOfIssue || "—"}
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">
                          {rec.remark || "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()
          ) : (
            /* Category chips view */
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {categorizedRemarks.map((c) => (
                <button
                  key={c.cat.name}
                  type="button"
                  onClick={() => setSelectedRemarkCategory(c.cat.name)}
                  className={`group rounded-xl border p-3 text-left transition-all hover:shadow-md hover:-translate-y-0.5 ${c.cat.bgColor} ${c.cat.borderColor}`}
                  data-ocid={`feedback.remark_category.${c.cat.name.toLowerCase().replace(/\s+/g, "_")}`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span
                      className={`text-xs font-bold leading-snug ${c.cat.color}`}
                    >
                      {c.cat.name}
                    </span>
                    <span
                      className={`text-xs font-bold px-1.5 py-0.5 rounded-full border bg-white/60 ${c.cat.color} ${c.cat.borderColor}`}
                    >
                      {c.records.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">
                    {c.records[0]?.remark?.slice(0, 60) ?? "—"}
                    {(c.records[0]?.remark?.length ?? 0) > 60 ? "…" : ""}
                  </p>
                  <span
                    className={`text-[10px] font-semibold ${c.cat.color} group-hover:underline mt-1 block`}
                  >
                    View all →
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Brand Breakdown — full width */}
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-3">
            Brand Breakdown
          </p>
          <div className="space-y-2">
            {brandData.map((b) => (
              <div key={b.name} className="flex items-center gap-2">
                <span className="text-xs w-28 truncate font-medium">
                  {b.name}
                </span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.round((b.count / maxBrandCount) * 100)}%`,
                      background: meta?.accent ?? "#6366f1",
                    }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-8 text-right">
                  {b.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Product Breakdown — full width, below brand */}
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-3">
            Product Breakdown
          </p>
          <div className="space-y-2">
            {productData.map((p) => (
              <div key={p.name} className="flex items-center gap-2">
                <span className="text-xs w-28 truncate font-medium">
                  {p.name}
                </span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.round((p.count / maxProductCount) * 100)}%`,
                      background: meta?.accent ?? "#6366f1",
                    }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-8 text-right">
                  {p.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 4 — RESOLUTION STATUS */}
      <div
        className="rounded-xl border bg-card shadow-sm p-6"
        data-ocid="feedback.issue_resolution"
      >
        <h3 className="text-base font-semibold mb-4">✅ Resolution Status</h3>
        {resolutionData.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Left: donut chart + scrollable legend */}
            <div className="flex flex-col gap-3">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={resolutionData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={40}
                    label={({ pct }: { pct: number }) =>
                      String(pct).concat("%")
                    }
                    labelLine={false}
                  >
                    {resolutionData.map((rd, i) => (
                      <Cell
                        key={rd.name}
                        fill={PIE_COLORS[i % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              {/* Custom scrollable legend — outside ResponsiveContainer to prevent overflow */}
              <div
                className="rounded-lg border bg-muted/30 p-3"
                style={{ maxHeight: 150, overflowY: "auto" }}
              >
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {resolutionData.map((rd, i) => (
                    <div
                      key={rd.name}
                      className="flex items-center gap-1.5 min-w-0"
                    >
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                        style={{
                          background: PIE_COLORS[i % PIE_COLORS.length],
                        }}
                      />
                      <span
                        className="text-[11px] text-foreground truncate"
                        title={rd.name}
                      >
                        {rd.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Right: resolution table — scrollable body */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-xs font-medium text-muted-foreground sticky top-0 bg-card">
                      Resolution
                    </th>
                    <th className="text-right py-2 text-xs font-medium text-muted-foreground sticky top-0 bg-card">
                      Count
                    </th>
                    <th className="text-right py-2 text-xs font-medium text-muted-foreground sticky top-0 bg-card">
                      %
                    </th>
                  </tr>
                </thead>
              </table>
              <div className="overflow-y-auto" style={{ maxHeight: 200 }}>
                <table className="w-full text-sm">
                  <tbody>
                    {resolutionData.map((r, i) => {
                      const isPending =
                        /pending|unresolved|open|not resolved/i.test(r.name);
                      return (
                        <tr
                          key={r.name}
                          className={`border-b last:border-0 ${i % 2 === 0 ? "bg-muted/20" : ""}`}
                        >
                          <td
                            className={`py-1.5 px-1 text-xs ${isPending ? "text-amber-700 font-medium" : "text-foreground"}`}
                          >
                            <span
                              className="inline-block w-2 h-2 rounded-full mr-2 flex-shrink-0 align-middle"
                              style={{
                                background: PIE_COLORS[i % PIE_COLORS.length],
                              }}
                            />
                            {r.name}
                          </td>
                          <td className="py-1.5 text-right text-xs w-12">
                            {r.count}
                          </td>
                          <td className="py-1.5 text-right text-xs text-muted-foreground w-12">
                            {r.pct}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            No resolution data available
          </p>
        )}
      </div>

      {/* SECTION 5 — AFFECTED EMPLOYEES */}
      <div
        className="rounded-xl border bg-card shadow-sm p-6"
        data-ocid="feedback.issue_employees"
      >
        <h3 className="text-base font-semibold mb-4">👥 Affected Employees</h3>
        {onSelectEmployee && (
          <p className="text-xs text-muted-foreground mb-3">
            Click any row to open the employee's profile
          </p>
        )}
        {employeeData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No employee data
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {[
                    "FSE Name",
                    "FIPL Code",
                    "Region",
                    "Case Count",
                    "Avg CES",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employeeData.slice(0, 20).map((emp, i) => {
                  const isClickable = !!(onSelectEmployee && emp.fiplCode);
                  return (
                    <tr
                      key={emp.fiplCode || i}
                      className={`border-t transition-colors ${isClickable ? "cursor-pointer hover:bg-indigo-50" : "hover:bg-muted/20"}`}
                      onClick={() => {
                        if (isClickable) onSelectEmployee(emp.fiplCode);
                      }}
                      onKeyDown={(e) => {
                        if (
                          isClickable &&
                          (e.key === "Enter" || e.key === " ")
                        ) {
                          onSelectEmployee(emp.fiplCode);
                        }
                      }}
                      tabIndex={isClickable ? 0 : undefined}
                      data-ocid={`feedback.affected_employee.${i + 1}`}
                    >
                      <td className="px-4 py-3 font-medium">{emp.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {emp.fiplCode}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {emp.region || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border bg-indigo-50 text-indigo-700 border-indigo-200">
                          {emp.count}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-sm font-semibold ${emp.avgCes < 30 ? "text-red-600" : "text-emerald-600"}`}
                        >
                          {emp.avgCes.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isClickable && (
                          <span className="text-xs text-indigo-600 font-medium">
                            View Profile →
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {employeeData.length > 20 && (
              <p className="text-xs text-muted-foreground text-center py-3">
                Showing top 20 of {employeeData.length} employees
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Issue Insights Dashboard Top-level ───────────────────────────────────────

function IssueInsightsDashboard({
  records,
  onSelectEmployee,
}: {
  records: DisplayRecord[];
  onSelectEmployee?: (fiplCode: string) => void;
}) {
  const [insightSearch, setInsightSearch] = useState("");
  const [insightRegion, setInsightRegion] = useState("all");
  const [selectedIssue, setSelectedIssue] = useState<CategoryKey | null>(null);

  const regionOptions = useMemo(
    () => [...new Set(records.map((r) => r.region).filter(Boolean))].sort(),
    [records],
  );

  const insightData = useMemo(
    () =>
      computeIssueInsights(
        records,
        insightRegion === "all" ? "" : insightRegion,
        insightSearch,
      ),
    [records, insightRegion, insightSearch],
  );

  const totalRecords = records.length;
  const negativeCount = records.filter((r) => r.cesScore < 30).length;
  const mostCommon = insightData[0]?.label ?? "—";

  // Export password gate
  const { granted: exportGranted } = usePasswordGate("export");
  const [pendingExportGate, setPendingExportGate] = useState(false);

  const runInsightsExport = () => {
    const filename = buildFilename(
      "Issue_Insights",
      insightRegion !== "all" ? { Region: insightRegion } : {},
    );
    exportToExcel({
      filename,
      filters: { Region: insightRegion !== "all" ? insightRegion : "All" },
      sheets: [
        {
          name: "Issue Summary",
          data: insightData.map((d) => ({
            "Issue Type": d.label,
            "Total Cases": d.count,
            "% of All Issues": `${d.pctOfTotal}%`,
            "Top Affected Regions": d.topRegions.join(", ") || "—",
          })),
          columns: [
            { key: "Issue Type", header: "Issue Type", width: 28 },
            { key: "Total Cases", header: "Total Cases", width: 14 },
            { key: "% of All Issues", header: "% of All Issues", width: 16 },
            {
              key: "Top Affected Regions",
              header: "Top Affected Regions",
              width: 35,
            },
          ],
        },
      ],
    });
  };

  if (selectedIssue) {
    return (
      <IssueDrillDown
        categoryKey={selectedIssue}
        allRecords={records}
        onBack={() => setSelectedIssue(null)}
        onSelectEmployee={onSelectEmployee}
      />
    );
  }

  return (
    <div className="space-y-5" data-ocid="feedback.issue_insights">
      {pendingExportGate && (
        <PasswordGate
          gateKey="export"
          onUnlock={() => {
            setPendingExportGate(false);
            runInsightsExport();
          }}
          onCancel={() => setPendingExportGate(false)}
        />
      )}
      {/* Section heading */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">
            📊 Issue Insights Dashboard
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Understand which issues are most common, where they happen, and how
            often they repeat
          </p>
        </div>
        <button
          type="button"
          data-ocid="feedback.issue_insights_export_button"
          onClick={() => {
            if (exportGranted) runInsightsExport();
            else setPendingExportGate(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-indigo-300 bg-background px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-colors shadow-sm shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          Export Insights
        </button>
      </div>

      {/* KPI summary chips */}
      <div
        className="flex flex-wrap gap-3"
        data-ocid="feedback.issue_insights_kpis"
      >
        <div className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 shadow-sm">
          <span className="text-xs text-muted-foreground font-medium">
            Total Feedback Records:
          </span>
          <span className="text-sm font-bold text-foreground">
            {totalRecords}
          </span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border bg-red-50 border-red-200 px-4 py-2 shadow-sm">
          <span className="text-xs text-red-600 font-medium">
            Negative CES (&lt;30):
          </span>
          <span className="text-sm font-bold text-red-700">
            {negativeCount}
          </span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border bg-indigo-50 border-indigo-200 px-4 py-2 shadow-sm">
          <span className="text-xs text-indigo-600 font-medium">
            Most Common Issue:
          </span>
          <span className="text-sm font-bold text-indigo-700">
            {mostCommon}
          </span>
        </div>
      </div>

      {/* Filters row */}
      <div
        className="flex flex-wrap gap-3 items-center"
        data-ocid="feedback.issue_insights_filters"
      >
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search issue types..."
            value={insightSearch}
            onChange={(e) => setInsightSearch(e.target.value)}
            data-ocid="feedback.issue_insights_search"
          />
        </div>
        <Select value={insightRegion} onValueChange={setInsightRegion}>
          <SelectTrigger
            className="w-44"
            data-ocid="feedback.issue_insights_region_select"
          >
            <SelectValue placeholder="All Regions" />
          </SelectTrigger>
          <SelectContent className="max-h-60 overflow-y-auto">
            <SelectItem value="all">All Regions</SelectItem>
            {regionOptions.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Issue cards grid */}
      {insightData.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 text-muted-foreground"
          data-ocid="feedback.issue_insights_empty_state"
        >
          <p className="text-base font-medium">
            No issue types match your filter
          </p>
          <p className="text-sm mt-1">
            Try clearing the search or selecting a different region
          </p>
        </div>
      ) : (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          data-ocid="feedback.issue_insights_grid"
        >
          {insightData.map((d, idx) => (
            <button
              key={d.key}
              type="button"
              data-ocid={`feedback.issue_card.${idx + 1}`}
              onClick={() => setSelectedIssue(d.key)}
              className={`group rounded-xl border text-left p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-primary ${d.bgLight} ${d.borderAccent}`}
            >
              {/* Header: label + count badge */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <span
                  className={`text-sm font-bold leading-snug ${d.textAccent}`}
                >
                  {d.label}
                </span>
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border bg-card text-foreground border-border shrink-0">
                  {d.count}
                </span>
              </div>

              {/* Repeat rate */}
              <p className="text-xs text-muted-foreground mb-3">
                <span className={`font-semibold ${d.textAccent}`}>
                  {d.pctOfTotal}%
                </span>{" "}
                of all issues
              </p>

              {/* Progress bar */}
              <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden mb-3">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${d.barWidth}%`, background: d.accent }}
                />
              </div>

              {/* Top regions */}
              {d.topRegions.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {d.topRegions.map((reg) => (
                    <span
                      key={reg}
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border bg-card text-muted-foreground border-border"
                    >
                      {reg}
                    </span>
                  ))}
                </div>
              )}

              {/* CTA */}
              <div
                className={`text-xs font-semibold ${d.textAccent} group-hover:underline mt-1`}
              >
                View Details →
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  fiplCode: "",
  customerName: "",
  contact: "",
  brand:
    Variant_tineco_ecovacs_coway_kuvings_instant.ecovacs as Variant_tineco_ecovacs_coway_kuvings_instant,
  product: "",
  cesScore: 35,
  remark: "",
  callDate: "",
  agent: "",
};

function brandEnumToStr(
  b: Variant_tineco_ecovacs_coway_kuvings_instant,
): string {
  const map: Record<string, string> = {
    [Variant_tineco_ecovacs_coway_kuvings_instant.ecovacs]: "Ecovacs",
    [Variant_tineco_ecovacs_coway_kuvings_instant.kuvings]: "Kuvings",
    [Variant_tineco_ecovacs_coway_kuvings_instant.coway]: "Coway",
    [Variant_tineco_ecovacs_coway_kuvings_instant.tineco]: "Tineco",
    [Variant_tineco_ecovacs_coway_kuvings_instant.instant]: "Instant",
  };
  return map[String(b)] ?? String(b);
}

export default function Feedback({
  onSelectEmployee,
}: {
  onSelectEmployee?: (fiplCode: string) => void;
}) {
  const { labels } = useLabels();
  const { data: sheetRecords = [], isLoading: sheetLoading } =
    useGoogleSheetCallRecords();
  const { data: liveEmployees = [] } = useEmployees();
  const { data: employees = [] } = useAllEmployees();
  const employeeCodes = employees.map((e) => e.fiplCode);
  const { data: backendFeedback = [], isLoading: backendLoading } =
    useAllFeedback(employeeCodes);
  const addFeedback = useAddFeedback();
  const batchUpload = useBatchFeedbackUpload();
  const isLoading = sheetLoading || backendLoading;

  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  const nameMap = useMemo(
    () => Object.fromEntries(employees.map((e) => [e.fiplCode, e.name])),
    [employees],
  );

  const regionMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const emp of liveEmployees) {
      if (emp.fiplCode && emp.region)
        map[normalizeKey(emp.fiplCode)] = emp.region;
    }
    return map;
  }, [liveEmployees]);

  const sheetDisplayRecords: DisplayRecord[] = useMemo(
    () =>
      sheetRecords.map((r) => ({
        id: r.id,
        fiplCode: r.fiplCode,
        fseName: r.fseName,
        customerName: r.customerName,
        brand: r.brand,
        product: r.product,
        cesScore: r.cesScore,
        remark: r.remark,
        dateOfVisit: r.dateOfVisit ?? "",
        callDate: r.callDate,
        agent: r.agent,
        source: "sheet" as const,
        typeOfIssue: r.typeOfIssue ?? "",
        resolution: r.resolution ?? "",
        region: regionMap[normalizeKey(r.fiplCode)] ?? "",
      })),
    [sheetRecords, regionMap],
  );

  const backendDisplayRecords: DisplayRecord[] = useMemo(
    () =>
      backendFeedback.map((f) => ({
        id: `be-${(f.entryId ?? 0n).toString()}`,
        fiplCode: f.fiplCode,
        fseName: nameMap[f.fiplCode] || "",
        customerName: f.customerName,
        contact: f.contact,
        brand: brandEnumToStr(f.brand),
        product: f.product,
        cesScore: f.cesScore,
        remark: f.remark,
        dateOfVisit: f.dateOfVisit ?? "",
        callDate: f.callDate,
        agent: f.agent,
        source: "manual" as const,
        typeOfIssue: "",
        resolution: "",
        region: regionMap[normalizeKey(f.fiplCode)] ?? "",
      })),
    [backendFeedback, nameMap, regionMap],
  );

  const allRecords: DisplayRecord[] = useMemo(
    () => [...sheetDisplayRecords, ...backendDisplayRecords],
    [sheetDisplayRecords, backendDisplayRecords],
  );

  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [cesFilter, setCesFilter] = useState<"all" | "positive" | "negative">(
    "all",
  );
  const [regionFilter, setRegionFilter] = useState("all");
  const [issueTypeFilter, setIssueTypeFilter] = useState("all");
  const [activeCategoryFilter, setActiveCategoryFilter] =
    useState<CategoryKey | null>(null);
  const [remarkRecord, setRemarkRecord] = useState<DisplayRecord | null>(null);
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { granted: writeGranted, grant: grantWrite } =
    usePasswordGate("feedback-write");
  const { granted: exportGranted } = usePasswordGate("export");
  const [pendingAction, setPendingAction] = useState<
    "upload" | "addRecord" | null
  >(null);
  const [pendingFeedbackExport, setPendingFeedbackExport] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — reset page on any filter change
  useEffect(() => {
    setPage(0);
  }, [
    search,
    brandFilter,
    cesFilter,
    regionFilter,
    issueTypeFilter,
    activeCategoryFilter,
  ]);

  const regionOptions = useMemo(
    () => [...new Set(allRecords.map((r) => r.region).filter(Boolean))].sort(),
    [allRecords],
  );

  const issueTypeOptions = useMemo(() => {
    const fromData = allRecords.map((r) => r.typeOfIssue).filter(Boolean);
    const combined = new Set([...KNOWN_ISSUE_TYPES, ...fromData]);
    return [...combined];
  }, [allRecords]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allRecords.filter((r) => {
      const matchSearch =
        !q ||
        (r.customerName || "").toLowerCase().includes(q) ||
        (r.fiplCode || "").toLowerCase().includes(q) ||
        (r.product || "").toLowerCase().includes(q) ||
        (r.agent || "").toLowerCase().includes(q) ||
        (r.fseName || "").toLowerCase().includes(q) ||
        (r.brand || "").toLowerCase().includes(q);
      const matchBrand =
        brandFilter === "all" ||
        r.brand.toLowerCase() === brandFilter.toLowerCase();
      const matchCes =
        cesFilter === "all" ||
        (cesFilter === "positive" && r.cesScore >= 30) ||
        (cesFilter === "negative" && r.cesScore < 30);
      const matchRegion = regionFilter === "all" || r.region === regionFilter;
      const matchIssueType =
        issueTypeFilter === "all" || r.typeOfIssue === issueTypeFilter;
      const matchCategory =
        !activeCategoryFilter ||
        classifyIssue(r.typeOfIssue).includes(activeCategoryFilter);
      return (
        matchSearch &&
        matchBrand &&
        matchCes &&
        matchRegion &&
        matchIssueType &&
        matchCategory
      );
    });
  }, [
    allRecords,
    search,
    brandFilter,
    cesFilter,
    regionFilter,
    issueTypeFilter,
    activeCategoryFilter,
  ]);

  const pages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryKey, number> = {
      "FSE Issue": 0,
      "Operation and Scheduling Issue": 0,
      "Brand Issue": 0,
      "Technical and Product Issue": 0,
      "After-Sales Issue": 0,
    };
    for (const r of allRecords) {
      for (const cat of classifyIssue(r.typeOfIssue)) {
        counts[cat] = (counts[cat] || 0) + 1;
      }
    }
    return counts;
  }, [allRecords]);

  const maxCategoryCount = useMemo(
    () => Math.max(1, ...Object.values(categoryCounts)),
    [categoryCounts],
  );

  const avgCes =
    allRecords.length > 0
      ? allRecords.reduce((s, f) => s + f.cesScore, 0) / allRecords.length
      : 0;

  function handleFormChange(
    field: keyof typeof EMPTY_FORM,
    value: string | number,
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleAddRecord() {
    const entry: FeedbackEntry = {
      entryId: 0n,
      fiplCode: form.fiplCode,
      customerName: form.customerName,
      contact: form.contact,
      brand: form.brand,
      product: form.product,
      cesScore: Number(form.cesScore),
      remark: form.remark,
      callDate: form.callDate,
      agent: form.agent,
    };
    try {
      await addFeedback.mutateAsync(entry);
      toast.success("Record added successfully");
      setDialogOpen(false);
      setForm({ ...EMPTY_FORM });
    } catch {
      toast.error("Failed to add record");
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        if (data == null) return;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(
          sheet,
          { defval: "" },
        );

        const brandMap: Record<
          string,
          Variant_tineco_ecovacs_coway_kuvings_instant
        > = {
          ecovacs: Variant_tineco_ecovacs_coway_kuvings_instant.ecovacs,
          kuvings: Variant_tineco_ecovacs_coway_kuvings_instant.kuvings,
          coway: Variant_tineco_ecovacs_coway_kuvings_instant.coway,
          tineco: Variant_tineco_ecovacs_coway_kuvings_instant.tineco,
          instant: Variant_tineco_ecovacs_coway_kuvings_instant.instant,
        };

        const records: FeedbackEntry[] = rows.map((row) => ({
          entryId: 0n,
          fiplCode: String(row["FIPL Code"] || "").trim(),
          customerName: String(row["Customer Name"] || "").trim(),
          contact: String(row["Customer Contact"] || "").trim(),
          brand:
            brandMap[
              String(row.Brand || "")
                .toLowerCase()
                .trim()
            ] ?? Variant_tineco_ecovacs_coway_kuvings_instant.ecovacs,
          product: String(row.Product || "").trim(),
          cesScore: Number(
            String(row["CES Score"] || "0").replace(/[^\d.]/g, ""),
          ),
          remark: String(row.Remark || "").trim(),
          callDate: String(row["Date of Call"] || "").trim(),
          agent: String(row.Agent || "").trim(),
        }));

        const result = await batchUpload.mutateAsync(records);
        toast.success(
          `${result.successCount} records uploaded successfully${result.failCount > 0n ? `, ${result.failCount} failed` : ""}`,
        );
      } catch {
        toast.error("Failed to parse or upload file");
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsBinaryString(file);
  }

  return (
    <div className="space-y-6">
      {/* ── Region Detail Drilldown ────────────────────────────────────────── */}
      {selectedRegion && (
        <RegionDetailPage
          selectedRegion={selectedRegion}
          allRecords={allRecords}
          onBack={() => setSelectedRegion(null)}
          onSelectEmployee={(fipl) => {
            setSelectedRegion(null);
            onSelectEmployee?.(fipl);
          }}
        />
      )}

      {!selectedRegion && (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {labels.feedbackTitle}
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                {allRecords.length} records&nbsp;&middot;&nbsp;Avg CES:{" "}
                <span
                  className={`font-semibold ${avgCes < 30 ? "text-red-600" : "text-emerald-600"}`}
                >
                  {avgCes.toFixed(1)}/40
                </span>
              </p>
            </div>
            {/* View label — single tab now */}
            <div
              className="inline-flex items-center rounded-lg border bg-muted p-1 gap-1"
              role="tablist"
            >
              <div className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium bg-background text-foreground shadow-sm">
                <TableIcon className="w-4 h-4" />
                {labels.callingRecordsTab}
              </div>
            </div>
          </div>

          {/* ─── Region Analysis Panel ─────────────────────────────────────────────── */}
          {!isLoading && allRecords.length > 0 && (
            <RegionAnalysisPanel
              records={
                filtered.length < allRecords.length ? filtered : allRecords
              }
              onSelectRegion={setSelectedRegion}
            />
          )}

          {/* ─── Issue Category Chips ──────────────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Filter by Category
              </span>
              {activeCategoryFilter && (
                <button
                  type="button"
                  onClick={() => setActiveCategoryFilter(null)}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Clear
                </button>
              )}
            </div>
            <div
              className="flex flex-wrap gap-2"
              data-ocid="feedback.category_chips"
            >
              {ISSUE_CATEGORIES.map((cat) => {
                const count = categoryCounts[cat.key] || 0;
                const pct = Math.round((count / maxCategoryCount) * 100);
                const isActive = activeCategoryFilter === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() =>
                      setActiveCategoryFilter(isActive ? null : cat.key)
                    }
                    data-ocid={`feedback.category.${cat.key.toLowerCase().replace(/\s+/g, "_")}`}
                    className={`group relative flex flex-col gap-1 px-3 py-2 rounded-xl border text-xs font-medium transition-all min-w-[120px] ${cat.color} ${
                      isActive
                        ? "ring-2 ring-offset-1 ring-current shadow-md scale-105"
                        : "opacity-80 hover:opacity-100 hover:scale-105"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate">{cat.label}</span>
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 shrink-0 bg-white/60 text-current border-0"
                      >
                        {count}
                      </Badge>
                    </span>
                    <span className="block h-1 rounded-full bg-current/20 overflow-hidden">
                      <span
                        className="block h-full rounded-full bg-current/60 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ─── Call Records View ──────────────────────────────────────────────── */}
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  data-ocid="feedback.search_input"
                  className="pl-9"
                  placeholder="Search by employee, FIPL, customer, brand, product, agent..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Select value={brandFilter} onValueChange={setBrandFilter}>
                  <SelectTrigger className="w-40" data-ocid="feedback.select">
                    <SelectValue placeholder="All Brands" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Brands</SelectItem>
                    {BRANDS.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
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
                  <SelectTrigger className="w-44" data-ocid="feedback.select">
                    <SelectValue placeholder="All Feedbacks" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Feedbacks</SelectItem>
                    <SelectItem value="positive">Positive (CES ≥30)</SelectItem>
                    <SelectItem value="negative">
                      Negative (CES &lt;30)
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Select value={regionFilter} onValueChange={setRegionFilter}>
                  <SelectTrigger className="w-40" data-ocid="feedback.select">
                    <SelectValue placeholder="All Regions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Regions</SelectItem>
                    {regionOptions.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={issueTypeFilter}
                  onValueChange={setIssueTypeFilter}
                >
                  <SelectTrigger className="w-52" data-ocid="feedback.select">
                    <SelectValue placeholder="All Issue Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Issue Types</SelectItem>
                    {issueTypeOptions.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex-1" />

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button
                  variant="outline"
                  data-ocid="feedback.upload_button"
                  onClick={() => {
                    if (writeGranted) {
                      fileInputRef.current?.click();
                    } else {
                      setPendingAction("upload");
                    }
                  }}
                  disabled={batchUpload.isPending}
                >
                  {batchUpload.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Upload Excel
                </Button>

                <Button
                  data-ocid="feedback.open_modal_button"
                  onClick={() => {
                    if (writeGranted) {
                      setDialogOpen(true);
                    } else {
                      setPendingAction("addRecord");
                    }
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Record
                </Button>
              </div>
            </div>

            {/* Add Record Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogContent
                className="max-w-lg max-h-[90vh] overflow-y-auto"
                data-ocid="feedback.dialog"
              >
                <DialogHeader>
                  <DialogTitle>Add Calling Record</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>FIPL Code</Label>
                      <Input
                        data-ocid="feedback.input"
                        value={form.fiplCode}
                        onChange={(e) =>
                          handleFormChange("fiplCode", e.target.value)
                        }
                        placeholder="e.g. FIPL-001"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Customer Name</Label>
                      <Input
                        value={form.customerName}
                        onChange={(e) =>
                          handleFormChange("customerName", e.target.value)
                        }
                        placeholder="Full name"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Contact</Label>
                      <Input
                        value={form.contact}
                        onChange={(e) =>
                          handleFormChange("contact", e.target.value)
                        }
                        placeholder="Phone / email"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Brand</Label>
                      <Select
                        value={form.brand}
                        onValueChange={(v) =>
                          handleFormChange(
                            "brand",
                            v as Variant_tineco_ecovacs_coway_kuvings_instant,
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BRANDS.map((b) => (
                            <SelectItem
                              key={b.toLowerCase()}
                              value={b.toLowerCase()}
                            >
                              {b}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Product</Label>
                      <Input
                        value={form.product}
                        onChange={(e) =>
                          handleFormChange("product", e.target.value)
                        }
                        placeholder="Product name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>CES Score (0–40)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={40}
                        value={form.cesScore}
                        onChange={(e) =>
                          handleFormChange("cesScore", Number(e.target.value))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Remark</Label>
                    <Textarea
                      data-ocid="feedback.textarea"
                      value={form.remark}
                      onChange={(e) =>
                        handleFormChange("remark", e.target.value)
                      }
                      rows={3}
                      placeholder="Notes about the call..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Date of Call</Label>
                      <Input
                        type="date"
                        value={form.callDate}
                        onChange={(e) =>
                          handleFormChange("callDate", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Agent</Label>
                      <Input
                        value={form.agent}
                        onChange={(e) =>
                          handleFormChange("agent", e.target.value)
                        }
                        placeholder="Agent name"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    data-ocid="feedback.cancel_button"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    data-ocid="feedback.submit_button"
                    onClick={handleAddRecord}
                    disabled={addFeedback.isPending}
                  >
                    {addFeedback.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Save Record
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Remark Preview Dialog */}
            <Dialog
              open={remarkRecord !== null}
              onOpenChange={(open) => {
                if (!open) setRemarkRecord(null);
              }}
            >
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Feedback Details</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="font-semibold">FSE / Employee: </span>
                    {remarkRecord?.fseName || remarkRecord?.fiplCode || "—"}
                  </div>
                  <div>
                    <span className="font-semibold">FIPL Code: </span>
                    {remarkRecord?.fiplCode}
                  </div>
                  {remarkRecord?.region && (
                    <div>
                      <span className="font-semibold">Region: </span>
                      {remarkRecord.region}
                    </div>
                  )}
                  <div>
                    <span className="font-semibold">Customer: </span>
                    {remarkRecord?.customerName}
                  </div>
                  <div>
                    <span className="font-semibold">Brand: </span>
                    {remarkRecord?.brand}
                  </div>
                  <div>
                    <span className="font-semibold">Product: </span>
                    {remarkRecord?.product}
                  </div>
                  <div>
                    <span className="font-semibold">CES Score: </span>
                    <span
                      className={
                        remarkRecord && remarkRecord.cesScore < 30
                          ? "text-red-600 font-semibold"
                          : "text-green-600 font-semibold"
                      }
                    >
                      {remarkRecord?.cesScore} (
                      {remarkRecord && remarkRecord.cesScore >= 30
                        ? "Positive"
                        : "Negative"}
                      )
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold">Date of Visit: </span>
                    {formatDisplayDate(remarkRecord?.dateOfVisit)}
                  </div>
                  <div>
                    <span className="font-semibold">Agent: </span>
                    {remarkRecord?.agent || "—"}
                  </div>
                  <div>
                    <span className="font-semibold">Type of Issue: </span>
                    {remarkRecord?.typeOfIssue || "—"}
                  </div>
                  <div>
                    <span className="font-semibold">Resolution: </span>
                    {remarkRecord?.resolution || "—"}
                  </div>
                  <div className="border-t pt-3">
                    <span className="font-semibold block mb-1">
                      Full Remark:
                    </span>
                    <p className="text-muted-foreground leading-relaxed">
                      {remarkRecord?.remark || "No remark"}
                    </p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Summary bar */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{filtered.length} records</span>
              {filtered.length > 0 && (
                <span>
                  Avg CES:{" "}
                  <span
                    className={`font-medium ${filtered.reduce((s, f) => s + f.cesScore, 0) / filtered.length < 30 ? "text-red-600" : "text-emerald-600"}`}
                  >
                    {(
                      filtered.reduce((s, f) => s + f.cesScore, 0) /
                      filtered.length
                    ).toFixed(1)}
                    /40
                  </span>
                </span>
              )}
              <div className="flex-1" />
              {pendingFeedbackExport && (
                <PasswordGate
                  gateKey="export"
                  onUnlock={() => {
                    setPendingFeedbackExport(false);
                    const filename = buildFilename("Feedback", {
                      CES: cesFilter,
                      Region: regionFilter,
                      IssueType: issueTypeFilter,
                      Search: search,
                    });
                    const filterLabels: Record<string, string> = {
                      Search: search || "All",
                      CES:
                        cesFilter === "positive"
                          ? "Positive (≥30)"
                          : cesFilter === "negative"
                            ? "Negative (<30)"
                            : "All",
                      Region: regionFilter !== "all" ? regionFilter : "All",
                      "Issue Type":
                        issueTypeFilter !== "all" ? issueTypeFilter : "All",
                    };
                    exportToExcel({
                      filename,
                      filters: filterLabels,
                      sheets: [
                        {
                          name: "Feedback Records",
                          data: filtered.map((r) => ({
                            "Employee Name": r.fseName || r.fiplCode || "—",
                            "FIPL Code": r.fiplCode,
                            "Customer Name": r.customerName,
                            Brand: r.brand,
                            Product: r.product,
                            "CES Score": r.cesScore,
                            "Date of Visit": formatDisplayDate(r.dateOfVisit),
                            Agent: r.agent || "—",
                            Region: r.region || "—",
                            "Type of Issue": r.typeOfIssue || "—",
                            Resolution: r.resolution || "—",
                            Remarks: r.remark || "—",
                          })),
                          columns: [
                            {
                              key: "Employee Name",
                              header: "Employee Name",
                              width: 22,
                            },
                            {
                              key: "FIPL Code",
                              header: "FIPL Code",
                              width: 14,
                            },
                            {
                              key: "Customer Name",
                              header: "Customer Name",
                              width: 22,
                            },
                            { key: "Brand", header: "Brand", width: 14 },
                            { key: "Product", header: "Product", width: 22 },
                            {
                              key: "CES Score",
                              header: "CES Score",
                              width: 12,
                            },
                            {
                              key: "Date of Visit",
                              header: "Date of Visit",
                              width: 14,
                            },
                            { key: "Agent", header: "Agent", width: 18 },
                            { key: "Region", header: "Region", width: 16 },
                            {
                              key: "Type of Issue",
                              header: "Type of Issue",
                              width: 28,
                            },
                            {
                              key: "Resolution",
                              header: "Resolution",
                              width: 28,
                            },
                            { key: "Remarks", header: "Remarks", width: 45 },
                          ],
                        },
                      ],
                    });
                  }}
                  onCancel={() => setPendingFeedbackExport(false)}
                />
              )}
              <button
                type="button"
                data-ocid="feedback.export_button"
                onClick={() => {
                  if (exportGranted) {
                    const filename = buildFilename("Feedback", {
                      CES: cesFilter,
                      Region: regionFilter,
                      IssueType: issueTypeFilter,
                      Search: search,
                    });
                    const filterLabels: Record<string, string> = {
                      Search: search || "All",
                      CES:
                        cesFilter === "positive"
                          ? "Positive (≥30)"
                          : cesFilter === "negative"
                            ? "Negative (<30)"
                            : "All",
                      Region: regionFilter !== "all" ? regionFilter : "All",
                      "Issue Type":
                        issueTypeFilter !== "all" ? issueTypeFilter : "All",
                    };
                    exportToExcel({
                      filename,
                      filters: filterLabels,
                      sheets: [
                        {
                          name: "Feedback Records",
                          data: filtered.map((r) => ({
                            "Employee Name": r.fseName || r.fiplCode || "—",
                            "FIPL Code": r.fiplCode,
                            "Customer Name": r.customerName,
                            Brand: r.brand,
                            Product: r.product,
                            "CES Score": r.cesScore,
                            "Date of Visit": formatDisplayDate(r.dateOfVisit),
                            Agent: r.agent || "—",
                            Region: r.region || "—",
                            "Type of Issue": r.typeOfIssue || "—",
                            Resolution: r.resolution || "—",
                            Remarks: r.remark || "—",
                          })),
                          columns: [
                            {
                              key: "Employee Name",
                              header: "Employee Name",
                              width: 22,
                            },
                            {
                              key: "FIPL Code",
                              header: "FIPL Code",
                              width: 14,
                            },
                            {
                              key: "Customer Name",
                              header: "Customer Name",
                              width: 22,
                            },
                            { key: "Brand", header: "Brand", width: 14 },
                            { key: "Product", header: "Product", width: 22 },
                            {
                              key: "CES Score",
                              header: "CES Score",
                              width: 12,
                            },
                            {
                              key: "Date of Visit",
                              header: "Date of Visit",
                              width: 14,
                            },
                            { key: "Agent", header: "Agent", width: 18 },
                            { key: "Region", header: "Region", width: 16 },
                            {
                              key: "Type of Issue",
                              header: "Type of Issue",
                              width: 28,
                            },
                            {
                              key: "Resolution",
                              header: "Resolution",
                              width: 28,
                            },
                            { key: "Remarks", header: "Remarks", width: 45 },
                          ],
                        },
                      ],
                    });
                  } else {
                    setPendingFeedbackExport(true);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-indigo-300 bg-background px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
            </div>

            {/* Table */}
            <div
              className="rounded-xl border overflow-x-auto"
              data-ocid="feedback.table"
            >
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {[
                      "Date of Visit",
                      "FSE",
                      "Customer Name",
                      "Region",
                      "Brand",
                      "Product",
                      "CES Score",
                      "Type of Issue",
                      "Remark",
                      "Agent",
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
                        colSpan={10}
                        className="px-4 py-10 text-center text-muted-foreground"
                        data-ocid="feedback.loading_state"
                      >
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                        Loading records from Google Sheets...
                      </td>
                    </tr>
                  ) : paginated.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-10 text-center text-muted-foreground"
                        data-ocid="feedback.empty_state"
                      >
                        No records found
                      </td>
                    </tr>
                  ) : (
                    paginated.map((f, idx) => (
                      <tr
                        key={f.id}
                        data-ocid={`feedback.item.${idx + 1}`}
                        className={`border-t transition-colors hover:bg-muted/30 ${f.cesScore < 30 ? "bg-red-50/40" : ""}`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-xs">
                          {formatDisplayDate(f.dateOfVisit)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-sm">
                            {f.fseName || nameMap[f.fiplCode] || "—"}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {f.fiplCode}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {f.customerName}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                          {f.region || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${brandColorClass(f.brand)}`}
                          >
                            {f.brand}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">{f.product}</td>
                        <td className="px-4 py-3">
                          <CesBadge score={f.cesScore} />
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {f.typeOfIssue ? (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border bg-violet-50 text-violet-700 border-violet-200 whitespace-nowrap">
                              {f.typeOfIssue}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 max-w-[200px] text-sm text-muted-foreground">
                          <button
                            type="button"
                            className="line-clamp-2 text-left cursor-pointer hover:text-blue-600 hover:underline bg-transparent border-none p-0"
                            title="Click to view full details"
                            onClick={() => setRemarkRecord(f)}
                          >
                            {f.remark || "—"}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm">{f.agent}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {page + 1} of {pages}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    data-ocid="feedback.pagination_prev"
                    disabled={page === 0}
                    onClick={() => setPage(page - 1)}
                  >
                    Prev
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    data-ocid="feedback.pagination_next"
                    disabled={page >= pages - 1}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* ─── Issue Insights Dashboard (replaces Customer Reviews) ──────────── */}
          <div
            className="rounded-xl border bg-card shadow-sm overflow-hidden"
            data-ocid="feedback.issue_insights_section"
          >
            <div className="px-5 py-4 border-b bg-muted/30">
              <h2 className="text-base font-bold tracking-tight">
                📊 Issue Insights Dashboard
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Visual breakdown of recurring issues — click any card to explore
                in depth
              </p>
            </div>
            <div className="p-5">
              {isLoading ? (
                <div
                  className="flex flex-col items-center justify-center py-16 text-muted-foreground"
                  data-ocid="feedback.issue_insights_loading"
                >
                  <Loader2 className="w-8 h-8 animate-spin mb-3" />
                  Loading insights...
                </div>
              ) : (
                <IssueInsightsDashboard
                  records={allRecords}
                  onSelectEmployee={onSelectEmployee}
                />
              )}
            </div>
          </div>

          {/* Password Gate */}
          {pendingAction && (
            <PasswordGate
              gateKey="feedback-write"
              onUnlock={() => {
                grantWrite();
                if (pendingAction === "upload") fileInputRef.current?.click();
                if (pendingAction === "addRecord") setDialogOpen(true);
                setPendingAction(null);
              }}
              onCancel={() => setPendingAction(null)}
            />
          )}
        </>
      )}
    </div>
  );
}
