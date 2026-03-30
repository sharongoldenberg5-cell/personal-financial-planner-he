import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import JSZip from 'jszip';

interface FinancialRecord {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  source: string;
}

interface MislakaProduct {
  id: string;
  owner: string;
  productType: string;
  providerName: string;
  planName: string;
  policyNumber: string;
  status: string;
  totalBalance: number;
  redemptionValue: number;
  monthlyPensionEstimate: number;
  projectedRetirementBalance: number;
  employeeContributionPct: number;
  employerContributionPct: number;
  severanceContributionPct: number;
  managementFeeDeposit: number;
  managementFeeBalance: number;
  investmentTrack: string;
  returnRate: number;
  retirementAge: number;
  joinDate: string;
  lastUpdate: string;
  deathCoverage: number;
  disabilityCoverage: number;
}

interface MislakaData {
  ownerName: string;
  ownerId: string;
  products: MislakaProduct[];
}

interface ParseResult {
  records: FinancialRecord[];
  rawData: Record<string, string>[];
  headers: string[];
  fileName?: string;
  error?: string;
  mortgageReport?: MortgageReport;
  mislakaData?: MislakaData;
}

interface MortgageSubLoan {
  subLoanNumber: string;
  loanNumber: string;
  originalAmount: number;
  currentBalance: number;
  principalBalance: number;
  interestBalance: number;
  interestRate: number;
  interestType: string;
  monthlyPayment: number;
  repaymentMethod: string;
  startDate: string;
  endDate: string;
  purpose: string;
}

interface MortgageReport {
  borrowerName: string;
  reportDate: string;
  loanNumber: string;
  totalBalance: number;
  totalPrincipal: number;
  totalInterest: number;
  subLoans: MortgageSubLoan[];
  bank: string;
}

interface ZipParseResult {
  files: ParseResult[];
  totalRecords: number;
  error?: string;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// In-memory job store for async processing
const jobs = new Map<string, { status: 'processing' | 'done' | 'error'; result?: unknown; error?: string }>();

// Cleanup old jobs after 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key] of jobs) {
    const ts = parseInt(key.split('-')[0], 36);
    if (now - ts > 600000) jobs.delete(key);
  }
}, 60000);

// Allow up to 60 seconds for OCR processing on Vercel
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const buffer = await file.arrayBuffer();
    const jobId = generateId();

    // For fast formats (Excel, CSV) - process synchronously
    if (['xlsx', 'xls', 'csv', 'tsv'].includes(ext)) {
      let result: { type: 'single'; data: ParseResult } | { type: 'zip'; data: ZipParseResult };
      if (ext === 'csv' || ext === 'tsv') {
        const text = new TextDecoder('utf-8').decode(buffer);
        result = { type: 'single', data: parseCsvFile(text, file.name) };
      } else {
        result = { type: 'single', data: parseExcelFile(buffer, file.name) };
      }
      return NextResponse.json({ jobId, status: 'done', result });
    }

    // For slow formats (PDF, Word, ZIP) - process async
    jobs.set(jobId, { status: 'processing' });

    // Fire and forget - don't await
    processFileAsync(jobId, ext, buffer, file.name);

    return NextResponse.json({ jobId, status: 'processing' });
  } catch (e) {
    return NextResponse.json({ jobId: '', status: 'error', error: String(e) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get('jobId');
  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
  }

  const job = jobs.get(jobId);
  if (!job) {
    return NextResponse.json({ status: 'not_found' }, { status: 404 });
  }

  if (job.status === 'done') {
    const result = job.result;
    jobs.delete(jobId); // Cleanup after retrieval
    return NextResponse.json({ jobId, status: 'done', result });
  }

  if (job.status === 'error') {
    const error = job.error;
    jobs.delete(jobId);
    return NextResponse.json({ jobId, status: 'error', error });
  }

  return NextResponse.json({ jobId, status: 'processing' });
}

async function processFileAsync(jobId: string, ext: string, buffer: ArrayBuffer, fileName: string) {
  try {
    let result: { type: 'single'; data: ParseResult } | { type: 'zip'; data: ZipParseResult };

    switch (ext) {
      case 'pdf':
        result = { type: 'single', data: await parsePdfFile(buffer, fileName) };
        break;
      case 'docx':
      case 'doc':
        result = { type: 'single', data: await parseWordFile(buffer, fileName) };
        break;
      case 'zip':
        result = { type: 'zip', data: await parseZipFile(buffer) };
        break;
      default:
        result = { type: 'single', data: { records: [], rawData: [], headers: [], fileName, error: `Unsupported: .${ext}` } };
    }

    jobs.set(jobId, { status: 'done', result });
  } catch (e) {
    jobs.set(jobId, { status: 'error', error: String(e) });
  }
}

// ============ Excel ============
function parseExcelFile(buffer: ArrayBuffer, fileName: string): ParseResult {
  try {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
    const headers = rawData.length > 0 ? Object.keys(rawData[0]) : [];
    const records = autoMapRecords(rawData, fileName);
    return { records, rawData, headers, fileName };
  } catch {
    return { records: [], rawData: [], headers: [], fileName, error: 'Failed to parse Excel file' };
  }
}

// ============ CSV ============
function parseCsvFile(text: string, fileName: string): ParseResult {
  try {
    const result = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
    });
    const rawData = result.data;
    const headers = result.meta.fields || [];
    const records = autoMapRecords(rawData, fileName);
    return { records, rawData, headers, fileName };
  } catch {
    return { records: [], rawData: [], headers: [], fileName, error: 'Failed to parse CSV file' };
  }
}

// ============ PDF ============
async function parsePdfFile(buffer: ArrayBuffer, fileName: string): Promise<ParseResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const pdfjsLib: any = require('pdfjs-dist/legacy/build/pdf.js');

    // Add timeout to prevent hanging on large/scanned PDFs
    const docPromise = pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('PDF_TIMEOUT')), 15000));
    const doc = await Promise.race([docPromise, timeoutPromise]) as { numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: { str: string; transform: number[] }[] }> }> };

    const allLines: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      // Group items by Y position to reconstruct lines
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: { str: string; y: number }[] = content.items.map((item: any) => ({
        str: item.str,
        y: Math.round(item.transform[5]),
      }));

      const lineMap = new Map<number, string[]>();
      for (const item of items) {
        if (!item.str.trim()) continue;
        if (!lineMap.has(item.y)) lineMap.set(item.y, []);
        lineMap.get(item.y)!.push(item.str);
      }

      // Sort by Y descending (PDF coordinates go bottom-up)
      const sortedYs = [...lineMap.keys()].sort((a, b) => b - a);
      for (const y of sortedYs) {
        const lineText = lineMap.get(y)!.join(' ').trim();
        if (lineText) allLines.push(lineText);
      }
    }

    // Also try to split concatenated text by date patterns as fallback
    // Use a lookbehind to split before dates that follow a space/number
    const expandedLines: string[] = [];
    const dateSplitPattern = /\s+(?=\d{2}[/.-]\d{2}[/.-]\d{2,4})/;
    for (const line of allLines) {
      const parts = line.split(dateSplitPattern).filter(p => p.trim());
      expandedLines.push(...parts);
    }

    let lines = expandedLines.length > allLines.length ? expandedLines : allLines;

    // Detect scanned PDF (no extractable text) - use OCR
    const totalChars = allLines.join('').replace(/\s/g, '').length;
    if (totalChars < 20) {
      try {
        const ocrLines = await ocrPdf(buffer);
        if (ocrLines.length > 0) {
          allLines.length = 0;
          allLines.push(...ocrLines);
          // Re-expand
          const ocrExpanded: string[] = [];
          for (const line of allLines) {
            const parts = line.split(dateSplitPattern).filter(p => p.trim());
            ocrExpanded.push(...parts);
          }
          lines = ocrExpanded.length > allLines.length ? ocrExpanded : allLines;
        } else {
          return {
            records: [], rawData: [], headers: [], fileName,
            error: 'PDF סרוק - לא הצלחנו לחלץ טקסט גם עם OCR.',
          };
        }
      } catch (ocrErr) {
        return {
          records: [], rawData: [], headers: [], fileName,
          error: 'PDF סרוק - שגיאה ב-OCR: ' + String(ocrErr),
        };
      }
    }

    // Detect Israeli mortgage report
    const fullText = allLines.join('\n');
    const isFIBI = fullText.includes('משנה סכום') && fullText.includes('יתרת') && fullText.includes('הלוואה');
    const isMishkan = (fullText.includes('נתונים לסילוק') && fullText.includes('חלק') && fullText.includes('יתרת הקרן'))
      || (fullText.includes('טפחות') && fullText.includes('סילוק'));
    const isHapoalim = fullText.includes('הפועלים') && fullText.includes('משכנתאות') && fullText.includes('יתרה לסילוק');
    const isMortgageReport = isFIBI || isMishkan || isHapoalim;
    if (isMortgageReport) {
      const mortgage = isFIBI ? parseMortgageReportFIBI(allLines)
        : isHapoalim ? parseMortgageReportHapoalim(allLines)
        : parseMortgageReportMishkan(allLines);
      // Create records from sub-loans for the table view
      const records: FinancialRecord[] = mortgage.subLoans.map(sl => ({
        id: generateId(),
        date: mortgage.reportDate,
        description: `משנה ${sl.subLoanNumber} - ${sl.interestType} (${sl.interestRate}%)`,
        amount: sl.currentBalance,
        type: 'expense' as const,
        category: 'mortgage',
        source: fileName,
      }));
      // Add total row
      if (mortgage.totalBalance > 0) {
        records.push({
          id: generateId(),
          date: mortgage.reportDate,
          description: `סה"כ יתרה לסילוק`,
          amount: mortgage.totalBalance,
          type: 'expense' as const,
          category: 'mortgage-total',
          source: fileName,
        });
      }
      const rawData = lines.map((line, i) => ({ line: String(i + 1), content: line.trim() }));
      return { records, rawData, headers: ['line', 'content'], fileName, mortgageReport: mortgage };
    }

    const records = extractRecordsFromText(lines, fileName);
    const rawData = lines.map((line, i) => ({ line: String(i + 1), content: line.trim() }));
    return { records, rawData, headers: ['line', 'content'], fileName };
  } catch (e) {
    const msg = String(e);
    if (msg.includes('PDF_TIMEOUT')) {
      return { records: [], rawData: [], headers: [], fileName, error: 'PDF סרוק (תמונה) - לא ניתן לחלץ טקסט. נא להשתמש בגרסה דיגיטלית של הדוח.' };
    }
    return { records: [], rawData: [], headers: [], fileName, error: 'Failed to parse PDF: ' + msg };
  }
}

// ============ Israeli Mortgage Report Parser - FIBI (Beinleumi) ============
function parseMortgageReportFIBI(lines: string[]): MortgageReport {
  const fullText = lines.join('\n');
  const subLoans: MortgageSubLoan[] = [];

  // Extract borrower name (usually line 3-4)
  let borrowerName = '';
  for (const line of lines.slice(0, 10)) {
    if (line.includes('לכבוד') || line.includes('שלום')) continue;
    if (line.match(/[א-ת]/) && !line.includes('דרך') && !line.includes('רחוב') && !line.match(/\d{5}/) && !line.includes('הלוואה') && !line.includes('א.ג.נ')) {
      if (line.match(/[א-ת]{2,}/) && line.length < 60) {
        borrowerName = line.trim();
        break;
      }
    }
  }

  // Extract report date
  let reportDate = '';
  const dateMatch = lines[0]?.match(/(\d{2}\/\d{2}\/\d{4})/);
  if (dateMatch) reportDate = dateMatch[1];

  // Detect bank
  let bank = '';
  if (fullText.includes('הבינלאומי') || fullText.includes('הראשון')) bank = 'הבנק הבינלאומי הראשון (FIBI)';
  else if (fullText.includes('הפועלים')) bank = 'בנק הפועלים';
  else if (fullText.includes('לאומי')) bank = 'בנק לאומי';
  else if (fullText.includes('דיסקונט')) bank = 'בנק דיסקונט';
  else if (fullText.includes('מזרחי')) bank = 'בנק מזרחי טפחות';

  // Extract loan number
  let loanNumber = '';
  const loanMatch = fullText.match(/(\d{2}-\d{7}-\d{2}-\d{2})/);
  if (loanMatch) loanNumber = loanMatch[1];

  // Parse each sub-loan block
  // Pattern: "סכום מספר_הלוואה.....: XX-XXXXXXX-XX-XX מספר_משנה......: NN"
  const subLoanPattern = /([\d,.]+)\s*:\.+משנה\s*סכום\s*מספר_הלוואה\.+:\s*([\d-]+)\s*מספר_משנה\.+:\s*(\d+)/g;
  let match;
  const fullJoined = lines.join(' ');

  // Simpler approach: scan lines for sub-loan markers
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('משנה סכום') || !line.includes('מספר_משנה')) continue;

    // Extract sub-loan number, loan number, and original amount from this line
    const numMatch = line.match(/מספר_משנה[.:]+\s*(\d+)/);
    const amtMatch = line.match(/([\d,]+\.\d{2})\s*:[.]+משנה\s*סכום/);
    const loanNumMatch = line.match(/מספר_הלוואה[.:]+\s*([\d-]+)/);
    if (!numMatch) continue;

    const subLoanNum = numMatch[1];
    const subLoanLoanNum = loanNumMatch ? loanNumMatch[1] : '';
    const originalAmount = amtMatch ? parseDecimal(amtMatch[1]) : 0;

    // Create a unique key to avoid duplicates
    const uniqueKey = `${subLoanLoanNum}-${subLoanNum}`;
    if (subLoans.some(sl => `${sl.loanNumber}-${sl.subLoanNumber}` === uniqueKey)) continue;

    // Look ahead in next ~20 lines for details
    let principalBalance = 0, interestBalance = 0, interestRate = 0;
    let interestType = '', monthlyPayment = 0, startDate = '', endDate = '';
    let repaymentMethod = '', currentBalance = 0, purpose = '';

    for (let j = i + 1; j < Math.min(i + 25, lines.length); j++) {
      const l = lines[j];

      // Principal balance: "XXXXXX.XX :.......הקרן יתרת"
      const principalMatch = l.match(/([\d,]+\.\d{2})\s*:[.]+הקרן\s*יתרת/);
      if (principalMatch) principalBalance = parseDecimal(principalMatch[1]);

      // Interest balance: "XXXX.XX :......ריבית יתרת"
      const intBalMatch = l.match(/([\d,]+\.\d{2})\s*:[.]+ריבית\s*יתרת/);
      if (intBalMatch) interestBalance = parseDecimal(intBalMatch[1]);

      // Current balance (sub-loan total): "XXXXXX.XX :..(**)יתרת משנה"
      const curBalMatch = l.match(/([\d,]+\.\d{2})\s*:[.]*\(\*\*\)יתרת\s*משנה/);
      if (curBalMatch) currentBalance = parseDecimal(curBalMatch[1]);

      // Monthly payment: "תשלום תקופתי )*(: XXXX.XX"
      const payMatch = l.match(/תקופתי\s*\)\*\(:\s*([\d,]+\.\d{2})\s*תשלום/);
      if (payMatch) monthlyPayment = parseDecimal(payMatch[1]);

      // Interest rate: "ריבית נוכחית )ליום מסירת המידע(..........: % X.XXX"
      const rateMatch = l.match(/נוכחית[^%]*:\s*%\s*([\d.]+)\s*ריבית/);
      if (rateMatch) interestRate = parseFloat(rateMatch[1]);

      // Interest type + indexation
      // "סוג ריבית.......: ריבית קבועה / ריבית פריים / משתנה-תשואת אג"ח"
      // "סוג הצמדה: צמוד לא / צמוד מדד"
      if (l.includes('ריבית קבועה') && !interestType) interestType = 'קבועה';
      else if (l.includes('פריים') && l.includes('ריבית') && !interestType) interestType = 'פריים';
      else if (l.includes('משתנה') && (l.includes('ריבית') || l.includes('תשואת')) && !interestType) interestType = 'משתנה';

      // Indexation: "צמוד לא" = לא צמוד, "צמוד מדד" = צמוד
      if (l.includes('סוג הצמדה') || l.includes('הצמדה:') || l.includes('הצמדת')) {
        if (l.includes('צמוד לא') || l.includes('לא צמוד')) {
          if (interestType === 'קבועה') interestType = 'קבועה לא צמודה';
          else if (interestType === 'משתנה') interestType = 'משתנה לא צמודה';
        } else if (l.includes('צמוד מדד') || l.includes('צמודה')) {
          if (interestType === 'קבועה') interestType = 'קבועה צמודה';
          else if (interestType === 'משתנה') interestType = 'משתנה צמודה';
        }
      }

      // Repayment
      if (l.includes('שפיצר')) repaymentMethod = 'שפיצר';
      else if (l.includes('בוליט')) repaymentMethod = 'בוליט';

      // End date: "ת.סיום/סילוק"
      const endMatch = l.match(/(\d{1,2}\/\d{2}\/\d{4})\s*משנה\s*בפועל/);
      if (endMatch) endDate = endMatch[1];

      // Start date
      const startMatch = l.match(/מתן\.ת[^:]*:\s*(\d{1,2}\/\d{2}\/\d{4})/);
      if (!startMatch) {
        const startMatch2 = l.match(/(\d{1,2}\/\d{2}\/\d{4})\s*:[.]+מתן\.ת/);
        if (startMatch2) startDate = startMatch2[1];
      } else {
        startDate = startMatch[1];
      }

      // Purpose
      if (l.includes('מטרת')) purpose = l.includes('רכישת דירה') ? 'רכישת דירה' : 'הלוואה לדיור';

      // Stop at next sub-loan or at summary section
      if (j > i + 1 && lines[j]?.includes('משנה סכום') && lines[j]?.includes('מספר_משנה')) break;
      if (l.includes('להלוואה סה"כ') || l.includes('ללווה') || l.includes('====')) break;
    }

    if (currentBalance === 0) currentBalance = principalBalance + interestBalance;

    subLoans.push({
      subLoanNumber: subLoanNum,
      loanNumber: subLoanLoanNum || loanNumber,
      originalAmount,
      currentBalance,
      principalBalance,
      interestBalance,
      interestRate,
      interestType,
      monthlyPayment,
      repaymentMethod,
      startDate,
      endDate,
      purpose,
    });
  }

  // Extract totals
  let totalBalance = 0, totalPrincipal = 0, totalInterest = 0;
  const totalMatch = fullText.match(/([\d,]+\.\d{2})\s*:[.]*לסילוק\s*סה"כ/);
  if (totalMatch) totalBalance = parseDecimal(totalMatch[1]);

  const totalPrincipalMatch = fullText.match(/([\d,]+\.\d{2})\s*:[.]+הקרן\s*יתרת[\s\S]*?סה"כ/);
  // Use last occurrence of principal in totals section
  for (const line of lines) {
    if (line.includes('סה"כ') || line.includes('ללווה')) {
      const pm = line.match(/([\d,]+\.\d{2})\s*:[.]+הקרן\s*יתרת/);
      if (pm) totalPrincipal = parseDecimal(pm[1]);
      const im = line.match(/([\d,]+\.\d{2})\s*:[.]+ריבית\s*יתרת/);
      if (im) totalInterest = parseDecimal(im[1]);
    }
  }

  // Fallback: sum sub-loans
  if (totalBalance === 0) totalBalance = subLoans.reduce((s, l) => s + l.currentBalance, 0);

  return {
    borrowerName,
    reportDate,
    loanNumber,
    totalBalance,
    totalPrincipal,
    totalInterest,
    subLoans,
    bank,
  };
}

// ============ Israeli Mortgage Report Parser - Hapoalim ============
function parseMortgageReportHapoalim(lines: string[]): MortgageReport {
  const fullText = lines.join('\n');
  const subLoans: MortgageSubLoan[] = [];

  // Extract borrower name - "לכבוד" line followed by name
  let borrowerName = '';
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('לכבוד')) {
      // Name is usually on the same line after "לכבוד" or the next line
      const afterLkavod = lines[i].replace(/.*לכבוד/, '').trim();
      if (afterLkavod.match(/[א-ת]{2,}/)) {
        // Extract date first then name
        const namePart = afterLkavod.replace(/תאריך.*/, '').trim();
        if (!namePart) {
          borrowerName = lines[i + 1]?.trim() || '';
        }
      } else {
        borrowerName = lines[i + 1]?.trim() || '';
      }
      break;
    }
  }
  // Try to find name near "מספר זהות"
  for (const line of lines.slice(0, 10)) {
    const nameMatch = line.match(/([א-ת]+\s+[א-ת]+)\s+מספר זהות/);
    if (nameMatch) { borrowerName = nameMatch[1]; break; }
  }

  // Extract report date
  let reportDate = '';
  for (const line of lines.slice(0, 10)) {
    const dateMatch = line.match(/תאריך[:\s]*(\d{2}\/\d{2}\/\d{4})/);
    if (dateMatch) { reportDate = dateMatch[1]; break; }
  }

  // Hapoalim format: table with columns on page 1
  // מספר הלוואה | קרן | הצמדת קרן | פיגור/עודף | ריבית | ריבית נדחית | נלווים | עמלת פירעון | יתרה לסילוק | תשלום חודשי
  // Pattern: 62/XX/XXXXXX/XXX followed by numbers
  const loanPattern = /(\d{2}\/\d{2}\/\d{6,}\/\d{3})\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)/g;

  let match;
  let loanNumber = '';
  const fullJoined = lines.join(' ');

  while ((match = loanPattern.exec(fullJoined)) !== null) {
    const num = match[1];
    if (!loanNumber) loanNumber = num;
    const principal = parseDecimal(match[2]);
    const indexation = parseDecimal(match[3]);
    const balance = parseDecimal(match[9]);
    const monthlyPayment = parseDecimal(match[10]);

    if (balance > 0) {
      subLoans.push({
        subLoanNumber: num.split('/').pop() || '',
        loanNumber: num,
        originalAmount: principal,
        currentBalance: balance,
        principalBalance: principal + indexation,
        interestBalance: parseDecimal(match[5]),
        interestRate: 0, // Will be extracted from page 2-3
        interestType: 'לא ידוע',
        monthlyPayment,
        repaymentMethod: 'שפיצר',
        startDate: '',
        endDate: '',
        purpose: 'הלוואה לדיור',
      });
    }
  }

  // If regex didn't match, try line-by-line approach
  if (subLoans.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Look for loan number pattern: 62/XX/XXXXXX/XXX
      const loanMatch = line.match(/(\d{2}\/\d{2,}\/\d{6}\/\d{3})/);
      if (loanMatch) {
        const num = loanMatch[1];
        if (!loanNumber) loanNumber = num;
        // Find amounts on same line
        const amounts = line.match(/[\d,]+\.\d{2}/g);
        if (amounts && amounts.length >= 2) {
          const nums = amounts.map(a => parseDecimal(a));
          // Last two numbers are usually balance and monthly payment
          const balance = nums[nums.length - 2] || 0;
          const monthly = nums[nums.length - 1] || 0;
          const principal = nums[0] || 0;

          if (balance > 1000) {
            subLoans.push({
              subLoanNumber: num.split('/').pop() || String(subLoans.length + 1).padStart(2, '0'),
              loanNumber: num,
              originalAmount: principal,
              currentBalance: balance,
              principalBalance: principal,
              interestBalance: 0,
              interestRate: 0,
              interestType: 'לא ידוע',
              monthlyPayment: monthly,
              repaymentMethod: 'שפיצר',
              startDate: '',
              endDate: '',
              purpose: 'הלוואה לדיור',
            });
          }
        }
      }
    }
  }

  // Extract end dates, interest types, and rates from all pages
  // Hapoalim page 2-3 structure: columns per sub-loan component

  // 1. End dates - "מועד צפוי לתשלום" line contains dates for each component
  const allDates: string[] = [];
  for (const line of lines) {
    if (line.includes('מועד צפוי') || line.includes('תאריך סילוק')) {
      const dates = line.match(/(\d{2}\/\d{2}\/\d{4})/g);
      if (dates) allDates.push(...dates);
    }
  }
  // Assign end dates - filter out past dates, sort by date
  const futureDates = [...new Set(allDates)].filter(d => {
    const parts = d.split('/');
    const date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    return date > new Date();
  }).sort((a, b) => {
    const pa = a.split('/'); const pb = b.split('/');
    return new Date(parseInt(pa[2]), parseInt(pa[1])-1, parseInt(pa[0])).getTime() -
           new Date(parseInt(pb[2]), parseInt(pb[1])-1, parseInt(pb[0])).getTime();
  });
  // Assign to sub-loans - for each loan, find the most likely end date
  // If more dates than loans, assign longest dates to indexed loans (they tend to be longer)
  for (let j = 0; j < subLoans.length; j++) {
    if (j < futureDates.length) {
      subLoans[j].endDate = futureDates[j];
    } else if (futureDates.length > 0) {
      // Use the latest date as fallback
      subLoans[j].endDate = futureDates[futureDates.length - 1];
    }
  }

  // 2. Interest type detection from all text
  // Key indicators:
  // "מדד / שער בסיס" or "הצמדת" = צמודה
  // "מועד שינוי הריבית" = משתנה (rate changes periodically)
  // No "שינוי" = קבועה
  // "פריים" or "P" = פריים
  const hasIndex = fullText.includes('מדד') && (fullText.includes('שער בסיס') || fullText.includes('הצמדת'));
  const hasRateChange = fullText.includes('שינוי הריבית') || fullText.includes('שינוי ריבית');

  // Detect interest types from page text and loan characteristics
  // Key indicators from Hapoalim:
  // - P (פריים) = ריבית יסודית נקבעת ע"י הבנק
  // - ₪ = ריבית בסיס לפי אג"ח צמודות למדד
  // - "מועד שינוי הריבית" = משתנה
  // - "מדד / שער בסיס" = צמודה למדד
  // - הצמדת קרן > 0 on page 1 = צמודה

  for (const sl of subLoans) {
    const isIndexed = sl.principalBalance > sl.originalAmount * 1.01;

    // Find loan-specific section in pages 2-3 text
    let hasLoanIndex = false;
    let hasLoanRateChange = false;
    let hasLoanPrime = false;
    const loanShort = sl.loanNumber.split('/').slice(0, 3).join('/'); // e.g. 62/58/381324

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(loanShort)) {
        // Look at surrounding 15 lines for this loan's details
        const section = lines.slice(i, Math.min(i + 15, lines.length)).join(' ');
        if (section.includes('מדד') || section.includes('שער בסיס')) hasLoanIndex = true;
        if (section.includes('שינוי') && section.includes('ריבית')) hasLoanRateChange = true;
        if (section.includes('פריים') || section.match(/\bP\b/)) hasLoanPrime = true;
      }
    }

    if (hasLoanPrime) {
      sl.interestType = 'פריים';
    } else if (isIndexed || hasLoanIndex) {
      sl.interestType = hasLoanRateChange ? 'משתנה צמודה' : 'קבועה צמודה';
    } else if (hasLoanRateChange) {
      sl.interestType = 'משתנה לא צמודה';
    } else {
      sl.interestType = 'קבועה לא צמודה';
    }
  }

  // Try to extract interest rate from OCR text first
  for (const line of lines) {
    if ((line.includes('ריבית') && line.includes('מתואמת')) || line.includes('שיעור ריבית')) {
      const rateMatches = line.match(/([\d.]+)/g);
      if (rateMatches) {
        for (const rm of rateMatches) {
          const rate = parseFloat(rm);
          if (rate > 1 && rate < 10) {
            for (const sl of subLoans) {
              if (sl.interestRate === 0) {
                sl.interestRate = rate;
                break;
              }
            }
          }
        }
      }
    }
  }

  // FALLBACK: Calculate interest rate from PMT data (reverse PMT formula)
  // For indexed loans: PMT is based on original principal, not current balance
  // For non-indexed: PMT is based on current balance
  for (const sl of subLoans) {
    if (sl.interestRate === 0 && sl.monthlyPayment > 0 && sl.currentBalance > 0 && sl.endDate) {
      const parts = sl.endDate.split('/');
      if (parts.length === 3) {
        const endDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        const now = new Date();
        const remainingMonths = Math.max(12, Math.round((endDate.getTime() - now.getTime()) / (30.44 * 24 * 60 * 60 * 1000)));
        // Reverse PMT: find r where PMT = P * [r(1+r)^n] / [(1+r)^n - 1]
        // Use Newton's method approximation
        const P = sl.currentBalance;
        const PMT = sl.monthlyPayment;
        const n = remainingMonths;

        // Try multiple principal bases for rate calculation
        // 1. Current balance (for non-indexed)
        // 2. Original amount (for indexed - PMT based on original)
        // 3. Sum of components from page 2-3 (Hapoalim splits into 201/202)
        const isIndexed = sl.interestType.includes('צמודה');
        const candidates = [P]; // currentBalance
        if (sl.originalAmount > 0 && sl.originalAmount !== P) candidates.push(sl.originalAmount);
        // For indexed Hapoalim loans: the PMT may be based on original loan amount
        // which can be different from current balance. Try reasonable multiples.
        if (isIndexed) {
          // Try the original amount (before indexation was added)
          // Also try finding component sums from "סכום הלוואה" lines
          for (const line of lines) {
            if (line.includes('סכום הלוואה') || line.includes('סכום מקורי')) {
              const amounts = line.match(/[\d,]+\.\d{2}/g);
              if (amounts) {
                const sum = amounts.reduce((s, a) => s + parseDecimal(a), 0);
                if (sum > 10000 && sum < P * 1.5 && sum > P * 0.5) {
                  if (!candidates.includes(sum)) candidates.push(sum);
                }
                // Also try individual amounts
                for (const a of amounts) {
                  const val = parseDecimal(a);
                  if (val > 10000 && !candidates.includes(val)) candidates.push(val);
                }
              }
            }
          }
        }

        let bestRate = 0;
        let bestConverged = false;
        for (const basis of candidates) {
          let lo = 0.00001;
          let hi = 0.015;
          let r = 0;
          let conv = false;
          for (let iter = 0; iter < 100; iter++) {
            r = (lo + hi) / 2;
            const rn = Math.pow(1 + r, n);
            const calcPMT = basis * r * rn / (rn - 1);
            if (Math.abs(calcPMT - PMT) < 1) { conv = true; break; }
            if (calcPMT > PMT) hi = r;
            else lo = r;
          }
          const rate = Math.round(r * 12 * 10000) / 100;
          if (conv && rate > 0.1 && rate < 15) {
            bestRate = rate;
            bestConverged = true;
            break; // Use first converging result
          }
        }

        if (bestConverged && bestRate > 0.1 && bestRate < 15) {
          sl.interestRate = bestRate;
        }
      }
    }
  }

  // Extract total from "סה"כ" line
  // In Hapoalim format: columns are: קרן | הצמדת קרן | פיגור | ריבית | ריבית נדחית | נלווים | עמלה | יתרה לסילוק | תשלום חודשי
  // So "יתרה לסילוק" is the second-to-last number
  let totalBalance = 0;
  let totalMonthly = 0;
  for (const line of lines) {
    if (line.includes('סה"כ') || line.includes('סהכ')) {
      const amounts = line.match(/[\d,]+\.\d{2}/g);
      if (amounts && amounts.length >= 2) {
        const nums = amounts.map(a => parseDecimal(a));
        // Second-to-last = total balance, last = total monthly
        totalBalance = nums[nums.length - 2] || 0;
        totalMonthly = nums[nums.length - 1] || 0;
      }
    }
  }

  if (totalBalance === 0) totalBalance = subLoans.reduce((s, l) => s + l.currentBalance, 0);

  return {
    borrowerName,
    reportDate,
    loanNumber,
    totalBalance,
    totalPrincipal: subLoans.reduce((s, l) => s + l.principalBalance, 0),
    totalInterest: subLoans.reduce((s, l) => s + l.interestBalance, 0),
    subLoans,
    bank: 'בנק הפועלים',
  };
}

// ============ Israeli Mortgage Report Parser - Mishkan/Leumi ============
function parseMortgageReportMishkan(lines: string[]): MortgageReport {
  const fullText = lines.join('\n');
  const subLoans: MortgageSubLoan[] = [];

  // Extract borrower name (after "לכבוד")
  let borrowerName = '';
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('לכבוד')) {
      // Next 1-2 lines are the name
      const names: string[] = [];
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        if (lines[j].match(/[א-ת]{2,}/) && !lines[j].includes('נתונים') && !lines[j].includes('הנדון')) {
          names.push(lines[j].trim());
        }
      }
      borrowerName = names.join(' ו/או ');
      break;
    }
  }

  // Extract report date
  let reportDate = '';
  for (const line of lines.slice(0, 15)) {
    const dm = line.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (dm) { reportDate = dm[1]; break; }
  }

  // Extract total from summary line:
  // "1,520,000.00 1,115,000.00 4,703.30 1,125,432.21 בניה עצמית"
  let totalBalance = 0;
  let totalOriginal = 0;
  let totalMonthlyPayment = 0;
  for (const line of lines) {
    if (line.includes('היתרה לסילוק בתיק') || line.includes('סכום הביצוע')) continue; // header line
    // Look for summary line: multiple amounts followed by purpose text
    const amounts = line.match(/[\d,]+\.\d{2}/g);
    if (amounts && amounts.length >= 3 && line.match(/[א-ת]/)) {
      // 4 numbers: מסגרת, ביצוע, יתרה/החזר (order varies due to RTL table rendering)
      // Strategy: largest = מסגרת, smallest = החזר חוד��י, the remaining large one = יתרה לסילוק
      const nums = amounts.map(a => parseDecimal(a));
      if (nums.length >= 4) {
        const sorted = [...nums].sort((a, b) => b - a);
        // Largest is מסגרת, second largest could be ביצוע or יתרה
        // The smallest (by far) is the monthly payment
        totalOriginal = sorted[0]; // מסגרת (largest)
        totalMonthlyPayment = sorted[sorted.length - 1]; // החזר חודשי (smallest)
        // יתרה לסילוק: the second or third largest, but should be less than מסגרת
        // and significantly larger than monthly payment
        totalBalance = sorted.find(n => n < totalOriginal && n > totalMonthlyPayment * 10) || sorted[1];
        break;
      }
    }
  }

  // Detect bank
  let bank = '';
  if (fullText.includes('טפחות')) bank = 'בנק מזרחי טפחות';
  else if (fullText.includes('משכן')) bank = 'בנק משכן (לאומי)';
  else if (fullText.includes('לאומי')) bank = 'בנק לאומי';
  else if (fullText.includes('הפועלים')) bank = 'בנק הפועלים';
  else bank = 'לא ידוע';

  // Extract loan number (תיק)
  let loanNumber = '';
  const tikMatch = fullText.match(/מס'\s*תיק[^:]*:\s*(\d+)/);
  if (tikMatch) loanNumber = tikMatch[1];

  // Parse sub-loan blocks: each starts with "חלק מס'" or "יתרת הקרן"
  // and contains "סכום הסילוק בחלק זה של ההלוואה: XX,XXX.XX"
  let partNum = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect start of a new sub-loan part
    if ((line.includes('יתרת הקרן') || (line.includes('יתרת') && !line.includes('סה"כ'))) && (line.includes('ש"ח') || line.includes('שח') || line.includes('שת'))) {
      partNum++;
      let principalBalance = 0;
      let interestRate = 0;
      let interestType = '';
      let monthlyPayment = 0;
      let originalAmount = 0;
      let settlementAmount = 0;
      let endDate = '';

      // The line with "יתרת הקרן" often has the sub-loan name and amount on the same or next line
      // Pattern: "ריבית קבועה לא צמודה למדד, גרייס חלקי 50,000.00"
      // The principal is on this line or the previous
      const principalMatch = line.match(/([\d,]+\.\d{2})/);

      // Look at surrounding lines for more detail
      for (let j = Math.max(0, i - 2); j < Math.min(i + 80, lines.length); j++) {
        const l = lines[j];

        // Principal from "יתרת הקרן" line or nearby amount line
        if (l.includes('יתרת הקרן') && l.match(/([\d,]+\.\d{2})/)) {
          // Amount might be on next line with the description
        }

        // Look for amount on same line as sub-loan description
        const descAmtMatch = l.match(/([\d,]+\.\d{2})$/);

        // סיכום ביניים (subtotal for this part)
        if (l.includes('סיכום ביניים') && l.match(/([\d,]+\.\d{2})/)) {
          const m = l.match(/([\d,]+\.\d{2})/);
          if (m) principalBalance = parseDecimal(m[1]);
        }

        // סכום חלק זה בעת הביצוע (original amount)
        if (l.includes('סכום חלק זה בעת הביצוע')) {
          const nextLine = lines[j + 1];
          const m = (l + ' ' + (nextLine || '')).match(/([\d,]+\.\d{2})/);
          if (m) originalAmount = parseDecimal(m[1]);
        }

        // סכום הסילוק בחלק זה של ההלוואה
        if (l.includes('בחלק זה של ההלוואה') && l.match(/([\d,]+\.\d{2})/)) {
          const m = l.match(/([\d,]+\.\d{2})/);
          if (m) settlementAmount = parseDecimal(m[1]);
        }

        // שיעור הריבית בחלק זה: % 4.900000
        if ((l.includes('שיעור הריבית בחלק זה') || l.includes('שיעור הריבית:')) && interestRate === 0) {
          const rateMatch = l.match(/%\s*([\d.]+)/);
          if (rateMatch) interestRate = parseFloat(rateMatch[1]);
        }

        // Fallback rate: שיעור הריבית לצרכי השוואה: X.XX %
        if (l.includes('שיעור הריבית לצרכי השוואה') && interestRate === 0) {
          const rateMatch = l.match(/([\d.]+)\s*%/);
          if (rateMatch) interestRate = parseFloat(rateMatch[1]);
        }

        // Interest type from description line (near יתרת הקרן):
        // "ריבית קבועה לא צמודה למדד" / "צמודה כל1,2.5,5 שנים" / "לא צמודה כל 2 שנים"
        if (!interestType && (l.includes('ריבית קבועה') || l.includes('ריבית משתנה'))) {
          if (l.includes('קבועה')) {
            interestType = l.includes('לא צמודה') ? 'קבועה לא צמודה' : 'קבועה צמודה';
          } else {
            interestType = l.includes('לא צמודה') ? 'משתנה לא צמודה' : 'משתנה צמודה';
          }
        }
        // Description lines like "צמודה כל1,2.5,5 שנים..." = משתנה צמודה
        if (!interestType && l.includes('צמודה כל') && l.includes('אג"ח')) {
          interestType = 'משתנה צמודה';
        }
        // "לא צמודה כל 2 שנים..." = משתנה לא צמודה
        if (!interestType && l.includes('לא צמודה כל') && l.includes('אג"ח')) {
          interestType = 'משתנה לא צמודה';
        }

        // סוג הריבית: קבועה / משתנה
        if (l.includes('סוג הריבית') && !interestType) {
          const nextL = lines[j + 1] || '';
          if (l.includes('קבועה') || nextL.includes('קבועה')) interestType = 'קבועה';
          else if (l.includes('משתנה') || nextL.includes('משתנה')) interestType = 'משתנה';
        }
        if ((l.includes('ריבית פריים') || l.includes('פריים')) && !interestType) {
          interestType = 'פריים';
        }

        // Indexation from "סוג ההצמדה"
        if ((l.includes('סוג ההצמדה') || (l.trim() === 'צמוד מדד') || (l.trim() === 'לא צמוד'))) {
          const isLinked = l.includes('צמוד מדד');
          const isNotLinked = l.includes('לא צמוד') && !l.includes('צמוד מדד');
          if (isNotLinked) {
            if (interestType === 'קבועה') interestType = 'קבועה לא צמודה';
            else if (interestType === 'משתנה') interestType = 'משתנה לא צמודה';
          } else if (isLinked) {
            if (interestType === 'קבועה') interestType = 'קבועה צמודה';
            else if (interestType === 'משתנה') interestType = 'משתנה צמודה';
          }
        }

        // End date: "תאריך סיום חלק זה של ההלוואה:"
        if (l.includes('תאריך סיום חלק זה')) {
          const nextL = lines[j + 1] || '';
          const dateMatch = (l + ' ' + nextL).match(/(\d{2}\/\d{2}\/\d{4})/);
          if (dateMatch) endDate = dateMatch[1];
        }

        // Monthly payment for this part
        if (l.includes('סכום החיוב החודשי בגין חלק זה')) {
          const m = l.match(/([\d,]+\.\d{2})/);
          if (m) monthlyPayment = parseDecimal(m[1]);
        }

        // Stop at next part
        if (j > i + 2 && lines[j]?.includes('יתרת הקרן:') && lines[j]?.includes('ש"ח')) break;
        if (l.includes('עמוד מתוך:')) break;
      }

      const balance = settlementAmount || principalBalance;
      if (balance > 0) {
        subLoans.push({
          subLoanNumber: String(partNum).padStart(2, '0'),
          loanNumber: loanNumber,
          originalAmount,
          currentBalance: balance,
          principalBalance,
          interestBalance: 0,
          interestRate,
          interestType: interestType || 'לא ידוע',
          monthlyPayment,
          repaymentMethod: '',
          startDate: '',
          endDate,
          purpose: '',
        });
      }
    }
  }

  // If we couldn't parse sub-loans but have a total, create one entry
  if (subLoans.length === 0 && totalBalance > 0) {
    subLoans.push({
      subLoanNumber: '01',
      loanNumber,
      originalAmount: totalOriginal,
      currentBalance: totalBalance,
      principalBalance: totalBalance,
      interestBalance: 0,
      interestRate: 0,
      interestType: 'מעורב',
      monthlyPayment: totalMonthlyPayment,
      repaymentMethod: '',
      startDate: '',
      endDate: '',
      purpose: '',
    });
  }

  // Use parsed total or sum sub-loans
  if (totalBalance === 0) totalBalance = subLoans.reduce((s, l) => s + l.currentBalance, 0);

  return {
    borrowerName,
    reportDate,
    loanNumber,
    totalBalance,
    totalPrincipal: subLoans.reduce((s, l) => s + l.principalBalance, 0),
    totalInterest: 0,
    subLoans,
    bank,
  };
}

// ============ Mislaka (Clearing House) ZIP Parser ============
async function parseMislakaZip(zip: JSZip, xmlEntries: [string, JSZip.JSZipObject][]): Promise<ZipParseResult> {
  const allProducts: MislakaProduct[] = [];
  let ownerName = '';
  let ownerId = '';
  const files: ParseResult[] = [];

  for (const [name, entry] of xmlEntries) {
    try {
      const xml = await entry.async('text');
      const fileType = name.includes('KGM') ? 'provident'
        : name.includes('PNN') ? 'pension'
        : name.includes('BTH') ? 'insurance'
        : 'other';

      // Extract owner info from YeshutLakoach (client), not YeshutYatzran (provider)
      if (!ownerId) {
        ownerId = xmlVal(xml, 'MISPAR-ZIHUY-LAKOACH') || '';
        // Get name from YeshutLakoach block (the actual client, not the institution contact)
        const lakoachMatch = xml.match(/<YeshutLakoach>([\s\S]*?)<\/YeshutLakoach>/);
        if (lakoachMatch) {
          const block = lakoachMatch[1];
          const fn = block.match(/<SHEM-PRATI>([^<]*)/)?.[1]?.trim() || '';
          const ln = block.match(/<SHEM-MISHPACHA>([^<]*)/)?.[1]?.trim() || '';
          if (fn && ln && !fn.includes('מוקד') && !fn.includes('Ella')) ownerName = `${fn} ${ln}`;
        }
        // Fallback
        if (!ownerName || ownerName.includes('מוקד')) ownerName = '';
      }

      // Find all product blocks - try multiple XML structures
      const blockPatterns = [
        /<HeshbonOPolisa>([\s\S]*?)<\/HeshbonOPolisa>/g,
        /<Polisa>([\s\S]*?)<\/Polisa>/g,
      ];

      let foundProducts = false;
      for (const pattern of blockPatterns) {
        let match;
        while ((match = pattern.exec(xml)) !== null) {
          const product = parseMislakaPolicy(match[1], fileType, xml);
          if (product) { allProducts.push(product); foundProducts = true; }
        }
        if (foundProducts) break;
      }

      // If no HeshbonOPolisa/Polisa blocks, try <Mutzar>
      if (!foundProducts) {
        const mutzarPattern = /<Mutzar>([\s\S]*?)<\/Mutzar>/g;
        let match;
        while ((match = mutzarPattern.exec(xml)) !== null) {
          const product = parseMislakaPolicy(match[1], fileType, xml);
          if (product) { allProducts.push(product); foundProducts = true; }
        }
      }

      // Last resort: parse whole file as one product
      if (!foundProducts) {
        const product = parseMislakaPolicy(xml, fileType, xml);
        if (product) allProducts.push(product);
      }

      files.push({
        records: [],
        rawData: [{ line: '1', content: `${fileType}: ${xmlVal(xml, 'SHEM-YATZRAN') || name}` }],
        headers: ['line', 'content'],
        fileName: name,
      });
    } catch {
      files.push({ records: [], rawData: [], headers: [], fileName: name, error: `Failed to parse ${name}` });
    }
  }

  // Also process XLS files in the ZIP (newer Mislaka format)
  for (const [name, entry] of Object.entries(zip.files)) {
    if (name.endsWith('.xls') || name.endsWith('.xlsx')) {
      try {
        const ab = await entry.async('arraybuffer');
        const wb = XLSX.read(ab, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });

        for (const row of data) {
          const product = parseMislakaExcelRow(row);
          if (product) allProducts.push(product);
        }

        files.push({
          records: [],
          rawData: data.slice(0, 5).map((r, i) => ({ line: String(i), content: Object.values(r).join(' | ') })),
          headers: Object.keys(data[0] || {}),
          fileName: name,
        });
      } catch { /* skip */ }
    }
  }

  // Build the result with mislakaData
  const mislakaData: MislakaData = { ownerName, ownerId, products: allProducts };

  // Create summary records for the preview
  const records: FinancialRecord[] = allProducts.map(p => ({
    id: generateId(),
    date: p.lastUpdate || new Date().toISOString().split('T')[0],
    description: `${getProductTypeHe(p.productType)} | ${p.providerName} | ${p.planName}`,
    amount: p.totalBalance,
    type: 'income' as const,
    category: p.productType,
    source: 'mislaka',
  }));

  return {
    files: [{
      records,
      rawData: [],
      headers: [],
      fileName: 'mislaka',
      mislakaData,
    }, ...files],
    totalRecords: records.length,
  };
}

function xmlVal(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}>([^<]*)</${tag}>`);
  const m = xml.match(re);
  return m ? m[1].trim() : '';
}

function xmlValNum(xml: string, tag: string): number {
  return parseFloat(xmlVal(xml, tag)) || 0;
}

// Sum ALL occurrences of a numeric tag within a block
function xmlSumAll(xml: string, tag: string): number {
  const re = new RegExp(`<${tag}>([^<]+)</${tag}>`, 'g');
  let sum = 0;
  let m;
  while ((m = re.exec(xml)) !== null) {
    sum += parseFloat(m[1]) || 0;
  }
  return sum;
}

// Get the MAX value of a tag (useful for finding the total row among layers)
function xmlMaxVal(xml: string, tag: string): number {
  const re = new RegExp(`<${tag}>([^<]+)</${tag}>`, 'g');
  let max = 0;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const val = parseFloat(m[1]) || 0;
    if (val > max) max = val;
  }
  return max;
}

function parseMislakaPolicy(block: string, fileType: string, fullXml: string): MislakaProduct | null {
  const policyNum = xmlVal(block, 'MISPAR-POLISA-O-HESHBON') || xmlVal(block, 'MISPAR-POLISA');

  // Total balance: sum all layers (shichvot) within this policy block
  // Each policy has multiple layers (employee, employer, severance) each with their own TOTAL-CHISACHON-MTZBR
  const totalBalance = xmlSumAll(block, 'TOTAL-CHISACHON-MTZBR') || xmlSumAll(block, 'TOTAL-ERKEI-PIDION');
  if (totalBalance === 0 && !policyNum) return null;

  // Determine product type from SUG-KUPA and file type
  const sugKupa = xmlVal(block, 'SUG-KUPA');
  let productType = fileType;
  if (sugKupa === '1') productType = 'pension';
  else if (sugKupa === '2') productType = 'provident';
  else if (sugKupa === '3') productType = 'education-fund';
  else if (sugKupa === '4') productType = 'investment-provident';

  // Check for managers insurance (ביטוח מנהלים)
  const planName = xmlVal(block, 'SHEM-TOCHNIT') || '';
  if (planName.includes('מנהלים') || fileType === 'insurance') productType = 'managers-insurance';

  // Check for education fund (השתלמות)
  if (planName.includes('השתלמות')) productType = 'education-fund';

  // Check for investment provident (גמל להשקעה)
  if (planName.includes('להשקעה') || planName.includes('גמל להשקעה')) productType = 'investment-provident';

  // Extract contribution percentages
  const contributions = extractContributions(block);

  const status = xmlVal(block, 'STATUS-POLISA-O-CHESHBON') || xmlVal(block, 'STATUS-POLISA-O-HESHBON');

  return {
    id: generateId(),
    owner: 'client', // Will be set later
    productType,
    providerName: xmlVal(block, 'SHEM-YATZRAN') || xmlVal(fullXml, 'SHEM-YATZRAN') || '',
    planName: planName || xmlVal(block, 'SHEM-KUPA') || '',
    policyNumber: policyNum,
    status: status === '1' ? 'active' : status === '2' ? 'inactive' : status || 'unknown',
    totalBalance,
    redemptionValue: xmlSumAll(block, 'TOTAL-ERKEI-PIDION') || totalBalance,
    monthlyPensionEstimate: xmlValNum(block, 'KITZVAT-HODSHIT-TZFUYA') || xmlValNum(block, 'SCHUM-KITZVAT-ZIKNA'),
    projectedRetirementBalance: xmlValNum(block, 'TOTAL-CHISACHON-MITZTABER-TZAFUY') || xmlValNum(block, 'TOTAL-SCHUM-MTZBR-TZAFUY-LEGIL-PRISHA-MECHUSHAV-LEKITZBA-IM-PREMIYOT'),
    employeeContributionPct: contributions.employee,
    employerContributionPct: contributions.employer,
    severanceContributionPct: contributions.severance,
    managementFeeDeposit: xmlValNum(block, 'SHEUR-DMEI-NIHUL-HAFKADA'),
    managementFeeBalance: xmlValNum(block, 'SHEUR-DMEI-NIHUL-TZVIRA'),
    investmentTrack: xmlVal(block, 'SHEM-MASLUL-HASHKAA') || '',
    returnRate: xmlValNum(block, 'TSUA-NETO') || xmlValNum(block, 'SHEUR-TSUA-NETO'),
    retirementAge: xmlValNum(block, 'GIL-PRISHA') || 67,
    joinDate: formatMislakaDate(xmlVal(block, 'TAARICH-HITZTARFUT-MUTZAR') || xmlVal(block, 'TAARICH-HITZTARFUT-RISHON')),
    lastUpdate: formatMislakaDate(xmlVal(block, 'TAARICH-NECHONUT') || xmlVal(block, 'TAARICH-ERECH-TZVIROT')),
    deathCoverage: 0,
    disabilityCoverage: 0,
  };
}

function extractContributions(block: string): { employee: number; employer: number; severance: number } {
  const result = { employee: 0, employer: 0, severance: 0 };
  // Parse SUG-HAFRASHA + ACHUZ-HAFRASHA pairs
  const sugMatches = block.match(/<SUG-HAFRASHA>(\d+)<\/SUG-HAFRASHA>/g) || [];
  const achuzMatches = block.match(/<ACHUZ-HAFRASHA>([\d.]+)<\/ACHUZ-HAFRASHA>/g) || [];

  for (let i = 0; i < sugMatches.length && i < achuzMatches.length; i++) {
    const sug = sugMatches[i].match(/>(\d+)</)?.[1];
    const achuz = parseFloat(achuzMatches[i].match(/>([^<]+)</)?.[1] || '0');
    if (sug === '1') result.severance = achuz; // פיצויים
    else if (sug === '2') result.employee = achuz; // עובד
    else if (sug === '3') result.employer = achuz; // מעביד
    else if (sug === '4') result.employee = achuz; // עצמאי
  }
  return result;
}

function formatMislakaDate(d: string): string {
  if (!d || d.length < 8) return '';
  // Format: YYYYMMDD -> YYYY-MM-DD
  return `${d.substring(0, 4)}-${d.substring(4, 6)}-${d.substring(6, 8)}`;
}

function parseMislakaExcelRow(row: Record<string, string>): MislakaProduct | null {
  // Newer Mislaka files come as XLS with Hebrew column headers
  const vals = Object.values(row);
  const keys = Object.keys(row);

  // Try to detect columns by header content
  let providerName = '', planName = '', balance = 0, policyNum = '', productType = 'provident';

  for (let i = 0; i < keys.length; i++) {
    const k = keys[i].toLowerCase();
    const v = String(vals[i] || '').trim();
    if (k.includes('שם') && k.includes('קופה')) planName = v;
    else if (k.includes('שם') && k.includes('יצרן')) providerName = v;
    else if (k.includes('שם') && k.includes('חברה')) providerName = v;
    else if (k.includes('יתרה') || k.includes('צבירה') || k.includes('ערך')) {
      const n = parseFloat(v.replace(/,/g, ''));
      if (n > balance) balance = n;
    }
    else if (k.includes('מספר') && k.includes('פוליסה')) policyNum = v;
    else if (k.includes('מספר') && k.includes('חשבון')) policyNum = v;
  }

  // Detect type from plan name
  if (planName.includes('פנסיה') || planName.includes('מקיפה')) productType = 'pension';
  else if (planName.includes('השתלמות')) productType = 'education-fund';
  else if (planName.includes('מנהלים') || planName.includes('ביטוח')) productType = 'managers-insurance';
  else if (planName.includes('להשקעה')) productType = 'investment-provident';

  if (balance === 0 && !planName) return null;

  return {
    id: generateId(),
    owner: 'client',
    productType,
    providerName: providerName || vals.find(v => typeof v === 'string' && v.length > 2 && !v.match(/^\d/)) || '',
    planName: planName || '',
    policyNumber: policyNum,
    status: 'unknown',
    totalBalance: balance,
    redemptionValue: balance,
    monthlyPensionEstimate: 0,
    projectedRetirementBalance: 0,
    employeeContributionPct: 0,
    employerContributionPct: 0,
    severanceContributionPct: 0,
    managementFeeDeposit: 0,
    managementFeeBalance: 0,
    investmentTrack: '',
    returnRate: 0,
    retirementAge: 67,
    joinDate: '',
    lastUpdate: '',
    deathCoverage: 0,
    disabilityCoverage: 0,
  };
}

function getProductTypeHe(type: string): string {
  const map: Record<string, string> = {
    'pension': 'קרן פנסיה',
    'provident': 'קופת גמל',
    'education-fund': 'קרן השתלמות',
    'managers-insurance': 'ביטוח מנהלים',
    'investment-provident': 'גמל להשקעה',
    'insurance': 'ביטוח',
    'other': 'אחר',
  };
  return map[type] || type;
}

// ============ OCR for scanned PDFs ============
async function ocrPdf(buffer: ArrayBuffer): Promise<string[]> {
  const mupdf = await import('mupdf');
  const Tesseract = await import('tesseract.js');

  const doc = mupdf.Document.openDocument(Buffer.from(buffer), 'application/pdf');
  const numPages = doc.countPages();
  const allLines: string[] = [];

  // OCR first 3 pages - page 1 has summary, pages 2-3 have rate details
  const maxPages = Math.min(numPages, 3);

  for (let i = 0; i < maxPages; i++) {
    const page = doc.loadPage(i);
    // 1.5x scale - good enough for OCR, faster than 2x
    const pixmap = page.toPixmap([1.5, 0, 0, 1.5, 0, 0], mupdf.ColorSpace.DeviceRGB, false, true);
    const pngBuffer = pixmap.asPNG();

    const { data: { text } } = await Tesseract.recognize(Buffer.from(pngBuffer), 'heb+eng');
    const pageLines = text.split('\n').filter(l => l.trim().length > 0);
    allLines.push(...pageLines);

    // Early exit only if NOT Hapoalim (Hapoalim needs pages 2-3 for rate details)
    const joined = allLines.join(' ');
    const isLikelyHapoalim = joined.includes('הפועלים') || joined.includes('משכנתאות');
    if (!isLikelyHapoalim && joined.includes('סילוק') && joined.match(/[\d,]+\.\d{2}/g)?.length && i >= 1) {
      break;
    }
  }

  return allLines;
}

function parseDecimal(val: string): number {
  return parseFloat(val.replace(/,/g, '')) || 0;
}

// ============ Word ============
async function parseWordFile(buffer: ArrayBuffer, fileName: string): Promise<ParseResult> {
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    const text = result.value;
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    const records = extractRecordsFromText(lines, fileName);
    const rawData = lines.map((line, i) => ({ line: String(i + 1), content: line.trim() }));
    return { records, rawData, headers: ['line', 'content'], fileName };
  } catch (e) {
    return { records: [], rawData: [], headers: [], fileName, error: 'Failed to parse Word: ' + String(e) };
  }
}

// ============ ZIP ============
async function parseZipFile(buffer: ArrayBuffer): Promise<ZipParseResult> {
  try {
    const zip = await JSZip.loadAsync(buffer);

    // Detect Mislaka ZIP:
    // 1. Contains XML files with Mimshak structure (old format)
    // 2. ZIP filename starts with "SwiftNess" (new format with XLS)
    const allEntryNames = Object.keys(zip.files);
    const xmlEntries = Object.entries(zip.files).filter(([name]) => name.endsWith('.xml') || name.endsWith('.dat') || name.endsWith('.DAT'));

    // Check for XML-based Mislaka
    if (xmlEntries.length > 0) {
      const firstXml = await xmlEntries[0][1].async('text');
      if (firstXml.includes('<Mimshak>') || firstXml.includes('SUG-MIMSHAK')) {
        return parseMislakaZip(zip, xmlEntries);
      }
    }

    // Check for XLS-based Mislaka (new format - no XML, just XLS with Mislaka data)
    const xlsEntries = Object.entries(zip.files).filter(([name]) =>
      (name.endsWith('.xls') || name.endsWith('.xlsx')) && !name.startsWith('__MACOSX')
    );
    if (xlsEntries.length > 0 && xmlEntries.length === 0) {
      // Check if XLS contains Mislaka-style data (columns with קופה, יצרן, צבירה etc.)
      const ab = await xlsEntries[0][1].async('arraybuffer');
      const wb = XLSX.read(ab, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const firstRow = (XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][])[0] || [];
      const headers = firstRow.map(v => String(v || '')) as string[];
      const headerStr = (headers || []).join(' ').toLowerCase();
      const isMislaka = headerStr.includes('קופה') || headerStr.includes('יצרן') || headerStr.includes('צבירה')
        || headerStr.includes('פוליסה') || headerStr.includes('חשבון') || headerStr.includes('גמל')
        || headerStr.includes('פנסיה') || headerStr.includes('השתלמות');

      if (isMislaka) {
        return parseMislakaZip(zip, []);
      }
    }

    const supportedExts = ['xlsx', 'xls', 'csv', 'tsv', 'pdf', 'docx', 'doc'];
    const files: ParseResult[] = [];
    let totalRecords = 0;

    const entries = Object.entries(zip.files).filter(([name, entry]) => {
      if (entry.dir) return false;
      if (name.startsWith('__MACOSX/') || name.startsWith('.')) return false;
      const ext = name.split('.').pop()?.toLowerCase() || '';
      return supportedExts.includes(ext);
    });

    for (const [name, entry] of entries) {
      const ext = name.split('.').pop()?.toLowerCase() || '';
      try {
        if (ext === 'csv' || ext === 'tsv') {
          const text = await entry.async('text');
          const r = parseCsvFile(text, name);
          files.push(r);
          totalRecords += r.records.length;
        } else if (ext === 'xlsx' || ext === 'xls') {
          const ab = await entry.async('arraybuffer');
          const r = parseExcelFile(ab, name);
          files.push(r);
          totalRecords += r.records.length;
        } else if (ext === 'pdf') {
          const ab = await entry.async('arraybuffer');
          const r = await parsePdfFile(ab, name);
          files.push(r);
          totalRecords += r.records.length;
        } else if (ext === 'docx' || ext === 'doc') {
          const ab = await entry.async('arraybuffer');
          const r = await parseWordFile(ab, name);
          files.push(r);
          totalRecords += r.records.length;
        }
      } catch {
        files.push({ records: [], rawData: [], headers: [], fileName: name, error: `Failed to process ${name}` });
      }
    }

    if (files.length === 0) {
      const allFiles = Object.keys(zip.files).filter(n => !n.endsWith('/'));
      return { files: [], totalRecords: 0, error: `No supported files found in ZIP. Files inside: ${allFiles.join(', ')}` };
    }

    return { files, totalRecords };
  } catch {
    return { files: [], totalRecords: 0, error: 'Failed to open ZIP file' };
  }
}

// ============ Text extraction ============
function extractRecordsFromText(lines: string[], source: string): FinancialRecord[] {
  const records: FinancialRecord[] = [];
  const datePattern = /(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/;
  // Match amounts: at least 2+ digits (optionally with commas), optionally with decimals, optionally negative
  const amountPattern = /[-]?\d[\d,]*\d(?:\.\d{1,2})?|[-]?\d{2,}(?:\.\d{1,2})?/g;

  for (const line of lines) {
    const dateMatch = line.match(datePattern);
    if (!dateMatch) continue;

    // Remove the date portion first, then search for amounts in the remaining text
    const withoutDate = line.replace(datePattern, '');
    const amounts = withoutDate.match(amountPattern);
    if (!amounts || amounts.length === 0) continue;

    // Use the last (rightmost) amount found
    const amountStr = amounts[amounts.length - 1];
    const amount = parseNumber(amountStr);
    if (amount === 0) continue;

    let description = withoutDate.replace(amountPattern, '').replace(/[₪$€]/g, '').trim().replace(/\s+/g, ' ');
    if (!description) description = line.trim();

    records.push({
      id: generateId(),
      date: normalizeDate(dateMatch[1]),
      description,
      amount: Math.abs(amount),
      type: amount < 0 ? 'expense' : 'income',
      category: 'general',
      source,
    });
  }

  return records;
}

// ============ Shared helpers ============
function autoMapRecords(rawData: Record<string, string>[], source: string): FinancialRecord[] {
  if (rawData.length === 0) return [];
  const headers = Object.keys(rawData[0]).map(h => h.toLowerCase().trim());
  const dateCol = findColumn(headers, ['date', 'תאריך', 'תאריך עסקה', 'תאריך ערך']);
  const descCol = findColumn(headers, ['description', 'תיאור', 'פרטים', 'פעולה', 'הערות']);
  const amountCol = findColumn(headers, ['amount', 'סכום', 'חובה', 'זכות', 'סכום עסקה']);
  const debitCol = findColumn(headers, ['debit', 'חובה']);
  const creditCol = findColumn(headers, ['credit', 'זכות']);
  const categoryCol = findColumn(headers, ['category', 'קטגוריה', 'סוג']);
  const originalHeaders = Object.keys(rawData[0]);

  return rawData.map(row => {
    let amount = 0;
    let type: 'income' | 'expense' = 'expense';
    if (amountCol !== null) {
      const val = parseNumber(row[originalHeaders[amountCol]]);
      amount = Math.abs(val);
      type = val >= 0 ? 'income' : 'expense';
    } else if (debitCol !== null && creditCol !== null) {
      const debit = parseNumber(row[originalHeaders[debitCol]]);
      const credit = parseNumber(row[originalHeaders[creditCol]]);
      if (credit > 0) { amount = credit; type = 'income'; }
      else { amount = debit; type = 'expense'; }
    }
    return {
      id: generateId(),
      date: dateCol !== null ? normalizeDate(row[originalHeaders[dateCol]]) : new Date().toISOString().split('T')[0],
      description: descCol !== null ? row[originalHeaders[descCol]] : Object.values(row).join(' | '),
      amount,
      type,
      category: categoryCol !== null ? row[originalHeaders[categoryCol]] : 'general',
      source,
    };
  });
}

function findColumn(headers: string[], options: string[]): number | null {
  for (const opt of options) {
    const idx = headers.findIndex(h => h.includes(opt));
    if (idx >= 0) return idx;
  }
  return null;
}

function parseNumber(val: string | number | undefined): number {
  if (val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  const cleaned = val.replace(/[^\d.-]/g, '');
  return parseFloat(cleaned) || 0;
}

function normalizeDate(val: string | undefined): string {
  if (!val) return new Date().toISOString().split('T')[0];
  const parsed = new Date(val);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  const parts = val.split(/[/.-]/);
  if (parts.length === 3) {
    const [d, m, y] = parts;
    const year = parseInt(y);
    const fullYear = year < 100 ? 2000 + year : year;
    const date = new Date(fullYear, parseInt(m) - 1, parseInt(d));
    if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
}
