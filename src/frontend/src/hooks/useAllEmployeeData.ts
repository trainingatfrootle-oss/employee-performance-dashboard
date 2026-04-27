import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  SHEET_NAMES,
  cell,
  fetchSheetByName,
  normalizeText,
  parseDate,
  parseNumber,
} from "../lib/googleSheets";

export interface EmployeeRecord {
  fiplCode: string;
  name: string;
  role: string;
  department: string;
  category: string;
  status: string;
  joinDate: string | null;
  avatar: string | null; // initials e.g. "PS"
  region: string | null;
  familyDetails: string | null;
  pastExperience: string | null;
  vehicleDetails: string | null;
  agentName: string | null;

  pulseData: Record<string, string> | null; // question -> answer
  prismData: Record<string, string> | null; // question -> answer
  personalityData: { traitLabels: string[]; scores: number[] } | null;

  performance: {
    salesInfluenceIndex: number;
    reviewCount: number;
    operationalDiscipline: number;
    productKnowledgeScore: number;
    softSkillScore: number;
    totalDemoVisits: number;
    totalComplaintVisits: number;
    totalVideoCallDemos: number;
  } | null;

  swot: {
    strengths: string | null;
    weaknesses: string | null;
    opportunities: string | null;
    threats: string | null;
    traits: string | null;
    problems: string | null;
    feedbacks: string | null;
  } | null;

  attendance: Array<{
    date: string | null;
    lapsesType: string | null;
    remarks: string | null;
  }>;

  sales: Array<{
    brand: string | null;
    product: string | null;
    type: string | null;
    date: string | null;
    quantity: number;
    amount: number;
  }>;

  feedback: Array<{
    fseName: string | null;
    customerName: string | null;
    brand: string | null;
    product: string | null;
    cesScore: number;
    remark: string | null;
    dateOfVisit: string | null;
    dateOfCall: string | null;
    agent: string | null;
    typeOfIssue: string | null;
    resolution: string | null;
  }>;
}

export interface TopPerformerRecord {
  rank: number;
  name: string;
  fiplCode: string;
  accessories: number;
  extendedWarranty: number;
  totalSales: number;
}

interface AllData {
  employees: EmployeeRecord[];
  topPerformers: TopPerformerRecord[];
  allSalesRecords: Array<{
    fiplCode: string;
    name: string;
    region: string;
    brand: string;
    product: string;
    type: string;
    date: string;
    quantity: number;
    amount: number;
  }>;
}

// Normalize FIPL codes: strip ALL non-alphanumeric chars to handle BOM, NBSP, hidden unicode
const normalizeKey = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

async function fetchAllData(): Promise<AllData> {
  const results = await Promise.allSettled([
    fetchSheetByName(SHEET_NAMES.employeeData), // 0
    fetchSheetByName(SHEET_NAMES.swotAnalysis), // 1
    fetchSheetByName(SHEET_NAMES.parameters), // 2
    fetchSheetByName(SHEET_NAMES.attendance), // 3
    fetchSheetByName(SHEET_NAMES.sales), // 4
    fetchSheetByName(SHEET_NAMES.topPerformers), // 5
    fetchSheetByName(SHEET_NAMES.callRecords), // 6
    fetchSheetByName(SHEET_NAMES.pulse), // 7
    fetchSheetByName(SHEET_NAMES.prism), // 8
    fetchSheetByName(SHEET_NAMES.personalityAnalysis), // 9
  ]);

  const getSheet = (
    result: PromiseSettledResult<{ headers: string[]; rows: string[][] }>,
    name: string,
  ) => {
    if (result.status === "rejected") {
      console.error(`Sheet "${name}" failed to load:`, result.reason);
      return { headers: [] as string[], rows: [] as string[][] };
    }
    return result.value;
  };

  const empSheet = getSheet(results[0], "Employee Data");
  const swotSheet = getSheet(results[1], "SWOT Analysis");
  const paramSheet = getSheet(results[2], "Parameters");
  const attSheet = getSheet(results[3], "Attendance");
  const salesSheet = getSheet(results[4], "Sales");
  const topSheet = getSheet(results[5], "Top Performers");
  const callSheet = getSheet(results[6], "Call Records");
  const pulseSheet = getSheet(results[7], "PULSE");
  const prismSheet = getSheet(results[8], "PRISM");
  const personalitySheet = getSheet(results[9], "Personality Analysis");

  // ── Sheet 1: Employee Data ─────────────────────────────────────────────────
  // Columns: FIPL Code | Name | Role | Department | FSE Category | Status |
  //          Joining Date | Avatar | Region | Family Details | Past Experience
  // Key: normalized (lowercase trimmed) FIPL code for robust cross-sheet matching
  const employeesMap: Record<string, EmployeeRecord> = {};
  for (const row of empSheet.rows) {
    const rawFipl = normalizeText(
      cell(row, empSheet.headers, "FIPL Code", "fipl code", "fipl") ||
        row[0] ||
        "",
    );
    if (!rawFipl) continue;
    const key = normalizeKey(rawFipl);
    employeesMap[key] = {
      fiplCode: rawFipl,
      name:
        normalizeText(
          cell(row, empSheet.headers, "Name", "FSE Name", "Employee Name"),
        ) ?? "",
      role:
        normalizeText(cell(row, empSheet.headers, "Role", "Designation")) ?? "",
      department:
        normalizeText(cell(row, empSheet.headers, "Department", "Dept")) ?? "",
      category:
        normalizeText(
          cell(row, empSheet.headers, "FSE Category", "Category"),
        ) ?? "",
      status:
        normalizeText(
          cell(row, empSheet.headers, "Status", "Employment Status"),
        ) ?? "",
      joinDate: parseDate(
        cell(
          row,
          empSheet.headers,
          "Joining Date",
          "Join Date",
          "Date of Joining",
        ),
      ),
      avatar: normalizeText(
        cell(row, empSheet.headers, "Avatar", "Avatar URL", "Initials"),
      ),
      region: normalizeText(
        cell(row, empSheet.headers, "Region", "Zone", "Area"),
      ),
      familyDetails: normalizeText(
        cell(row, empSheet.headers, "Family Details", "Family"),
      ),
      pastExperience: normalizeText(
        cell(row, empSheet.headers, "Past Experience", "Experience"),
      ),
      vehicleDetails: normalizeText(
        cell(row, empSheet.headers, "Vehicle Details", "Vehicle"),
      ),
      agentName: normalizeText(
        cell(row, empSheet.headers, "Agent Name", "Agent"),
      ),
      performance: null,
      swot: null,
      attendance: [],
      sales: [],
      feedback: [],
      pulseData: null,
      prismData: null,
      personalityData: null,
    };
  }
  console.log(
    `[Employee Data] Loaded ${Object.keys(employeesMap).length} employees`,
  );

  // ── Sheet 2: SWOT Analysis ─────────────────────────────────────────────────
  // STRICT POSITIONAL MAPPING (user-confirmed column layout):
  // A(0)=FIPL Code, B(1)=Strengths, C(2)=Weaknesses, D(3)=Opportunities,
  // E(4)=Threats, F(5)=Traits, G(6)=Problems, H(7)=SKIP, I(8)=Feedbacks
  console.log("[SWOT] Detected headers:", swotSheet.headers);
  const swotMap: Record<
    string,
    {
      strengths: string | null;
      weaknesses: string | null;
      opportunities: string | null;
      threats: string | null;
      traits: string | null;
      problems: string | null;
      feedbacks: string | null;
    }
  > = {};

  for (const row of swotSheet.rows) {
    // Always read FIPL from column A (index 0) — positional, no header dependency
    const rawFiplRaw = (row[0] ?? "")
      .replace(/\u200B|\u200C|\u200D|\uFEFF|\u00A0/g, "")
      .trim();
    if (!rawFiplRaw) continue;
    const key = normalizeKey(rawFiplRaw);

    swotMap[key] = {
      strengths: normalizeText(row[1] ?? ""),
      weaknesses: normalizeText(row[2] ?? ""),
      opportunities: normalizeText(row[3] ?? ""),
      threats: normalizeText(row[4] ?? ""),
      traits: normalizeText(row[5] ?? ""),
      problems: normalizeText(row[6] ?? ""),
      feedbacks: normalizeText(row[8] ?? ""), // col I = index 8 (col H skipped)
    };
  }

  console.log(`[SWOT] Loaded ${Object.keys(swotMap).length} SWOT records`);
  // Debug: log any SWOT keys that don't match any employee key
  const empKeys = new Set(Object.keys(employeesMap));
  for (const k of Object.keys(swotMap)) {
    if (!empKeys.has(k)) {
      console.warn(`[SWOT] No matching employee for normalized key: "${k}"`);
    }
  }

  // Attach SWOT to employees
  for (const [key, emp] of Object.entries(employeesMap)) {
    emp.swot = swotMap[key] ?? null;
    if (!emp.swot) {
      console.warn(
        `[SWOT] No SWOT entry found for employee key: "${key}" (FIPL: ${emp.fiplCode})`,
      );
    }
  }

  // ── Sheet 3: Parameters ────────────────────────────────────────────────────
  for (const row of paramSheet.rows) {
    const rawFipl = normalizeText(
      cell(row, paramSheet.headers, "FIPL Code", "fipl"),
    );
    if (!rawFipl) continue;
    const key = normalizeKey(rawFipl);
    if (!employeesMap[key]) {
      console.warn(`Parameters: FIPL "${rawFipl}" not found`);
      continue;
    }
    employeesMap[key].performance = {
      salesInfluenceIndex: parseNumber(
        cell(row, paramSheet.headers, "Sales Influence Index", "SII"),
      ),
      reviewCount: parseNumber(
        cell(row, paramSheet.headers, "Review Count", "Reviews"),
      ),
      operationalDiscipline: parseNumber(
        cell(row, paramSheet.headers, "Operational Discipline", "Discipline"),
      ),
      productKnowledgeScore: parseNumber(
        cell(
          row,
          paramSheet.headers,
          "Product Knowledge Score",
          "Product Knowledge",
        ),
      ),
      softSkillScore: parseNumber(
        cell(
          row,
          paramSheet.headers,
          "Soft Skill Score",
          "Soft Skills Score",
          "Soft Skills",
        ),
      ),
      totalDemoVisits: parseNumber(
        cell(row, paramSheet.headers, "Total Demo Visits", "Demo Visits"),
      ),
      totalComplaintVisits: parseNumber(
        cell(
          row,
          paramSheet.headers,
          "Total Complaint Visits",
          "Complaint Visits",
        ),
      ),
      totalVideoCallDemos: parseNumber(
        cell(
          row,
          paramSheet.headers,
          "Total Video Call Demos",
          "Video Call Demos",
          "Video Demos",
        ),
      ),
    };
  }

  // ── Sheet 4: Attendance ────────────────────────────────────────────────────
  for (const row of attSheet.rows) {
    const rawFipl = normalizeText(
      cell(row, attSheet.headers, "FIPL Code", "fipl"),
    );
    if (!rawFipl) continue;
    const key = normalizeKey(rawFipl);
    if (!employeesMap[key]) {
      console.warn(`Attendance: FIPL "${rawFipl}" not found`);
      continue;
    }
    employeesMap[key].attendance.push({
      date: parseDate(cell(row, attSheet.headers, "Date", "Attendance Date")),
      lapsesType: normalizeText(
        cell(row, attSheet.headers, "Lapses Type", "Lapse Type", "Type"),
      ),
      remarks: normalizeText(
        cell(row, attSheet.headers, "Remarks", "Remark", "Notes", "Reason"),
      ),
    });
  }
  console.log(`[Attendance] Loaded ${attSheet.rows.length} records`);

  // ── Sheet 5: Sales ─────────────────────────────────────────────────────────
  console.log("[Sales] Detected headers:", salesSheet.headers);
  const allSalesRecords: Array<{
    fiplCode: string;
    name: string;
    region: string;
    brand: string;
    product: string;
    type: string;
    date: string;
    quantity: number;
    amount: number;
  }> = [];
  for (const row of salesSheet.rows) {
    const rawFipl = normalizeText(
      cell(row, salesSheet.headers, "FIPL Code", "fipl"),
    );
    const brand = normalizeText(cell(row, salesSheet.headers, "Brand"));
    const product = normalizeText(cell(row, salesSheet.headers, "Product"));
    const type = normalizeText(
      cell(row, salesSheet.headers, "Type", "Sale Type"),
    );
    const dateRaw = cell(row, salesSheet.headers, "Date", "Sale Date");
    const quantityRaw = cell(row, salesSheet.headers, "Quantity", "Qty");
    const amountRaw = cell(
      row,
      salesSheet.headers,
      "Amount",
      "Amount (₹)",
      "Sales Amount",
    );
    const quantity = parseNumber(quantityRaw);
    const amount = parseNumber(amountRaw);
    const rowName =
      normalizeText(cell(row, salesSheet.headers, "Name")) || rawFipl || "";
    const rowRegion =
      normalizeText(cell(row, salesSheet.headers, "Region")) || "";
    const parsedDate = parseDate(dateRaw);
    allSalesRecords.push({
      fiplCode: rawFipl || "",
      name: rowName || "",
      region: rowRegion || "",
      brand: brand ?? "",
      product: product ?? "",
      type: type ?? "",
      date: parsedDate ?? "",
      quantity,
      amount,
    });
    if (rawFipl) {
      const key = normalizeKey(rawFipl);
      if (employeesMap[key]) {
        employeesMap[key].sales.push({
          brand,
          product,
          type,
          date: parsedDate,
          quantity,
          amount,
        });
      }
    }
  }
  const totalSalesRecords = allSalesRecords.length;
  console.log(
    `[Sales] Total records loaded: ${totalSalesRecords}, linked to employees: ${Object.values(employeesMap).reduce((s, e) => s + e.sales.length, 0)}`,
  );

  // ── Sheet 7: Call Records ──────────────────────────────────────────────────
  console.log("[Call Records] Detected headers:", callSheet.headers);
  for (const row of callSheet.rows) {
    const rawFipl = normalizeText(
      cell(row, callSheet.headers, "FIPL Code", "fipl"),
    );
    if (!rawFipl) continue;
    const key = normalizeKey(rawFipl);
    if (!employeesMap[key]) {
      console.warn(
        `Call Records: FIPL "${rawFipl}" not found in Employee Data`,
      );
      continue;
    }
    employeesMap[key].feedback.push({
      fseName: normalizeText(cell(row, callSheet.headers, "FSE Name", "FSE")),
      customerName: normalizeText(
        cell(row, callSheet.headers, "Customer Name", "Customer"),
      ),
      brand: normalizeText(cell(row, callSheet.headers, "Brand")),
      product: normalizeText(cell(row, callSheet.headers, "Product")),
      cesScore: parseNumber(cell(row, callSheet.headers, "CES Score", "CES")),
      remark: normalizeText(
        cell(row, callSheet.headers, "Remark", "Remarks", "Notes"),
      ),
      dateOfVisit: parseDate(
        cell(row, callSheet.headers, "Date of Visit", "Visit Date"),
      ),
      dateOfCall: parseDate(
        cell(row, callSheet.headers, "Date of Call", "Call Date", "Date"),
      ),
      agent: normalizeText(cell(row, callSheet.headers, "Agent", "Agent Name")),
      typeOfIssue: normalizeText(
        cell(
          row,
          callSheet.headers,
          "Type of Issue",
          "Issue Type",
          "Type",
          "Issue",
        ),
      ),
      resolution: normalizeText(
        cell(row, callSheet.headers, "Resolution", "Resolve", "Resolved"),
      ),
    });
  }
  console.log(`[Call Records] Loaded ${callSheet.rows.length} records`);

  // ── Sheet 6: Top Performers ────────────────────────────────────────────────
  const topPerformers: TopPerformerRecord[] = [];
  console.log("[Top Performers] Detected headers:", topSheet.headers);
  for (const row of topSheet.rows) {
    const rawFipl = normalizeText(
      cell(row, topSheet.headers, "fiplCode", "FIPL Code", "fipl"),
    );
    const name = normalizeText(cell(row, topSheet.headers, "name", "Name"));
    if (!name && !rawFipl) continue;
    topPerformers.push({
      rank:
        parseNumber(cell(row, topSheet.headers, "rank", "Rank")) ||
        topPerformers.length + 1,
      name: name ?? "",
      fiplCode: rawFipl ?? "",
      accessories: parseNumber(
        cell(row, topSheet.headers, "accessories", "Accessories"),
      ),
      extendedWarranty: parseNumber(
        cell(
          row,
          topSheet.headers,
          "extendedWarranty",
          "Extended Warranty",
          "warranty",
        ),
      ),
      totalSales: parseNumber(
        cell(row, topSheet.headers, "totalSales", "Total Sales", "total"),
      ),
    });
  }
  console.log(`[Top Performers] Loaded ${topPerformers.length} records`);

  // ── PULSE Sheet ───────────────────────────────────────────────────────────
  // Row 0 = headers (FIPL Code, Employee Name, Q1, Q2, ...)
  // Each subsequent row = one employee's answers
  if (pulseSheet.headers.length > 0) {
    const pulseQuestions = pulseSheet.headers.slice(2); // skip FIPL Code, Employee Name
    for (const row of pulseSheet.rows) {
      const rawFipl = (row[0] ?? "")
        .replace(/\u200B|\u200C|\u200D|\uFEFF|\u00A0/g, "")
        .trim();
      if (!rawFipl) continue;
      const key = normalizeKey(rawFipl);
      if (!employeesMap[key]) continue;
      const answers: Record<string, string> = {};
      pulseQuestions.forEach((q, i) => {
        const ans = (row[i + 2] ?? "").trim();
        if (q.trim()) answers[q.trim()] = ans;
      });
      employeesMap[key].pulseData = answers;
    }
  }
  console.log(`[PULSE] Loaded ${pulseSheet.rows.length} records`);

  // ── PRISM Sheet ────────────────────────────────────────────────────────────
  if (prismSheet.headers.length > 0) {
    const prismQuestions = prismSheet.headers.slice(2); // skip FIPL Code, Employee Name
    for (const row of prismSheet.rows) {
      const rawFipl = (row[0] ?? "")
        .replace(/\u200B|\u200C|\u200D|\uFEFF|\u00A0/g, "")
        .trim();
      if (!rawFipl) continue;
      const key = normalizeKey(rawFipl);
      if (!employeesMap[key]) continue;
      const answers: Record<string, string> = {};
      prismQuestions.forEach((q, i) => {
        const ans = (row[i + 2] ?? "").trim();
        if (q.trim()) answers[q.trim()] = ans;
      });
      employeesMap[key].prismData = answers;
    }
  }
  console.log(`[PRISM] Loaded ${prismSheet.rows.length} records`);

  // ── Sheet 10: Personality Analysis ───────────────────────────────────────
  // A(0)=FIPL Code, B(1)=Name, C-G(2-6)=5 trait scores
  const FALLBACK_LABELS = [
    "Introverted ↔ Extroverted",
    "Calm ↔ Emotionally reactive",
    "Risk-averse ↔ Risk-taker",
    "Organized ↔ Spontaneous",
    "Self-doubting ↔ Confident",
  ];
  const traitLabelsFromSheet =
    personalitySheet.headers.length > 2
      ? personalitySheet.headers
          .slice(2, 7)
          .map((h, i) => h.trim() || FALLBACK_LABELS[i])
      : FALLBACK_LABELS;

  for (const row of personalitySheet.rows) {
    const rawFipl = normalizeText(row[0] || "");
    if (!rawFipl) continue;
    const key = normalizeKey(rawFipl);
    if (!employeesMap[key]) continue;
    const scores = traitLabelsFromSheet.map((_, i) =>
      parseNumber(row[i + 2] || "0"),
    );
    employeesMap[key].personalityData = {
      traitLabels: traitLabelsFromSheet,
      scores,
    };
  }
  console.log(
    `[Personality Analysis] Loaded ${personalitySheet.rows.length} records`,
  );

  const allEmployees = Object.values(employeesMap);
  console.log(
    `[Data Load Complete] Employees: ${allEmployees.length}, Sales: ${totalSalesRecords}, Feedback: ${allEmployees.reduce((s, e) => s + e.feedback.length, 0)}`,
  );
  return { employees: allEmployees, topPerformers, allSalesRecords } as AllData;
}

export function useAllEmployeeData() {
  return useQuery<AllData>({
    queryKey: ["allEmployeeData"],
    queryFn: fetchAllData,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchIntervalInBackground: false,
  });
}

export function useEmployees() {
  const { data, ...rest } = useAllEmployeeData();
  return { data: data?.employees ?? [], ...rest };
}

export function useTopPerformers() {
  const { data, ...rest } = useAllEmployeeData();
  return { data: data?.topPerformers ?? [], ...rest };
}

export { useMemo };
