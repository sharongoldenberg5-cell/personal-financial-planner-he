import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

interface PeriodRate {
  label: string;
  minYears: number;
  maxYears: number;
  rate: number;
}

interface TrackRates {
  key: string;
  label_he: string;
  label_en: string;
  rate: number; // default/20+ year rate for backward compat
  periods: PeriodRate[];
}

interface MortgageRates {
  updatedAt: string;
  source: string;
  prime: number;
  boiRate: number;
  tracks: TrackRates[];
}

// Cache
let cachedRates: MortgageRates | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000;

const BOI_CPI_LINKED_URL = 'https://www.boi.org.il/boi_files/Pikuah/pribmash.xls';
const BOI_NON_LINKED_URL = 'https://www.boi.org.il/boi_files/Pikuah/mashfix.xls';

// Period definitions matching BOI Excel columns
const PERIODS = [
  { label: 'עד 5 שנים', minYears: 0, maxYears: 5 },
  { label: '5-10 שנים', minYears: 5, maxYears: 10 },
  { label: '10-15 שנים', minYears: 10, maxYears: 15 },
  { label: '15-20 שנים', minYears: 15, maxYears: 20 },
  { label: '20-25 שנים', minYears: 20, maxYears: 25 },
  { label: 'מעל 25 שנה', minYears: 25, maxYears: 40 },
];

// Fallback rates by period (Bank of Israel data via kantahome.com, March 2026)
const FALLBACK_CPI_RATES = [3.52, 3.97, 3.14, 3.60, 3.53, 3.39]; // צמודה per period
const FALLBACK_NON_LINKED_RATES = [4.41, 3.84, 4.35, 4.84, 5.07, 5.29]; // לא צמודה per period (from mashfix last row)

export async function GET() {
  if (cachedRates && Date.now() - cacheTimestamp < CACHE_TTL) {
    return NextResponse.json(cachedRates);
  }
  try {
    const rates = await fetchLatestRates();
    cachedRates = rates;
    cacheTimestamp = Date.now();
    return NextResponse.json(rates);
  } catch {
    return NextResponse.json(getFallbackRates());
  }
}

async function fetchLatestRates(): Promise<MortgageRates> {
  const [cpiResp, nonLinkedResp] = await Promise.allSettled([
    fetch(BOI_CPI_LINKED_URL, { signal: AbortSignal.timeout(15000) }),
    fetch(BOI_NON_LINKED_URL, { signal: AbortSignal.timeout(15000) }),
  ]);

  let cpiPeriodRates = [...FALLBACK_CPI_RATES];
  let nonLinkedPeriodRates = [...FALLBACK_NON_LINKED_RATES];

  // Parse CPI-linked file
  if (cpiResp.status === 'fulfilled' && cpiResp.value.ok) {
    try {
      const buffer = await cpiResp.value.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });

      // Try Sheet1 first (current rates), then RESULT (historical)
      for (const sheetName of ['Sheet1', 'RESULT', wb.SheetNames[0]]) {
        const sheet = wb.Sheets[sheetName];
        if (!sheet) continue;
        const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1 }) as unknown as unknown[][];
        // Find last row with numbers
        const dataRows = data.filter(row => Array.isArray(row) && row.some(v => typeof v === 'number' && v > 1 && v < 20));
        if (dataRows.length > 0) {
          const lastRow = dataRows[dataRows.length - 1];
          const nums = lastRow.filter(v => typeof v === 'number' && v > 1 && v < 15) as number[];
          // BOI CPI file has 6 period columns (עד 5, 5-10, 10-15, 15-20, 20-25, מעל 25)
          if (nums.length >= 6) {
            cpiPeriodRates = nums.slice(0, 6);
            break;
          } else if (nums.length >= 3) {
            // Partial data - use what we have
            for (let i = 0; i < nums.length && i < 6; i++) cpiPeriodRates[i] = nums[i];
            break;
          }
        }
      }
    } catch { /* use fallback */ }
  }

  // Parse non-linked file
  if (nonLinkedResp.status === 'fulfilled' && nonLinkedResp.value.ok) {
    try {
      const buffer = await nonLinkedResp.value.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1 }) as unknown as unknown[][];

      const dataRows = data.filter(row => Array.isArray(row) && row.some(v => typeof v === 'number' && v > 1 && v < 20));
      if (dataRows.length > 0) {
        const lastRow = dataRows[dataRows.length - 1];
        // mashfix columns: ממוצע, מעל 25, 20-25, 15-20, 10-15, 5-10, 1-5, עד שנה
        // We need to reverse order to match our PERIODS (ascending)
        const nums = lastRow.filter(v => typeof v === 'number' && v > 1 && v < 15) as number[];
        if (nums.length >= 6) {
          // mashfix order is reversed: [avg, 25+, 20-25, 15-20, 10-15, 5-10, 1-5, <1]
          // We want: [<5, 5-10, 10-15, 15-20, 20-25, 25+]
          const reversed = nums.slice(1).reverse(); // skip avg, reverse the rest
          if (reversed.length >= 6) {
            nonLinkedPeriodRates = reversed.slice(0, 6);
          }
        }
      }
    } catch { /* use fallback */ }
  }

  const boiRate = 4.0;
  const prime = boiRate + 1.5;

  // Build tracks with period data
  // BOI doesn't split fixed/variable - we apply ±0.05% spread
  const tracks = buildTracks(cpiPeriodRates, nonLinkedPeriodRates, prime, boiRate);

  return {
    updatedAt: new Date().toISOString(),
    source: 'Bank of Israel (boi.org.il)',
    prime,
    boiRate,
    tracks,
  };
}

function buildTracks(cpiRates: number[], nonLinkedRates: number[], prime: number, boiRate: number): TrackRates[] {
  const round = (n: number) => Math.round(n * 100) / 100;

  // Helper to get default rate (20-25 year period, index 4)
  const cpiDefault = round(cpiRates[4] || cpiRates[cpiRates.length - 1] || 3.48);
  const nonLinkedDefault = round(nonLinkedRates[4] || nonLinkedRates[nonLinkedRates.length - 1] || 4.79);

  return [
    {
      key: 'משתנה צמודה',
      label_he: 'משתנה צמודה למדד',
      label_en: 'Variable CPI-linked',
      rate: round(cpiDefault - 0.03),
      periods: PERIODS.map((p, i) => ({
        ...p,
        rate: round((cpiRates[i] || cpiDefault) - 0.05),
      })),
    },
    {
      key: 'משתנה לא צמודה',
      label_he: 'משתנה לא צמודה',
      label_en: 'Variable Non-linked',
      rate: round(nonLinkedDefault - 0.10),
      periods: PERIODS.map((p, i) => ({
        ...p,
        rate: round((nonLinkedRates[i] || nonLinkedDefault) - 0.10),
      })),
    },
    {
      key: 'קבועה צמודה',
      label_he: 'קבועה צמודה למדד',
      label_en: 'Fixed CPI-linked',
      rate: round(cpiDefault + 0.03),
      periods: PERIODS.map((p, i) => ({
        ...p,
        rate: round((cpiRates[i] || cpiDefault) + 0.05),
      })),
    },
    {
      key: 'קבועה לא צמודה',
      label_he: 'קבועה לא צמודה (קל"צ)',
      label_en: 'Fixed Non-linked',
      rate: nonLinkedDefault,
      periods: PERIODS.map((p, i) => ({
        ...p,
        rate: round(nonLinkedRates[i] || nonLinkedDefault),
      })),
    },
    {
      key: 'פריים',
      label_he: `פריים (בנק ישראל ${boiRate}% + 1.5%)`,
      label_en: `Prime (BoI ${boiRate}% + 1.5%)`,
      rate: prime,
      periods: PERIODS.map(p => ({ ...p, rate: prime })), // Prime is the same for all periods
    },
  ];
}

function getFallbackRates(): MortgageRates {
  const boiRate = 4.0;
  const prime = boiRate + 1.5;
  return {
    updatedAt: '2026-03-15T00:00:00.000Z',
    source: 'Bank of Israel (fallback)',
    prime,
    boiRate,
    tracks: buildTracks(FALLBACK_CPI_RATES, FALLBACK_NON_LINKED_RATES, prime, boiRate),
  };
}
