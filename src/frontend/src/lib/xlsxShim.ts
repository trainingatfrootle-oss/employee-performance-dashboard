// npm-based XLSX shim — replaces the old CDN/window.XLSX approach.
// All app code should import from here rather than importing xlsx directly,
// so we retain a single, typed surface area for the library.
import * as XLSXLib from "xlsx";

export type XLSXWorkbook = XLSXLib.WorkBook;
export type XLSXWorksheet = XLSXLib.WorkSheet;

export const XLSX = {
  read: (
    data: string | ArrayBuffer,
    opts: XLSXLib.ParsingOptions,
  ): XLSXWorkbook => XLSXLib.read(data, opts),

  utils: {
    sheet_to_json: <T = Record<string, unknown>>(
      sheet: XLSXWorksheet,
      opts?: XLSXLib.Sheet2JSONOpts,
    ): T[] => XLSXLib.utils.sheet_to_json<T>(sheet, opts),

    book_new: (): XLSXWorkbook => XLSXLib.utils.book_new(),

    book_append_sheet: (
      wb: XLSXWorkbook,
      ws: XLSXWorksheet,
      name: string,
    ): void => XLSXLib.utils.book_append_sheet(wb, ws, name),

    json_to_sheet: <T = Record<string, unknown>>(data: T[]): XLSXWorksheet =>
      XLSXLib.utils.json_to_sheet(data),

    aoa_to_sheet: (data: unknown[][]): XLSXWorksheet =>
      XLSXLib.utils.aoa_to_sheet(data as any[][]), // xlsx public API requires any[][]
  },

  writeFile: (wb: XLSXWorkbook, name: string): void =>
    XLSXLib.writeFile(wb, name),
};
