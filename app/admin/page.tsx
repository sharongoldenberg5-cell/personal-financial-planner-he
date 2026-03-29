'use client';

import { useState, useEffect } from 'react';
import { getLeadStats, getLeads, getLeadHeatLevel } from '@/lib/admin-storage';
import { Users, Flame, UserCheck, UserX, TrendingUp, BarChart3 } from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboard() {
  const [stats, setStats] = useState<ReturnType<typeof getLeadStats> | null>(null);
  const [recentLeads, setRecentLeads] = useState<ReturnType<typeof getLeads>>([]);

  useEffect(() => {
    setStats(getLeadStats());
    setRecentLeads(getLeads().slice(-10).reverse());
  }, []);

  if (!stats) return null;

  const kpis = [
    { label: 'סה"כ לידים', value: stats.total, icon: Users, color: 'bg-blue-500' },
    { label: 'לידים חמים', value: stats.hot, icon: Flame, color: 'bg-red-500' },
    { label: 'שויכו ליועץ', value: stats.assigned, icon: UserCheck, color: 'bg-green-500' },
    { label: 'ממתינים לשיבוץ', value: stats.unassigned, icon: UserX, color: 'bg-orange-500' },
    { label: 'יועצים רשומים', value: stats.advisorCount, icon: TrendingUp, color: 'bg-purple-500' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">דשבורד אדמין</h1>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {kpis.map(kpi => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className={`${kpi.color} text-white p-2 rounded-lg`}>
                  <Icon size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  <p className="text-xs text-gray-500">{kpi.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Status distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><BarChart3 size={18} /> לפי ציון</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2"><span className="w-3 h-3 bg-red-500 rounded-full" /> אדום (סיכון)</span>
              <span className="font-bold">{stats.red}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-red-500 rounded-full h-2" style={{ width: `${stats.total ? (stats.red / stats.total) * 100 : 0}%` }} />
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2"><span className="w-3 h-3 bg-yellow-500 rounded-full" /> צהוב (לשיפור)</span>
              <span className="font-bold">{stats.yellow}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-yellow-500 rounded-full h-2" style={{ width: `${stats.total ? (stats.yellow / stats.total) * 100 : 0}%` }} />
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2"><span className="w-3 h-3 bg-green-500 rounded-full" /> ירוק (יציב)</span>
              <span className="font-bold">{stats.green}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-green-500 rounded-full h-2" style={{ width: `${stats.total ? (stats.green / stats.total) * 100 : 0}%` }} />
            </div>
          </div>
        </div>

        {/* Heat distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><Flame size={18} /> חום הליד</h2>
          <div className="space-y-4">
            <div className="text-center p-4 bg-red-50 rounded-xl">
              <p className="text-3xl font-bold text-red-600">{stats.hot}</p>
              <p className="text-sm text-red-600">🔥 חם</p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-xl">
              <p className="text-3xl font-bold text-orange-600">{stats.warm}</p>
              <p className="text-sm text-orange-600">🟠 חמים</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-xl">
              <p className="text-3xl font-bold text-blue-600">{stats.cold}</p>
              <p className="text-sm text-blue-600">🔵 קרים</p>
            </div>
          </div>
        </div>

        {/* Leads per day */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="font-semibold mb-4">לידים - 7 ימים אחרונים</h2>
          <div className="space-y-2">
            {Object.entries(stats.perDay).map(([day, count]) => (
              <div key={day} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-20">{new Date(day).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' })}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-4">
                  <div className="bg-blue-500 rounded-full h-4 flex items-center justify-end px-1"
                    style={{ width: `${Math.max(count * 20, count ? 15 : 0)}%` }}>
                    {count > 0 && <span className="text-[10px] text-white">{count}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Leads */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">לידים אחרונים</h2>
          <Link href="/admin/leads" className="text-blue-600 text-sm hover:underline">צפה בהכל ←</Link>
        </div>
        {recentLeads.length === 0 ? (
          <p className="text-gray-400 text-center py-8">אין לידים עדיין. שלח את השאלון ללקוחות!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="px-3 py-2 text-start">שם</th>
                  <th className="px-3 py-2 text-start">טלפון</th>
                  <th className="px-3 py-2 text-center">ציון</th>
                  <th className="px-3 py-2 text-center">חום</th>
                  <th className="px-3 py-2 text-start">סוג יועץ</th>
                  <th className="px-3 py-2 text-start">שויך ל</th>
                  <th className="px-3 py-2 text-start">תאריך</th>
                </tr>
              </thead>
              <tbody>
                {recentLeads.map(lead => {
                  const heat = getLeadHeatLevel(lead.heatPercent);
                  const statusColor = lead.percentScore < 45 ? 'bg-red-100 text-red-700' : lead.percentScore < 70 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700';
                  const heatEmoji = heat === 'hot' ? '🔥' : heat === 'warm' ? '🟠' : '🔵';
                  return (
                    <tr key={lead.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium">{lead.name || '-'}</td>
                      <td className="px-3 py-2">{lead.phone || '-'}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor}`}>{lead.percentScore}</span>
                      </td>
                      <td className="px-3 py-2 text-center">{heatEmoji} {lead.heatPercent}</td>
                      <td className="px-3 py-2 text-xs">{lead.proType}</td>
                      <td className="px-3 py-2 text-xs">{lead.assignedTo || <span className="text-orange-500">לא שויך</span>}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{lead.timestamp ? new Date(lead.timestamp).toLocaleDateString('he-IL') : '-'}</td>
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
