// Shim to access the globally loaded XLSX from CDN (loaded via index.html script tag)
// biome-ignore lint/suspicious/noExplicitAny: CDN global
type XLSXType = any;
// biome-ignore lint/suspicious/noExplicitAny: CDN global
export const XLSX = (window as any).XLSX as XLSXType;
