'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/translations';
import { getMortgageReports, deleteMortgageReport, clearAllMortgageReports } from '@/lib/storage';
import type { MortgageReport } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Building, Trash2, AlertTriangle, ArrowUpRight, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, Legend } from 'recharts';
// Link removed - upload is in its own tab

// Track colors (rates loaded dynamically from /api/rates)
const TRACK_COLORS: Record<string, string> = {
  'משתנה צמודה': '#d97706',
  'משתנה לא צמודה': '#f59e0b',
  'קבועה צמודה': '#16a34a',
  'קבועה לא צמודה': '#22c55e',
  'פריים': '#2563eb',
};

interface PeriodRate {
  label: string;
  minYears: number;
  maxYears: number;
  rate: number;
}

interface TrackType {
  key: string;
  color: string;
  benchmark: number; // default rate (20+ years)
  label_he: string;
  label_en: string;
  periods?: PeriodRate[];
}

const FALLBACK_TRACKS: TrackType[] = [
  { key: 'משתנה צמודה', color: '#d97706', benchmark: 3.45, label_he: 'משתנה צמודה למדד', label_en: 'Variable CPI-linked' },
  { key: 'משתנה לא צמודה', color: '#f59e0b', benchmark: 4.70, label_he: 'משתנה לא צמודה', label_en: 'Variable Non-linked' },
  { key: 'קבועה צמודה', color: '#16a34a', benchmark: 3.48, label_he: 'קבועה צמודה למדד', label_en: 'Fixed CPI-linked' },
  { key: 'קבועה לא צמודה', color: '#22c55e', benchmark: 4.79, label_he: 'קבועה לא צמודה (קל"צ)', label_en: 'Fixed Non-linked' },
  { key: 'פריים', color: '#2563eb', benchmark: 5.50, label_he: 'פריים (בנק ישראל 4.0% + 1.5%)', label_en: 'Prime (BoI 4.0% + 1.5%)' },
];

// Mapping for older/unclassified type names
const TYPE_ALIASES: Record<string, string> = {
  'קבועה': 'קבועה לא צמודה',
  'משתנה': 'משתנה לא צמודה',
  'מעורב': 'משתנה לא צמודה',
  'לא ידוע': 'משתנה לא צמודה',
};

function normalizeTrackType(type: string): string {
  if (FALLBACK_TRACKS.some(t => t.key === type)) return type;
  return TYPE_ALIASES[type] || type;
}

function getTrackStatic(type: string) {
  const normalized = normalizeTrackType(type);
  return FALLBACK_TRACKS.find(t => t.key === normalized) || FALLBACK_TRACKS[1];
}

export default function MortgagePage() {
  const { t, locale } = useTranslation();
  const [reports, setReports] = useState<MortgageReport[]>([]);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [trackTypes, setTrackTypes] = useState<TrackType[]>(FALLBACK_TRACKS);
  const [ratesSource, setRatesSource] = useState('');
  const [ratesUpdated, setRatesUpdated] = useState('');

  useEffect(() => {
    setReports(getMortgageReports());

    // Fetch live rates from Bank of Israel
    fetch('/api/rates')
      .then(r => r.json())
      .then(data => {
        if (data.tracks && data.tracks.length > 0) {
          setTrackTypes(data.tracks.map((t: { key: string; rate: number; label_he: string; label_en: string; periods?: PeriodRate[] }) => ({
            ...t,
            color: TRACK_COLORS[t.key] || '#64748b',
            benchmark: t.rate,
            periods: t.periods,
          })));
          setRatesSource(data.source || '');
          setRatesUpdated(data.updatedAt ? new Date(data.updatedAt).toLocaleDateString('he-IL') : '');
        }
      })
      .catch(() => { /* use fallback */ });
  }, []);

  const fmtCur = (n: number) => formatCurrency(n, locale === 'he' ? 'he-IL' : 'en-IL');

  const getTrack = (type: string) => {
    const normalized = normalizeTrackType(type);
    return trackTypes.find(t => t.key === normalized) || trackTypes[1] || FALLBACK_TRACKS[1];
  };

  // Get rate for specific track + remaining years
  const getRateForPeriod = (type: string, remainingYears: number): number => {
    const track = getTrack(type);
    if (!track.periods || track.periods.length === 0) return track.benchmark;
    const period = track.periods.find(p => remainingYears >= p.minYears && remainingYears < p.maxYears);
    return period?.rate || track.benchmark;
  };

  const allSubLoans = reports.flatMap(r =>
    r.subLoans.filter(sl => sl.currentBalance > 0).map(sl => ({
      ...sl,
      bank: r.bank,
      reportDate: r.reportDate,
      normalizedType: normalizeTrackType(sl.interestType),
    }))
  );

  const totalDebt = allSubLoans.reduce((s, sl) => s + sl.currentBalance, 0);
  const totalMonthly = allSubLoans.reduce((s, sl) => s + sl.monthlyPayment, 0);
  const weightedRate = totalDebt > 0
    ? allSubLoans.filter(sl => sl.interestRate > 0).reduce((s, sl) => s + sl.interestRate * sl.currentBalance, 0)
      / allSubLoans.filter(sl => sl.interestRate > 0).reduce((s, sl) => s + sl.currentBalance, 0) || 0
    : 0;

  // Distribution by track type
  const typeDistribution = trackTypes.map(track => {
    const loans = allSubLoans.filter(sl => normalizeTrackType(sl.interestType) === track.key);
    return {
      name: locale === 'he' ? track.label_he : track.label_en,
      key: track.key,
      value: loans.reduce((s, l) => s + l.currentBalance, 0),
      color: track.color,
      count: loans.length,
      avgRate: loans.length > 0
        ? loans.reduce((s, l) => s + l.interestRate, 0) / loans.length
        : 0,
      benchmark: track.benchmark,
    };
  }).filter(d => d.value > 0);

  // Bar chart: your rate vs market for each sub-loan
  const rateComparisonData = allSubLoans
    .filter(sl => sl.interestRate > 0)
    .sort((a, b) => b.interestRate - a.interestRate)
    .map(sl => {
      const track = getTrack(sl.interestType);
      return {
        name: `#${sl.subLoanNumber}`,
        fullName: `${sl.subLoanNumber} - ${sl.normalizedType}`,
        yourRate: sl.interestRate,
        marketRate: track.benchmark,
        diff: sl.interestRate - track.benchmark,
        color: sl.interestRate > track.benchmark + 0.3 ? '#dc2626' : '#16a34a',
        balance: sl.currentBalance,
      };
    });

  // Detailed savings analysis per sub-loan
  // PMT formula: M = P * [r(1+r)^n] / [(1+r)^n - 1]
  function calcMonthlyPayment(principal: number, annualRate: number, months: number): number {
    if (annualRate === 0 || months === 0) return principal / Math.max(months, 1);
    const r = annualRate / 100 / 12;
    return principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  }

  // Total interest cost over remaining life
  function calcTotalInterest(principal: number, annualRate: number, months: number): number {
    const monthly = calcMonthlyPayment(principal, annualRate, months);
    return (monthly * months) - principal;
  }

  function getRemainingMonths(endDate: string): number {
    if (!endDate) return 240;
    const end = new Date(endDate.split('/').reverse().join('-'));
    if (isNaN(end.getTime())) return 240;
    const now = new Date();
    const months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
    return Math.max(months, 12);
  }

  const savingsAnalysis = allSubLoans
    .filter(sl => sl.interestRate > 0)
    .map(sl => {
      const track = getTrack(sl.interestType);
      const remainingMonths = getRemainingMonths(sl.endDate);
      const remainingYears = Math.round(remainingMonths / 12);

      // Get period-specific benchmark rate (not just general average)
      const periodBenchmark = getRateForPeriod(sl.interestType, remainingYears);

      // Calculate standard PMT for both current and market rate
      const pmtCurrent = calcMonthlyPayment(sl.currentBalance, sl.interestRate, remainingMonths);
      const pmtMarket = calcMonthlyPayment(sl.currentBalance, periodBenchmark, remainingMonths);

      // Total interest over remaining life
      const totalInterestCurrent = calcTotalInterest(sl.currentBalance, sl.interestRate, remainingMonths);
      const totalInterestMarket = calcTotalInterest(sl.currentBalance, periodBenchmark, remainingMonths);

      // Savings = difference in total interest
      const totalInterestSaving = Math.max(0, totalInterestCurrent - totalInterestMarket);
      const monthlySaving = Math.max(0, pmtCurrent - pmtMarket);
      const yearlySaving = monthlySaving * 12;

      return {
        subLoanNumber: sl.subLoanNumber,
        interestType: sl.normalizedType,
        currentRate: sl.interestRate,
        marketRate: periodBenchmark,
        rateDiff: sl.interestRate - periodBenchmark,
        balance: sl.currentBalance,
        remainingMonths,
        remainingYears,
        currentMonthly: sl.monthlyPayment > 0 ? sl.monthlyPayment : pmtCurrent,
        pmtCurrent,
        pmtMarket,
        monthlySaving,
        yearlySaving,
        totalInterestCurrent,
        totalInterestMarket,
        totalInterestSaving,
        isExpensive: sl.interestRate > periodBenchmark + 0.3,
        color: track.color,
      };
    });

  const totalMonthlySavings = savingsAnalysis.reduce((s, a) => s + a.monthlySaving, 0);
  const totalYearlySavings = savingsAnalysis.reduce((s, a) => s + a.yearlySaving, 0);
  const totalLifetimeSavings = savingsAnalysis.reduce((s, a) => s + a.totalInterestSaving, 0);
  const expensiveLoans = savingsAnalysis.filter(a => a.isExpensive);

  const handleDelete = (id: string) => {
    deleteMortgageReport(id);
    setReports(getMortgageReports());
  };

  if (reports.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">{t('mortgage.title')}</h1>
        <div className="bg-surface rounded-xl shadow-sm border border-border p-12 text-center">
          <Building size={48} className="mx-auto mb-4 text-text-light" />
          <p className="text-text-light">{t('mortgage.noData')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('mortgage.title')}</h1>
        <button onClick={() => { clearAllMortgageReports(); setReports([]); }}
          className="flex items-center gap-1.5 text-sm text-text-light hover:text-danger transition-colors">
          <RotateCcw size={14} /> {t('common.reset')}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-r from-red-600 to-red-400 text-white rounded-xl p-5">
          <p className="text-sm opacity-80">{t('mortgage.totalDebt')}</p>
          <p className="text-2xl font-bold">{fmtCur(totalDebt)}</p>
        </div>
        <div className="bg-gradient-to-r from-orange-600 to-orange-400 text-white rounded-xl p-5">
          <p className="text-sm opacity-80">{t('mortgage.totalMonthly')}</p>
          <p className="text-2xl font-bold">{fmtCur(totalMonthly)}</p>
        </div>
        <div className="bg-gradient-to-r from-blue-600 to-blue-400 text-white rounded-xl p-5">
          <p className="text-sm opacity-80">{t('mortgage.weightedRate')}</p>
          <p className="text-2xl font-bold">{weightedRate.toFixed(2)}%</p>
        </div>
        <div className="bg-gradient-to-r from-purple-600 to-purple-400 text-white rounded-xl p-5">
          <p className="text-sm opacity-80">{t('mortgage.subLoansCount')}</p>
          <p className="text-2xl font-bold">{allSubLoans.length}</p>
          <p className="text-xs opacity-70">{reports.length} {t('mortgage.reports')}</p>
        </div>
      </div>

      {/* Savings Alert */}
      {totalMonthlySavings > 50 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle size={24} className="text-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-warning">{t('mortgage.savingsAlert')}</p>
            <p className="text-sm mt-1">
              {t('mortgage.savingsDescription')} <strong>{fmtCur(Math.round(totalMonthlySavings))}</strong> {t('mortgage.perMonth')} ({fmtCur(Math.round(totalYearlySavings))} {t('mortgage.perYear')})
            </p>
            <p className="text-sm mt-1 font-semibold text-danger">
              {t('mortgage.totalLifetimeSavings')}: {fmtCur(Math.round(totalLifetimeSavings))}
            </p>
          </div>
        </div>
      )}

      {/* Detailed Savings Table */}
      {savingsAnalysis.some(a => a.rateDiff !== 0) && (
        <div className="bg-surface rounded-xl shadow-sm border border-border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">{t('mortgage.savingsBreakdown')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-light">
                  <th className="px-2 py-2 text-start">{t('mortgage.interestType')}</th>
                  <th className="px-2 py-2 text-end">{t('mortgage.balance')}</th>
                  <th className="px-2 py-2 text-end">{t('mortgage.rate')}</th>
                  <th className="px-2 py-2 text-end">{t('mortgage.marketRate')}</th>
                  <th className="px-2 py-2 text-end">{t('mortgage.rateDiff')}</th>
                  <th className="px-2 py-2 text-end">{t('mortgage.remainingYears')}</th>
                  <th className="px-2 py-2 text-end">{t('mortgage.monthlySaving')}</th>
                  <th className="px-2 py-2 text-end">{t('mortgage.totalInterestSaving')}</th>
                </tr>
              </thead>
              <tbody>
                {savingsAnalysis.map((a, i) => (
                  <tr key={i} className={`border-b border-border/50 ${a.isExpensive ? 'bg-red-50' : ''}`}>
                    <td className="px-2 py-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.color }} />
                        #{a.subLoanNumber} {a.interestType}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-end">{fmtCur(a.balance)}</td>
                    <td className="px-2 py-2 text-end font-semibold">{a.currentRate}%</td>
                    <td className="px-2 py-2 text-end text-text-light">{a.marketRate}%</td>
                    <td className="px-2 py-2 text-end">
                      {a.rateDiff > 0.1 ? (
                        <span className="text-danger font-semibold">+{a.rateDiff.toFixed(2)}%</span>
                      ) : a.rateDiff < -0.1 ? (
                        <span className="text-success">{a.rateDiff.toFixed(2)}%</span>
                      ) : (
                        <span className="text-text-light">0%</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-end">{a.remainingYears} {t('mortgage.years')}</td>
                    <td className="px-2 py-2 text-end">
                      {a.monthlySaving > 10 ? (
                        <span className="text-success font-semibold">{fmtCur(Math.round(a.monthlySaving))}</span>
                      ) : (
                        <span className="text-text-light">-</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-end">
                      {a.totalInterestSaving > 100 ? (
                        <span className="text-success font-bold">{fmtCur(Math.round(a.totalInterestSaving))}</span>
                      ) : (
                        <span className="text-text-light">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold border-t-2 border-border bg-green-50">
                  <td className="px-2 py-3" colSpan={6}>{t('mortgage.totalPotentialSavings')}</td>
                  <td className="px-2 py-3 text-end text-success">{fmtCur(Math.round(totalMonthlySavings))}{t('mortgage.perMonth')}</td>
                  <td className="px-2 py-3 text-end text-success text-lg">{fmtCur(Math.round(totalLifetimeSavings))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Track Type Distribution Pie */}
        <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-lg font-semibold mb-4">{t('mortgage.typeDistribution')}</h2>
          {typeDistribution.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={typeDistribution} cx="50%" cy="50%" outerRadius={85} innerRadius={40} dataKey="value"
                    label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}>
                    {typeDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(val) => fmtCur(Number(val))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-3">
                {typeDistribution.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                      <span>{d.name}</span>
                    </div>
                    <span className="font-semibold">{fmtCur(d.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-text-light">{t('common.noData')}</div>
          )}
        </div>

        {/* Rate vs Market Bar Chart */}
        <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-lg font-semibold mb-4">{t('mortgage.rateComparison')}</h2>
          {rateComparisonData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={rateComparisonData} barGap={2}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 'auto']} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                <Tooltip
                  formatter={(val) => `${Number(val).toFixed(2)}%`}
                  labelFormatter={(label) => {
                    const item = rateComparisonData.find(d => d.name === label);
                    return item?.fullName || label;
                  }}
                />
                <Legend />
                <Bar dataKey="yourRate" name={t('mortgage.yourRate')} radius={[4, 4, 0, 0]}>
                  {rateComparisonData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
                <Bar dataKey="marketRate" name={t('mortgage.marketRate')} fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-text-light">{t('common.noData')}</div>
          )}
        </div>
      </div>

      {/* Full Rate Matrix Table */}
      <div className="bg-surface rounded-xl shadow-sm border border-border p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">{t('mortgage.rateMatrix')}</h2>
          {ratesSource && (
            <span className="text-xs text-text-light">
              {ratesSource} {ratesUpdated && `| ${t('mortgage.lastUpdate')}: ${ratesUpdated}`}
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-2 py-2 text-start">{t('mortgage.interestType')}</th>
                {(trackTypes[0]?.periods || []).map((p, i) => (
                  <th key={i} className="px-2 py-2 text-center text-xs">{p.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trackTypes.map(track => {
                const myLoans = allSubLoans.filter(sl => normalizeTrackType(sl.interestType) === track.key);
                return (
                  <tr key={track.key} className="border-b border-border/50">
                    <td className="px-2 py-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: track.color }} />
                        <span className="text-xs font-medium">{locale === 'he' ? track.label_he : track.label_en}</span>
                      </span>
                    </td>
                    {(track.periods || []).map((p, i) => {
                      // Check if any of the client's sub-loans fall in this period+track
                      const matchingLoan = myLoans.find(sl => {
                        const yrs = getRemainingMonths(sl.endDate) / 12;
                        return yrs >= p.minYears && yrs < p.maxYears;
                      });
                      return (
                        <td key={i} className={`px-2 py-2 text-center text-xs ${matchingLoan ? 'bg-yellow-50 font-bold' : ''}`}>
                          {p.rate.toFixed(2)}%
                          {matchingLoan && matchingLoan.interestRate > 0 && (
                            <div className={`text-[10px] mt-0.5 ${matchingLoan.interestRate > p.rate + 0.3 ? 'text-danger' : 'text-success'}`}>
                              ({t('mortgage.yours')}: {matchingLoan.interestRate}%)
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-Report Detailed Breakdown */}
      {reports.map(report => {
        const isExpanded = expandedReport === report.id;
        const activeLoans = report.subLoans.filter(sl => sl.currentBalance > 0);

        return (
          <div key={report.id} className="bg-surface rounded-xl shadow-sm border border-border mb-4 overflow-hidden">
            <div className="flex items-center justify-between p-5 cursor-pointer hover:bg-background/50"
              onClick={() => setExpandedReport(isExpanded ? null : (report.id || null))}>
              <div>
                <div className="flex items-center gap-2">
                  <Building size={20} className="text-primary" />
                  <h3 className="font-semibold text-lg">{report.bank}</h3>
                </div>
                <p className="text-sm text-text-light mt-1">
                  {report.borrowerName} | {report.reportDate}
                  {report.loanNumber && ` | ${t('mortgage.loan')} ${report.loanNumber}`}
                </p>
                <p className="text-sm mt-1">
                  <span className="font-semibold text-danger">{fmtCur(report.totalBalance)}</span>
                  <span className="text-text-light mx-2">|</span>
                  {activeLoans.length} {t('mortgage.tracks')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={(e) => { e.stopPropagation(); handleDelete(report.id!); }}
                  className="text-text-light hover:text-danger p-1"><Trash2 size={16} /></button>
                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </div>

            {isExpanded && (
              <div className="px-5 pb-5 border-t border-border">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm mt-4">
                    <thead>
                      <tr className="border-b border-border text-text-light">
                        <th className="px-2 py-2 text-start">#</th>
                        <th className="px-2 py-2 text-start">{t('mortgage.interestType')}</th>
                        <th className="px-2 py-2 text-end">{t('mortgage.rate')}</th>
                        <th className="px-2 py-2 text-end">{t('mortgage.benchmark')}</th>
                        <th className="px-2 py-2 text-center">{t('mortgage.status')}</th>
                        <th className="px-2 py-2 text-end">{t('mortgage.balance')}</th>
                        <th className="px-2 py-2 text-end">{t('mortgage.original')}</th>
                        <th className="px-2 py-2 text-end">{t('mortgage.monthly')}</th>
                        <th className="px-2 py-2 text-end">{t('mortgage.pctOfTotal')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeLoans.map((sl, i) => {
                        const track = getTrack(sl.interestType);
                        const isExpensive = sl.interestRate > 0 && sl.interestRate > track.benchmark + 0.3;
                        const pct = report.totalBalance > 0 ? (sl.currentBalance / report.totalBalance) * 100 : 0;
                        const normalizedType = normalizeTrackType(sl.interestType);

                        return (
                          <tr key={i} className={`border-b border-border/50 ${isExpensive ? 'bg-red-50' : ''}`}>
                            <td className="px-2 py-2 font-medium">{sl.subLoanNumber}</td>
                            <td className="px-2 py-2">
                              <span className="inline-flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: track.color }} />
                                {normalizedType}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-end font-semibold">{sl.interestRate > 0 ? `${sl.interestRate}%` : '-'}</td>
                            <td className="px-2 py-2 text-end text-text-light">{track.benchmark}%</td>
                            <td className="px-2 py-2 text-center">
                              {sl.interestRate > 0 && (
                                isExpensive ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-danger font-medium">
                                    <ArrowUpRight size={12} /> {t('mortgage.aboveMarket')}
                                  </span>
                                ) : (
                                  <span className="text-xs text-success font-medium">{t('mortgage.ok')}</span>
                                )
                              )}
                            </td>
                            <td className="px-2 py-2 text-end font-semibold text-danger">{fmtCur(sl.currentBalance)}</td>
                            <td className="px-2 py-2 text-end text-text-light">{sl.originalAmount > 0 ? fmtCur(sl.originalAmount) : '-'}</td>
                            <td className="px-2 py-2 text-end">{sl.monthlyPayment > 0 ? fmtCur(sl.monthlyPayment) : '-'}</td>
                            <td className="px-2 py-2 text-end text-text-light">{pct.toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="font-semibold border-t-2 border-border">
                        <td className="px-2 py-2" colSpan={5}>{t('mortgage.total')}</td>
                        <td className="px-2 py-2 text-end text-danger">{fmtCur(report.totalBalance)}</td>
                        <td className="px-2 py-2"></td>
                        <td className="px-2 py-2 text-end">{fmtCur(activeLoans.reduce((s, l) => s + l.monthlyPayment, 0))}</td>
                        <td className="px-2 py-2 text-end">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
