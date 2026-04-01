'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/translations';
import { loadState, calculateNetWorth, calculateTotalLiabilities, getBankAccounts } from '@/lib/storage';
import { formatCurrency } from '@/lib/utils';
import type { AppState, BankAccount } from '@/lib/types';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Target,
  Lightbulb,
  Upload,
  User,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ArrowRightLeft,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

const COLORS = ['#2563eb', '#7c3aed', '#16a34a', '#d97706', '#dc2626', '#0891b2', '#4f46e5'];

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  'הכנסה-משכורת': { label: 'משכורת', color: '#16a34a' },
  'דיור-משכנתא': { label: 'משכנתא', color: '#dc2626' },
  'דיור-שכירות': { label: 'שכירות', color: '#dc2626' },
  'ביטוח': { label: 'ביטוח', color: '#d97706' },
  'חיסכון-פנסיה': { label: 'חיסכון/פנסיה', color: '#2563eb' },
  'כרטיס-אשראי': { label: 'כרטיסי אשראי', color: '#7c3aed' },
  'חשבונות-בית': { label: 'חשבונות בית', color: '#0891b2' },
  'מזון': { label: 'מזון', color: '#ea580c' },
  'רכב-דלק': { label: 'רכב/דלק', color: '#64748b' },
  'העברות': { label: 'העברות', color: '#94a3b8' },
  'חיסכון': { label: 'חיסכון', color: '#2563eb' },
  'מט"ח': { label: 'מט"ח', color: '#6366f1' },
  'אחר': { label: 'אחר', color: '#9ca3af' },
};

const PIE_COLORS = ['#dc2626', '#7c3aed', '#d97706', '#0891b2', '#ea580c', '#64748b', '#2563eb', '#6366f1', '#9ca3af'];

export default function DashboardPage() {
  const { t, locale } = useTranslation();
  const [state, setState] = useState<AppState | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [showIncomeDetails, setShowIncomeDetails] = useState(false);
  const [showExpenseDetails, setShowExpenseDetails] = useState(false);

  useEffect(() => {
    setState(loadState());
    setBankAccounts(getBankAccounts());
    setIsMobile(window.innerWidth < 1024);
  }, []);

  if (!state) return null;

  const Arrow = locale === 'he' ? ArrowLeft : ArrowRight;
  const isNewUser = !state.profile;
  const fmtCur = (n: number) => formatCurrency(n, locale === 'he' ? 'he-IL' : 'en-IL');

  if (isNewUser && isMobile) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
        <img src="/captain.png" alt="Captain" className="w-40 h-auto mb-6" />
        <h1 className="text-3xl font-bold text-primary mb-2">{t('welcome.title')}</h1>
        <p className="text-lg text-text-light mb-8">{t('welcome.subtitle')}</p>

        <div className="space-y-4 w-full max-w-md">
          <Link href="/profile"
            className="flex items-center gap-3 p-4 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors">
            <div className="bg-white/20 p-2 rounded-lg"><User size={24} /></div>
            <div className="text-start">
              <p className="font-semibold">{t('welcome.step1')}</p>
              <p className="text-sm opacity-80">{t('welcome.step1desc')}</p>
            </div>
            <Arrow size={20} className="ms-auto" />
          </Link>

          <Link href="/upload"
            className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl hover:bg-background transition-colors text-text">
            <div className="bg-primary/10 p-2 rounded-lg"><Upload size={24} className="text-primary" /></div>
            <div className="text-start">
              <p className="font-semibold">{t('welcome.step2')}</p>
              <p className="text-sm text-text-light">{t('welcome.step2desc')}</p>
            </div>
            <Arrow size={20} className="ms-auto text-text-light" />
          </Link>

          <Link href="/goals"
            className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl hover:bg-background transition-colors text-text">
            <div className="bg-primary/10 p-2 rounded-lg"><Target size={24} className="text-primary" /></div>
            <div className="text-start">
              <p className="font-semibold">{t('welcome.step3')}</p>
              <p className="text-sm text-text-light">{t('welcome.step3desc')}</p>
            </div>
            <Arrow size={20} className="ms-auto text-text-light" />
          </Link>
        </div>
      </div>
    );
  }

  const netWorth = calculateNetWorth();
  const totalLiabilities = calculateTotalLiabilities();
  const profile = state.profile;
  const familyNetIncome = profile ? (profile.monthlyIncome || 0) + (profile.spouseMonthlyIncomeNet || 0) : 0;
  const monthlySavings = profile ? familyNetIncome - profile.monthlyExpenses : 0;
  const monthlyDebtPayments = (state.liabilities || []).reduce((s, l) => s + l.monthlyPayment, 0);

  // Bank transaction data
  const allTransactions = bankAccounts.flatMap(a => a.transactions);
  const hasBankData = allTransactions.length > 0;

  const bankIncome = allTransactions.filter(t => t.credit > 0).reduce((s, t) => s + t.credit, 0);
  const bankExpenses = allTransactions.filter(t => t.debit > 0).reduce((s, t) => s + t.debit, 0);
  const bankNetFlow = bankIncome - bankExpenses;

  // Income breakdown by category
  const incomeByCategory: Record<string, number> = {};
  for (const t of allTransactions) {
    if (t.credit > 0) {
      incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + t.credit;
    }
  }
  const incomeBreakdown = Object.entries(incomeByCategory)
    .map(([cat, amount]) => ({ cat, label: CATEGORY_CONFIG[cat]?.label || cat, amount, color: CATEGORY_CONFIG[cat]?.color || '#16a34a' }))
    .sort((a, b) => b.amount - a.amount);

  // Expense breakdown by category
  const expensesByCategory: Record<string, number> = {};
  for (const t of allTransactions) {
    if (t.debit > 0) {
      expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.debit;
    }
  }
  const expenseBreakdown = Object.entries(expensesByCategory)
    .map(([cat, amount]) => ({ cat, label: CATEGORY_CONFIG[cat]?.label || cat, amount, color: CATEGORY_CONFIG[cat]?.color || '#dc2626' }))
    .sort((a, b) => b.amount - a.amount);

  const expensePieData = expenseBreakdown.map(d => ({ name: d.label, value: d.amount, color: d.color }));

  // Use bank data for income/expenses if available, otherwise fall back to profile
  const displayIncome = hasBankData ? bankIncome : familyNetIncome;
  const displayExpenses = hasBankData ? bankExpenses : (profile?.monthlyExpenses || 0) + monthlyDebtPayments;
  const displaySavings = hasBankData ? bankNetFlow : monthlySavings - monthlyDebtPayments;

  const assetsByCategory = state.assets.reduce<Record<string, number>>((acc, a) => {
    acc[a.category] = (acc[a.category] || 0) + a.value;
    return acc;
  }, {});

  const pieData = Object.entries(assetsByCategory).map(([key, value]) => ({
    name: t(`assets.categories.${key}`),
    value,
  }));

  const goalChartData = state.goals
    .filter(g => g.status === 'active')
    .slice(0, 5)
    .map(g => ({
      name: g.name.length > 12 ? g.name.slice(0, 12) + '...' : g.name,
      current: g.currentAmount,
      target: g.targetAmount,
    }));

  const quickActions = [
    { label: t('nav.profile'), href: '/profile', icon: User, color: 'bg-blue-500' },
    { label: t('nav.upload'), href: '/upload', icon: Upload, color: 'bg-green-500' },
    { label: t('nav.goals'), href: '/goals', icon: Target, color: 'bg-purple-500' },
    { label: t('nav.recommendations'), href: '/recommendations', icon: Lightbulb, color: 'bg-orange-500' },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">
        {t('dashboard.welcome')}{profile ? `, ${profile.firstName}` : ''}
      </h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard
          icon={<Wallet size={24} />}
          label={t('dashboard.netWorth')}
          value={formatCurrency(netWorth)}
          color="bg-primary"
        />
        <ExpandableStatCard
          icon={<TrendingUp size={24} />}
          label={hasBankData ? 'הכנסות (מתנועות)' : t('dashboard.familyNetIncome')}
          value={fmtCur(displayIncome)}
          color="bg-success"
          expandable={hasBankData && incomeBreakdown.length > 0}
          expanded={showIncomeDetails}
          onToggle={() => setShowIncomeDetails(!showIncomeDetails)}
        />
        <ExpandableStatCard
          icon={<TrendingDown size={24} />}
          label={hasBankData ? 'הוצאות (מתנועות)' : t('dashboard.monthlyExpenses')}
          value={fmtCur(displayExpenses)}
          color="bg-danger"
          expandable={hasBankData && expenseBreakdown.length > 0}
          expanded={showExpenseDetails}
          onToggle={() => setShowExpenseDetails(!showExpenseDetails)}
        />
        <StatCard
          icon={<PiggyBank size={24} />}
          label={hasBankData ? 'תזרים נטו' : t('dashboard.monthlySavings')}
          value={fmtCur(displaySavings)}
          color={displaySavings >= 0 ? 'bg-success' : 'bg-danger'}
        />
        <StatCard
          icon={<TrendingDown size={24} />}
          label={t('assets.totalLiabilities')}
          value={formatCurrency(totalLiabilities)}
          color="bg-red-600"
        />
      </div>

      {/* Income Details Expansion */}
      {showIncomeDetails && hasBankData && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-xl p-4 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-green-800">פירוט הכנסות</h3>
            <Link href="/transactions" className="text-xs text-primary hover:underline flex items-center gap-1">
              לכל התנועות <Arrow size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {incomeBreakdown.map((d, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 bg-white rounded-lg text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                  <span>{d.label}</span>
                </div>
                <span className="font-bold text-green-700">{fmtCur(d.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expense Details Expansion */}
      {showExpenseDetails && hasBankData && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-red-800">פירוט הוצאות</h3>
            <Link href="/transactions" className="text-xs text-primary hover:underline flex items-center gap-1">
              לכל התנועות <Arrow size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {expenseBreakdown.map((d, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 bg-white rounded-lg text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                  <span>{d.label}</span>
                </div>
                <span className="font-bold text-red-700">{fmtCur(d.amount)}</span>
              </div>
            ))}
          </div>
          {/* Mini pie */}
          {expensePieData.length > 2 && (
            <div className="mt-3">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={expensePieData} cx="50%" cy="50%" outerRadius={70} innerRadius={35} dataKey="value"
                    label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}>
                    {expensePieData.map((d, i) => <Cell key={i} fill={d.color || PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(val) => fmtCur(Number(val))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Bank Transaction Summary - shown when bank data exists */}
      {hasBankData && (
        <div className="bg-surface rounded-xl shadow-sm border border-border p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowRightLeft size={18} className="text-primary" />
              <span className="font-medium text-sm">
                נתונים מ-{bankAccounts.length} חשבון{bankAccounts.length > 1 ? 'ות' : ''} בנק
                ({allTransactions.length} תנועות)
              </span>
            </div>
            <Link href="/transactions" className="text-xs text-primary hover:underline flex items-center gap-1">
              ניתוח מלא <Arrow size={12} />
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Asset Distribution */}
        <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-lg font-semibold mb-4">{t('dashboard.assetDistribution')}</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {pieData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val) => formatCurrency(Number(val))} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-text-light">
              {t('common.noData')}
            </div>
          )}
        </div>

        {/* Goals Progress */}
        <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-lg font-semibold mb-4">{t('dashboard.goalsProgress')}</h2>
          {goalChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={goalChartData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(val) => formatCurrency(Number(val))} />
                <Bar dataKey="current" fill="#2563eb" name="Current" radius={[4, 4, 0, 0]} />
                <Bar dataKey="target" fill="#e2e8f0" name="Target" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-text-light">
              {t('common.noData')}
            </div>
          )}
        </div>
      </div>

      {/* Top Recommendations */}
      {state.recommendations.length > 0 && (
        <div className="bg-surface rounded-xl shadow-sm border border-border p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{t('dashboard.topRecommendations')}</h2>
            <Link href="/recommendations" className="text-primary text-sm hover:underline flex items-center gap-1">
              {t('nav.recommendations')} <Arrow size={14} />
            </Link>
          </div>
          <div className="space-y-3">
            {state.recommendations.slice(0, 3).map(rec => (
              <div key={rec.id} className="flex items-start gap-3 p-3 bg-background rounded-lg">
                <Lightbulb size={18} className="text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">{rec.title}</p>
                  <p className="text-xs text-text-light mt-0.5">{rec.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
        <h2 className="text-lg font-semibold mb-4">{t('dashboard.quickActions')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map(({ label, href, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-background transition-colors"
            >
              <div className={`${color} text-white p-3 rounded-xl`}>
                <Icon size={24} />
              </div>
              <span className="text-sm font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-surface rounded-xl shadow-sm border border-border p-5">
      <div className="flex items-center gap-3">
        <div className={`${color} text-white p-2.5 rounded-lg`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-text-light">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
}

function ExpandableStatCard({ icon, label, value, color, expandable, expanded, onToggle }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div
      className={`bg-surface rounded-xl shadow-sm border border-border p-5 ${expandable ? 'cursor-pointer hover:border-primary/50 transition-colors' : ''}`}
      onClick={expandable ? onToggle : undefined}
    >
      <div className="flex items-center gap-3">
        <div className={`${color} text-white p-2.5 rounded-lg`}>
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-sm text-text-light">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
        {expandable && (
          <div className="text-text-light">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        )}
      </div>
    </div>
  );
}
