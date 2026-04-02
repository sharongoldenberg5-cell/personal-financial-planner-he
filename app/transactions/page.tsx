'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/translations';
import { getBankAccounts, clearAllBankAccounts, getCreditCards, clearAllCreditCards } from '@/lib/storage';
import { formatCurrency } from '@/lib/utils';
import type { BankAccount, BankTransaction, CreditCardStatement } from '@/lib/types';
import {
  RotateCcw, TrendingUp, TrendingDown, CreditCard, Home, Shield,
  PiggyBank, Wallet, ArrowRightLeft, BarChart3, AlertTriangle,
  Zap, Phone, ShoppingBag, GraduationCap, Heart, Utensils,
  Car, Bus, Receipt, Building, ChevronDown, ChevronUp, Landmark, Plane, Globe, Coffee,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import Link from 'next/link';

// Full category configuration with icons, colors, and groups
const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: typeof Wallet; group: string }> = {
  // הכנסות
  'הכנסה-משכורת': { label: 'משכורת', color: '#16a34a', icon: TrendingUp, group: 'הכנסות' },
  'הכנסה-קצבה': { label: 'קצבאות', color: '#22c55e', icon: Landmark, group: 'הכנסות' },
  'הכנסה-שכירות': { label: 'הכנסה משכירות', color: '#15803d', icon: Home, group: 'הכנסות' },
  // דיור
  'דיור-משכנתא': { label: 'משכנתא', color: '#dc2626', icon: Home, group: 'דיור' },
  'דיור-שכירות': { label: 'שכירות', color: '#ef4444', icon: Home, group: 'דיור' },
  'דיור-ועד-בית': { label: 'ועד בית', color: '#f87171', icon: Building, group: 'דיור' },
  // אנרגיה ותשתיות
  'אנרגיה-חשמל': { label: 'חשמל', color: '#f59e0b', icon: Zap, group: 'אנרגיה' },
  'אנרגיה-גז': { label: 'גז', color: '#d97706', icon: Zap, group: 'אנרגיה' },
  'אנרגיה-מים': { label: 'מים', color: '#0ea5e9', icon: Zap, group: 'אנרגיה' },
  // מיסים
  'מיסים-ארנונה': { label: 'ארנונה', color: '#7c3aed', icon: Landmark, group: 'מיסים' },
  'מיסים-מס-הכנסה': { label: 'מס הכנסה', color: '#6d28d9', icon: Landmark, group: 'מיסים' },
  'מיסים-ביטוח-לאומי': { label: 'ביטוח לאומי', color: '#8b5cf6', icon: Landmark, group: 'מיסים' },
  'מיסים-מעמ': { label: 'מע"מ', color: '#a78bfa', icon: Landmark, group: 'מיסים' },
  // ביטוח
  'ביטוח': { label: 'ביטוח', color: '#d97706', icon: Shield, group: 'ביטוח' },
  // חיסכון ופנסיה
  'חיסכון-פנסיה': { label: 'פנסיה/גמל', color: '#2563eb', icon: PiggyBank, group: 'חיסכון' },
  'חיסכון': { label: 'חיסכון/פקדונות', color: '#3b82f6', icon: PiggyBank, group: 'חיסכון' },
  // כרטיסי אשראי
  'כרטיס-אשראי': { label: 'כרטיסי אשראי', color: '#7c3aed', icon: CreditCard, group: 'כרטיסי אשראי' },
  // תקשורת
  'תקשורת': { label: 'תקשורת/אינטרנט', color: '#06b6d4', icon: Phone, group: 'תקשורת' },
  // מזון
  'מזון': { label: 'מזון וסופרים', color: '#ea580c', icon: Utensils, group: 'מזון' },
  // רכב
  'רכב-דלק': { label: 'דלק', color: '#64748b', icon: Car, group: 'רכב' },
  'רכב-אחזקה': { label: 'אחזקת רכב', color: '#475569', icon: Car, group: 'רכב' },
  // תחבורה
  'תחבורה': { label: 'תחבורה ציבורית', color: '#0891b2', icon: Bus, group: 'תחבורה' },
  // חינוך
  'חינוך': { label: 'חינוך', color: '#0d9488', icon: GraduationCap, group: 'חינוך' },
  // בריאות
  'בריאות': { label: 'בריאות', color: '#e11d48', icon: Heart, group: 'בריאות' },
  // בילוי ופנאי
  'בילוי-פנאי': { label: 'בילוי ופנאי', color: '#db2777', icon: Utensils, group: 'בילוי' },
  'בילוי-מסעדות': { label: 'מסעדות וקפה', color: '#ec4899', icon: Coffee, group: 'בילוי' },
  // ביגוד
  'ביגוד-קניות': { label: 'ביגוד וקניות', color: '#c026d3', icon: ShoppingBag, group: 'ביגוד' },
  // נסיעות
  'נסיעות': { label: 'נסיעות ותיירות', color: '#f472b6', icon: Plane, group: 'נסיעות' },
  // קניות אונליין
  'קניות-אונליין': { label: 'קניות אונליין', color: '#a855f7', icon: Globe, group: 'קניות' },
  // תקשורת מנויים (מכרטיס אשראי)
  'תקשורת-מנויים': { label: 'מנויים ותקשורת', color: '#22d3ee', icon: Phone, group: 'תקשורת' },
  // העברות
  'העברות': { label: 'העברות', color: '#94a3b8', icon: ArrowRightLeft, group: 'העברות' },
  // הלוואות
  'הלוואות': { label: 'הלוואות', color: '#b91c1c', icon: Receipt, group: 'הלוואות' },
  // מט"ח
  'מט"ח': { label: 'מט"ח', color: '#6366f1', icon: Wallet, group: 'מט"ח' },
  // אחר
  'אחר': { label: 'אחר', color: '#9ca3af', icon: Wallet, group: 'אחר' },
};

const PIE_COLORS = ['#dc2626', '#7c3aed', '#d97706', '#0891b2', '#ea580c', '#64748b', '#2563eb', '#06b6d4', '#e11d48', '#0d9488', '#c026d3', '#6366f1', '#9ca3af'];

export default function TransactionsPage() {
  const { t, locale } = useTranslation();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCardStatement[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showAllTransactions, setShowAllTransactions] = useState(false);

  useEffect(() => {
    setAccounts(getBankAccounts());
    setCreditCards(getCreditCards());
  }, []);

  const fmtCur = (n: number) => formatCurrency(n, locale === 'he' ? 'he-IL' : 'en-IL');

  // Filter
  const filteredAccounts = selectedAccount === 'all' ? accounts :
    accounts.filter(a => a.id === selectedAccount);
  const filteredByType = selectedType === 'all' ? filteredAccounts :
    filteredAccounts.filter(a => a.type === selectedType);
  // Bank transactions
  const bankTransactions = filteredByType.flatMap(a => a.transactions);

  // Credit card transactions converted to common format
  const ccTransactions: BankTransaction[] = creditCards.flatMap(cc =>
    cc.transactions
      .filter(t => t.category !== 'כרטיס-אשראי')
      .map(t => ({
        date: t.date,
        code: '',
        action: t.businessName,
        details: t.isInstallment ? `תשלום ${t.installmentCurrent}/${t.installmentTotal}` : '',
        reference: `CC:${cc.cardName}`,
        debit: t.amount,
        credit: 0,
        balance: 0,
        category: t.category,
      }))
  );

  const allTransactions = [...bankTransactions, ...ccTransactions];

  // Totals
  const totalIncome = allTransactions.filter(t => t.credit > 0).reduce((s, t) => s + t.credit, 0);
  const totalExpenses = allTransactions.filter(t => t.debit > 0).reduce((s, t) => s + t.debit, 0);
  const netFlow = totalIncome - totalExpenses;

  // Income breakdown
  const incomeByCategory: Record<string, { amount: number; transactions: BankTransaction[] }> = {};
  for (const t of allTransactions) {
    if (t.credit > 0) {
      if (!incomeByCategory[t.category]) incomeByCategory[t.category] = { amount: 0, transactions: [] };
      incomeByCategory[t.category].amount += t.credit;
      incomeByCategory[t.category].transactions.push(t);
    }
  }
  const incomeBreakdown = Object.entries(incomeByCategory)
    .map(([cat, data]) => ({ cat, ...data }))
    .sort((a, b) => b.amount - a.amount);

  // Expense breakdown (exclude כרטיס-אשראי as it's a payment method, not expense category)
  const expensesByCategory: Record<string, { amount: number; transactions: BankTransaction[] }> = {};
  for (const t of allTransactions) {
    if (t.debit > 0 && t.category !== 'כרטיס-אשראי') {
      if (!expensesByCategory[t.category]) expensesByCategory[t.category] = { amount: 0, transactions: [] };
      expensesByCategory[t.category].amount += t.debit;
      expensesByCategory[t.category].transactions.push(t);
    }
  }
  const expenseBreakdown = Object.entries(expensesByCategory)
    .map(([cat, data]) => ({ cat, ...data }))
    .sort((a, b) => b.amount - a.amount);

  // Group expenses by group
  const expensesByGroup: Record<string, { amount: number; categories: typeof expenseBreakdown }> = {};
  for (const exp of expenseBreakdown) {
    const group = CATEGORY_CONFIG[exp.cat]?.group || 'אחר';
    if (!expensesByGroup[group]) expensesByGroup[group] = { amount: 0, categories: [] };
    expensesByGroup[group].amount += exp.amount;
    expensesByGroup[group].categories.push(exp);
  }
  const groupBreakdown = Object.entries(expensesByGroup)
    .map(([group, data]) => ({ group, ...data }))
    .sort((a, b) => b.amount - a.amount);

  const expensePieData = expenseBreakdown.map(d => ({
    name: CATEGORY_CONFIG[d.cat]?.label || d.cat,
    value: d.amount,
    color: CATEGORY_CONFIG[d.cat]?.color || '#9ca3af',
  }));

  // Bar chart data for groups
  const groupBarData = groupBreakdown.slice(0, 8).map(g => ({
    name: g.group,
    value: g.amount,
  }));

  // Insights
  const insights: { type: 'warning' | 'info' | 'tip'; text: string }[] = [];

  if (totalExpenses > totalIncome && totalIncome > 0) {
    insights.push({ type: 'warning', text: `ההוצאות (${fmtCur(totalExpenses)}) גבוהות מההכנסות (${fmtCur(totalIncome)}) - מינוס של ${fmtCur(totalExpenses - totalIncome)}` });
  }

  // Installment warning from credit cards
  const installmentTxs = creditCards.flatMap(cc => cc.transactions.filter(t => t.isInstallment));
  if (installmentTxs.length > 0) {
    const instTotal = installmentTxs.reduce((s, t) => s + t.totalDealAmount, 0);
    insights.push({ type: 'warning', text: `${installmentTxs.length} עסקאות בתשלומים | חוב כולל: ${fmtCur(instTotal)} - עסקאות בתשלומים מייצרות חוב נסתר` });
  }

  const housingTotal = (expensesByCategory['דיור-משכנתא']?.amount || 0) + (expensesByCategory['דיור-שכירות']?.amount || 0);
  if (housingTotal > 0 && totalIncome > 0) {
    const housingPct = (housingTotal / totalIncome) * 100;
    if (housingPct > 30) {
      insights.push({ type: 'warning', text: `הוצאות דיור (${fmtCur(housingTotal)}) = ${housingPct.toFixed(0)}% מההכנסה. מומלץ עד 30%` });
    }
  }

  const insuranceTotal = expensesByCategory['ביטוח']?.amount || 0;
  if (insuranceTotal > 500) {
    insights.push({ type: 'tip', text: `תשלומי ביטוח: ${fmtCur(insuranceTotal)} - שווה לבדוק כפלים ולהשוות מחירים` });
  }

  const savingsTotal = (expensesByCategory['חיסכון-פנסיה']?.amount || 0) + (expensesByCategory['חיסכון']?.amount || 0);
  if (totalIncome > 0) {
    const savingsRate = (savingsTotal / totalIncome) * 100;
    if (savingsRate < 10) {
      insights.push({ type: 'tip', text: `שיעור חיסכון ${savingsRate.toFixed(0)}% - מומלץ לפחות 20% מההכנסה` });
    } else {
      insights.push({ type: 'info', text: `שיעור חיסכון: ${savingsRate.toFixed(0)}% מההכנסה (${fmtCur(savingsTotal)})` });
    }
  }

  const energyTotal = (expensesByGroup['אנרגיה']?.amount || 0);
  if (energyTotal > 0) {
    insights.push({ type: 'info', text: `חשבונות אנרגיה (חשמל+מים+גז): ${fmtCur(energyTotal)}` });
  }

  const foodTotal = expensesByCategory['מזון']?.amount || 0;
  if (foodTotal > 0 && totalIncome > 0) {
    const foodPct = (foodTotal / totalIncome) * 100;
    if (foodPct > 15) {
      insights.push({ type: 'tip', text: `הוצאות מזון ${fmtCur(foodTotal)} (${foodPct.toFixed(0)}% מההכנסה) - מעל הממוצע` });
    }
  }

  if (accounts.length === 0 && creditCards.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">{t('nav.transactions')}</h1>
        <div className="bg-surface rounded-xl shadow-sm border border-border p-12 text-center">
          <BarChart3 size={48} className="mx-auto mb-4 text-text-light" />
          <p className="text-text-light mb-4">אין נתוני תנועות. העלה קובץ Excel של תנועות חשבון בנק.</p>
          <Link href="/upload" className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors">
            העלה קובץ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('nav.transactions')}</h1>
        <button onClick={() => { clearAllBankAccounts(); clearAllCreditCards(); setAccounts([]); setCreditCards([]); }}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-text-light hover:text-danger transition-colors">
          <RotateCcw size={14} /> {t('common.reset')}
        </button>
      </div>

      {/* Filters */}
      {accounts.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => setSelectedAccount('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${selectedAccount === 'all' ? 'bg-primary text-white' : 'bg-surface border border-border'}`}>
            כל החשבונות
          </button>
          {accounts.map(a => (
            <button key={a.id} onClick={() => setSelectedAccount(a.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${selectedAccount === a.id ? 'bg-primary text-white' : 'bg-surface border border-border'}`}>
              {a.bank} - {a.accountNumber} ({a.type === 'business' ? 'עסקי' : 'פרטי'})
            </button>
          ))}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-600 to-green-500 text-white rounded-xl p-5">
          <p className="text-sm opacity-80">הכנסות</p>
          <p className="text-2xl font-bold">{fmtCur(totalIncome)}</p>
          <p className="text-xs opacity-60 mt-1">{incomeBreakdown.length} קטגוריות</p>
        </div>
        <div className="bg-gradient-to-br from-red-600 to-red-500 text-white rounded-xl p-5">
          <p className="text-sm opacity-80">הוצאות</p>
          <p className="text-2xl font-bold">{fmtCur(totalExpenses)}</p>
          <p className="text-xs opacity-60 mt-1">{expenseBreakdown.length} קטגוריות</p>
        </div>
        <div className={`bg-gradient-to-br ${netFlow >= 0 ? 'from-blue-600 to-blue-500' : 'from-orange-600 to-orange-500'} text-white rounded-xl p-5`}>
          <p className="text-sm opacity-80">תזרים נטו</p>
          <p className="text-2xl font-bold">{fmtCur(netFlow)}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-600 to-purple-500 text-white rounded-xl p-5">
          <p className="text-sm opacity-80">תנועות</p>
          <p className="text-2xl font-bold">{allTransactions.length}</p>
          <p className="text-xs opacity-60 mt-1">{filteredByType.length} חשבונות</p>
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="space-y-2 mb-6">
          {insights.map((ins, i) => (
            <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${
              ins.type === 'warning' ? 'bg-red-50 border-red-200' :
              ins.type === 'tip' ? 'bg-yellow-50 border-yellow-200' :
              'bg-blue-50 border-blue-200'
            }`}>
              {ins.type === 'warning' ? <AlertTriangle size={16} className="text-danger flex-shrink-0 mt-0.5" /> :
               ins.type === 'tip' ? <TrendingDown size={16} className="text-warning flex-shrink-0 mt-0.5" /> :
               <TrendingUp size={16} className="text-primary flex-shrink-0 mt-0.5" />}
              <p className="text-sm">{ins.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* === INCOME BREAKDOWN === */}
      <div className="bg-surface rounded-xl shadow-sm border border-border p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp size={20} className="text-success" /> פירוט הכנסות
        </h2>
        <div className="space-y-2">
          {incomeBreakdown.map((item) => {
            const config = CATEGORY_CONFIG[item.cat];
            const Icon = config?.icon || Wallet;
            const pct = totalIncome > 0 ? (item.amount / totalIncome) * 100 : 0;
            const isExpanded = expandedCategory === `income-${item.cat}`;
            return (
              <div key={item.cat}>
                <div
                  className="flex items-center gap-3 p-3 bg-background rounded-lg cursor-pointer hover:bg-green-50 transition-colors"
                  onClick={() => setExpandedCategory(isExpanded ? null : `income-${item.cat}`)}
                >
                  <div className="p-1.5 rounded-lg" style={{ backgroundColor: (config?.color || '#16a34a') + '20' }}>
                    <Icon size={16} style={{ color: config?.color || '#16a34a' }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{config?.label || item.cat}</span>
                      <span className="font-bold text-success">{fmtCur(item.amount)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-green-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-text-light">{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                  <span className="text-xs text-text-light">{item.transactions.length} תנועות</span>
                  {isExpanded ? <ChevronUp size={14} className="text-text-light" /> : <ChevronDown size={14} className="text-text-light" />}
                </div>
                {isExpanded && (
                  <div className="mt-1 ms-10 space-y-1">
                    {item.transactions.map((t, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-green-50 rounded text-xs">
                        <div className="flex gap-3">
                          <span className="text-text-light">{t.date}</span>
                          <span>{t.action}</span>
                          <span className="text-text-light">{t.details}</span>
                        </div>
                        <span className="font-semibold text-success">{fmtCur(t.credit)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* === EXPENSE BREAKDOWN BY GROUP === */}
      <div className="bg-surface rounded-xl shadow-sm border border-border p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingDown size={20} className="text-danger" /> פירוט הוצאות לפי קטגוריה
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Pie chart */}
          {expensePieData.length > 0 && (
            <div>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={expensePieData} cx="50%" cy="50%" outerRadius={70} innerRadius={30} dataKey="value"
                    label={({ name, percent }: any) => `${name || ''} ${(((percent || 0)) * 100).toFixed(0)}%`}
                    labelLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
                    fontSize={9}
                  >
                    {expensePieData.map((d, i) => <Cell key={i} fill={d.color || PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(val) => fmtCur(Number(val))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Bar chart by group */}
          {groupBarData.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-text-light mb-2">הוצאות לפי קבוצה</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={groupBarData} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
                  <Tooltip formatter={(val) => fmtCur(Number(val))} />
                  <Bar dataKey="value" fill="#dc2626" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Detailed list by group */}
        <div className="space-y-4">
          {groupBreakdown.map((group) => (
            <div key={group.group} className="border border-border rounded-xl overflow-hidden">
              <div className="bg-background px-4 py-2.5 flex items-center justify-between">
                <span className="font-semibold text-sm">{group.group}</span>
                <span className="font-bold text-danger">{fmtCur(group.amount)}</span>
              </div>
              <div className="p-2 space-y-1">
                {group.categories.map((item) => {
                  const config = CATEGORY_CONFIG[item.cat];
                  const Icon = config?.icon || Wallet;
                  const pct = totalExpenses > 0 ? (item.amount / totalExpenses) * 100 : 0;
                  const isExpanded = expandedCategory === `expense-${item.cat}`;
                  return (
                    <div key={item.cat}>
                      <div
                        className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer hover:bg-red-50 transition-colors"
                        onClick={() => setExpandedCategory(isExpanded ? null : `expense-${item.cat}`)}
                      >
                        <div className="p-1.5 rounded-lg" style={{ backgroundColor: (config?.color || '#dc2626') + '20' }}>
                          <Icon size={14} style={{ color: config?.color || '#dc2626' }} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">{config?.label || item.cat}</span>
                            <span className="font-semibold text-danger text-sm">{fmtCur(item.amount)}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ backgroundColor: config?.color || '#dc2626', width: `${pct}%` }} />
                            </div>
                            <span className="text-[10px] text-text-light">{pct.toFixed(1)}%</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-text-light">{item.transactions.length}</span>
                        {isExpanded ? <ChevronUp size={12} className="text-text-light" /> : <ChevronDown size={12} className="text-text-light" />}
                      </div>
                      {isExpanded && (
                        <div className="ms-10 space-y-0.5 pb-1">
                          {item.transactions.sort((a, b) => b.debit - a.debit).map((t, i) => (
                            <div key={i} className="flex items-center justify-between p-1.5 bg-red-50 rounded text-xs">
                              <div className="flex gap-2">
                                <span className="text-text-light">{t.date}</span>
                                <span className="font-medium">{t.action}</span>
                                <span className="text-text-light truncate max-w-[150px]">{t.details}</span>
                              </div>
                              <span className="font-semibold text-danger">{fmtCur(t.debit)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* === ALL TRANSACTIONS TABLE === */}
      <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">כל התנועות ({allTransactions.length})</h2>
          <button
            onClick={() => setShowAllTransactions(!showAllTransactions)}
            className="text-sm text-primary hover:underline"
          >
            {showAllTransactions ? 'הסתר' : 'הצג הכל'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-light">
                <th className="px-2 py-2 text-start">תאריך</th>
                <th className="px-2 py-2 text-start">פעולה</th>
                <th className="px-2 py-2 text-start">פרטים</th>
                <th className="px-2 py-2 text-start">קטגוריה</th>
                <th className="px-2 py-2 text-end">חובה</th>
                <th className="px-2 py-2 text-end">זכות</th>
                <th className="px-2 py-2 text-end">יתרה</th>
              </tr>
            </thead>
            <tbody>
              {(showAllTransactions ? allTransactions : allTransactions.slice(0, 20)).map((t, i) => {
                const config = CATEGORY_CONFIG[t.category];
                return (
                  <tr key={i} className="border-b border-border/50 hover:bg-background">
                    <td className="px-2 py-2">{t.date}</td>
                    <td className="px-2 py-2 font-medium">{t.action}</td>
                    <td className="px-2 py-2 text-text-light max-w-[200px] truncate">{t.details}</td>
                    <td className="px-2 py-2">
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{
                        backgroundColor: (config?.color || '#9ca3af') + '15',
                        color: config?.color || '#9ca3af'
                      }}>
                        {config?.label || t.category}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-end">{t.debit > 0 ? <span className="text-danger">{fmtCur(t.debit)}</span> : ''}</td>
                    <td className="px-2 py-2 text-end">{t.credit > 0 ? <span className="text-success">{fmtCur(t.credit)}</span> : ''}</td>
                    <td className="px-2 py-2 text-end font-medium">{fmtCur(t.balance)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!showAllTransactions && allTransactions.length > 20 && (
            <button
              onClick={() => setShowAllTransactions(true)}
              className="w-full mt-2 py-2 text-sm text-primary hover:underline"
            >
              הצג עוד {allTransactions.length - 20} תנועות...
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
