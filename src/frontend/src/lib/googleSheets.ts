// Spreadsheet ID for the live Google Sheet database
const SPREADSHEET_ID = "14SPX91n8Y4rCt58bpmXOj5BGpmcIR2i3-gTJbmR_fnw";

export const SHEET_NAMES = {
  employeeData: "Employee Data",
  swotAnalysis: "SWOT Analysis",
  parameters: "Parameters",
  attendance: "Attendance",
  sales: "Sales",
  topPerformers: "Top Performers",
  callRecords: "Call Records",
  pulse: "PULSE",
  prism: "PRISM",
  personalityAnalysis: "Personality Analysis",
  issues: "Issues",
  suggestions: "Suggestions",
};

// CSV parser that handles quoted fields with commas inside them
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let fields: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else if ((ch === "\r" || ch === "\n") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      fields.push(current.trim());
      current = "";
      if (fields.some((f) => f !== "")) {
        rows.push(fields);
      }
      fields = [];
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  if (fields.some((f) => f !== "")) {
    rows.push(fields);
  }

  return rows;
}

export interface SheetData {
  headers: string[];
  rows: string[][];
}

export async function fetchSheetByName(sheetName: string): Promise<SheetData> {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(`Failed to fetch sheet "${sheetName}": ${res.status}`);
  const rawText = await res.text();
  // Strip BOM (\uFEFF) that Google Sheets sometimes prepends to CSV
  const text = rawText.replace(/^\uFEFF/, "");
  const allRows = parseCSV(text);
  if (allRows.length === 0) return { headers: [], rows: [] };
  const headers = allRows[0].map((h) => h.trim());
  const rows = allRows
    .slice(1)
    .filter((row) => row.some((cell) => cell !== ""));
  console.log(`[Sheet "${sheetName}"] Headers detected:`, headers);
  return { headers, rows };
}

export function col(headers: string[], ...candidates: string[]): number {
  for (const candidate of candidates) {
    const idx = headers.findIndex(
      (h) => h.toLowerCase().trim() === candidate.toLowerCase().trim(),
    );
    if (idx !== -1) return idx;
  }
  // Partial match fallback
  for (const candidate of candidates) {
    const idx = headers.findIndex((h) =>
      h.toLowerCase().includes(candidate.toLowerCase()),
    );
    if (idx !== -1) return idx;
  }
  return -1;
}

export function cell(
  row: string[],
  headers: string[],
  ...candidates: string[]
): string {
  const idx = col(headers, ...candidates);
  if (idx === -1) return "";
  return row[idx] ?? "";
}

// Parse date: DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, or Excel serial number
export function parseDate(val: string): string | null {
  if (!val || !val.trim()) return null;
  const v = val.trim();
  // Excel serial
  if (/^\d+$/.test(v) && Number(v) > 40000) {
    const serial = Number.parseInt(v);
    const date = new Date((serial - 25569) * 86400 * 1000);
    return date.toISOString();
  }
  // DD-MM-YYYY or DD/MM/YYYY
  const m = v.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (m) {
    return new Date(
      Number.parseInt(m[3]),
      Number.parseInt(m[2]) - 1,
      Number.parseInt(m[1]),
    ).toISOString();
  }
  // YYYY-MM-DD
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(v).toISOString();
  return null;
}

// Parse number: strip literal unicode escape sequences (e.g. \u20b9 for ₹) first,
// then strip all remaining non-digit/decimal characters
export function parseNumber(val: string): number {
  if (!val) return 0;
  // Strip literal unicode escape sequences like \u20b9 (₹) before stripping other chars
  const noEscape = val.replace(/\\u[0-9a-fA-F]{4}/gi, "");
  const cleaned = noEscape.replace(/[^\d.]/g, "");
  if (!cleaned) return 0;
  const n = Number.parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

export function normalizeText(val: string | undefined): string | null {
  if (!val) return null;
  // Decode literal unicode escapes (e.g. \u2022 stored as 6 chars in the sheet)
  const decoded = val.replace(/\\u([0-9a-fA-F]{4})/gi, (_, code) =>
    String.fromCharCode(Number.parseInt(code, 16)),
  );
  const t = decoded.trim();
  return t === "" ? null : t;
}
