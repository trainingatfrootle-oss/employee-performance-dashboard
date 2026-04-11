import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PasswordGate, usePasswordGate } from "../components/PasswordGate";
import {
  type EmployeeRecord,
  useAllEmployeeData,
} from "../hooks/useAllEmployeeData";
import { useGoogleSheetEmployees } from "../hooks/useGoogleSheetEmployees";
import {
  Variant_active_onHold,
  useAddEmployee,
  useDeleteEmployee,
  useUpdateEmployee,
} from "../hooks/useQueries";
import type { Employee } from "../types/appTypes";

const PAGE_SIZE = 15;

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

const DEPARTMENTS = [
  "Enterprise Sales",
  "SMB Sales",
  "Channel",
  "Marketing",
  "Customer Success",
  "Engineering",
  "Operations",
  "Finance",
  "HR",
];

const ROLES = [
  "FSE",
  "Senior FSE",
  "Team Lead",
  "Manager",
  "Senior Manager",
  "Area Manager",
  "Regional Manager",
];

const REGIONS = ["North", "South", "East", "West", "Central"];

const EMPTY_EMPLOYEE: Employee = {
  fiplCode: "",
  name: "",
  role: "",
  department: "",
  region: "",
  status: Variant_active_onHold.active,
  joinDate: "",
  fseCategory: "",
  avatarUrl: "",
  familyDetails: "",
  pastExperience: "",
};

const normalizeKey = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

function parseYearMonth(
  d: string | null,
): { year: number; month: number } | null {
  if (!d) return null;
  // ISO strings (contain "T"): use Date object with LOCAL time to avoid UTC timezone shift
  if (d.includes("T")) {
    const dt = new Date(d);
    if (!Number.isNaN(dt.getTime()))
      return { year: dt.getFullYear(), month: dt.getMonth() + 1 };
  }
  // YYYY-MM-DD (no time component): safe to split directly
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m] = d.split("-").map(Number);
    return { year: y, month: m };
  }
  // DD-MM-YYYY or DD/MM/YYYY
  const parts = d.split(/[-\/]/).map(Number);
  if (parts.length === 3) {
    if (parts[0] > 31) return { year: parts[0], month: parts[1] };
    return { year: parts[2], month: parts[1] };
  }
  return null;
}

function monthLabel(year: number, month: number) {
  return `${MONTHS[month - 1]} ${year}`;
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

function categoryBadgeClass(cat: string) {
  if (cat === "Star") return "bg-amber-100 text-amber-800 border-amber-200";
  if (cat === "Cash Cow") return "bg-green-100 text-green-800 border-green-200";
  if (cat === "Question Mark")
    return "bg-blue-100 text-blue-800 border-blue-200";
  if (cat === "Dog") return "bg-gray-100 text-gray-700 border-gray-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function EmployeeRow({
  employee,
  employeeRecord,
  lastSalesYM,
  lastAttendanceYM,
  onSelect,
  onEdit,
  onDelete,
}: {
  employee: Employee;
  employeeRecord: EmployeeRecord | undefined;
  lastSalesYM: { year: number; month: number } | null;
  lastAttendanceYM: { year: number; month: number } | null;
  onSelect: (fiplCode: string) => void;
  onEdit: (emp: Employee) => void;
  onDelete: (fiplCode: string) => void;
}) {
  const efficiencyScore = useMemo(() => {
    const perf = employeeRecord?.performance;
    if (!perf) return null;
    const avg =
      (perf.salesInfluenceIndex +
        perf.operationalDiscipline +
        perf.productKnowledgeScore +
        perf.softSkillScore) /
      4;
    return Math.round(avg * 10) / 10;
  }, [employeeRecord]);

  const lastMonthSales = useMemo(() => {
    if (!lastSalesYM || !employeeRecord) return null;
    const sales = employeeRecord.sales;
    if (!sales.length)
      return { sum: 0, label: monthLabel(lastSalesYM.year, lastSalesYM.month) };
    const sum = sales
      .filter((s) => {
        const ym = parseYearMonth(s.date);
        return (
          ym && ym.year === lastSalesYM.year && ym.month === lastSalesYM.month
        );
      })
      .reduce((acc, s) => acc + s.amount, 0);
    return { sum, label: monthLabel(lastSalesYM.year, lastSalesYM.month) };
  }, [employeeRecord, lastSalesYM]);

  const lastMonthLapses = useMemo(() => {
    if (!lastAttendanceYM || !employeeRecord) return null;
    const att = employeeRecord.attendance;
    if (!att.length)
      return {
        count: 0,
        label: monthLabel(lastAttendanceYM.year, lastAttendanceYM.month),
      };
    const count = att.filter((a) => {
      const ym = parseYearMonth(a.date);
      return (
        ym &&
        ym.year === lastAttendanceYM.year &&
        ym.month === lastAttendanceYM.month
      );
    }).length;
    return {
      count,
      label: monthLabel(lastAttendanceYM.year, lastAttendanceYM.month),
    };
  }, [employeeRecord, lastAttendanceYM]);

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/60 transition-colors"
      data-ocid="employees.item.1"
      onClick={() => onSelect(employee.fiplCode)}
    >
      <TableCell>
        <div>
          <div className="font-medium text-foreground">{employee.name}</div>
          <div className="text-xs text-muted-foreground font-mono">
            {employee.fiplCode}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {employee.region || "—"}
      </TableCell>
      <TableCell>
        {efficiencyScore !== null ? (
          <span className="font-semibold text-foreground">
            {efficiencyScore}{" "}
            <span className="text-xs text-muted-foreground font-normal">
              / 100
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">N/A</span>
        )}
      </TableCell>
      <TableCell>
        {lastMonthLapses !== null ? (
          <div>
            <span className="font-medium">
              {lastMonthLapses.count}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                lapses
              </span>
            </span>
            <div className="text-xs text-muted-foreground">
              {lastMonthLapses.label}
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">N/A</span>
        )}
      </TableCell>
      <TableCell className="font-medium">
        {lastMonthSales !== null ? (
          <div>
            <div>{formatIndianCurrency(lastMonthSales.sum)}</div>
            <div className="text-xs text-muted-foreground">
              {lastMonthSales.label}
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">N/A</span>
        )}
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={`text-xs font-medium border ${categoryBadgeClass(employee.fseCategory)}`}
        >
          {employee.fseCategory || "—"}
        </Badge>
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            data-ocid="employees.edit_button"
            onClick={() => onEdit(employee)}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
            data-ocid="employees.delete_button"
            onClick={() => onDelete(employee.fiplCode)}
          >
            Delete
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function Employees({
  onSelectEmployee,
}: {
  onSelectEmployee: (fiplCode: string) => void;
}) {
  const {
    data: sheetEmployees = [],
    isLoading: sheetLoading,
    isError,
  } = useGoogleSheetEmployees();

  const { data: allData, isLoading: allDataLoading } = useAllEmployeeData();

  const addEmployee = useAddEmployee();
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();

  // Convert Google Sheet employees to the Employee type used by the UI
  const employees: Employee[] = useMemo(
    () =>
      sheetEmployees.map((e) => ({
        fiplCode: e.fiplCode,
        name: e.name,
        role: e.role,
        department: e.department,
        fseCategory: e.fseCategory,
        status:
          e.status.toLowerCase() === "on hold"
            ? Variant_active_onHold.onHold
            : Variant_active_onHold.active,
        joinDate: e.joinDate,
        avatarUrl: e.avatar,
        region: e.region,
        familyDetails: e.familyDetails,
        pastExperience: e.pastExperience,
      })),
    [sheetEmployees],
  );

  // Build a map from normalized FIPL → EmployeeRecord for fast lookup
  const recordMap = useMemo(() => {
    const map = new Map<string, EmployeeRecord>();
    for (const rec of allData?.employees ?? []) {
      map.set(normalizeKey(rec.fiplCode), rec);
    }
    return map;
  }, [allData]);

  // Global last uploaded month for sales (max year+month across ALL sales records)
  const lastSalesYM = useMemo(() => {
    let maxYear = 0;
    let maxMonth = 0;
    for (const s of allData?.allSalesRecords ?? []) {
      const ym = parseYearMonth(s.date);
      if (!ym) continue;
      if (ym.year > maxYear || (ym.year === maxYear && ym.month > maxMonth)) {
        maxYear = ym.year;
        maxMonth = ym.month;
      }
    }
    return maxYear ? { year: maxYear, month: maxMonth } : null;
  }, [allData]);

  // Global last uploaded month for attendance (max year+month across ALL attendance records)
  const lastAttendanceYM = useMemo(() => {
    let maxYear = 0;
    let maxMonth = 0;
    for (const emp of allData?.employees ?? []) {
      for (const a of emp.attendance) {
        const ym = parseYearMonth(a.date);
        if (!ym) continue;
        if (ym.year > maxYear || (ym.year === maxYear && ym.month > maxMonth)) {
          maxYear = ym.year;
          maxMonth = ym.month;
        }
      }
    }
    return maxYear ? { year: maxYear, month: maxMonth } : null;
  }, [allData]);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "onHold" | "inactive"
  >("all");
  const [page, setPage] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [addEmpGate, setAddEmpGate] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState<Employee>(EMPTY_EMPLOYEE);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Password gate for Actions (Edit/Delete)
  const { granted: actionsGranted, grant: grantActions } =
    usePasswordGate("employee-actions");
  const [pendingAction, setPendingAction] = useState<
    | { type: "edit"; emp: Employee }
    | { type: "delete"; fiplCode: string }
    | null
  >(null);

  const categories = useMemo(() => {
    const cats = new Set(employees.map((e) => e.fseCategory).filter(Boolean));
    return Array.from(cats).sort();
  }, [employees]);

  const regions = useMemo(() => {
    const rs = new Set(employees.map((e) => e.region).filter(Boolean));
    return Array.from(rs).sort();
  }, [employees]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return employees.filter((e) => {
      const matchSearch =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.fiplCode.toLowerCase().includes(q);
      const matchCat =
        categoryFilter === "all" || e.fseCategory === categoryFilter;
      const matchRegion = regionFilter === "all" || e.region === regionFilter;
      // Status filter: match against the sheet status string (case-insensitive)
      const sheetEmp = sheetEmployees.find(
        (se) => normalizeKey(se.fiplCode) === normalizeKey(e.fiplCode),
      );
      const rawStatus = (sheetEmp?.status || "").toLowerCase().trim();
      let matchStatus = true;
      if (statusFilter === "active") matchStatus = rawStatus === "active";
      else if (statusFilter === "onHold") matchStatus = rawStatus === "on hold";
      else if (statusFilter === "inactive")
        matchStatus = rawStatus === "inactive";
      return matchSearch && matchCat && matchRegion && matchStatus;
    });
  }, [
    employees,
    sheetEmployees,
    search,
    categoryFilter,
    regionFilter,
    statusFilter,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const isLoading = sheetLoading || allDataLoading;

  const openAdd = () => {
    setEditingEmployee(null);
    setForm(EMPTY_EMPLOYEE);
    setDialogOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setForm({ ...emp });
    setDialogOpen(true);
  };

  // Password-gated handlers for Edit and Delete
  const handleEditRequest = (emp: Employee) => {
    if (actionsGranted) {
      openEdit(emp);
    } else {
      setPendingAction({ type: "edit", emp });
    }
  };

  const handleDeleteRequest = (fiplCode: string) => {
    if (actionsGranted) {
      setDeleteTarget(fiplCode);
    } else {
      setPendingAction({ type: "delete", fiplCode });
    }
  };

  const handleActionsUnlock = () => {
    grantActions();
    if (pendingAction?.type === "edit") {
      openEdit(pendingAction.emp);
    } else if (pendingAction?.type === "delete") {
      setDeleteTarget(pendingAction.fiplCode);
    }
    setPendingAction(null);
  };

  const handleSave = async () => {
    if (!form.fiplCode.trim() || !form.name.trim()) {
      toast.error("FIPL Code and Name are required");
      return;
    }
    if (editingEmployee) {
      await updateEmployee.mutateAsync(form);
      toast.success("Employee updated");
      setDialogOpen(false);
    } else {
      const res = (await addEmployee.mutateAsync(form)) as {
        ok?: string;
        err?: string;
      };
      if ("ok" in res) {
        toast.success("Employee added");
        setDialogOpen(false);
      } else {
        toast.error(res.err as string);
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteEmployee.mutateAsync(deleteTarget);
    toast.success("Employee deleted");
    setDeleteTarget(null);
  };

  const setField = (k: keyof Employee, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-4">
      {/* Error Banner */}
      {isError && (
        <div
          data-ocid="employees.error_state"
          className="flex items-center gap-2 px-4 py-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm"
        >
          <AlertTriangle size={16} className="shrink-0" />
          Could not load employee data from Google Sheets. Retrying
          automatically.
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-wrap gap-2 flex-1">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search by name or FIPL code..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                data-ocid="employees.search_input"
              />
            </div>
            <div className="flex items-center gap-1.5 min-w-[160px]">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <Select
                value={categoryFilter}
                onValueChange={(v) => {
                  setCategoryFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9" data-ocid="employees.select">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1.5 min-w-[160px]">
              <Select
                value={regionFilter}
                onValueChange={(v) => {
                  setRegionFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9" data-ocid="employees.select">
                  <SelectValue placeholder="All Regions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  {regions.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={() => setAddEmpGate(true)}
            data-ocid="employees.primary_button"
          >
            <Plus className="w-4 h-4 mr-1" /> Add Employee
          </Button>
          {addEmpGate && (
            <PasswordGate
              gateKey="add-employee"
              onUnlock={() => {
                setAddEmpGate(false);
                openAdd();
              }}
              onCancel={() => setAddEmpGate(false)}
            />
          )}
        </div>

        {/* Status switchable filter */}
        <div
          className="flex items-center gap-2"
          data-ocid="employees.status_filter"
        >
          <span className="text-xs text-muted-foreground font-medium">
            Status:
          </span>
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            {(
              [
                { value: "all", label: "All" },
                { value: "active", label: "Active" },
                { value: "onHold", label: "On Hold" },
                { value: "inactive", label: "Inactive" },
              ] as const
            ).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setStatusFilter(value);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  statusFilter === value
                    ? value === "active"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : value === "onHold"
                        ? "bg-amber-500 text-white shadow-sm"
                        : value === "inactive"
                          ? "bg-red-500 text-white shadow-sm"
                          : "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-ocid={`employees.status.${value}`}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground ml-1">
            {filtered.length} employee{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[200px]">Name / FIPL</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Efficiency</TableHead>
                  <TableHead>
                    Attendance Lapses
                    {lastAttendanceYM && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {monthLabel(
                          lastAttendanceYM.year,
                          lastAttendanceYM.month,
                        )}
                      </span>
                    )}
                  </TableHead>
                  <TableHead>
                    Sales
                    {lastSalesYM && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {monthLabel(lastSalesYM.year, lastSalesYM.month)}
                      </span>
                    )}
                  </TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-12 text-muted-foreground"
                      data-ocid="employees.loading_state"
                    >
                      Loading employees from Google Sheets...
                    </TableCell>
                  </TableRow>
                ) : paginated.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-12 text-muted-foreground"
                      data-ocid="employees.empty_state"
                    >
                      No employees found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((emp) => (
                    <EmployeeRow
                      key={emp.fiplCode}
                      employee={emp}
                      employeeRecord={recordMap.get(normalizeKey(emp.fiplCode))}
                      lastSalesYM={lastSalesYM}
                      lastAttendanceYM={lastAttendanceYM}
                      onSelect={onSelectEmployee}
                      onEdit={handleEditRequest}
                      onDelete={handleDeleteRequest}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              data-ocid="employees.pagination_prev"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="flex items-center px-3">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              data-ocid="employees.pagination_next"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="max-w-lg max-h-[90vh] overflow-y-auto"
          data-ocid="employees.dialog"
        >
          <DialogHeader>
            <DialogTitle>
              {editingEmployee ? "Edit Employee" : "Add Employee"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>FIPL Code *</Label>
              <Input
                value={form.fiplCode}
                onChange={(e) => setField("fiplCode", e.target.value)}
                disabled={!!editingEmployee}
                data-ocid="employees.input"
              />
            </div>
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setField("role", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Department</Label>
              <Select
                value={form.department}
                onValueChange={(v) => setField("department", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select dept" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Region</Label>
              <Select
                value={form.region}
                onValueChange={(v) => setField("region", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {REGIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Category (FSE)</Label>
              <Input
                value={form.fseCategory}
                onChange={(e) => setField("fseCategory", e.target.value)}
                placeholder="Star, Cash Cow..."
              />
            </div>
            <div className="space-y-1">
              <Label>Join Date</Label>
              <Input
                type="text"
                placeholder="DD-MM-YYYY"
                value={form.joinDate}
                onChange={(e) => setField("joinDate", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setField("status", v as Employee["status"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="onHold">On Hold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              data-ocid="employees.cancel_button"
            >
              Cancel
            </Button>
            <Button onClick={handleSave} data-ocid="employees.submit_button">
              {editingEmployee ? "Update" : "Add"} Employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent data-ocid="employees.modal">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the employee and all related records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-ocid="employees.cancel_button">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              data-ocid="employees.confirm_button"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Password Gate for Actions (Edit/Delete) */}
      {pendingAction && (
        <PasswordGate
          gateKey="employee-actions"
          onUnlock={handleActionsUnlock}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </div>
  );
}
