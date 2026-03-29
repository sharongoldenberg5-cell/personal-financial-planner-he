'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/translations';
import { getMislakaReports, deleteMislakaReport, clearAllMislakaReports, getProfile } from '@/lib/storage';
import type { MislakaReport, MislakaProduct } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Shield, TrendingUp, Wallet, Briefcase, Trash2 } from 'lucide-react';
import Link from 'next/link';

// Only pension-related types shown here (not education-fund or investment-provident)
const PENSION_TYPES = ['pension', 'managers-insurance', 'provident'];

const TYPE_CONFIG: Record<string, { icon: typeof Shield; color: string; label_he: string; label_en: string }> = {
  'pension': { icon: Shield, color: '#2563eb', label_he: 'קרן פנסיה', label_en: 'Pension Fund' },
  'managers-insurance': { icon: Briefcase, color: '#d97706', label_he: 'ביטוח מנהלים', label_en: 'Managers Insurance' },
  'provident': { icon: Wallet, color: '#7c3aed', label_he: 'קופת גמל', label_en: 'Provident Fund' },
};

function ProductCard({ product, t, fmtCur, locale }: { product: MislakaProduct; t: (k: string) => string; fmtCur: (n: number) => string; locale: string }) {
  const config = TYPE_CONFIG[product.productType];
  const Icon = config?.icon || Shield;

  return (
    <div className="p-3 bg-background rounded-lg">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon size={16} style={{ color: config?.color || '#64748b' }} />
          <div>
            <p className="font-medium text-sm">{product.providerName}</p>
            <p className="text-xs text-text-light">{product.planName}</p>
          </div>
        </div>
        <p className="font-bold">{fmtCur(product.totalBalance)}</p>
      </div>

      {(product.monthlyPensionEstimate > 0 || product.projectedRetirementBalance > 0) && (
        <div className="flex gap-3 text-xs mb-1">
          {product.monthlyPensionEstimate > 0 && (
            <span className="text-success">{t('pension.monthlyEstimate')}: {fmtCur(product.monthlyPensionEstimate)}</span>
          )}
          {product.projectedRetirementBalance > 0 && (
            <span className="text-primary">{t('pension.projectedBalance')}: {fmtCur(product.projectedRetirementBalance)}</span>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-light">
        <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: config?.color + '15', color: config?.color }}>
          {locale === 'he' ? config?.label_he : config?.label_en}
        </span>
        {product.managementFeeBalance > 0 && <span>{t('pension.feeBalance')}: {product.managementFeeBalance}%</span>}
        {product.managementFeeDeposit > 0 && <span>{t('pension.feeDeposit')}: {product.managementFeeDeposit}%</span>}
        {product.returnRate > 0 && (
          <span className="flex items-center gap-0.5"><TrendingUp size={10} className="text-success" />{product.returnRate}%</span>
        )}
        {product.status === 'active' && <span className="text-success">{t('pension.active')}</span>}
        {product.status === 'inactive' && <span className="text-text-light">{t('pension.inactive')}</span>}
      </div>
    </div>
  );
}

function OwnerColumn({ products, ownerName, t, fmtCur, locale }: {
  products: MislakaProduct[];
  ownerName: string;
  t: (k: string) => string;
  fmtCur: (n: number) => string;
  locale: string;
}) {
  const totalBalance = products.reduce((s, p) => s + p.totalBalance, 0);
  const totalPension = products.reduce((s, p) => s + (p.monthlyPensionEstimate || 0), 0);
  const totalLumpSum = products.filter(p => !p.monthlyPensionEstimate).reduce((s, p) => s + (p.projectedRetirementBalance || 0), 0);

  // Group by type
  const groups = PENSION_TYPES.map(type => ({
    type,
    config: TYPE_CONFIG[type],
    products: products.filter(p => p.productType === type),
  })).filter(g => g.products.length > 0);

  return (
    <div className="space-y-4">
      <div className="border-b border-border pb-2">
        <h3 className="font-semibold text-lg">{ownerName}</h3>
        <div className="flex flex-wrap gap-3 mt-1 text-sm">
          <span>{t('pension.totalSavings')}: <strong>{fmtCur(totalBalance)}</strong></span>
          {totalPension > 0 && (
            <span>{t('pension.estimatedMonthlyPension')}: <strong className="text-success">{fmtCur(totalPension)}</strong></span>
          )}
          {totalLumpSum > 0 && (
            <span>{t('pension.projectedLumpSum')}: <strong className="text-primary">{fmtCur(totalLumpSum)}</strong></span>
          )}
        </div>
      </div>

      {groups.map(group => (
        <div key={group.type}>
          <div className="flex items-center gap-2 mb-2">
            <group.config.icon size={16} style={{ color: group.config.color }} />
            <span className="text-sm font-medium">{locale === 'he' ? group.config.label_he : group.config.label_en}</span>
            <span className="text-xs text-text-light">({group.products.length})</span>
            <span className="ms-auto text-sm font-bold">{fmtCur(group.products.reduce((s, p) => s + p.totalBalance, 0))}</span>
          </div>
          <div className="space-y-2">
            {group.products.map(p => (
              <ProductCard key={p.id} product={p} t={t} fmtCur={fmtCur} locale={locale} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PensionPage() {
  const { t, locale } = useTranslation();
  const [reports, setReports] = useState<MislakaReport[]>([]);

  useEffect(() => {
    setReports(getMislakaReports());
  }, []);

  const profile = getProfile();
  const getOwnerLabel = (r: MislakaReport) => {
    if (r.owner === 'spouse') {
      return profile?.spouseFirstName ? `${profile.spouseFirstName} ${profile.spouseLastName || ''}`.trim() : t('profile.spouseSection');
    }
    return profile?.firstName ? `${profile.firstName} ${profile.lastName || ''}`.trim() : t('profile.clientSection');
  };

  const fmtCur = (n: number) => formatCurrency(n, locale === 'he' ? 'he-IL' : 'en-IL');

  // Filter only pension-type products
  const allPensionProducts = reports.flatMap(r =>
    r.products.filter(p => PENSION_TYPES.includes(p.productType)).map(p => ({ ...p, ownerLabel: r.ownerName }))
  );

  // Split by owner
  const ownerReports = reports.map(r => ({
    ...r,
    pensionProducts: r.products.filter(p => PENSION_TYPES.includes(p.productType)),
  })).filter(r => r.pensionProducts.length > 0);

  const totalBalance = allPensionProducts.reduce((s, p) => s + p.totalBalance, 0);
  const totalPension = allPensionProducts.reduce((s, p) => s + (p.monthlyPensionEstimate || 0), 0);
  // Projected balance MINUS the portion designated for pension (kitzba)
  // Products with monthlyPensionEstimate > 0 have their balance going to pension, not lump sum
  const totalProjectedForPension = allPensionProducts
    .filter(p => p.monthlyPensionEstimate > 0)
    .reduce((s, p) => s + (p.projectedRetirementBalance || 0), 0);
  const totalProjectedLumpSum = allPensionProducts
    .filter(p => !p.monthlyPensionEstimate || p.monthlyPensionEstimate === 0)
    .reduce((s, p) => s + (p.projectedRetirementBalance || 0), 0);
  const hasMultipleOwners = ownerReports.length > 1;

  if (ownerReports.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">{t('pension.title')}</h1>
        <div className="bg-surface rounded-xl shadow-sm border border-border p-12 text-center">
          <Shield size={48} className="mx-auto mb-4 text-text-light" />
          <p className="text-text-light mb-4">{t('pension.noData')}</p>
          <Link href="/upload" className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors">
            {t('pension.uploadMislaka')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('pension.title')}</h1>
        <button
          onClick={() => { clearAllMislakaReports(); setReports([]); }}
          className="flex items-center gap-1.5 text-sm text-text-light hover:text-danger transition-colors"
        >
          <Trash2 size={14} /> {t('pension.clearAll')}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-r from-blue-600 to-blue-400 text-white rounded-xl p-5">
          <p className="text-sm opacity-80">{t('pension.totalSavings')}</p>
          <p className="text-2xl font-bold">{fmtCur(totalBalance)}</p>
          <p className="text-xs opacity-70 mt-1">{allPensionProducts.length} {t('pension.products')}</p>
        </div>
        <div className="bg-gradient-to-r from-green-600 to-green-400 text-white rounded-xl p-5">
          <p className="text-sm opacity-80">{t('pension.estimatedMonthlyPension')}</p>
          <p className="text-2xl font-bold">{fmtCur(totalPension)}</p>
          <p className="text-xs opacity-70 mt-1">{t('pension.combinedHousehold')}</p>
        </div>
        <div className="bg-gradient-to-r from-purple-600 to-purple-400 text-white rounded-xl p-5">
          <p className="text-sm opacity-80">{t('pension.projectedForPension')}</p>
          <p className="text-2xl font-bold">{fmtCur(totalProjectedForPension)}</p>
          <p className="text-xs opacity-70 mt-1">{t('pension.willBecomePension')}</p>
        </div>
        <div className="bg-gradient-to-r from-orange-600 to-orange-400 text-white rounded-xl p-5">
          <p className="text-sm opacity-80">{t('pension.projectedLumpSum')}</p>
          <p className="text-2xl font-bold">{fmtCur(totalProjectedLumpSum)}</p>
          <p className="text-xs opacity-70 mt-1">{t('pension.capitalAtRetirement')}</p>
        </div>
      </div>

      {/* Two columns: Client | Spouse */}
      <div className={`grid ${hasMultipleOwners ? 'grid-cols-2' : 'grid-cols-1'} gap-6`}>
        {ownerReports.map(r => (
          <div key={r.id} className="bg-surface rounded-xl shadow-sm border border-border p-5 relative">
            <button
              onClick={() => { deleteMislakaReport(r.id!); setReports(getMislakaReports()); }}
              className="absolute top-3 end-3 text-text-light hover:text-danger p-1"
              title={t('common.delete')}
            >
              <Trash2 size={16} />
            </button>
            <OwnerColumn
              products={r.pensionProducts}
              ownerName={getOwnerLabel(r)}
              t={t}
              fmtCur={fmtCur}
              locale={locale}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
