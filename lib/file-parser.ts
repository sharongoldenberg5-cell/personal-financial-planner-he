// Client-side file parser types
// Actual parsing happens server-side via /api/parse-file

import type { FinancialRecord } from './types';

export interface ParseResult {
  records: FinancialRecord[];
  rawData: Record<string, string>[];
  headers: string[];
  fileName?: string;
  error?: string;
}

export interface ZipParseResult {
  files: ParseResult[];
  totalRecords: number;
  error?: string;
}

export type ApiResponse =
  | { type: 'single'; data: ParseResult }
  | { type: 'zip'; data: ZipParseResult };

export function isZipResult(result: ApiResponse): result is { type: 'zip'; data: ZipParseResult } {
  return result.type === 'zip';
}
