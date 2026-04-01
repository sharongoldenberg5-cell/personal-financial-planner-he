'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/translations';
import { getBankAccounts, clearAllBankAccounts } from '@/lib/storage';
import { formatCurrency } from '@/lib/utils';
import type { BankAccount } from '@/lib/types';
import { RotateCcw, TrendingUp, TrendingDown, CreditCard, Home, Shield, PiggyBank, Wallet, ArrowRightLeft, BarChart3, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import Link from 'next/link';

const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: typeof Wallet }> = {
  'הכנסה-משכורת': { label: 'משכורת', color: '#16a34a', icon: TrendingUp },
  'דיור-משכנתא': { label: 'משכנתא', color: '#dc2626', icon: Home },
  'דיור-שכירות': { label: 'שכירות', color: '#dc2626', icon: Home },
  'ביטוח': { label: 'ביטוח', color: '#d97706', icon: Shield },
  'חיסכון-פנסיה': { label: 'חיסכון/פנסיה', color: '#2563eb', icon: PiggyBank },
  'כרטיס-אשראי': { label: 'כרטיסי אשראי', color: '#7c3aed', icon: CreditCard },
  'חשבונות-בית': { label: 'חשבונות בית', color: '#0891b2', icon: Home },
  'מזון': { label: 'מזון', color: '#ea580c', icon: Wallet },
  'רכב-דלק': { label: 'רכב/דלק', color: '#64748b', icon: Wallet },
  'העברות': { label: 'העברות', color: '#94a3b8', icon: ArrowRightLeft },
  'חיסכון': { label: 'חיסכון', color: '#2563eb', icon: PiggyBank },
  'מט"ח': { label: 'מט"ח', color: '#6366f1', icon: Wallet },
  'אחר': { label: 'אחר', color: '#9ca3af', icon: Wallet },
};

const PIE_COLORS = ['#dc2626', '#7c3aed', '#d97706', '#0891b2', '#ea580c', '#64748b', '#2563eb', '#6366f1', '#9ca3af'];

export default function TransactionsPage() {
  const { t, locale } = useTranslation();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  useEffect(() => {
    setAccounts(getBankAccounts());
  }, []);

  const fmtCur = (n: number) => formatCurrency(n, locale === 'he' ? 'he-IL' : 'en-IL');

  // Filter transactions
  const filteredAccounts = selectedAccount === 'all' ? accounts :
    accounts.filter(a => a.id === selectedAccount);
  const filteredByType = selectedType === 'all' ? filteredAccounts :
    filteredAccounts.filter(a => a.type === selectedType);
  const allTransactions = filteredByType.flatMap(a => a.transactions);

  // Calculations
  const totalIncome = allTransactions.filter(t => t.credit > 0).reduce((s, t) => s + t.credit, 0);
  const totalExpenses = allTransactions.filter(t => t.debit > 0).reduce((s, t) => s + t.debit, 0);
  const netFlow = totalIncome - totalExpenses;

  // Category breakdown (expenses only)
  const expensesByCategory: Record<string, number> = {};
  for (const t of allTransactions) {
    if (t.debit > 0) {
      expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.debit;
    }
  }
  const pieData = Object.entries(expensesByCategory)
    .map(([cat, amount]) => ({
      name: CATEGORY_CONFIG[cat]?.label || cat,
      value: amount,
      color: CATEGORY_CONFIG[cat]?.color || '#9ca3af',
    }))
    .sort((a, b) => b.value - a.value);

  // Insights
  const insights: { type: 'warning' | 'info' | 'tip'; text: string }[] = [];

  // Check if expenses > income
  if (totalExpenses > totalIncome && totalIncome > 0) {
    insights.push({ type: 'warning', text: `ההוצאות (${fmtCur(totalExpenses)}) גבוהות מההכנסות (${fmtCur(totalIncome)}) - אתה במינוס של ${fmtCur(totalExpenses - totalIncome)}` });
  }

  // Check credit card percentage
  const ccTotal = expensesByCategory['כרטיס-אשראי'] || 0;
  if (ccTotal > 0 && totalExpenses > 0) {
    const ccPct = (ccTotal / totalExpenses) * 100;
    if (ccPct > 40) {
      insights.push({ type: 'warning', text: `${ccPct.toFixed(0)}% מההוצאות דרך כרטיסי אשראי (${fmtCur(ccTotal)}) - מומלץ לבדוק פירוט` });
    }
  }

  // Check mortgage percentage
  const mortgageTotal = (expensesByCategory['דיור-משכנתא'] || 0) + (expensesByCategory['דיור-שכירות'] || 0);
  if (mortgageTotal > 0 && totalIncome > 0) {
    const mortPct = (mortgageTotal / totalIncome) * 100;
    if (mortPct > 30) {
      insights.push({ type: 'warning', text: `הוצאות דיור (${fmtCur(mortgageTotal)}) = ${mortPct.toFixed(0)}% מההכנסה. מומלץ עד 30%` });
    }
  }

  // Check insurance spending
  const insuranceTotal = expensesByCategory['ביטוח'] || 0;
  if (insuranceTotal > 500) {
    insights.push({ type: 'tip', text: `תשלומי ביטוח: ${fmtCur(insuranceTotal)} בחודש - שווה לבדוק כפלים ולהשוות מחירים` });
  }

  // Savings rate
  const savingsTotal = (expensesByCategory['חיסכון-פנסיה'] || 0) + (expensesByCategory['חיסכון'] || 0);
  if (totalIncome > 0) {
    const savingsRate = (savingsTotal / totalIncome) * 100;
    if (savingsRate < 10) {
      insights.push({ type: 'tip', text: `שיעור החיסכון שלך ${savingsRate.toFixed(0)}% - מומלץ לחסוך לפחות 20% מההכנסה` });
    } else {
      insights.push({ type: 'info', text: `שיעור החיסכון: ${savingsRate.toFixed(0)}% מההכנסה (${fmtCur(savingsTotal)})` });
    }
  }

  if (accounts.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">{t('nav.transactions')}</h1>
        <div className="bg-surface rounded-xl shadow-sm border border-border p-12 text-center">
          <BarChart3 size={48} className="mx-auto mb-4 text-text-light" />
          <p className="text-text-light mb-4">אין נתוני תנועות. העלה קובץ Excel של תנועות חשבון.</p>
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
        <div className="flex gap-2">
          <button onClick={() => { clearAllBankAccounts(); setAccounts([]); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-text-light hover:text-danger transition-colors">
            <RotateCcw size={14} /> {t('common.reset')}
          </button>
        </div>
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-r from-green-600 to-green-400 text-white rounded-xl p-5">
          <p className="text-sm opacity-80">הכנסות</p>
          <p className="text-2xl font-bold">{fmtCur(totalIncome)}</p>
        </div>
        <div className="bg-gradient-to-r from-red-600 to-red-400 text-white rounded-xl p-5">
          <p className="text-sm opacity-80">הוצאות</p>
          <p className="text-2xl font-bold">{fmtCur(totalExpenses)}</p>
        </div>
        <div className={`bg-gradient-to-r ${netFlow >= 0 ? 'from-blue-600 to-blue-400' : 'from-orange-600 to-orange-400'} text-white rounded-xl p-5`}>
          <p className="text-sm opacity-80">תזרים נטו</p>
          <p className="text-2xl font-bold">{fmtCur(netFlow)}</p>
        </div>
        <div className="bg-gradient-to-r from-purple-600 to-purple-400 text-white rounded-xl p-5">
          <p className="text-sm opacity-80">תנועות</p>
          <p className="text-2xl font-bold">{allTransactions.length}</p>
          <p className="text-xs opacity-70">{filteredByType.length} חשבונות</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Expense Pie */}
        <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-lg font-semibold mb-4">פיזור הוצאות</h2>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={85} innerRadius={40} dataKey="value"
                    label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color || PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(val) => fmtCur(Number(val))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-3">
                {pieData.map((d, i) => (
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
            <p className="text-text-light text-center py-8">אין הוצאות</p>
          )}
        </div>

        {/* Top Expenses */}
        <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-lg font-semibold mb-4">הוצאות גדולות</h2>
          <div className="space-y-2">
            {allTransactions
              .filter(t => t.debit > 0)
              .sort((a, b) => b.debit - a.debit)
              .slice(0, 10)
              .map((t, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-background rounded-lg text-sm">
                  <div>
                    <p className="font-medium">{t.action}</p>
                    <p className="text-xs text-text-light">{t.details} | {t.date}</p>
                  </div>
                  <span className="font-bold text-danger">{fmtCur(t.debit)}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* All Transactions Table */}
      <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
        <h2 className="text-lg font-semibold mb-4">כל התנועות ({allTransactions.length})</h2>
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
              {allTransactions.map((t, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-background">
                  <td className="px-2 py-2">{t.date}</td>
                  <td className="px-2 py-2 font-medium">{t.action}</td>
                  <td className="px-2 py-2 text-text-light max-w-[200px] truncate">{t.details}</td>
                  <td className="px-2 py-2">
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{
                      backgroundColor: (CATEGORY_CONFIG[t.category]?.color || '#9ca3af') + '15',
                      color: CATEGORY_CONFIG[t.category]?.color || '#9ca3af'
                    }}>
                      {CATEGORY_CONFIG[t.category]?.label || t.category}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-end">{t.debit > 0 ? <span className="text-danger">{fmtCur(t.debit)}</span> : ''}</td>
                  <td className="px-2 py-2 text-end">{t.credit > 0 ? <span className="text-success">{fmtCur(t.credit)}</span> : ''}</td>
                  <td className="px-2 py-2 text-end font-medium">{fmtCur(t.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
