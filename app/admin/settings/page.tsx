'use client';

import { useState } from 'react';
import { Settings, Link as LinkIcon, Copy, CheckCircle } from 'lucide-react';

export default function SettingsPage() {
  const [copied, setCopied] = useState('');

  const quizUrl = typeof window !== 'undefined' ? `${window.location.origin}/quiz` : 'https://personal-financial-planner-he.vercel.app/quiz';
  const adminUrl = typeof window !== 'undefined' ? `${window.location.origin}/admin` : 'https://personal-financial-planner-he.vercel.app/admin';

  const copyUrl = (url: string, key: string) => {
    navigator.clipboard.writeText(url);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">הגדרות</h1>

      {/* Links */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><LinkIcon size={18} /> קישורים</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">קישור לשאלון (לשליחה ללקוחות)</label>
            <div className="flex gap-2">
              <input type="text" readOnly value={quizUrl} className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm" />
              <button onClick={() => copyUrl(quizUrl, 'quiz')} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1">
                {copied === 'quiz' ? <><CheckCircle size={14} /> הועתק</> : <><Copy size={14} /> העתק</>}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">קישור לאדמין</label>
            <div className="flex gap-2">
              <input type="text" readOnly value={adminUrl} className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm" />
              <button onClick={() => copyUrl(adminUrl, 'admin')} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1">
                {copied === 'admin' ? <><CheckCircle size={14} /> הועתק</> : <><Copy size={14} /> העתק</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><Settings size={18} /> מידע מערכת</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">גרסה:</span> <span className="font-medium">1.0.0</span></div>
          <div><span className="text-gray-500">פלטפורמה:</span> <span className="font-medium">Next.js + Vercel</span></div>
          <div><span className="text-gray-500">אחסון:</span> <span className="font-medium">localStorage (מקומי)</span></div>
          <div><span className="text-gray-500">שם המערכת:</span> <span className="font-medium">קפטן פיננסי</span></div>
        </div>
      </div>
    </div>
  );
}
