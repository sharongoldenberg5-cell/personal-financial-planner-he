'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/translations';
import { getGoals, saveGoal, deleteGoal, generateId, clearAllGoals, getRetirementGoals, saveRetirementGoals, getMislakaReports, getProfile, getAssets, saveAsset } from '@/lib/storage';
import type { Goal, GoalTemplate, GoalPriority, GoalStatus, RetirementGoals } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Plus, Pencil, Trash2, X, Target, Zap, Clock, Rocket, RotateCcw, AlertTriangle, CheckCircle, Save } from 'lucide-react';

const PENSION_TYPES = ['pension', 'managers-insurance', 'provident'];

const templates: GoalTemplate[] = [
  'education-fund', 'home-purchase', 'emergency-fund', 'travel', 'car', 'custom',
];
const priorities: GoalPriority[] = ['high', 'medium', 'low'];
const statuses: GoalStatus[] = ['active', 'completed', 'paused'];

const emptyGoal = {
  name: '',
  template: 'custom' as GoalTemplate,
  targetAmount: 0,
  currentAmount: 0,
  targetDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  priority: 'medium' as GoalPriority,
  status: 'active' as GoalStatus,
  monthlyContribution: 0,
  linkedAssetIds: [] as string[],
  notes: '',
};

export default function GoalsPage() {
  const { t } = useTranslation();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyGoal);

  // Retirement goals
  const [retGoals, setRetGoals] = useState<RetirementGoals>({ pensionTarget: 0, lumpSumTarget: 0 });
  const [retSaved, setRetSaved] = useState(false);

  const [assets, setAssets] = useState<{ id: string; name: string; value: number; linkedGoalId?: string }[]>([]);

  useEffect(() => {
    setGoals(getGoals());
    setAssets(getAssets().map(a => ({ id: a.id, name: a.name, value: a.value, linkedGoalId: a.linkedGoalId })));
    const saved = getRetirementGoals();
    if (saved) setRetGoals(saved);
  }, []);

  // Mislaka data for gap analysis
  const mislakaReports = getMislakaReports();
  const profile = getProfile();
  const allProducts = mislakaReports.flatMap(r => r.products);
  const pensionProducts = allProducts.filter(p => PENSION_TYPES.includes(p.productType));
  const currentProjectedPension = pensionProducts.reduce((s, p) => s + (p.monthlyPensionEstimate || 0), 0);
  const currentProjectedLumpSum = allProducts.filter(p => !p.monthlyPensionEstimate).reduce((s, p) => s + (p.projectedRetirementBalance || 0), 0);

  const handleSaveRetirement = () => {
    saveRetirementGoals(retGoals);
    setRetSaved(true);
    setTimeout(() => setRetSaved(false), 3000);
  };

  const handleSave = () => {
    const now = new Date().toISOString();
    const goalId = editingId || generateId();
    const goal: Goal = {
      ...form,
      id: goalId,
      name: form.name || t(`goals.templates.${form.template}`),
      linkedAssetIds: form.linkedAssetIds || [],
      createdAt: editingId ? goals.find(g => g.id === editingId)?.createdAt || now : now,
      updatedAt: now,
    };
    saveGoal(goal);

    // Update linked assets to point back to this goal
    const allAssets = getAssets();
    for (const asset of allAssets) {
      if ((form.linkedAssetIds || []).includes(asset.id)) {
        if (asset.linkedGoalId !== goalId) {
          saveAsset({ ...asset, linkedGoalId: goalId });
        }
      } else if (asset.linkedGoalId === goalId) {
        saveAsset({ ...asset, linkedGoalId: undefined });
      }
    }

    setGoals(getGoals());
    setAssets(getAssets().map(a => ({ id: a.id, name: a.name, value: a.value, linkedGoalId: a.linkedGoalId })));
    resetForm();
  };

  const handleEdit = (goal: Goal) => {
    setForm(goal);
    setEditingId(goal.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    deleteGoal(id);
    setGoals(getGoals());
  };

  const resetForm = () => {
    setForm(emptyGoal);
    setEditingId(null);
    setShowForm(false);
  };

  const priorityColor = (p: GoalPriority) =>
    p === 'high' ? 'text-danger' : p === 'medium' ? 'text-warning' : 'text-text-light';

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('goals.title')}</h1>
        <div className="flex gap-2">
          <button onClick={() => { clearAllGoals(); setGoals([]); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-text-light hover:text-danger transition-colors">
            <RotateCcw size={14} /> {t('common.reset')}
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors">
            <Plus size={18} /> {t('goals.addGoal')}
          </button>
        </div>
      </div>

      {/* ===== RETIREMENT GOALS SECTION ===== */}
      <div className="bg-surface rounded-xl shadow-sm border border-border p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">{t('goals.retirementSection')}</h2>

        {/* Targets Input */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('goals.pensionTarget')} (₪/{t('goals.perMonth')})</label>
            <input type="number" value={retGoals.pensionTarget || ''} placeholder="15,000"
              onChange={e => { setRetGoals(p => ({ ...p, pensionTarget: parseInt(e.target.value) || 0 })); setRetSaved(false); }}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('goals.lumpSumTarget')} (₪)</label>
            <input type="number" value={retGoals.lumpSumTarget || ''} placeholder="2,000,000"
              onChange={e => { setRetGoals(p => ({ ...p, lumpSumTarget: parseInt(e.target.value) || 0 })); setRetSaved(false); }}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none" />
          </div>
        </div>

        <div className="flex items-center gap-3 mb-5">
          <button onClick={handleSaveRetirement}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm">
            <Save size={16} /> {t('common.save')}
          </button>
          {retSaved && <span className="flex items-center gap-1 text-success text-sm"><CheckCircle size={14} /> {t('profile.saved')}</span>}
        </div>

        {/* Gap Analysis */}
        {(retGoals.pensionTarget > 0 || retGoals.lumpSumTarget > 0) && (
          <div className="grid grid-cols-2 gap-4">
            {/* Pension Gap */}
            {retGoals.pensionTarget > 0 && (() => {
              const gap = retGoals.pensionTarget - currentProjectedPension;
              const pct = retGoals.pensionTarget > 0 ? Math.min(100, (currentProjectedPension / retGoals.pensionTarget) * 100) : 0;
              const onTrack = gap <= 0;
              return (
                <div className={`p-4 rounded-xl border ${onTrack ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {onTrack ? <CheckCircle size={18} className="text-success" /> : <AlertTriangle size={18} className="text-danger" />}
                    <h3 className="font-semibold">{t('goals.pensionTarget')}</h3>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{t('goals.current')}: {formatCurrency(currentProjectedPension)}</span>
                    <span>{t('goals.target')}: {formatCurrency(retGoals.pensionTarget)}</span>
                  </div>
                  <div className="w-full bg-border rounded-full h-3 mb-2">
                    <div className={`rounded-full h-3 transition-all ${onTrack ? 'bg-success' : 'bg-danger'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-sm">
                    {onTrack ? (
                      <span className="text-success font-medium">{t('goals.onTrack')} ✓</span>
                    ) : (
                      <span className="text-danger font-medium">{t('goals.gap')}: {formatCurrency(gap)} {t('goals.perMonth')}</span>
                    )}
                  </p>
                  {!currentProjectedPension && <p className="text-xs text-text-light mt-1">{t('goals.uploadMislakaHint')}</p>}
                </div>
              );
            })()}

            {/* Lump Sum Gap */}
            {retGoals.lumpSumTarget > 0 && (() => {
              const gap = retGoals.lumpSumTarget - currentProjectedLumpSum;
              const pct = retGoals.lumpSumTarget > 0 ? Math.min(100, (currentProjectedLumpSum / retGoals.lumpSumTarget) * 100) : 0;
              const onTrack = gap <= 0;
              return (
                <div className={`p-4 rounded-xl border ${onTrack ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {onTrack ? <CheckCircle size={18} className="text-success" /> : <AlertTriangle size={18} className="text-danger" />}
                    <h3 className="font-semibold">{t('goals.lumpSumTarget')}</h3>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{t('goals.current')}: {formatCurrency(currentProjectedLumpSum)}</span>
                    <span>{t('goals.target')}: {formatCurrency(retGoals.lumpSumTarget)}</span>
                  </div>
                  <div className="w-full bg-border rounded-full h-3 mb-2">
                    <div className={`rounded-full h-3 transition-all ${onTrack ? 'bg-success' : 'bg-danger'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-sm">
                    {onTrack ? (
                      <span className="text-success font-medium">{t('goals.onTrack')} ✓</span>
                    ) : (
                      <span className="text-danger font-medium">{t('goals.gap')}: {formatCurrency(gap)}</span>
                    )}
                  </p>
                  {!currentProjectedLumpSum && <p className="text-xs text-text-light mt-1">{t('goals.uploadMislakaHint')}</p>}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ===== REGULAR GOALS grouped by time range ===== */}
      {goals.length === 0 ? (
        <div className="bg-surface rounded-xl shadow-sm border border-border p-12 text-center">
          <Target size={48} className="mx-auto mb-4 text-text-light" />
          <p className="text-text-light">{t('common.noData')}</p>
        </div>
      ) : (() => {
        const now = new Date();
        const getYearsLeft = (g: Goal) => {
          const target = new Date(g.targetDate);
          return Math.max(0, (target.getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        };

        const ranges = [
          { key: 'short', label: t('goals.shortTerm'), sublabel: t('goals.upTo2Years'), icon: Zap, color: 'text-danger', borderColor: 'border-s-danger', filter: (g: Goal) => getYearsLeft(g) <= 2 },
          { key: 'medium', label: t('goals.mediumTerm'), sublabel: t('goals.twoToSixYears'), icon: Clock, color: 'text-warning', borderColor: 'border-s-warning', filter: (g: Goal) => getYearsLeft(g) > 2 && getYearsLeft(g) <= 6 },
          { key: 'long', label: t('goals.longTerm'), sublabel: t('goals.overSixYears'), icon: Rocket, color: 'text-primary', borderColor: 'border-s-primary', filter: (g: Goal) => getYearsLeft(g) > 6 },
        ];

        return (
          <div className="space-y-6">
            {ranges.map(range => {
              const rangeGoals = goals.filter(range.filter);
              if (rangeGoals.length === 0) return null;
              const RangeIcon = range.icon;

              return (
                <div key={range.key}>
                  <div className="flex items-center gap-2 mb-3">
                    <RangeIcon size={20} className={range.color} />
                    <h2 className={`text-lg font-semibold ${range.color}`}>{range.label}</h2>
                    <span className="text-xs text-text-light">({range.sublabel})</span>
                    <span className="text-xs text-text-light ms-auto">{rangeGoals.length} {t('goals.goalsCount')}</span>
                  </div>

                  <div className="space-y-3">
                    {rangeGoals.map(goal => {
                      const progress = goal.targetAmount > 0
                        ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) : 0;
                      const yearsLeft = getYearsLeft(goal);

                      return (
                        <div key={goal.id} className={`bg-surface rounded-xl shadow-sm border border-border border-s-4 ${range.borderColor} p-5`}>
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-lg">{goal.name}</h3>
                                <span className={`text-xs font-medium ${priorityColor(goal.priority)}`}>
                                  ({t(`goals.priorities.${goal.priority}`)})
                                </span>
                              </div>
                              <p className="text-sm text-text-light">
                                {t(`goals.templates.${goal.template}`)} | {t(`goals.statuses.${goal.status}`)}
                                {yearsLeft > 0 && ` | ${yearsLeft.toFixed(1)} ${t('goals.yearsLeft')}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleEdit(goal)} className="text-primary hover:text-primary-dark p-1"><Pencil size={16} /></button>
                              <button onClick={() => handleDelete(goal.id)} className="text-danger hover:text-red-700 p-1"><Trash2 size={16} /></button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-sm mb-2">
                            <span>{formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}</span>
                            <span className="font-medium">{progress.toFixed(0)}%</span>
                          </div>

                          <div className="w-full bg-border rounded-full h-3">
                            <div className="bg-primary rounded-full h-3 transition-all" style={{ width: `${progress}%` }} />
                          </div>

                          <div className="flex items-center justify-between mt-2 text-xs text-text-light">
                            <span>{t('goals.monthlyContribution')}: {formatCurrency(goal.monthlyContribution)}</span>
                            <span>{t('goals.targetDate')}: {goal.targetDate}</span>
                          </div>

                          {/* Linked assets */}
                          {(goal.linkedAssetIds || []).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {(goal.linkedAssetIds || []).map(assetId => {
                                const asset = assets.find(a => a.id === assetId);
                                return asset ? (
                                  <span key={assetId} className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                                    {asset.name} ({formatCurrency(asset.value)})
                                  </span>
                                ) : null;
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {editingId ? t('goals.editGoal') : t('goals.addGoal')}
              </h2>
              <button onClick={resetForm} className="text-text-light hover:text-text">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('goals.template')}</label>
                <select
                  value={form.template}
                  onChange={e => setForm(prev => ({
                    ...prev,
                    template: e.target.value as GoalTemplate,
                    name: prev.name || t(`goals.templates.${e.target.value}`),
                  }))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                >
                  {templates.map(tmpl => (
                    <option key={tmpl} value={tmpl}>{t(`goals.templates.${tmpl}`)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t('goals.name')}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('goals.targetAmount')} (₪)</label>
                  <input
                    type="number"
                    value={form.targetAmount}
                    onChange={e => setForm(prev => ({ ...prev, targetAmount: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('goals.currentAmount')} (₪)</label>
                  <input
                    type="number"
                    value={form.currentAmount}
                    onChange={e => setForm(prev => ({ ...prev, currentAmount: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t('goals.targetDate')}</label>
                <input
                  type="date"
                  value={form.targetDate}
                  onChange={e => setForm(prev => ({ ...prev, targetDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('goals.priority')}</label>
                  <select
                    value={form.priority}
                    onChange={e => setForm(prev => ({ ...prev, priority: e.target.value as GoalPriority }))}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  >
                    {priorities.map(p => (
                      <option key={p} value={p}>{t(`goals.priorities.${p}`)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('goals.status')}</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(prev => ({ ...prev, status: e.target.value as GoalStatus }))}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  >
                    {statuses.map(s => (
                      <option key={s} value={s}>{t(`goals.statuses.${s}`)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t('goals.monthlyContribution')} (₪)</label>
                <input
                  type="number"
                  value={form.monthlyContribution}
                  onChange={e => setForm(prev => ({ ...prev, monthlyContribution: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              {/* Link to assets */}
              {assets.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1">{t('goals.linkedAssets')}</label>
                  <div className="max-h-32 overflow-y-auto border border-border rounded-lg p-2 space-y-1">
                    {assets.map(asset => (
                      <label key={asset.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-background p-1 rounded">
                        <input
                          type="checkbox"
                          checked={(form.linkedAssetIds || []).includes(asset.id)}
                          onChange={e => {
                            const ids = form.linkedAssetIds || [];
                            setForm(prev => ({
                              ...prev,
                              linkedAssetIds: e.target.checked ? [...ids, asset.id] : ids.filter(id => id !== asset.id),
                            }));
                          }}
                          className="rounded border-border"
                        />
                        <span>{asset.name}</span>
                        <span className="text-text-light ms-auto">{formatCurrency(asset.value)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">{t('assets.notes')}</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                >
                  {t('common.save')}
                </button>
                <button
                  onClick={resetForm}
                  className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-background transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
