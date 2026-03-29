'use client';

import { useState, useEffect } from 'react';
import { getAdvisors, saveAdvisor, deleteAdvisor, generateId, getLeads, type Advisor } from '@/lib/admin-storage';
import { Plus, Pencil, Trash2, X, Star, UserCog } from 'lucide-react';

const specialtyLabels: Record<string, string> = {
  mortgage: 'יועץ משכנתא',
  pension: 'סוכן ביטוח פנסיוני',
  financial: 'מתכנן פיננסי',
};

const emptyAdvisor: Omit<Advisor, 'id' | 'createdAt'> = {
  name: '', company: '', phone: '', email: '', license: '',
  specialty: [], rating: 3, active: true, notes: '',
};

export default function AdvisorsPage() {
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyAdvisor);
  const [leadCounts, setLeadCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    setAdvisors(getAdvisors());
    const leads = getLeads();
    const counts: Record<string, number> = {};
    for (const l of leads) {
      if (l.assignedTo) counts[l.assignedTo] = (counts[l.assignedTo] || 0) + 1;
    }
    setLeadCounts(counts);
  }, []);

  const handleSave = () => {
    const advisor: Advisor = {
      ...form,
      id: editingId || generateId(),
      createdAt: editingId ? advisors.find(a => a.id === editingId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
    };
    saveAdvisor(advisor);
    setAdvisors(getAdvisors());
    resetForm();
  };

  const handleEdit = (a: Advisor) => { setForm(a); setEditingId(a.id); setShowForm(true); };
  const handleDelete = (id: string) => { deleteAdvisor(id); setAdvisors(getAdvisors()); };
  const resetForm = () => { setForm(emptyAdvisor); setEditingId(null); setShowForm(false); };

  const toggleSpecialty = (s: 'mortgage' | 'pension' | 'financial') => {
    setForm(prev => ({
      ...prev,
      specialty: prev.specialty.includes(s) ? prev.specialty.filter(x => x !== s) : [...prev.specialty, s],
    }));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">ניהול יועצים ({advisors.length})</h1>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          <Plus size={16} /> הוסף יועץ
        </button>
      </div>

      {/* Advisors List */}
      {advisors.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <UserCog size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-gray-400">אין יועצים רשומים. הוסף יועצים כדי לשבץ להם לידים.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {advisors.map(advisor => (
            <div key={advisor.id} className={`bg-white rounded-xl shadow-sm border p-5 ${advisor.active ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-lg">{advisor.name}</h3>
                  <p className="text-sm text-gray-500">{advisor.company}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEdit(advisor)} className="text-gray-400 hover:text-blue-500 p-1"><Pencil size={14} /></button>
                  <button onClick={() => handleDelete(advisor.id)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 mb-3">
                {advisor.specialty.map(s => (
                  <span key={s} className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">{specialtyLabels[s]}</span>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                <div>📞 {advisor.phone}</div>
                <div>📧 {advisor.email}</div>
                <div>📄 רישיון: {advisor.license || '-'}</div>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={12} className={i < advisor.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <span className="text-sm font-medium">{leadCounts[advisor.name] || 0} לידים</span>
                <span className={`text-xs px-2 py-0.5 rounded ${advisor.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {advisor.active ? 'פעיל' : 'לא פעיל'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{editingId ? 'עריכת יועץ' : 'הוספת יועץ'}</h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">שם מלא</label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">חברה</label>
                <input type="text" value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">טלפון</label>
                  <input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">אימייל</label>
                  <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">מספר רישיון</label>
                <input type="text" value={form.license} onChange={e => setForm(p => ({ ...p, license: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">תחום התמחות</label>
                <div className="flex gap-2">
                  {(['mortgage', 'pension', 'financial'] as const).map(s => (
                    <button key={s} onClick={() => toggleSpecialty(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        form.specialty.includes(s) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}>
                      {specialtyLabels[s]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">דירוג (1-5)</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setForm(p => ({ ...p, rating: n }))}>
                      <Star size={24} className={n <= form.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} />
                <label className="text-sm">יועץ פעיל</label>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">הערות</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">שמור</button>
                <button onClick={resetForm} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">ביטול</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
