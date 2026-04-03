'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/translations';
import { getInsuranceReports, clearAllInsuranceReports, getProfile } from '@/lib/storage';
import { formatCurrency } from '@/lib/utils';
import type { InsuranceReport, InsurancePolicy, UserProfile } from '@/lib/types';
import {
  HeartPulse, Shield, Heart, Brain, Umbrella, AlertTriangle,
  ChevronDown, ChevronUp, RotateCcw, BarChart3, Phone,
} from 'lucide-react';
import Link from 'next/link';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const BRANCH_CONFIG: Record<string, { label: string; color: string; icon: typeof Shield }> = {
  nursing: { label: 'סיעודי', color: '#7c3aed', icon: Shield },
  health: { label: 'בריאות', color: '#0ea5e9', icon: Heart },
  disability: { label: 'אובדן כושר עבודה', color: '#f59e0b', icon: Brain },
  life: { label: 'ביטוח חיים', color: '#dc2626', icon: HeartPulse },
};

const PIE_COLORS = ['#7c3aed', '#0ea5e9', '#f59e0b', '#dc2626'];

export default function InsurancePage() {
  const { t } = useTranslation();
  const [reports, setReports] = useState<InsuranceReport[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [expandedBranch, setExpandedBranch] = useState<string | null>(null);

  useEffect(() => {
    setReports(getInsuranceReports());
    setProfile(getProfile());
  }, []);

  const allPolicies = reports.flatMap(r => r.policies);

  if (allPolicies.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">{t('nav.insurance')}</h1>
        <div className="bg-surface rounded-xl shadow-sm border border-border p-12 text-center">
          <HeartPulse size={48} className="mx-auto mb-4 text-text-light" />
          <p className="text-text-light mb-2">אין נתוני ביטוח. העלה קובץ מהר הביטוח.</p>
          <p className="text-xs text-text-light mb-4">הורד את התיק הביטוחי מאתר הר הביטוח של משרד האוצר</p>
          <div className="flex gap-3 justify-center">
            <a href="https://bituachnet.cma.gov.il/" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
              <Shield size={16} /> הר הביטוח
            </a>
            <Link href="/upload" className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors">
              העלה קובץ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Group by branch
  const byBranch: Record<string, InsurancePolicy[]> = {};
  for (const p of allPolicies) {
    if (!byBranch[p.branch]) byBranch[p.branch] = [];
    byBranch[p.branch].push(p);
  }

  const branchSummary = Object.entries(byBranch).map(([branch, policies]) => ({
    branch,
    ...BRANCH_CONFIG[branch],
    count: policies.length,
    monthlyTotal: policies.reduce((s, p) => s + p.monthlyPremium, 0),
    policies,
  }));

  const totalMonthly = allPolicies.reduce((s, p) => s + p.monthlyPremium, 0);
  const totalAnnual = totalMonthly * 12;

  const pieData = branchSummary.map(b => ({ name: b.label, value: b.monthlyTotal, color: b.color }));

  // ============ INSIGHTS ============
  const insights: { type: 'warning' | 'danger' | 'tip' | 'info'; icon: typeof AlertTriangle; text: string }[] = [];

  // Nursing insurance check
  const nursingPolicies = byBranch['nursing'] || [];
  if (nursingPolicies.length > 0) {
    insights.push({
      type: 'info', icon: Shield,
      text: `יש לך ${nursingPolicies.length} פוליסות סיעודי פרטי. ⚠️ ביטוח סיעודי פרטי לא נמכר מ-2019. אם תבטל - לא תוכל לרכוש מחדש. שמור על הפוליסות האלה!`,
    });
    if (nursingPolicies.length > 1) {
      const companies = [...new Set(nursingPolicies.map(p => p.company))];
      if (companies.length > 1) {
        insights.push({
          type: 'warning', icon: AlertTriangle,
          text: `יש לך ביטוח סיעודי ב-${companies.length} חברות שונות (${companies.join(', ')}). ייתכן כפל כיסוי - יועץ יבדוק אם אפשר לחסוך בלי לפגוע בכיסוי.`,
        });
      }
    }
  } else {
    insights.push({
      type: 'danger', icon: AlertTriangle,
      text: 'אין לך ביטוח סיעודי פרטי. מ-2019 לא ניתן לרכוש ביטוח סיעודי פרטי חדש. בדוק עם יועץ חלופות כמו ביטוח סיעודי קבוצתי דרך קופת חולים.',
    });
  }

  // Disability insurance
  const disabilityPolicies = byBranch['disability'] || [];
  if (disabilityPolicies.length > 0) {
    const totalDisabilityMonthly = disabilityPolicies.reduce((s, p) => s + p.monthlyPremium, 0);
    insights.push({
      type: 'tip', icon: Brain,
      text: `יש לך ${disabilityPolicies.length} פוליסות אכ"ע בעלות ${formatCurrency(totalDisabilityMonthly)}/חודש. שים לב: הגדרת "עיסוק סביר ביחס להשכלה" פחות טובה מ"עיסוקי ספציפי". מומלץ לבדוק אפשרות לשדרוג - במידת האפשר, לא כל עיסוק מאושר להגדרה ספציפית.`,
    });
  }

  // Life insurance
  const lifePolicies = byBranch['life'] || [];
  if (lifePolicies.length > 0 && profile) {
    const totalLifeCoverage = lifePolicies.reduce((s, p) => s + p.premium, 0); // approximation
    const children = profile.numberOfChildren || 0;
    const monthlyIncome = profile.monthlyIncome || 0;
    const recommended = (children * 500000) + (monthlyIncome * 12 * 10);

    if (recommended > 0) {
      insights.push({
        type: 'warning', icon: HeartPulse,
        text: `ביטוח חיים - בחן את הצורך ב-3 מישורים: 1) אובדן הכנסה שוטפת של המשפחה 2) אירועים גדולים שלא יתממשו (לימודי ילדים, חתונות) 3) התחייבויות לא מבוטחות (משכנתא). המלצה כללית: 500,000₪ לכל ילד + החזר הכנסה נטו למחיה שוטפת.`,
      });
    }
  }

  // Critical illness
  const healthPolicies = byBranch['health'] || [];
  const hasCriticalIllness = healthPolicies.some(p => p.subBranch.includes('מחלות קשות'));
  if (!hasCriticalIllness) {
    insights.push({
      type: 'tip', icon: Heart,
      text: 'לא נמצא ביטוח מחלות קשות. המלצה: 200,000₪ למבוגר כהשלמה לאכ"ע (שמכסה רק 75% מהברוטו). לילד - עד 600,000₪, כי מחלת ילד פוגעת דרסטית בהכנסת שני ההורים.',
    });
  }

  // Pension umbrella
  insights.push({
    type: 'tip', icon: Umbrella,
    text: 'הגדרות קרן הפנסיה כוללות 90 ימי המתנה, הגדרת עיסוק "סביר" וקיזוז ביטוח לאומי. במצב תביעה - הפיצוי עלול להיות נמוך מהצפוי ואף אפס. מטריה ביטוחית (נרכשת פרטית) משפרת להגדרה ספציפית, מבטלת קיזוז ביט"ל, ומגדילה את הפיצוי.',
  });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('nav.insurance')}</h1>
        <button onClick={() => { clearAllInsuranceReports(); setReports([]); }}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-text-light hover:text-danger transition-colors">
          <RotateCcw size={14} /> אפס
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-purple-600 to-purple-500 text-white rounded-xl p-5">
          <p className="text-sm opacity-80">סה"כ חודשי</p>
          <p className="text-2xl font-bold">{formatCurrency(totalMonthly)}</p>
          <p className="text-xs opacity-60">{formatCurrency(totalAnnual)} / שנה</p>
        </div>
        <div className="bg-gradient-to-br from-blue-600 to-blue-500 text-white rounded-xl p-5">
          <p className="text-sm opacity-80">פוליסות</p>
          <p className="text-2xl font-bold">{allPolicies.length}</p>
          <p className="text-xs opacity-60">{branchSummary.length} ענפים</p>
        </div>
        <div className="bg-gradient-to-br from-orange-600 to-orange-500 text-white rounded-xl p-5">
          <p className="text-sm opacity-80">חברות ביטוח</p>
          <p className="text-2xl font-bold">{new Set(allPolicies.map(p => p.company)).size}</p>
        </div>
        <div className="bg-gradient-to-br from-red-600 to-red-500 text-white rounded-xl p-5">
          <p className="text-sm opacity-80">ממצאים</p>
          <p className="text-2xl font-bold">{insights.length}</p>
          <p className="text-xs opacity-60">דורשים תשומת לב</p>
        </div>
      </div>

      {/* Insights - provocative */}
      <div className="space-y-3 mb-6">
        {insights.map((ins, i) => {
          const Icon = ins.icon;
          return (
            <div key={i} className={`flex items-start gap-3 p-4 rounded-xl border ${
              ins.type === 'danger' ? 'bg-red-50 border-red-300' :
              ins.type === 'warning' ? 'bg-orange-50 border-orange-300' :
              ins.type === 'tip' ? 'bg-yellow-50 border-yellow-300' :
              'bg-blue-50 border-blue-200'
            }`}>
              <Icon size={18} className={`flex-shrink-0 mt-0.5 ${
                ins.type === 'danger' ? 'text-red-600' :
                ins.type === 'warning' ? 'text-orange-600' :
                ins.type === 'tip' ? 'text-yellow-700' :
                'text-blue-600'
              }`} />
              <div>
                <p className="text-sm leading-relaxed">{ins.text}</p>
                <button className="mt-2 flex items-center gap-1.5 text-xs text-primary hover:underline font-medium">
                  <Phone size={12} /> רוצה שיועץ ביטוח מוסמך יבדוק?
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Pie chart */}
        <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-lg font-semibold mb-4">פיזור עלויות ביטוח</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={85} innerRadius={35} dataKey="value" label={false}>
                {pieData.map((d, i) => <Cell key={i} fill={d.color || PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip formatter={(val) => formatCurrency(Number(val)) + '/חודש'} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-1 mt-2">
            {pieData.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                <span>{d.name}</span>
                <span className="text-text-light ms-auto">{formatCurrency(d.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Summary by branch */}
        <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-lg font-semibold mb-4">סיכום לפי ענף</h2>
          <div className="space-y-3">
            {branchSummary.map(b => {
              const Icon = b.icon || Shield;
              return (
                <div key={b.branch} className="flex items-center justify-between p-3 bg-background rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: b.color + '20' }}>
                      <Icon size={18} style={{ color: b.color }} />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{b.label}</p>
                      <p className="text-xs text-text-light">{b.count} פוליסות</p>
                    </div>
                  </div>
                  <p className="font-bold" style={{ color: b.color }}>{formatCurrency(b.monthlyTotal)}/חודש</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detailed policies by branch */}
      <div className="space-y-4">
        {branchSummary.map(b => {
          const Icon = b.icon || Shield;
          const isExpanded = expandedBranch === b.branch;
          return (
            <div key={b.branch} className="bg-surface rounded-xl shadow-sm border border-border overflow-hidden">
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-background/50 transition-colors"
                onClick={() => setExpandedBranch(isExpanded ? null : b.branch)}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: b.color + '20' }}>
                    <Icon size={18} style={{ color: b.color }} />
                  </div>
                  <div>
                    <p className="font-semibold">{b.label}</p>
                    <p className="text-xs text-text-light">{b.count} פוליסות • {formatCurrency(b.monthlyTotal)}/חודש</p>
                  </div>
                </div>
                {isExpanded ? <ChevronUp size={18} className="text-text-light" /> : <ChevronDown size={18} className="text-text-light" />}
              </div>
              {isExpanded && (
                <div className="px-4 pb-4 space-y-2">
                  {b.policies.map((p, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-background rounded-lg text-sm">
                      <div>
                        <p className="font-medium">{p.subBranch}</p>
                        <p className="text-xs text-text-light">{p.company} • {p.productType}</p>
                        <p className="text-xs text-text-light">{p.period} • פוליסה {p.policyNumber}</p>
                      </div>
                      <div className="text-end">
                        <p className="font-bold" style={{ color: b.color }}>{formatCurrency(p.monthlyPremium)}/חודש</p>
                        {p.premiumType === 'שנתית' && (
                          <p className="text-xs text-text-light">{formatCurrency(p.premium)}/שנה</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
