'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/translations';
import { loadState, calculateNetWorth, calculateTotalLiabilities } from '@/lib/storage';
import { formatCurrency } from '@/lib/utils';
import type { AppState } from '@/lib/types';
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
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

const COLORS = ['#2563eb', '#7c3aed', '#16a34a', '#d97706', '#dc2626', '#0891b2', '#4f46e5'];

export default function DashboardPage() {
  const { t, locale } = useTranslation();
  const [state, setState] = useState<AppState | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setState(loadState());
    setIsMobile(window.innerWidth < 1024);
  }, []);

  if (!state) return null;

  const Arrow = locale === 'he' ? ArrowLeft : ArrowRight;
  const isNewUser = !state.profile;

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
        <StatCard
          icon={<TrendingUp size={24} />}
          label={t('dashboard.familyNetIncome')}
          value={formatCurrency(familyNetIncome)}
          color="bg-success"
        />
        <StatCard
          icon={<TrendingDown size={24} />}
          label={t('dashboard.monthlyExpenses')}
          value={formatCurrency((profile?.monthlyExpenses || 0) + monthlyDebtPayments)}
          color="bg-danger"
        />
        <StatCard
          icon={<PiggyBank size={24} />}
          label={t('dashboard.monthlySavings')}
          value={formatCurrency(monthlySavings - monthlyDebtPayments)}
          color={monthlySavings - monthlyDebtPayments >= 0 ? 'bg-success' : 'bg-danger'}
        />
        <StatCard
          icon={<TrendingDown size={24} />}
          label={t('assets.totalLiabilities')}
          value={formatCurrency(totalLiabilities)}
          color="bg-red-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Asset Distribution */}
        <div className="bg-surface rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-lg font-semibold mb-4">{t('dashboard.assetDistribution')}</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={false}>
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
