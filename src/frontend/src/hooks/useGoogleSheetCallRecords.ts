import { useQuery } from "@tanstack/react-query";
import {
  SHEET_NAMES,
  cell,
  fetchSheetByName,
  normalizeText,
  parseDate,
  parseNumber,
} from "../lib/googleSheets";

export interface GoogleSheetCallRecord {
  id: string;
  fiplCode: string;
  fseName: string;
  customerName: string;
  brand: string;
  product: string;
  cesScore: number;
  remark: string;
  callDate: string;
  agent: string;
  typeOfIssue: string;
  resolution: string;
}

// Fetch ALL call records directly — no employee-linking, no rows dropped
// Sheet 7: FIPL Code | FSE Name | Customer Name | Brand | Product |
//          CES Score | Remark | Date of Call | Agent
async function fetchCallRecords(): Promise<GoogleSheetCallRecord[]> {
  const { headers, rows } = await fetchSheetByName(SHEET_NAMES.callRecords);
  console.log("[Call Records Direct] Detected headers:", headers);

  return rows
    .map((row, idx) => {
      const fiplCode =
        normalizeText(cell(row, headers, "FIPL Code", "fipl")) ?? "";
      const fseName =
        normalizeText(cell(row, headers, "FSE Name", "FSE")) ?? "";
      const customerName =
        normalizeText(cell(row, headers, "Customer Name", "Customer")) ?? "";
      const brand = normalizeText(cell(row, headers, "Brand")) ?? "";
      const product = normalizeText(cell(row, headers, "Product")) ?? "";
      const cesScore = parseNumber(cell(row, headers, "CES Score", "CES"));
      const remark =
        normalizeText(cell(row, headers, "Remark", "Remarks", "Notes")) ?? "";
      const callDateRaw = cell(
        row,
        headers,
        "Date of Call",
        "Call Date",
        "Date",
      );
      const callDate =
        parseDate(callDateRaw) ?? normalizeText(callDateRaw) ?? "";
      const agent =
        normalizeText(cell(row, headers, "Agent", "Agent Name")) ?? "";
      const typeOfIssue =
        normalizeText(
          cell(row, headers, "Type of Issue", "Issue Type", "Type", "Issue"),
        ) ?? "";
      const resolution =
        normalizeText(
          cell(row, headers, "Resolution", "Resolve", "Resolved"),
        ) ?? "";

      return {
        id: `cr-${idx}`,
        fiplCode,
        fseName,
        customerName,
        brand,
        product,
        cesScore,
        remark,
        callDate,
        agent,
        typeOfIssue,
        resolution,
      };
    })
    .filter((r) => r.fiplCode !== "" || r.fseName !== "");
}

export function useGoogleSheetCallRecords() {
  const { data, isLoading, isError } = useQuery<GoogleSheetCallRecord[]>({
    queryKey: ["callRecordsDirect"],
    queryFn: fetchCallRecords,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchIntervalInBackground: false,
  });
  return {
    data: data ?? [],
    isLoading,
    isError,
  };
}
