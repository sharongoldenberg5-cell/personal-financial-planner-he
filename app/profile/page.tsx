'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/translations';
import { getProfile, saveProfile, generateId, clearProfile } from '@/lib/storage';
import type { UserProfile, Gender, MaritalStatus, EmploymentStatus } from '@/lib/types';
import { Save, CheckCircle, RotateCcw } from 'lucide-react';

const defaultProfile: UserProfile = {
  id: '', firstName: '', lastName: '', age: 30, gender: 'male',
  maritalStatus: 'single', numberOfChildren: 0, childrenAges: [],
  employmentStatus: 'employed', occupation: '',
  monthlyIncomeGross: 0, monthlyIncome: 0, monthlyExpenses: 0, retirementAge: 67,
  spouseFirstName: '', spouseLastName: '', spouseAge: 30, spouseGender: 'female',
  spouseOccupation: '', spouseEmploymentStatus: 'employed',
  spouseMonthlyIncomeGross: 0, spouseMonthlyIncomeNet: 0, spouseRetirementAge: 65,
  createdAt: '', updatedAt: '',
};

const inputClass = "w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm";

export default function ProfilePage() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [saved, setSaved] = useState(false);

  useEffect(() => { const e = getProfile(); if (e) setProfile(e); }, []);

  const set = (field: keyof UserProfile, value: string | number | number[]) => {
    setProfile(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    const now = new Date().toISOString();
    const updated = { ...profile, id: profile.id || generateId(), createdAt: profile.createdAt || now, updatedAt: now };
    saveProfile(updated);
    setProfile(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const genderOpts: { value: Gender; label: string }[] = [
    { value: 'male', label: t('profile.genderOptions.male') },
    { value: 'female', label: t('profile.genderOptions.female') },
    { value: 'other', label: t('profile.genderOptions.other') },
  ];
  const maritalOpts: { value: MaritalStatus; label: string }[] = [
    { value: 'single', label: t('profile.maritalOptions.single') },
    { value: 'married', label: t('profile.maritalOptions.married') },
    { value: 'divorced', label: t('profile.maritalOptions.divorced') },
    { value: 'widowed', label: t('profile.maritalOptions.widowed') },
  ];
  const empOpts: { value: EmploymentStatus; label: string }[] = [
    { value: 'employed', label: t('profile.employmentOptions.employed') },
    { value: 'self-employed', label: t('profile.employmentOptions.self-employed') },
    { value: 'controlling-shareholder', label: t('profile.employmentOptions.controlling-shareholder') },
    { value: 'unemployed', label: t('profile.employmentOptions.unemployed') },
    { value: 'retired', label: t('profile.employmentOptions.retired') },
    { value: 'student', label: t('profile.employmentOptions.student') },
  ];

  const isMarried = profile.maritalStatus === 'married';

  return (
    <div className={`mx-auto ${isMarried ? 'max-w-4xl' : 'max-w-2xl'}`}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('profile.title')}</h1>
        <button onClick={() => { clearProfile(); setProfile(defaultProfile); setSaved(false); }}
          className="flex items-center gap-1.5 text-sm text-text-light hover:text-danger transition-colors">
          <RotateCcw size={14} /> {t('common.reset')}
        </button>
      </div>

      <div className="bg-surface rounded-xl shadow-sm border border-border p-6 space-y-6">

        {/* Marital Status - top level */}
        <div className="max-w-xs">
          <label className="block text-sm font-medium mb-1">{t('profile.maritalStatus')}</label>
          <select value={profile.maritalStatus} onChange={e => set('maritalStatus', e.target.value)} className={inputClass}>
            {maritalOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Two columns: Client | Spouse (if married) */}
        <div className={`grid ${isMarried ? 'grid-cols-2' : 'grid-cols-1'} gap-6`}>

          {/* ===== CLIENT COLUMN ===== */}
          <div className="space-y-4">
            <h3 className="text-md font-semibold pb-1 border-b border-border">{t('profile.clientSection')}</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">{t('profile.firstName')}</label>
                <input type="text" value={profile.firstName} onChange={e => set('firstName', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('profile.lastName')}</label>
                <input type="text" value={profile.lastName} onChange={e => set('lastName', e.target.value)} className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">{t('profile.age')}</label>
                <input type="number" value={profile.age} onChange={e => set('age', parseInt(e.target.value) || 0)} min={18} max={120} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('profile.gender')}</label>
                <select value={profile.gender} onChange={e => set('gender', e.target.value)} className={inputClass}>
                  {genderOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">{t('profile.employmentStatus')}</label>
                <select value={profile.employmentStatus} onChange={e => set('employmentStatus', e.target.value)} className={inputClass}>
                  {empOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('profile.occupation')}</label>
                <input type="text" value={profile.occupation} onChange={e => set('occupation', e.target.value)} className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">{t('profile.monthlyIncomeGross')} (₪)</label>
                <input type="number" value={profile.monthlyIncomeGross || 0} onChange={e => set('monthlyIncomeGross', parseInt(e.target.value) || 0)} min={0} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('profile.monthlyIncomeNet')} (₪)</label>
                <input type="number" value={profile.monthlyIncome} onChange={e => set('monthlyIncome', parseInt(e.target.value) || 0)} min={0} className={inputClass} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">{t('profile.retirementAge')}</label>
              <input type="number" value={profile.retirementAge} onChange={e => set('retirementAge', parseInt(e.target.value) || 67)} min={50} max={80} className={inputClass + ' max-w-[120px]'} />
            </div>
          </div>

          {/* ===== SPOUSE COLUMN ===== */}
          {isMarried && (
            <div className="space-y-4">
              <h3 className="text-md font-semibold pb-1 border-b border-border">{t('profile.spouseSection')}</h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('profile.firstName')}</label>
                  <input type="text" value={profile.spouseFirstName || ''} onChange={e => set('spouseFirstName', e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('profile.lastName')}</label>
                  <input type="text" value={profile.spouseLastName || ''} onChange={e => set('spouseLastName', e.target.value)} className={inputClass} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('profile.age')}</label>
                  <input type="number" value={profile.spouseAge || 30} onChange={e => set('spouseAge', parseInt(e.target.value) || 0)} min={18} max={120} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('profile.gender')}</label>
                  <select value={profile.spouseGender || 'female'} onChange={e => set('spouseGender', e.target.value)} className={inputClass}>
                    {genderOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('profile.employmentStatus')}</label>
                  <select value={profile.spouseEmploymentStatus || 'employed'} onChange={e => set('spouseEmploymentStatus', e.target.value)} className={inputClass}>
                    {empOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('profile.occupation')}</label>
                  <input type="text" value={profile.spouseOccupation || ''} onChange={e => set('spouseOccupation', e.target.value)} className={inputClass} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('profile.monthlyIncomeGross')} (₪)</label>
                  <input type="number" value={profile.spouseMonthlyIncomeGross || 0} onChange={e => set('spouseMonthlyIncomeGross', parseInt(e.target.value) || 0)} min={0} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('profile.monthlyIncomeNet')} (₪)</label>
                  <input type="number" value={profile.spouseMonthlyIncomeNet || 0} onChange={e => set('spouseMonthlyIncomeNet', parseInt(e.target.value) || 0)} min={0} className={inputClass} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t('profile.retirementAge')}</label>
                <input type="number" value={profile.spouseRetirementAge || 65} onChange={e => set('spouseRetirementAge', parseInt(e.target.value) || 65)} min={50} max={80} className={inputClass + ' max-w-[120px]'} />
              </div>
            </div>
          )}
        </div>

        {/* ===== SHARED / FAMILY SECTION ===== */}
        <h3 className="text-md font-semibold pt-2 border-t border-border">{t('profile.familySection')}</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('profile.numberOfChildren')}</label>
            <input
              type="number"
              value={profile.numberOfChildren}
              onChange={e => {
                const count = parseInt(e.target.value) || 0;
                set('numberOfChildren', count);
                const ages = profile.childrenAges || [];
                if (count > ages.length) set('childrenAges', [...ages, ...Array(count - ages.length).fill(0)]);
                else set('childrenAges', ages.slice(0, count));
              }}
              min={0} max={20} className={inputClass + ' max-w-[120px]'}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('profile.monthlyExpenses')} (₪)</label>
            <input type="number" value={profile.monthlyExpenses} onChange={e => set('monthlyExpenses', parseInt(e.target.value) || 0)} min={0} className={inputClass} />
          </div>
        </div>

        {/* Children Ages */}
        {profile.numberOfChildren > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1">{t('profile.childrenAges')}</label>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: profile.numberOfChildren }).map((_, i) => (
                <input
                  key={i} type="number"
                  placeholder={`${t('profile.child')} ${i + 1}`}
                  value={(profile.childrenAges || [])[i] || ''}
                  onChange={e => { const a = [...(profile.childrenAges || [])]; a[i] = parseInt(e.target.value) || 0; set('childrenAges', a); }}
                  min={0} max={50}
                  className="w-20 px-2 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-center text-sm"
                />
              ))}
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex items-center gap-3 pt-4 border-t border-border">
          <button onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium">
            <Save size={18} /> {t('common.save')}
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-success text-sm">
              <CheckCircle size={16} /> {t('profile.saved')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
