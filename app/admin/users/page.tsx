'use client';

import { useState, useEffect } from 'react';
import { dbGetAllUsers, dbGetUserDetail } from '@/lib/admin-users-actions';
import { formatCurrency } from '@/lib/utils';
import { Users, ChevronDown, ChevronUp, Wallet, CreditCard, Target, Building, Shield, TrendingDown, RefreshCw } from 'lucide-react';

interface UserSummary {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  age: number | null;
  maritalStatus: string | null;
  monthlyIncome: number | null;
  monthlyExpenses: number | null;
  createdAt: Date;
  assetCount: number;
  liabilityCount: number;
  goalCount: number;
  bankAccountCount: number;
  creditCardCount: number;
  mortgageCount: number;
  mislakaCount: number;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<Record<string, any>>({});

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    const data = await dbGetAllUsers();
    setUsers(data as any);
    setLoading(false);
  };

  const toggleUser = async (userId: string) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
      return;
    }
    setExpandedUser(userId);
    if (!userDetail[userId]) {
      const detail = await dbGetUserDetail(userId);
      setUserDetail(prev => ({ ...prev, [userId]: detail }));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users size={24} /> משתמשים ({users.length})
        </h1>
        <button onClick={loadUsers} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white">
          <RefreshCw size={14} /> רענן
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">טוען...</div>
      ) : users.length === 0 ? (
        <div className="text-center text-gray-400 py-12">אין משתמשים רשומים</div>
      ) : (
        <div className="space-y-3">
          {users.map(user => (
            <div key={user.userId} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              {/* User Header */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-700/50 transition-colors"
                onClick={() => toggleUser(user.userId)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                    {(user.firstName || '?')[0]}
                  </div>
                  <div>
                    <p className="font-medium text-white">
                      {user.firstName} {user.lastName}
                      {user.age ? ` (${user.age})` : ''}
                    </p>
                    <p className="text-xs text-gray-400">
                      {user.maritalStatus === 'married' ? 'נשוי/אה' : user.maritalStatus === 'single' ? 'רווק/ה' : user.maritalStatus || ''}
                      {user.monthlyIncome ? ` | הכנסה: ${formatCurrency(user.monthlyIncome)}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex gap-2 text-xs text-gray-400">
                    {user.assetCount > 0 && <span className="bg-blue-900/50 px-2 py-0.5 rounded">{user.assetCount} נכסים</span>}
                    {user.liabilityCount > 0 && <span className="bg-red-900/50 px-2 py-0.5 rounded">{user.liabilityCount} התחייבויות</span>}
                    {user.goalCount > 0 && <span className="bg-purple-900/50 px-2 py-0.5 rounded">{user.goalCount} יעדים</span>}
                    {user.bankAccountCount > 0 && <span className="bg-green-900/50 px-2 py-0.5 rounded">{user.bankAccountCount} חשבונות</span>}
                    {user.creditCardCount > 0 && <span className="bg-yellow-900/50 px-2 py-0.5 rounded">{user.creditCardCount} כרטיסים</span>}
                    {user.mortgageCount > 0 && <span className="bg-orange-900/50 px-2 py-0.5 rounded">{user.mortgageCount} משכנתאות</span>}
                    {user.mislakaCount > 0 && <span className="bg-teal-900/50 px-2 py-0.5 rounded">{user.mislakaCount} מסלקה</span>}
                  </div>
                  {expandedUser === user.userId ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                </div>
              </div>

              {/* User Detail */}
              {expandedUser === user.userId && userDetail[user.userId] && (
                <div className="px-4 pb-4 border-t border-gray-700 pt-4 space-y-4">
                  {(() => {
                    const d = userDetail[user.userId];
                    return (
                      <>
                        {/* Summary Cards */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-blue-900/30 rounded-lg p-3 text-center">
                            <p className="text-xs text-gray-400">סה"כ נכסים</p>
                            <p className="text-lg font-bold text-blue-400">{formatCurrency(d.summary?.totalAssets || 0)}</p>
                          </div>
                          <div className="bg-red-900/30 rounded-lg p-3 text-center">
                            <p className="text-xs text-gray-400">סה"כ התחייבויות</p>
                            <p className="text-lg font-bold text-red-400">{formatCurrency(d.summary?.totalLiabilities || 0)}</p>
                          </div>
                          <div className="bg-green-900/30 rounded-lg p-3 text-center">
                            <p className="text-xs text-gray-400">שווי נקי</p>
                            <p className="text-lg font-bold text-green-400">{formatCurrency(d.summary?.netWorth || 0)}</p>
                          </div>
                        </div>

                        {/* Profile */}
                        {d.profile && (
                          <div>
                            <h3 className="text-sm font-semibold text-gray-300 mb-2">פרופיל</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                              {d.profile.monthlyIncome && <div className="bg-gray-700/50 p-2 rounded"><span className="text-gray-400">הכנסה:</span> {formatCurrency(d.profile.monthlyIncome)}</div>}
                              {d.profile.monthlyExpenses && <div className="bg-gray-700/50 p-2 rounded"><span className="text-gray-400">הוצאות:</span> {formatCurrency(d.profile.monthlyExpenses)}</div>}
                              {d.profile.numberOfChildren != null && <div className="bg-gray-700/50 p-2 rounded"><span className="text-gray-400">ילדים:</span> {d.profile.numberOfChildren}</div>}
                              {d.profile.retirementAge && <div className="bg-gray-700/50 p-2 rounded"><span className="text-gray-400">גיל פרישה:</span> {d.profile.retirementAge}</div>}
                            </div>
                          </div>
                        )}

                        {/* Assets */}
                        {d.assets?.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-1"><Wallet size={14} /> נכסים ({d.assets.length})</h3>
                            <div className="space-y-1">
                              {d.assets.map((a: any) => (
                                <div key={a.id} className="flex justify-between text-xs bg-gray-700/30 p-2 rounded">
                                  <span>{a.name} <span className="text-gray-500">({a.category})</span></span>
                                  <span className="text-blue-400">{formatCurrency(a.value)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Liabilities */}
                        {d.liabilities?.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-1"><TrendingDown size={14} /> התחייבויות ({d.liabilities.length})</h3>
                            <div className="space-y-1">
                              {d.liabilities.map((l: any) => (
                                <div key={l.id} className="flex justify-between text-xs bg-gray-700/30 p-2 rounded">
                                  <span>{l.name} <span className="text-gray-500">{l.interestRate}%</span></span>
                                  <span className="text-red-400">{formatCurrency(l.currentBalance)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Goals */}
                        {d.goals?.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-1"><Target size={14} /> יעדים ({d.goals.length})</h3>
                            <div className="space-y-1">
                              {d.goals.map((g: any) => (
                                <div key={g.id} className="flex justify-between text-xs bg-gray-700/30 p-2 rounded">
                                  <span>{g.name} <span className="text-gray-500">({g.status})</span></span>
                                  <span>{formatCurrency(g.currentAmount)} / {formatCurrency(g.targetAmount)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Recommendations */}
                        {d.recommendations?.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold text-gray-300 mb-2">המלצות ({d.recommendations.length})</h3>
                            <div className="space-y-1">
                              {d.recommendations.slice(0, 5).map((r: any) => (
                                <div key={r.id} className="text-xs bg-gray-700/30 p-2 rounded">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] mr-1 ${r.priority === 'high' ? 'bg-red-900/50 text-red-300' : r.priority === 'medium' ? 'bg-yellow-900/50 text-yellow-300' : 'bg-blue-900/50 text-blue-300'}`}>{r.category}</span>
                                  {r.title}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
