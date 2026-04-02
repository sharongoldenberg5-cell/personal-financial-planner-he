'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/translations';
import { getLiabilities, saveLiability, deleteLiability, generateId, calculateTotalLiabilities, clearAllLiabilities } from '@/lib/storage';
import type { Liability, LiabilityCategory } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Plus, Pencil, Trash2, X, TrendingDown, RotateCcw } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#dc2626', '#d97706', '#7c3aed', '#64748b'];
const liabilityCategories: LiabilityCategory[] = ['mortgage', 'loan', 'credit-card', 'other'];

const loanPurposes = ['דיור', 'רכב', 'לימודים', 'שיפוץ', 'עסקי', 'רפואי', 'חתונה', 'אחר'];

const emptyLiability: Omit<Liability, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '', category: 'mortgage', originalAmount: 0, currentBalance: 0,
  interestRate: 0, monthlyPayment: 0, lender: '', startDate: '', endDate: '', loanPurpose: '', notes: '',
};

export default function LiabilitiesPage() {
  const { t, locale } = useTranslation();
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyLiability);

  useEffect(() => {
    setLiabilities(getLiabilities());
  }, []);

  const totalLiab = calculateTotalLiabilities();
  const totalMonthly = liabilities.reduce((s, l) => s + l.monthlyPayment, 0);
  const fmtCur = (n: number) => formatCurrency(n, locale === 'he' ? 'he-IL' : 'en-IL');

  const chartData = liabilityCategories
    .map(cat => ({
      name: t(`liabilities.categories.${cat}`),
      value: liabilities.filter(l => l.category === cat).reduce((s, l) => s + l.currentBalance, 0),
    }))
    .filter(d => d.value > 0);

  const handleSave = () => {
    const now = new Date().toISOString();
    const liability: Liability = {
      ...form,
      id: editingId || generateId(),
      createdAt: editingId ? liabilities.find(l => l.id === editingId)?.createdAt || now : now,
      updatedAt: now,
    };
    saveLiability(liability);
    setLiabilities(getLiabilities());
    resetForm();
  };

  const handleEdit = (l: Liability) => { setForm(l); setEditingId(l.id); setShowForm(true); };
  const handleDelete = (id: string) => { deleteLiability(id); setLiabilities(getLiabilities()); };
  const resetForm = () => { setForm(emptyLiability); setEditingId(null); setShowForm(false); };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('liabilities.title')}</h1>
        <div className="flex gap-2">
          <button onClick={() => { clearAllLiabilities(); setLiabilities([]); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-text-light hover:text-danger transition-colors">
            <RotateCcw size={14} /> {t('common.reset')}
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-danger text-white rounded-lg hover:bg-red-700 transition-colors">
            <Plus size={18} /> {t('liabilities.addLiability')}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-gradient-to-r from-red-600 to-red-400 text-white rounded-xl p-5">
          <div className="flex items-center gap-3">
            <TrendingDown size={28} />
            <div>
              <p className="text-sm opacity-80">{t('assets.totalLiabilities')}</p>
              <p className="text-3xl font-bold">{fmtCur(totalLiab)}</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-r from-orange-600 to-orange-400 text-white rounded-xl p-5">
          <div className="flex items-center gap-3">
            <TrendingDown size={28} />
            <div>
              <p className="text-sm opacity-80">{t('liabilities.totalMonthlyPayments')}</p>
              <p className="text-3xl font-bold">{fmtCur(totalMonthly)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart */}
        {chartData.length > 0 && (
          <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
            <h2 className="text-lg font-semibold mb-4">{t('liabilities.distribution')}</h2>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" outerRadius={95} dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                  {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(val) => fmtCur(Number(val))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* List */}
        <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
          {liabilities.length === 0 ? (
            <div className="text-center py-12">
              <TrendingDown size={48} className="mx-auto mb-4 text-text-light" />
              <p className="text-text-light">{t('common.noData')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {liabilities.map(l => {
                const paidPercent = l.originalAmount > 0
                  ? Math.max(0, Math.min(100, ((l.originalAmount - l.currentBalance) / l.originalAmount) * 100))
                  : 0;

                return (
                  <div key={l.id} className="p-4 bg-background rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold">{l.name}</p>
                        <p className="text-sm text-text-light">
                          {t(`liabilities.categories.${l.category}`)}
                          {l.lender && ` • ${l.lender}`}
                          {l.interestRate > 0 && ` • ${l.interestRate}%`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleEdit(l)} className="text-primary hover:text-primary-dark p-1"><Pencil size={16} /></button>
                        <button onClick={() => handleDelete(l.id)} className="text-danger hover:text-red-700 p-1"><Trash2 size={16} /></button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>{t('liabilities.currentBalance')}: <strong className="text-danger">{fmtCur(l.currentBalance)}</strong></span>
                      <span>{t('liabilities.monthlyPayment')}: {fmtCur(l.monthlyPayment)}</span>
                    </div>

                    {l.originalAmount > 0 && (
                      <>
                        <div className="flex items-center justify-between text-xs text-text-light mb-1">
                          <span>{t('liabilities.originalAmount')}: {fmtCur(l.originalAmount)}</span>
                          <span>{paidPercent.toFixed(0)}% {t('liabilities.paid')}</span>
                        </div>
                        <div className="w-full bg-border rounded-full h-2">
                          <div className="bg-success rounded-full h-2 transition-all" style={{ width: `${paidPercent}%` }} />
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editingId ? t('liabilities.editLiability') : t('liabilities.addLiability')}</h2>
              <button onClick={resetForm} className="text-text-light hover:text-text"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('liabilities.name')}</label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('liabilities.category')}</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as LiabilityCategory }))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none">
                  {liabilityCategories.map(c => <option key={c} value={c}>{t(`liabilities.categories.${c}`)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('liabilities.lender')}</label>
                <input type="text" value={form.lender} onChange={e => setForm(p => ({ ...p, lender: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('liabilities.originalAmount')} (₪)</label>
                  <input type="number" value={form.originalAmount} onChange={e => setForm(p => ({ ...p, originalAmount: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('liabilities.currentBalance')} (₪)</label>
                  <input type="number" value={form.currentBalance} onChange={e => setForm(p => ({ ...p, currentBalance: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('liabilities.interestRate')}</label>
                  <input type="number" step="0.1" value={form.interestRate} onChange={e => setForm(p => ({ ...p, interestRate: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('liabilities.monthlyPayment')} (₪)</label>
                  <input type="number" value={form.monthlyPayment} onChange={e => setForm(p => ({ ...p, monthlyPayment: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('liabilities.startDate')}</label>
                  <input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('liabilities.endDate')}</label>
                  <input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
                </div>
              </div>
              {form.category === 'loan' && (
                <div>
                  <label className="block text-sm font-medium mb-1">מטרת ההלוואה</label>
                  <select value={form.loanPurpose || ''} onChange={e => setForm(p => ({ ...p, loanPurpose: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none bg-surface">
                    <option value="">בחר מטרה</option>
                    {loanPurposes.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">{t('liabilities.notes')}</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} className="flex-1 px-4 py-2 bg-danger text-white rounded-lg hover:bg-red-700 transition-colors">{t('common.save')}</button>
                <button onClick={resetForm} className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-background transition-colors">{t('common.cancel')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
