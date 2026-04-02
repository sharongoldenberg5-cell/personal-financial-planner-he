'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/translations';
import { getAssets, saveAsset, deleteAsset, generateId, calculateNetWorth, clearAllAssets, getGoals } from '@/lib/storage';
import type { Asset, AssetCategory } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Plus, Pencil, Trash2, X, Wallet, RotateCcw } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#2563eb', '#7c3aed', '#16a34a', '#d97706', '#dc2626', '#0891b2', '#4f46e5', '#c026d3', '#ea580c'];

const assetCategories: AssetCategory[] = [
  'real-estate', 'vehicle', 'bank-account', 'savings',
  'investment', 'pension', 'provident-fund', 'insurance', 'other',
];

const emptyAsset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '', category: 'bank-account', value: 0, currency: 'ILS',
  monthlyContribution: 0, interestRate: 0, notes: '',
};

export default function AssetsPage() {
  const { t, locale } = useTranslation();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyAsset);

  const [goalNames, setGoalNames] = useState<Record<string, string>>({});
  useEffect(() => {
    setAssets(getAssets());
    const goals = getGoals();
    setGoalNames(Object.fromEntries(goals.map(g => [g.id, g.name])));
  }, []);

  const netWorth = calculateNetWorth();
  const totalAssets = assets.reduce((s, a) => s + a.value, 0);
  const fmtCur = (n: number) => formatCurrency(n, locale === 'he' ? 'he-IL' : 'en-IL');

  const chartData = assetCategories
    .map(cat => ({
      name: t(`assets.categories.${cat}`),
      value: assets.filter(a => a.category === cat).reduce((s, a) => s + a.value, 0),
    }))
    .filter(d => d.value > 0);

  const handleSave = () => {
    const now = new Date().toISOString();
    const asset: Asset = {
      ...form,
      id: editingId || generateId(),
      createdAt: editingId ? assets.find(a => a.id === editingId)?.createdAt || now : now,
      updatedAt: now,
    };
    saveAsset(asset);
    setAssets(getAssets());
    resetForm();
  };

  const handleEdit = (a: Asset) => { setForm(a); setEditingId(a.id); setShowForm(true); };
  const handleDelete = (id: string) => { deleteAsset(id); setAssets(getAssets()); };
  const resetForm = () => { setForm(emptyAsset); setEditingId(null); setShowForm(false); };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('nav.assets')}</h1>
        <div className="flex gap-2">
          <button onClick={() => { clearAllAssets(); setAssets([]); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-text-light hover:text-danger transition-colors">
            <RotateCcw size={14} /> {t('common.reset')}
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors">
            <Plus size={18} /> {t('assets.addAsset')}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-gradient-to-r from-primary to-blue-400 text-white rounded-xl p-5">
          <div className="flex items-center gap-3">
            <Wallet size={28} />
            <div>
              <p className="text-sm opacity-80">{t('assets.totalNetWorth')}</p>
              <p className="text-3xl font-bold">{fmtCur(netWorth)}</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-r from-green-600 to-green-400 text-white rounded-xl p-5">
          <div className="flex items-center gap-3">
            <Wallet size={28} />
            <div>
              <p className="text-sm opacity-80">{t('assets.totalAssets')}</p>
              <p className="text-3xl font-bold">{fmtCur(totalAssets)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {chartData.length > 0 && (
          <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
            <h2 className="text-lg font-semibold mb-4">{t('dashboard.assetDistribution')}</h2>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                  label={({ name, percent, x, y, midAngle }: any) => { // eslint-disable-line
                    const RADIAN = Math.PI / 180;
                    const nx = (x || 0) + Math.cos(-((midAngle || 0)) * RADIAN) * 10;
                    const ny = (y || 0) + Math.sin(-((midAngle || 0)) * RADIAN) * 10;
                    return <text x={nx} y={ny} textAnchor={nx > ((x || 0) - 5) ? 'start' : 'end'} dominantBaseline="central" fontSize={11} fill="#374151">{`${name || ''} ${(((percent || 0)) * 100).toFixed(0)}%`}</text>;
                  }}
                  labelLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
                >
                  {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(val) => fmtCur(Number(val))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
          {assets.length === 0 ? (
            <div className="text-center py-12">
              <Wallet size={48} className="mx-auto mb-4 text-text-light" />
              <p className="text-text-light">{t('common.noData')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {assets.map(asset => (
                <div key={asset.id} className="flex items-center justify-between p-3 bg-background rounded-lg">
                  <div>
                    <p className="font-medium">{asset.name}</p>
                    <p className="text-sm text-text-light">
                      {t(`assets.categories.${asset.category}`)}
                      {asset.linkedGoalId && goalNames[asset.linkedGoalId] && (
                        <span className="ms-2 text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                          {t('goals.linkedTo')}: {goalNames[asset.linkedGoalId]}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-success">{fmtCur(asset.value)}</span>
                    <button onClick={() => handleEdit(asset)} className="text-primary hover:text-primary-dark"><Pencil size={16} /></button>
                    <button onClick={() => handleDelete(asset.id)} className="text-danger hover:text-red-700"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editingId ? t('assets.editAsset') : t('assets.addAsset')}</h2>
              <button onClick={resetForm} className="text-text-light hover:text-text"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('assets.name')}</label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('assets.category')}</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as AssetCategory }))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none">
                  {assetCategories.map(c => <option key={c} value={c}>{t(`assets.categories.${c}`)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('assets.value')} (₪)</label>
                <input type="number" value={form.value} onChange={e => setForm(p => ({ ...p, value: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('assets.monthlyContribution')} (₪)</label>
                <input type="number" value={form.monthlyContribution || 0} onChange={e => setForm(p => ({ ...p, monthlyContribution: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('assets.notes')}</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors">{t('common.save')}</button>
                <button onClick={resetForm} className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-background transition-colors">{t('common.cancel')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
