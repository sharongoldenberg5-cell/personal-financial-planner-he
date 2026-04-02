'use client';

import { useState } from 'react';
import { useTranslation } from '@/lib/translations';
import { generateId } from '@/lib/storage';
import { Shield, TrendingUp, Building, ChevronLeft, ChevronRight, CheckCircle, AlertTriangle, Phone } from 'lucide-react';

// ===== QUIZ DATA =====
interface Question {
  id: string;
  text: string;
  options: { label: string; score: number; heatScore: number; category: string }[];
}

const stages = [
  { key: 'income', icon: TrendingUp, color: '#2563eb' },
  { key: 'debt', icon: Building, color: '#d97706' },
  { key: 'savings', icon: Shield, color: '#16a34a' },
];

const questions: Question[] = [
  // Stage 1: Income & Expenses
  {
    id: 'q1', text: 'מה ההכנסה המשפחתית נטו בחודש?',
    options: [
      { label: 'עד 15,000 ש"ח', score: 1, heatScore: 2, category: 'income' },
      { label: '15,000-25,000 ש"ח', score: 2, heatScore: 3, category: 'income' },
      { label: '25,000-40,000 ש"ח', score: 3, heatScore: 4, category: 'income' },
      { label: 'מעל 40,000 ש"ח', score: 4, heatScore: 4, category: 'income' },
    ],
  },
  {
    id: 'q2', text: 'כמה מההכנסה נשאר בסוף החודש?',
    options: [
      { label: 'אני בד"כ במינוס', score: 1, heatScore: 4, category: 'income' },
      { label: 'כמעט שום דבר', score: 2, heatScore: 3, category: 'income' },
      { label: '10-20%', score: 3, heatScore: 2, category: 'income' },
      { label: 'מעל 20%', score: 4, heatScore: 1, category: 'income' },
    ],
  },
  {
    id: 'q3', text: 'יש לכם תקציב משפחתי מסודר?',
    options: [
      { label: 'לא, אין לי מושג לאן הולך הכסף', score: 1, heatScore: 3, category: 'income' },
      { label: 'יש לי מושג כללי', score: 2, heatScore: 2, category: 'income' },
      { label: 'כן, אני עוקב חלקית', score: 3, heatScore: 2, category: 'income' },
      { label: 'כן, הכל מתועד ומנוהל', score: 4, heatScore: 1, category: 'income' },
    ],
  },
  {
    id: 'q4', text: 'יש לכם קרן חירום (חיסכון נזיל ל-6 חודשי הוצאות)?',
    options: [
      { label: 'לא, אין', score: 1, heatScore: 3, category: 'income' },
      { label: 'יש משהו קטן, לא מספיק', score: 2, heatScore: 3, category: 'income' },
      { label: 'יש ל-3-4 חודשים', score: 3, heatScore: 2, category: 'income' },
      { label: 'יש ל-6 חודשים ומעלה', score: 4, heatScore: 1, category: 'income' },
    ],
  },
  // Stage 2: Mortgage & Debt
  {
    id: 'q5', text: 'מה גובה החזר המשכנתא ביחס להכנסה?',
    options: [
      { label: 'אין לי משכנתא', score: 4, heatScore: 1, category: 'mortgage' },
      { label: 'עד 25% מההכנסה', score: 3, heatScore: 2, category: 'mortgage' },
      { label: '25-35% מההכנסה', score: 2, heatScore: 3, category: 'mortgage' },
      { label: 'מעל 35% מההכנסה', score: 1, heatScore: 4, category: 'mortgage' },
    ],
  },
  {
    id: 'q6', text: 'עד כמה ההחזר החודשי של המשכנתא וההלוואות מפריע לכם?',
    options: [
      { label: 'לא מפריע / אין חובות', score: 4, heatScore: 1, category: 'mortgage' },
      { label: 'מרגיש אבל מתמודדים', score: 3, heatScore: 2, category: 'mortgage' },
      { label: 'מגביל אותנו משמעותית', score: 2, heatScore: 4, category: 'mortgage' },
      { label: 'גורם ללחץ כלכלי מתמיד', score: 1, heatScore: 4, category: 'mortgage' },
    ],
  },
  {
    id: 'q7', text: 'מתי בדקת או מיחזרת את המשכנתא לאחרונה?',
    options: [
      { label: 'אין משכנתא', score: 4, heatScore: 1, category: 'mortgage' },
      { label: 'בשנתיים האחרונות', score: 3, heatScore: 2, category: 'mortgage' },
      { label: 'לפני 3-5 שנים', score: 2, heatScore: 3, category: 'mortgage' },
      { label: 'מעולם לא / לא זוכר', score: 1, heatScore: 4, category: 'mortgage' },
    ],
  },
  {
    id: 'q8', text: 'יש לכם הלוואות או חובות נוספים (מלבד משכנתא)?',
    options: [
      { label: 'אין', score: 4, heatScore: 1, category: 'debt' },
      { label: 'הלוואה אחת קטנה', score: 3, heatScore: 2, category: 'debt' },
      { label: 'כמה הלוואות', score: 2, heatScore: 3, category: 'debt' },
      { label: 'חובות משמעותיים / כרטיסי אשראי', score: 1, heatScore: 4, category: 'debt' },
    ],
  },
  {
    id: 'q9', text: 'מה יחס החוב הכולל להכנסה החודשית?',
    options: [
      { label: 'אין חובות', score: 4, heatScore: 1, category: 'debt' },
      { label: 'עד 30% מההכנסה', score: 3, heatScore: 2, category: 'debt' },
      { label: '30-50%', score: 2, heatScore: 3, category: 'debt' },
      { label: 'מעל 50%', score: 1, heatScore: 4, category: 'debt' },
    ],
  },
  // Stage 3: Savings, Pension, Insurance
  {
    id: 'q10', text: 'האם אתה יודע כמה פנסיה חודשית תקבל בגיל פרישה?',
    options: [
      { label: 'כן, בדקתי ואני מעודכן', score: 4, heatScore: 1, category: 'pension' },
      { label: 'יש לי מושג כללי', score: 3, heatScore: 2, category: 'pension' },
      { label: 'לא ממש', score: 2, heatScore: 3, category: 'pension' },
      { label: 'אין לי מושג', score: 1, heatScore: 4, category: 'pension' },
    ],
  },
  {
    id: 'q11', text: 'האם אתה יודע כמה כסף תוכל לתת לילדיך לטובת עתידם (דירה, לימודים)?',
    options: [
      { label: 'כן, יש תוכנית ברורה וחיסכון ייעודי', score: 4, heatScore: 1, category: 'pension' },
      { label: 'יש רעיון כללי אבל בלי תוכנית', score: 3, heatScore: 2, category: 'pension' },
      { label: 'אני מקווה שיסתדר', score: 2, heatScore: 3, category: 'pension' },
      { label: 'אין לי מושג, זה מדאיג אותי', score: 1, heatScore: 4, category: 'pension' },
    ],
  },
  {
    id: 'q12', text: 'מתי בדקת את דמי הניהול בפנסיה, בקופות הגמל ובביטוחים?',
    options: [
      { label: 'בשנה האחרונה', score: 4, heatScore: 1, category: 'pension' },
      { label: 'לפני 2-3 שנים', score: 3, heatScore: 2, category: 'pension' },
      { label: 'לפני יותר מ-3 שנים', score: 2, heatScore: 3, category: 'pension' },
      { label: 'מעולם לא', score: 1, heatScore: 4, category: 'pension' },
    ],
  },
  {
    id: 'q13', text: 'יש לכם חסכון לטווח ארוך מעבר לפנסיה (קרן השתלמות, השקעות, נדל"ן)?',
    options: [
      { label: 'כן, כמה אפיקים', score: 4, heatScore: 2, category: 'savings' },
      { label: 'כן, אפיק אחד', score: 3, heatScore: 2, category: 'savings' },
      { label: 'רק פנסיה חובה', score: 2, heatScore: 3, category: 'savings' },
      { label: 'אין לי שום חיסכון', score: 1, heatScore: 4, category: 'savings' },
    ],
  },
  {
    id: 'q14', text: 'האם אתה בטוח שאינך משלם על כפל ביטוחים?',
    options: [
      { label: 'כן, בדקתי ואין כפלים', score: 4, heatScore: 1, category: 'insurance' },
      { label: 'לא בטוח, ייתכן שיש', score: 3, heatScore: 3, category: 'insurance' },
      { label: 'אף פעם לא חשבתי על זה', score: 2, heatScore: 3, category: 'insurance' },
      { label: 'אין לי מושג מה הביטוחים שלי', score: 1, heatScore: 4, category: 'insurance' },
    ],
  },
  {
    id: 'q15', text: 'האם אתה משוכנע שעלות הביטוחים שלך היא הזולה ביותר שאפשר לקבל?',
    options: [
      { label: 'כן, השוויתי לאחרונה', score: 4, heatScore: 1, category: 'insurance' },
      { label: 'אני חושב שזה סביר', score: 3, heatScore: 2, category: 'insurance' },
      { label: 'מעולם לא השוויתי', score: 2, heatScore: 3, category: 'insurance' },
      { label: 'אני חושש שאני משלם יותר מדי', score: 1, heatScore: 4, category: 'insurance' },
    ],
  },
  {
    id: 'q16', text: 'כמה גורמים מטפלים בעולם הפיננסי שלך (סוכן ביטוח, יועץ משכנתא, בנקאי)?',
    options: [
      { label: 'גורם אחד שמכיר את כל התמונה', score: 4, heatScore: 1, category: 'general' },
      { label: '2 גורמים שעובדים בתיאום', score: 3, heatScore: 2, category: 'general' },
      { label: 'כמה גורמים, בלי קשר ביניהם', score: 2, heatScore: 3, category: 'general' },
      { label: 'אין לי אף גורם שמטפל בזה', score: 1, heatScore: 4, category: 'general' },
    ],
  },
  {
    id: 'q17', text: 'כל כמה זמן אתה יושב עם מישהו שבודק את כל התמונה הפיננסית שלך?',
    options: [
      { label: 'לפחות פעם בשנה', score: 4, heatScore: 1, category: 'general' },
      { label: 'כל 2-3 שנים', score: 3, heatScore: 2, category: 'general' },
      { label: 'רק כשיש בעיה', score: 2, heatScore: 3, category: 'general' },
      { label: 'מעולם לא', score: 1, heatScore: 4, category: 'general' },
    ],
  },
];

const stageQuestions = [
  questions.slice(0, 4),   // Stage 1: Income
  questions.slice(4, 9),   // Stage 2: Debt
  questions.slice(9, 17),  // Stage 3: Savings/Pension/Insurance
];

// Recommendation templates based on weak areas
const recommendationTemplates: Record<string, { title: string; text: string; proType: string }> = {
  mortgage: {
    title: 'המשכנתא שלך דורשת בדיקה',
    text: 'מהתשובות שלך עולה שייתכן ואתה משלם יותר מדי על המשכנתא. בדיקה פשוטה של מיחזור יכולה לחסוך מאות עד אלפי שקלים בחודש.',
    proType: 'mortgage',
  },
  debt: {
    title: 'החובות מכבידים',
    text: 'יחס החוב להכנסה שלך גבוה. ארגון מחדש של ההלוואות וסדרי עדיפויות בפירעון יכולים להקל משמעותית.',
    proType: 'financial',
  },
  pension: {
    title: 'הפנסיה שלך צריכה תשומת לב',
    text: 'דמי ניהול שלא נבדקו שנים, חוסר מודעות לקצבה הצפויה - הפרשים קטנים הופכים לעשרות אלפי שקלים לאורך השנים.',
    proType: 'pension',
  },
  insurance: {
    title: 'ייתכן שאתה משלם על ביטוחים מיותרים',
    text: 'כפל ביטוחים ועלויות שלא נבדקו יכולים לעלות מאות שקלים בחודש ללא סיבה. בדיקה אחת יכולה לשנות.',
    proType: 'pension',
  },
  savings: {
    title: 'החיסכון שלך לא מספיק',
    text: 'בלי חיסכון לטווח ארוך מעבר לפנסיה, אתה עלול להגיע לפרישה בלי רשת ביטחון. כל שנה שעוברת היא הזדמנות שהולכת לאיבוד.',
    proType: 'financial',
  },
  income: {
    title: 'ניהול התקציב דורש שיפור',
    text: 'כשלא יודעים לאן הולך הכסף, קשה לתכנן. מיפוי פשוט של ההוצאות יכול לשחרר כסף שאתה אפילו לא מודע אליו.',
    proType: 'financial',
  },
  general: {
    title: 'אין לך מישהו שרואה את כל התמונה',
    text: 'כשכל גורם מטפל רק בתחום שלו, אף אחד לא רואה את התמונה המלאה. זה כמו לנהל חברה בלי מנכ"ל.',
    proType: 'financial',
  },
};

type QuizPhase = 'intro' | 'quiz' | 'results' | 'deepcheck' | 'lead';

export default function QuizPage() {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<QuizPhase>('intro');
  const [currentStage, setCurrentStage] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [heatAnswers, setHeatAnswers] = useState<Record<string, number>>({});
  const [categoryScores, setCategoryScores] = useState<Record<string, number[]>>({});
  const [leadForm, setLeadForm] = useState({ name: '', phone: '', email: '', preferredTime: '' });
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; type: 'mislaka' | 'mortgage'; status: 'uploading' | 'done' | 'error'; insight?: string }[]>([]);
  const [heatBonus, setHeatBonus] = useState(0);

  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).length;
  const progress = (answeredCount / totalQuestions) * 100;

  const handleAnswer = (questionId: string, score: number, heatScore: number, category: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: score }));
    setHeatAnswers(prev => ({ ...prev, [questionId]: heatScore }));
    setCategoryScores(prev => {
      const arr = prev[category] || [];
      return { ...prev, [category]: [...arr, score] };
    });

    // Auto advance
    const stageQs = stageQuestions[currentStage];
    if (currentQuestion < stageQs.length - 1) {
      setTimeout(() => setCurrentQuestion(prev => prev + 1), 300);
    } else if (currentStage < 2) {
      setTimeout(() => { setCurrentStage(prev => prev + 1); setCurrentQuestion(0); }, 500);
    } else {
      setTimeout(() => setPhase('results'), 500);
    }
  };

  // Calculate scores
  const totalScore = Object.values(answers).reduce((s, v) => s + v, 0);
  const maxScore = totalQuestions * 4;
  const percentScore = Math.round((totalScore / maxScore) * 100);
  const heatTotal = Object.values(heatAnswers).reduce((s, v) => s + v, 0) + heatBonus;
  const heatMax = totalQuestions * 4 + 50;
  const heatPercent = Math.min(100, Math.round((heatTotal / heatMax) * 100));

  const getStatus = () => {
    if (percentScore >= 70) return { color: '#16a34a', bg: 'bg-green-50', border: 'border-green-200', label: 'יציבות פיננסית', emoji: '🟢' };
    if (percentScore >= 45) return { color: '#d97706', bg: 'bg-yellow-50', border: 'border-yellow-200', label: 'יש מקום לשיפור משמעותי', emoji: '🟡' };
    return { color: '#dc2626', bg: 'bg-red-50', border: 'border-red-200', label: 'האיתנות הפיננסית שלך בסיכון', emoji: '🔴' };
  };

  // Find 2 weakest categories for recommendations
  const getRecommendations = () => {
    const catAvg: { cat: string; avg: number }[] = [];
    for (const [cat, scores] of Object.entries(categoryScores)) {
      if (scores.length > 0) {
        catAvg.push({ cat, avg: scores.reduce((s, v) => s + v, 0) / scores.length });
      }
    }
    catAvg.sort((a, b) => a.avg - b.avg);
    return catAvg.slice(0, 2).map(c => recommendationTemplates[c.cat]).filter(Boolean);
  };

  // Determine professional type
  const getProType = () => {
    const recs = getRecommendations();
    if (recs.some(r => r.proType === 'mortgage')) return 'יועץ משכנתא';
    if (recs.some(r => r.proType === 'pension')) return 'סוכן ביטוח פנסיוני';
    return 'מתכנן פיננסי';
  };

  const handleFileUpload = async (file: File, type: 'mislaka' | 'mortgage') => {
    const entry = { name: file.name, type, status: 'uploading' as const };
    setUploadedFiles(prev => [...prev, entry]);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const resp = await fetch('/api/parse-file', { method: 'POST', body: formData });
      if (!resp.ok) throw new Error('Upload failed');
      const data = await resp.json();

      let insight = '';
      let bonus = 0;

      if (data.status === 'done') {
        const result = data.result?.data || data.result;
        if (result?.mortgageReport) {
          const m = result.mortgageReport;
          const activeLoans = m.subLoans?.filter((s: {currentBalance: number}) => s.currentBalance > 0) || [];
          const totalBal = m.totalBalance || 0;
          const avgRate = activeLoans.length > 0
            ? activeLoans.reduce((s: number, l: {interestRate: number; currentBalance: number}) => s + l.interestRate * l.currentBalance, 0) / totalBal
            : 0;

          let rateInsight = '';
          if (avgRate > 5) rateInsight = '⚠️ הריבית הממוצעת שלך גבוהה מהשוק - יש פוטנציאל חיסכון משמעותי!';
          else if (avgRate > 4) rateInsight = '💡 ייתכן שאפשר לשפר חלק מהמסלולים';
          else rateInsight = '✓ הריבית שלך סבירה';

          insight = `🏦 ${m.bank || 'הבנק'} | יתרה: ${totalBal.toLocaleString()} ₪ | ${activeLoans.length} מסלולים | ריבית ממוצעת: ${avgRate.toFixed(2)}%\n${rateInsight}`;
          bonus = 30;
        } else if (result?.records?.length > 0) {
          insight = `📄 הקובץ עובד בהצלחה - ${result.records.length} רשומות זוהו`;
          bonus = 20;
        }
      } else if (data.status === 'processing') {
        // File is being processed async (OCR)
        insight = '📄 הקובץ התקבל! הנתונים יועברו למומחה לבדיקה מעמיקה';
        bonus = 30;
      }

      setHeatBonus(prev => prev + bonus);
      setUploadedFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'done', insight } : f));
    } catch {
      setUploadedFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'error', insight: 'שגיאה בעיבוד הקובץ' } : f));
    }
  };

  const handleLeadSubmit = async () => {
    // Save lead data
    const leadData = {
      id: generateId(),
      ...leadForm,
      score: totalScore,
      percentScore,
      heatScore: heatTotal,
      heatPercent,
      status: getStatus().label,
      recommendations: getRecommendations().map(r => r.title),
      proType: getProType(),
      answers: { ...answers },
      uploadedFiles: uploadedFiles.filter(f => f.status === 'done').map(f => f.name),
      hasUploads: uploadedFiles.some(f => f.status === 'done'),
      timestamp: new Date().toISOString(),
    };
    // Store in localStorage + sync to DB
    const { saveLead } = await import('@/lib/admin-storage');
    saveLead(leadData as any);
    setLeadSubmitted(true);
  };

  // ===== INTRO SCREEN =====
  if (phase === 'intro') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col items-center justify-center px-4">
        <img src="/captain.png" alt="Captain" className="w-32 h-auto mb-6" />
        <h1 className="text-3xl font-bold text-center text-primary mb-3">בדוק את האיתנות הפיננסית שלך</h1>
        <p className="text-lg text-text-light text-center mb-2 max-w-md">ענה על 17 שאלות קצרות וגלה את הציון הפיננסי שלך</p>
        <p className="text-sm text-text-light text-center mb-8 max-w-md">תקבל ניתוח אישי + 2 המלצות מעשיות לשיפור מיידי</p>
        <button
          onClick={() => setPhase('quiz')}
          className="px-8 py-4 bg-primary text-white text-lg font-bold rounded-xl hover:bg-primary-dark transition-colors shadow-lg"
        >
          התחל את הבדיקה
        </button>
        <p className="text-xs text-text-light mt-4">חינם | 3 דקות | ללא התחייבות</p>
      </div>
    );
  }

  // ===== QUIZ SCREEN =====
  if (phase === 'quiz') {
    const stageQs = stageQuestions[currentStage];
    const question = stageQs[currentQuestion];
    const stageConfig = stages[currentStage];
    const StageIcon = stageConfig.icon;
    const stageNames = ['הכנסות והוצאות', 'משכנתא וחובות', 'חסכונות, פנסיה וביטוח'];

    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col">
        {/* Progress */}
        <div className="px-4 pt-4">
          <div className="max-w-lg mx-auto">
            <div className="flex justify-between text-xs text-text-light mb-1">
              <span>שאלה {answeredCount + 1} מתוך {totalQuestions}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-border rounded-full h-2">
              <div className="bg-primary rounded-full h-2 transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        {/* Stage indicator */}
        <div className="flex justify-center gap-6 mt-4 mb-6">
          {stages.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.key} className={`flex items-center gap-1.5 text-xs ${i === currentStage ? 'font-bold' : 'text-text-light'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center ${i === currentStage ? 'bg-primary text-white' : i < currentStage ? 'bg-success text-white' : 'bg-border'}`}>
                  {i < currentStage ? <CheckCircle size={14} /> : <Icon size={14} />}
                </div>
                <span className="hidden sm:inline">{stageNames[i]}</span>
              </div>
            );
          })}
        </div>

        {/* Question */}
        <div className="flex-1 flex items-center justify-center px-4 pb-8">
          <div className="max-w-lg w-full">
            <div className="bg-surface rounded-2xl shadow-lg border border-border p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-1">
                <StageIcon size={18} style={{ color: stageConfig.color }} />
                <span className="text-xs font-medium" style={{ color: stageConfig.color }}>{stageNames[currentStage]}</span>
              </div>
              <h2 className="text-xl font-bold mb-6">{question.text}</h2>

              <div className="space-y-3">
                {question.options.map((opt, i) => {
                  const isSelected = answers[question.id] === opt.score;
                  return (
                    <button
                      key={i}
                      onClick={() => handleAnswer(question.id, opt.score, opt.heatScore, opt.category)}
                      className={`w-full text-start p-4 rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5 text-primary font-medium'
                          : 'border-border hover:border-primary/50 hover:bg-background'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Navigation */}
            {answeredCount > 0 && (
              <div className="flex justify-between mt-4">
                <button
                  onClick={() => {
                    if (currentQuestion > 0) setCurrentQuestion(prev => prev - 1);
                    else if (currentStage > 0) {
                      setCurrentStage(prev => prev - 1);
                      setCurrentQuestion(stageQuestions[currentStage - 1].length - 1);
                    }
                  }}
                  className="flex items-center gap-1 text-sm text-text-light hover:text-text"
                >
                  <ChevronRight size={16} /> חזור
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ===== RESULTS SCREEN =====
  if (phase === 'results') {
    const status = getStatus();
    const recs = getRecommendations();

    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col items-center px-4 py-8">
        <div className="max-w-lg w-full">
          {/* Score */}
          <div className={`${status.bg} border ${status.border} rounded-2xl p-8 text-center mb-6`}>
            <div className="text-5xl mb-3">{status.emoji}</div>
            <h1 className="text-2xl font-bold mb-2">הציון שלך: {percentScore}/100</h1>
            <p className="text-lg font-medium" style={{ color: status.color }}>{status.label}</p>
          </div>

          {/* Recommendations */}
          <div className="space-y-4 mb-8">
            <h2 className="text-lg font-bold">ההמלצות שלך:</h2>
            {recs.map((rec, i) => (
              <div key={i} className="bg-surface rounded-xl border border-border p-5">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={18} className="text-warning" />
                  <h3 className="font-semibold">{rec.title}</h3>
                </div>
                <p className="text-sm text-text-light">{rec.text}</p>
              </div>
            ))}
          </div>

          {/* Deep Check - Upload mortgage report */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-bold text-primary mb-2">🎁 בונוס: בדיקת המשכנתא שלך</h2>
            <p className="text-sm text-text-light mb-4">העלה את דוח היתרה לסילוק מהבנק וקבל ניתוח מיידי - האם אתה משלם יותר מדי?</p>

            {uploadedFiles.length === 0 ? (
              <>
                <label className="flex items-center gap-4 p-5 bg-white rounded-xl border-2 border-dashed border-blue-300 hover:border-primary cursor-pointer transition-colors mb-3">
                  <Building size={32} className="text-primary flex-shrink-0" />
                  <div>
                    <span className="text-sm font-bold block">העלה דוח יתרה לסילוק</span>
                    <span className="text-xs text-text-light">PDF שהורדת מאתר הבנק</span>
                  </div>
                  <input type="file" accept=".pdf,.zip" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, 'mortgage'); }} />
                </label>
                <p className="text-xs text-text-light mb-2">אין לך את הדוח? היכנס לאתר הבנק והורד:</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { name: 'הפועלים', url: 'https://www.bankhapoalim.co.il/' },
                    { name: 'לאומי', url: 'https://www.leumi.co.il/' },
                    { name: 'דיסקונט', url: 'https://www.discountbank.co.il/' },
                    { name: 'מזרחי טפחות', url: 'https://www.mizrahi-tefahot.co.il/' },
                    { name: 'הבינלאומי', url: 'https://www.fibi.co.il/' },
                    { name: 'ירושלים', url: 'https://www.bankjerusalem.co.il/' },
                  ].map(bank => (
                    <a key={bank.name} href={bank.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1 p-2 bg-white rounded-lg border border-gray-200 hover:border-primary hover:text-primary transition-colors text-xs">
                      <Building size={12} />
                      {bank.name}
                    </a>
                  ))}
                </div>
              </>

            ) : (
              <div className="space-y-3">
                {uploadedFiles.map((f, i) => (
                  <div key={i} className={`p-4 rounded-xl text-sm ${
                    f.status === 'done' ? 'bg-green-50 border border-green-200' :
                    f.status === 'error' ? 'bg-red-50 border border-red-200' :
                    'bg-white border border-blue-200'
                  }`}>
                    <div className="flex items-center gap-3 mb-2">
                      {f.status === 'uploading' && <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
                      {f.status === 'done' && <CheckCircle size={20} className="text-success flex-shrink-0" />}
                      {f.status === 'error' && <AlertTriangle size={20} className="text-danger flex-shrink-0" />}
                      <p className="font-bold">{f.status === 'uploading' ? 'מנתח את המשכנתא שלך...' : f.status === 'done' ? 'הניתוח הושלם!' : 'שגיאה בעיבוד'}</p>
                    </div>
                    {f.insight && (
                      <div className="bg-white rounded-lg p-3 mt-2">
                        <p className="text-sm">{f.insight}</p>
                      </div>
                    )}
                    {f.status === 'done' && (
                      <p className="text-xs text-success font-medium mt-2">✓ הנתונים נשמרו - המומחה יקבל את הפרטים המלאים</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CTA */}
          <div className="bg-primary/5 border-2 border-primary rounded-2xl p-6 text-center">
            <h2 className="text-xl font-bold text-primary mb-2">רוצה שמומחה יבדוק את המצב שלך?</h2>
            <p className="text-sm text-text-light mb-4">{getProType()} מומחה יציג לך תמונה מלאה - בחינם וללא התחייבות</p>
            <button
              onClick={() => setPhase('lead')}
              className="px-8 py-3 bg-primary text-white text-lg font-bold rounded-xl hover:bg-primary-dark transition-colors w-full"
            >
              רוצה שיחזרו אליי
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== LEAD FORM =====
  if (phase === 'lead') {
    if (leadSubmitted) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <CheckCircle size={64} className="text-success mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">תודה! הפרטים התקבלו</h1>
            <p className="text-text-light mb-6">{getProType()} מומחה יחזור אליך בהקדם</p>
            <a href="/" className="text-primary font-medium hover:underline">חזרה לדף הבית</a>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-surface rounded-2xl shadow-lg border border-border p-8">
            <Phone size={32} className="text-primary mx-auto mb-4" />
            <h1 className="text-xl font-bold text-center mb-2">השאר פרטים</h1>
            <p className="text-sm text-text-light text-center mb-6">{getProType()} מומחה יחזור אליך לבדיקה חינמית</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">שם מלא</label>
                <input type="text" value={leadForm.name} onChange={e => setLeadForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-4 py-3 border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none" placeholder="ישראל ישראלי" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">טלפון</label>
                <input type="tel" value={leadForm.phone} onChange={e => setLeadForm(p => ({ ...p, phone: e.target.value }))}
                  className="w-full px-4 py-3 border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none" placeholder="050-1234567" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">אימייל</label>
                <input type="email" value={leadForm.email} onChange={e => setLeadForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full px-4 py-3 border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none" placeholder="mail@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">מתי נוח לחזור אליך?</label>
                <select value={leadForm.preferredTime} onChange={e => setLeadForm(p => ({ ...p, preferredTime: e.target.value }))}
                  className="w-full px-4 py-3 border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none">
                  <option value="">בחר זמן</option>
                  <option value="morning">בוקר (8:00-12:00)</option>
                  <option value="afternoon">צהריים (12:00-16:00)</option>
                  <option value="evening">ערב (16:00-20:00)</option>
                  <option value="anytime">בכל זמן</option>
                </select>
              </div>

              <button
                onClick={handleLeadSubmit}
                disabled={!leadForm.name || !leadForm.phone}
                className="w-full px-6 py-3 bg-primary text-white text-lg font-bold rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                שלח
              </button>
            </div>

            <p className="text-[10px] text-text-light text-center mt-4">
              הפרטים שלך מאובטחים ולא יועברו לצד שלישי ללא הסכמתך
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
