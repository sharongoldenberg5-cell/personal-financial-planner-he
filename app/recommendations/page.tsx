'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/translations';
import { getProfile, getAssets, getLiabilities, getPensionData, getGoals, getRecommendations, saveRecommendations, clearAllRecommendations, getRetirementGoals, getMislakaReports } from '@/lib/storage';
import { generateRuleBasedRecommendations } from '@/lib/rules-engine';
import type { Recommendation } from '@/lib/types';
import { Lightbulb, RefreshCw, AlertTriangle, ChevronDown, ChevronUp, Cpu, Calculator, RotateCcw } from 'lucide-react';

const categoryColors: Record<string, string> = {
  savings: 'bg-blue-100 text-blue-700',
  investment: 'bg-purple-100 text-purple-700',
  pension: 'bg-green-100 text-green-700',
  tax: 'bg-yellow-100 text-yellow-700',
  insurance: 'bg-orange-100 text-orange-700',
  general: 'bg-gray-100 text-gray-700',
};

const priorityColors: Record<string, string> = {
  high: 'border-s-4 border-s-danger',
  medium: 'border-s-4 border-s-warning',
  low: 'border-s-4 border-s-primary',
};

export default function RecommendationsPage() {
  const { t } = useTranslation();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    const profile = getProfile();
    setHasProfile(!!profile);
    setRecommendations(getRecommendations());
  }, []);

  const generate = () => {
    setLoading(true);
    const profile = getProfile();
    if (!profile) {
      setLoading(false);
      return;
    }

    // Small delay to show loading state
    setTimeout(() => {
      const recs = generateRuleBasedRecommendations({
        profile,
        assets: getAssets(),
        liabilities: getLiabilities(),
        pensionData: getPensionData(),
        goals: getGoals(),
        retirementGoals: getRetirementGoals(),
        mislakaReports: getMislakaReports(),
      });

      saveRecommendations(recs);
      setRecommendations(recs);
      setLoading(false);
    }, 500);
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('recommendations.title')}</h1>
        <div className="flex gap-2">
          <button onClick={() => { clearAllRecommendations(); setRecommendations([]); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-text-light hover:text-danger transition-colors">
            <RotateCcw size={14} /> {t('common.reset')}
          </button>
          <button
            onClick={generate}
            disabled={!hasProfile || loading}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
          {loading ? (
            <RefreshCw size={18} className="animate-spin" />
          ) : (
            <Lightbulb size={18} />
          )}
          {loading ? t('recommendations.generating') : t('recommendations.generate')}
          </button>
        </div>
      </div>

      {!hasProfile && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 mb-6 flex items-center gap-3">
          <AlertTriangle size={20} className="text-warning" />
          <span className="text-sm">{t('recommendations.noProfile')}</span>
        </div>
      )}

      {recommendations.length === 0 && hasProfile && !loading && (
        <div className="bg-surface rounded-xl shadow-sm border border-border p-12 text-center">
          <Lightbulb size={48} className="mx-auto mb-4 text-text-light" />
          <p className="text-text-light">{t('common.noData')}</p>
          <p className="text-sm text-text-light mt-2">
            {t('recommendations.generate')}
          </p>
        </div>
      )}

      <div className="space-y-4">
        {recommendations.map(rec => (
          <div
            key={rec.id}
            className={`bg-surface rounded-xl shadow-sm border border-border p-5 ${priorityColors[rec.priority]}`}
          >
            <div
              className="flex items-start justify-between cursor-pointer"
              onClick={() => toggleExpand(rec.id)}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${categoryColors[rec.category]}`}>
                    {t(`recommendations.categories.${rec.category}`)}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-text-light">
                    {rec.source === 'ai' ? <Cpu size={12} /> : <Calculator size={12} />}
                    {t(`recommendations.source.${rec.source}`)}
                  </span>
                </div>
                <h3 className="font-semibold">{rec.title}</h3>
                <p className="text-sm text-text-light mt-1">{rec.description}</p>
              </div>
              <button className="text-text-light ms-3 mt-1">
                {expanded.has(rec.id) ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
            </div>

            {expanded.has(rec.id) && rec.actionItems.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <h4 className="text-sm font-semibold mb-2">{t('recommendations.actionItems')}:</h4>
                <ul className="space-y-2">
                  {rec.actionItems.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
