'use client';

import { useState, useEffect } from 'react';
import { getLeads, updateLead, deleteLead, getLeadHeatLevel, getAdvisors, type Lead, type Advisor } from '@/lib/admin-storage';
import { Trash2, ChevronDown, ChevronUp, Download, Filter, UserPlus } from 'lucide-react';

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    setLeads(getLeads().reverse());
    setAdvisors(getAdvisors());
  }, []);

  const filtered = leads.filter(l => {
    if (filter === 'all') return true;
    if (filter === 'hot') return getLeadHeatLevel(l.heatPercent) === 'hot';
    if (filter === 'warm') return getLeadHeatLevel(l.heatPercent) === 'warm';
    if (filter === 'cold') return getLeadHeatLevel(l.heatPercent) === 'cold';
    if (filter === 'unassigned') return !l.assignedTo;
    if (filter === 'assigned') return !!l.assignedTo;
    if (filter === 'red') return l.percentScore < 45;
    if (filter === 'yellow') return l.percentScore >= 45 && l.percentScore < 70;
    if (filter === 'green') return l.percentScore >= 70;
    if (filter === 'mortgage' || filter === 'pension' || filter === 'financial') return l.proType?.includes(filter === 'mortgage' ? 'משכנתא' : filter === 'pension' ? 'פנסיוני' : 'פיננסי');
    return true;
  });

  const handleAssign = (leadId: string, advisorId: string) => {
    const advisor = advisors.find(a => a.id === advisorId);
    updateLead(leadId, { assignedTo: advisor?.name || advisorId, assignedAt: new Date().toISOString() });
    setLeads(getLeads().reverse());
  };

  const handleDelete = (id: string) => {
    deleteLead(id);
    setLeads(getLeads().reverse());
  };

  const exportCsv = () => {
    const header = 'שם,טלפון,אימייל,ציון,חום,סטטוס,סוג יועץ,שויך ל,תאריך\n';
    const rows = filtered.map(l =>
      `${l.name},${l.phone},${l.email},${l.percentScore},${l.heatPercent},${l.status},${l.proType},${l.assignedTo || ''},${l.timestamp?.split('T')[0] || ''}`
    ).join('\n');
    const blob = new Blob(['\ufeff' + header + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`; a.click();
  };

  const statusColor = (score: number) => score < 45 ? 'bg-red-100 text-red-700' : score < 70 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700';
  const heatEmoji = (hp: number) => { const h = getLeadHeatLevel(hp); return h === 'hot' ? '🔥' : h === 'warm' ? '🟠' : '🔵'; };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">ניהול לידים ({filtered.length})</h1>
        <button onClick={exportCsv} className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
          <Download size={16} /> ייצוא CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Filter size={16} className="text-gray-400 self-center" />
        {[
          { key: 'all', label: 'הכל' },
          { key: 'hot', label: '🔥 חם' },
          { key: 'warm', label: '🟠 חמים' },
          { key: 'cold', label: '🔵 קרים' },
          { key: 'unassigned', label: 'לא שויכו' },
          { key: 'assigned', label: 'שויכו' },
          { key: 'red', label: '🔴 אדום' },
          { key: 'yellow', label: '🟡 צהוב' },
          { key: 'green', label: '🟢 ירוק' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter === f.key ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-gray-400 text-center py-12">אין לידים</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500">
                  <th className="px-3 py-3 text-start">שם</th>
                  <th className="px-3 py-3 text-start">טלפון</th>
                  <th className="px-3 py-3 text-center">ציון</th>
                  <th className="px-3 py-3 text-center">חום</th>
                  <th className="px-3 py-3 text-start">סוג</th>
                  <th className="px-3 py-3 text-start">שויך ל</th>
                  <th className="px-3 py-3 text-start">תאריך</th>
                  <th className="px-3 py-3 text-center">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(lead => {
                  const isExpanded = expandedId === lead.id;
                  return (
                    <tr key={lead.id} className="border-b border-gray-100">
                      <td colSpan={8} className="p-0">
                        {/* Main row */}
                        <div className="flex items-center cursor-pointer hover:bg-gray-50 px-3 py-3" onClick={() => setExpandedId(isExpanded ? null : lead.id)}>
                          <div className="flex-1 grid grid-cols-8 gap-2 items-center">
                            <span className="font-medium">{lead.name || '-'}</span>
                            <span>{lead.phone || '-'}</span>
                            <span className="text-center"><span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(lead.percentScore)}`}>{lead.percentScore}</span></span>
                            <span className="text-center">{heatEmoji(lead.heatPercent)} {lead.heatPercent}</span>
                            <span className="text-xs">{lead.proType}</span>
                            <span className="text-xs">{lead.assignedTo || <span className="text-orange-500">ממתין</span>}</span>
                            <span className="text-xs text-gray-500">{lead.timestamp ? new Date(lead.timestamp).toLocaleDateString('he-IL') : '-'}</span>
                            <span className="flex items-center justify-center gap-1">
                              <button onClick={e => { e.stopPropagation(); handleDelete(lead.id); }} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </span>
                          </div>
                        </div>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="bg-gray-50 px-6 py-4 border-t border-gray-100">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                              <div><span className="text-xs text-gray-500">אימייל:</span><p className="font-medium text-sm">{lead.email || '-'}</p></div>
                              <div><span className="text-xs text-gray-500">זמן מועדף:</span><p className="font-medium text-sm">{lead.preferredTime || '-'}</p></div>
                              <div><span className="text-xs text-gray-500">סטטוס:</span><p className="font-medium text-sm">{lead.status}</p></div>
                              <div><span className="text-xs text-gray-500">ציון חום:</span><p className="font-medium text-sm">{heatEmoji(lead.heatPercent)} {lead.heatPercent}% ({getLeadHeatLevel(lead.heatPercent)})</p></div>
                            </div>

                            {lead.recommendations && lead.recommendations.length > 0 && (
                              <div className="mb-4">
                                <span className="text-xs text-gray-500">המלצות שניתנו:</span>
                                <ul className="mt-1 space-y-1">
                                  {lead.recommendations.map((r, i) => <li key={i} className="text-sm bg-white rounded p-2">• {r}</li>)}
                                </ul>
                              </div>
                            )}

                            {/* Assign to advisor */}
                            <div className="flex items-center gap-3 pt-3 border-t border-gray-200">
                              <UserPlus size={16} className="text-gray-400" />
                              <span className="text-sm font-medium">שיבוץ ליועץ:</span>
                              <select
                                value={lead.assignedTo || ''}
                                onChange={e => handleAssign(lead.id, e.target.value)}
                                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                              >
                                <option value="">בחר יועץ...</option>
                                {advisors.map(a => (
                                  <option key={a.id} value={a.id}>{a.name} ({a.specialty.join(', ')})</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
