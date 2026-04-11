import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Trophy,
  Upload,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useLabels } from "../contexts/UILabelsContext";
import { useActor } from "../hooks/useActor";
import { useTopPerformers } from "../hooks/useAllEmployeeData";
import { XLSX } from "../lib/xlsxShim";
import type { TopPerformer } from "../types/appTypes";

const REQUIRED_COLUMNS = [
  "Rank",
  "Name",
  "FIPL Code",
  "Accessories Units",
  "Extended Warranty Units",
  "Total Sales Amount",
];

interface ParsedRow {
  rank: number;
  name: string;
  fiplCode: string;
  accessories: number;
  extendedWarranty: number;
  totalSales: number;
  errors: string[];
}

function cleanNumeric(val: unknown): string {
  return String(val ?? "")
    .replace(/₹/g, "")
    .replace(/,/g, "")
    .trim();
}

function getRankColor(rank: number): string {
  if (rank === 1) return "bg-amber-50 border-l-4 border-l-amber-400";
  if (rank === 2) return "bg-slate-50 border-l-4 border-l-slate-400";
  if (rank === 3) return "bg-orange-50 border-l-4 border-l-orange-400";
  return "";
}

function getRankBadge(rank: number) {
  if (rank === 1)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-300">
        🥇 1
      </span>
    );
  if (rank === 2)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-300">
        🥈 2
      </span>
    );
  if (rank === 3)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700 border border-orange-300">
        🥉 3
      </span>
    );
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
      {rank}
    </span>
  );
}

export default function TopPerformers() {
  const { labels } = useLabels();
  const { actor, isFetching } = useActor();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parsedRows, setParsedRows] = useState<ParsedRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const { data: topPerformers = [], isLoading: loadingPerformers } =
    useTopPerformers();

  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllEmployees();
    },
    enabled: !!actor && !isFetching,
  });

  const employeeMap = new Map(
    employees.map((e) => [e.fiplCode.trim().toUpperCase(), e]),
  );

  const mutation = useMutation({
    mutationFn: async (records: TopPerformer[]) => {
      if (!actor) throw new Error("Not connected");
      return actor.batchTopPerformersUpload(records);
    },
    onSuccess: (result) => {
      const success = Number(result.successCount);
      const fail = Number(result.failCount);
      toast.success(`${success} rows uploaded successfully, ${fail} failed`);
      queryClient.invalidateQueries({ queryKey: ["allEmployeeData"] });
      setParsedRows(null);
      setFileName(null);
    },
    onError: (err) => {
      toast.error(`Upload failed: ${String(err)}`);
    },
  });

  const parseFile = async (file: File) => {
    setParseError(null);
    setParsedRows(null);
    setFileName(file.name);

    try {
      let workbook: any;
      if (file.name.endsWith(".csv")) {
        const text = await file.text();
        workbook = XLSX.read(text, { type: "string" });
      } else {
        const buffer = await file.arrayBuffer();
        workbook = XLSX.read(buffer, { type: "array" });
      }

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(sheet, {
        defval: "",
      });

      // Check required columns
      if (rawRows.length === 0) {
        setParseError("File is empty or has no data rows.");
        return;
      }
      const firstRow = rawRows[0];
      const missing = REQUIRED_COLUMNS.filter((col) => !(col in firstRow));
      if (missing.length > 0) {
        setParseError(`Missing required columns: ${missing.join(", ")}`);
        return;
      }

      // Track seen ranks for duplicate detection
      const seenRanks = new Map<number, number>(); // rank -> first row index

      const parsed: ParsedRow[] = rawRows
        .filter((row) => {
          // Skip completely empty rows
          return REQUIRED_COLUMNS.some(
            (col) => String(row[col] ?? "").trim() !== "",
          );
        })
        .map((row) => {
          const errors: string[] = [];
          const r = row as Record<string, unknown>;

          const rankRaw = String(r.Rank ?? "").trim();
          const nameRaw = String(r.Name ?? "").trim();
          const fiplRaw = String(r["FIPL Code"] ?? "").trim();
          const accRaw = cleanNumeric(r["Accessories Units"]);
          const ewRaw = cleanNumeric(r["Extended Warranty Units"]);
          const salesRaw = cleanNumeric(r["Total Sales Amount"]);

          const rank = Number(rankRaw);
          if (!rankRaw || !Number.isInteger(rank) || rank < 1 || rank > 10) {
            errors.push("Invalid rank (must be 1–10)");
          }

          if (!nameRaw) errors.push("Name is required");

          const fiplUpper = fiplRaw.toUpperCase();
          if (!fiplRaw) {
            errors.push("FIPL Code is required");
          } else if (!employeeMap.has(fiplUpper)) {
            errors.push("Invalid FIPL Code");
          }

          const accessories = Number(accRaw);
          if (accRaw === "" || Number.isNaN(accessories) || accessories < 0) {
            errors.push("Invalid number (Accessories Units)");
          }

          const extendedWarranty = Number(ewRaw);
          if (
            ewRaw === "" ||
            Number.isNaN(extendedWarranty) ||
            extendedWarranty < 0
          ) {
            errors.push("Invalid number (Extended Warranty Units)");
          }

          const totalSales = Number(salesRaw);
          if (salesRaw === "" || Number.isNaN(totalSales) || totalSales < 0) {
            errors.push("Invalid number (Total Sales Amount)");
          }

          return {
            rank: Number.isInteger(rank) ? rank : 0,
            name: nameRaw,
            fiplCode: fiplRaw,
            accessories: Number.isNaN(accessories) ? 0 : accessories,
            extendedWarranty: Number.isNaN(extendedWarranty)
              ? 0
              : extendedWarranty,
            totalSales: Number.isNaN(totalSales) ? 0 : totalSales,
            errors,
          };
        });

      // Duplicate rank check (second pass)
      parsed.forEach((row, idx) => {
        if (row.rank >= 1 && row.rank <= 10) {
          if (seenRanks.has(row.rank)) {
            row.errors.push("Duplicate rank");
            // Also mark first occurrence
            const firstIdx = seenRanks.get(row.rank)!;
            if (!parsed[firstIdx].errors.includes("Duplicate rank")) {
              parsed[firstIdx].errors.push("Duplicate rank");
            }
          } else {
            seenRanks.set(row.rank, idx);
          }
        }
      });

      setParsedRows(parsed);
    } catch (e) {
      setParseError(`Failed to parse file: ${String(e)}`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    e.target.value = "";
  };

  const validRows = parsedRows?.filter((r) => r.errors.length === 0) ?? [];

  const handleConfirm = () => {
    const records: TopPerformer[] = validRows.map((r) => ({
      rank: BigInt(r.rank),
      name: r.name,
      fiplCode: r.fiplCode,
      accessories: BigInt(r.accessories),
      extendedWarranty: BigInt(r.extendedWarranty),
      totalSales: r.totalSales,
    }));
    mutation.mutate(records);
  };

  const sortedPerformers = [...topPerformers]
    .sort((a, b) => b.totalSales - a.totalSales)
    .slice(0, 10);

  const isLoading = loadingPerformers || loadingEmployees;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Trophy size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {labels.topPerformersTitle}
          </h1>
          <p className="text-sm text-muted-foreground">
            Upload and manage top 10 performer rankings
          </p>
        </div>
      </div>

      {/* Upload Section */}
      <Card data-ocid="uploads.card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Upload size={16} className="text-primary" />
            Upload Excel / CSV
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drop Zone */}
          {!parsedRows && (
            <button
              type="button"
              className="w-full border-2 border-dashed border-border rounded-xl p-10 flex flex-col items-center gap-3 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              data-ocid="uploads.dropzone"
            >
              <FileSpreadsheet size={40} className="text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  Click to upload .xlsx or .csv
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Required columns: Rank, Name, FIPL Code, Accessories Units,
                  Extended Warranty Units, Total Sales Amount
                </p>
              </div>
              <span
                className="mt-1 inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-border bg-background text-sm font-medium text-foreground hover:bg-muted transition-colors"
                data-ocid="uploads.upload_button"
              >
                <Upload size={14} /> Select File
              </span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.csv"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Parse Error */}
          {parseError && (
            <div
              className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive"
              data-ocid="uploads.error_state"
            >
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              {parseError}
            </div>
          )}

          {/* Preview Table */}
          {parsedRows && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    Preview: {fileName}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {parsedRows.length} rows
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-xs text-green-600 border-green-300"
                  >
                    <CheckCircle2 size={11} className="mr-1" />
                    {validRows.length} valid
                  </Badge>
                  {parsedRows.length - validRows.length > 0 && (
                    <Badge
                      variant="outline"
                      className="text-xs text-destructive border-destructive/30"
                    >
                      <AlertCircle size={11} className="mr-1" />
                      {parsedRows.length - validRows.length} invalid
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setParsedRows(null);
                      setFileName(null);
                    }}
                    data-ocid="uploads.cancel_button"
                  >
                    <X size={14} className="mr-1" /> Clear
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleConfirm}
                    disabled={validRows.length === 0 || mutation.isPending}
                    data-ocid="uploads.submit_button"
                  >
                    {mutation.isPending ? (
                      <Loader2 size={14} className="mr-1 animate-spin" />
                    ) : (
                      <CheckCircle2 size={14} className="mr-1" />
                    )}
                    {mutation.isPending ? "Saving..." : "Confirm & Save"}
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-72 rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs">Rank</TableHead>
                      <TableHead className="text-xs">Name</TableHead>
                      <TableHead className="text-xs">FIPL Code</TableHead>
                      <TableHead className="text-xs text-right">
                        Accessories
                      </TableHead>
                      <TableHead className="text-xs text-right">
                        Ext. Warranty
                      </TableHead>
                      <TableHead className="text-xs text-right">
                        Total Sales (₹)
                      </TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.map((row, idx) => (
                      <TableRow
                        key={`preview-${row.rank}-${row.fiplCode}-${idx}`}
                        data-ocid={`uploads.item.${idx + 1}`}
                        className={row.errors.length > 0 ? "bg-red-50" : ""}
                      >
                        <TableCell className="text-sm">
                          {row.rank || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.name || "—"}
                        </TableCell>
                        <TableCell className="text-sm font-mono text-xs">
                          {row.fiplCode || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-right">
                          {row.accessories}
                        </TableCell>
                        <TableCell className="text-sm text-right">
                          {row.extendedWarranty}
                        </TableCell>
                        <TableCell className="text-sm text-right">
                          ₹{row.totalSales.toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="text-xs">
                          {row.errors.length > 0 ? (
                            <span className="text-destructive flex items-start gap-1">
                              <AlertCircle
                                size={12}
                                className="mt-0.5 flex-shrink-0"
                              />
                              {row.errors.join("; ")}
                            </span>
                          ) : (
                            <span className="text-green-600 flex items-center gap-1">
                              <CheckCircle2 size={12} /> Valid
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          {/* Success/mutation state */}
          {mutation.isSuccess && (
            <div
              className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700"
              data-ocid="uploads.success_state"
            >
              <CheckCircle2 size={15} />
              Upload complete.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Display Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Trophy size={16} className="text-amber-500" />
            Top 10 Performers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div
              className="flex items-center justify-center py-16 text-muted-foreground gap-2"
              data-ocid="uploads.loading_state"
            >
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : sortedPerformers.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3"
              data-ocid="uploads.empty_state"
            >
              <FileSpreadsheet size={40} className="opacity-30" />
              <div>
                <p className="font-medium">No data available</p>
                <p className="text-xs mt-1">
                  Upload an Excel file to get started.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-16 text-xs">Rank</TableHead>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">FIPL Code</TableHead>
                    <TableHead className="text-xs text-right">
                      Accessories
                    </TableHead>
                    <TableHead className="text-xs text-right">
                      Ext. Warranty
                    </TableHead>
                    <TableHead className="text-xs text-right">
                      Total Sales (₹)
                    </TableHead>
                    <TableHead className="text-xs">Region</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPerformers.map((p, idx) => {
                    const rank = Number(p.rank);
                    const emp = employeeMap.get(
                      p.fiplCode.trim().toUpperCase(),
                    );
                    return (
                      <TableRow
                        key={p.fiplCode}
                        data-ocid={`uploads.item.${idx + 1}`}
                        className={getRankColor(rank)}
                      >
                        <TableCell className="font-medium">
                          {getRankBadge(rank)}
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {p.name}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {p.fiplCode}
                        </TableCell>
                        <TableCell className="text-sm text-right">
                          {Number(p.accessories).toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="text-sm text-right">
                          {Number(p.extendedWarranty).toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="text-sm text-right font-semibold">
                          ₹{p.totalSales.toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="text-sm">
                          {emp?.region ?? (
                            <span className="text-muted-foreground text-xs">
                              N/A
                            </span>
                          )}
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
