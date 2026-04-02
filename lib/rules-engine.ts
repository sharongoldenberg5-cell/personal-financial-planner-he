import type { UserProfile, Asset, Liability, PensionData, Goal, Recommendation, RetirementGoals, MislakaReport, BankAccount, MortgageReport, CreditCardStatement } from './types';
import { generateId } from './storage';

interface AnalysisInput {
  profile: UserProfile;
  assets: Asset[];
  liabilities: Liability[];
  pensionData: PensionData[];
  goals: Goal[];
  retirementGoals?: RetirementGoals | null;
  mislakaReports?: MislakaReport[];
  bankAccounts?: BankAccount[];
  mortgageReports?: MortgageReport[];
  creditCards?: CreditCardStatement[];
}

const PENSION_TYPES = ['pension', 'managers-insurance', 'provident'];

export function generateRuleBasedRecommendations(input: AnalysisInput): Recommendation[] {
  const { profile, assets, liabilities, pensionData, goals, retirementGoals, mislakaReports } = input;
  const recommendations: Recommendation[] = [];
  const now = new Date().toISOString();

  const totalAssets = assets.reduce((sum, a) => sum + a.value, 0);
  const totalPension = pensionData.reduce((sum, p) => sum + p.currentBalance, 0);
  const netWorth = totalAssets + totalPension;
  const familyNetIncome = (profile.monthlyIncome || 0) + (profile.spouseMonthlyIncomeNet || 0);
  const monthlySavings = familyNetIncome - profile.monthlyExpenses;
  const yearsToRetirement = profile.retirementAge - profile.age;
  const savingsRate = familyNetIncome > 0 ? (monthlySavings / familyNetIncome) * 100 : 0;

  // ---- Pre-compute transaction data ----
  const bankAccounts = input.bankAccounts || [];
  const mortgageReports = input.mortgageReports || [];
  const allTransactions = bankAccounts.flatMap(a => a.transactions);
  const hasTransactions = allTransactions.length > 0;
  const txTotalIncome = allTransactions.filter(t => t.credit > 0).reduce((s, t) => s + t.credit, 0);
  const txTotalExpenses = allTransactions.filter(t => t.debit > 0 && t.category !== 'כרטיס-אשראי').reduce((s, t) => s + t.debit, 0);
  const txByCategory: Record<string, number> = {};
  for (const t of allTransactions) {
    if (t.debit > 0) {
      txByCategory[t.category] = (txByCategory[t.category] || 0) + t.debit;
    }
  }
  const txIncomeByCategory: Record<string, number> = {};
  for (const t of allTransactions) {
    if (t.credit > 0) {
      txIncomeByCategory[t.category] = (txIncomeByCategory[t.category] || 0) + t.credit;
    }
  }

  // ---- Mislaka pre-compute ----
  const allMislakaProducts = (mislakaReports || []).flatMap(r => r.products);
  const mislakaTotal = allMislakaProducts.reduce((s, p) => s + (p.totalBalance || 0), 0);

  // ==================================================================
  // SECTION 1: BASIC FINANCIAL HEALTH
  // ==================================================================

  // Emergency Fund Check
  const emergencyFundTarget = profile.monthlyExpenses * 6;
  const savingsAssets = assets.filter(a => a.category === 'savings' || a.category === 'bank-account');
  const liquidSavings = savingsAssets.reduce((sum, a) => sum + a.value, 0);

  if (liquidSavings < emergencyFundTarget && profile.monthlyExpenses > 0) {
    recommendations.push({
      id: generateId(),
      title: 'בניית קרן חירום',
      description: `מומלץ להחזיק קרן חירום בגובה ${emergencyFundTarget.toLocaleString()} ₪ (6 חודשי הוצאות). כרגע יש לך ${liquidSavings.toLocaleString()} ₪ נזילים.`,
      category: 'savings',
      priority: 'high',
      source: 'rules',
      actionItems: [
        `הפקד ${Math.ceil((emergencyFundTarget - liquidSavings) / 12).toLocaleString()} ₪ בחודש לחשבון חיסכון נזיל`,
        'שמור על הקרן בחשבון חיסכון נפרד',
        'אל תשקיע את קרן החירום בהשקעות מסוכנות',
      ],
      createdAt: now,
    });
  }

  // Savings Rate Check
  if (savingsRate < 20 && profile.monthlyIncome > 0) {
    recommendations.push({
      id: generateId(),
      title: 'הגדלת שיעור החיסכון',
      description: `שיעור החיסכון שלך הוא ${savingsRate.toFixed(1)}%. מומלץ לחסוך לפחות 20% מההכנסה.`,
      category: 'savings',
      priority: savingsRate < 10 ? 'high' : 'medium',
      source: 'rules',
      actionItems: [
        'בדוק הוצאות שניתן לקצץ',
        `הגדל את החיסכון החודשי ב-${Math.ceil(familyNetIncome * 0.2 - monthlySavings).toLocaleString()} ₪`,
        'הגדר הוראת קבע אוטומטית לחיסכון',
      ],
      createdAt: now,
    });
  }

  // ==================================================================
  // SECTION 2: PENSION & RETIREMENT
  // ==================================================================

  // Pension Check
  const hasPensionData = pensionData.length > 0 || (mislakaReports && mislakaReports.length > 0);
  if (!hasPensionData && profile.employmentStatus !== 'student') {
    recommendations.push({
      id: generateId(),
      title: 'הסדרת פנסיה',
      description: 'לא נמצאו נתוני פנסיה. חובה חוקית על כל עובד בישראל להפריש לפנסיה.',
      category: 'pension',
      priority: 'high',
      source: 'rules',
      actionItems: [
        'פנה לסוכן פנסיוני או יועץ פנסיוני מוסמך',
        'בדוק שהמעסיק מפריש כחוק (6.5% עובד + 6.5% מעסיק + 6% פיצויים)',
        'השווה בין קרנות פנסיה שונות',
      ],
      createdAt: now,
    });
  }

  // High Management Fees
  for (const pension of pensionData) {
    if (pension.managementFeePercent > 1.0) {
      recommendations.push({
        id: generateId(),
        title: `דמי ניהול גבוהים - ${pension.provider}`,
        description: `דמי הניהול ב-${pension.provider} הם ${pension.managementFeePercent}%. ניתן להוזיל עד 0.5% בממוצע.`,
        category: 'pension',
        priority: 'medium',
        source: 'rules',
        actionItems: [
          'פנה לחברה המנהלת לצורך משא ומתן על הורדת דמי ניהול',
          'קבל הצעות מחברות מתחרות',
          'שקול להעביר את הקופה אם לא מתקבלת הנחה',
        ],
        createdAt: now,
      });
    }
  }

  // Education Fund Check (Keren Hishtalmut)
  if (profile.employmentStatus === 'employed' || profile.employmentStatus === 'self-employed') {
    const hasEducationFund = pensionData.some(p => p.type === 'education-fund')
      || (mislakaReports || []).some(r => r.products.some(p => p.productType === 'education-fund'));
    if (!hasEducationFund) {
      recommendations.push({
        id: generateId(),
        title: 'פתיחת קרן השתלמות',
        description: 'קרן השתלמות היא מכשיר חיסכון עם הטבות מס משמעותיות. לא נמצאה קרן השתלמות בנתונים שלך.',
        category: 'tax',
        priority: 'high',
        source: 'rules',
        actionItems: [
          'פתח קרן השתלמות דרך המעסיק או באופן עצמאי',
          'הפקד את המקסימום המותר לצורך הטבת המס',
          'בחר מסלול השקעה המתאים לגילך',
        ],
        createdAt: now,
      });
    }
  }

  // Retirement Readiness
  if (yearsToRetirement > 0 && yearsToRetirement < 20 && !retirementGoals) {
    const estimatedRetirementNeeds = profile.monthlyExpenses * 12 * 20;
    const currentRetirementSavings = totalPension + mislakaTotal + assets.filter(a =>
      a.category === 'investment' || a.category === 'savings'
    ).reduce((sum, a) => sum + a.value, 0);

    if (currentRetirementSavings < estimatedRetirementNeeds * 0.5) {
      recommendations.push({
        id: generateId(),
        title: 'מוכנות לפרישה',
        description: `נותרו ${yearsToRetirement} שנים לפרישה. החיסכון הנוכחי (${currentRetirementSavings.toLocaleString()} ₪) נמוך מהנדרש (${estimatedRetirementNeeds.toLocaleString()} ₪ משוער).`,
        category: 'pension',
        priority: 'high',
        source: 'rules',
        actionItems: [
          'הגדל הפקדות לפנסיה ולחיסכון ארוך טווח',
          'שקול ייעוץ פנסיוני מקצועי',
          'בחן אפשרויות השקעה לטווח ארוך',
        ],
        createdAt: now,
      });
    }
  }

  // Insurance Check
  const hasInsurance = assets.some(a => a.category === 'insurance');
  if (!hasInsurance && profile.maritalStatus === 'married') {
    recommendations.push({
      id: generateId(),
      title: 'ביטוח חיים ואובדן כושר עבודה',
      description: 'כמשפחה, חשוב לוודא כיסוי ביטוחי מתאים. לא נמצאו נתוני ביטוח.',
      category: 'insurance',
      priority: 'medium',
      source: 'rules',
      actionItems: [
        'בדוק ביטוח חיים, אובדן כושר עבודה ובריאות',
        'וודא שהכיסוי הביטוחי בפנסיה מספק',
        'השווה הצעות מכמה חברות ביטוח',
      ],
      createdAt: now,
    });
  }

  // Asset Diversification
  if (assets.length > 0) {
    const realEstateValue = assets.filter(a => a.category === 'real-estate').reduce((sum, a) => sum + a.value, 0);
    if (netWorth > 0 && (realEstateValue / netWorth) > 0.7) {
      recommendations.push({
        id: generateId(),
        title: 'פיזור השקעות',
        description: `${((realEstateValue / netWorth) * 100).toFixed(0)}% מהנכסים שלך בנדל"ן. מומלץ לפזר את ההשקעות.`,
        category: 'investment',
        priority: 'medium',
        source: 'rules',
        actionItems: [
          'שקול להשקיע בקרנות מחקות מדדים',
          'בחן השקעה באג"ח ממשלתי לגיוון',
          'אל תשים את כל הביצים בסל אחד',
        ],
        createdAt: now,
      });
    }
  }

  // ==================================================================
  // SECTION 3: GOAL-SPECIFIC RECOMMENDATIONS
  // ==================================================================

  for (const goal of goals) {
    if (goal.status !== 'active') continue;
    const targetDate = new Date(goal.targetDate);
    const yearsLeft = Math.max(0, (targetDate.getTime() - Date.now()) / (365.25 * 24 * 60 * 60 * 1000));
    const monthsLeft = Math.max(1, yearsLeft * 12);
    const remaining = goal.targetAmount - goal.currentAmount;
    const requiredMonthly = remaining / monthsLeft;
    const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;

    let recommendedTrack = '';
    let recommendedStocks = '';
    let riskLevel = '';
    if (yearsLeft <= 2) {
      recommendedTrack = 'שמרני / אג"ח / פיקדון';
      recommendedStocks = '0% מניות';
      riskLevel = 'טווח קצר';
    } else if (yearsLeft <= 6) {
      recommendedTrack = 'מאוזן / משולב';
      recommendedStocks = '40-50% מניות';
      riskLevel = 'טווח בינוני';
    } else {
      recommendedTrack = 'מנייתי / מסלול מניות';
      recommendedStocks = '80-100% מניות';
      riskLevel = 'טווח ארוך';
    }

    const isOffTrack = requiredMonthly > goal.monthlyContribution * 1.5 && remaining > 0;

    let description = `${riskLevel} (${yearsLeft.toFixed(1)} שנים) | התקדמות: ${progress.toFixed(0)}%`;
    if (isOffTrack) {
      description += ` | נדרש ${Math.ceil(requiredMonthly).toLocaleString()} ₪/חודש (כרגע ${goal.monthlyContribution.toLocaleString()} ₪)`;
    }
    description += ` | מסלול מומלץ: ${recommendedTrack} (${recommendedStocks})`;

    const actionItems: string[] = [];
    if (isOffTrack) {
      actionItems.push(`הגדל הפקדה חודשית ל-${Math.ceil(requiredMonthly).toLocaleString()} ₪, או הארך תאריך יעד, או התאם סכום`);
    }
    // Add unlinked-goal tip inline
    if ((!goal.linkedAssetIds || goal.linkedAssetIds.length === 0) && goal.targetAmount > 10000) {
      actionItems.push('⚠️ אין נכס מקושר ליעד - קשר נכס רלוונטי או פתח חשבון חיסכון ייעודי');
    }
    actionItems.push(`מסלול השקעה מומלץ: ${recommendedTrack} - ${recommendedStocks}`);
    if (yearsLeft <= 2) {
      actionItems.push('טווח קצר - הימנע ממניות, העדף אג"ח ופיקדונות');
    } else if (yearsLeft <= 6) {
      actionItems.push('טווח בינוני - שלב 40-50% מניות עם אג"ח לגיוון');
    } else {
      actionItems.push('טווח ארוך - מסלול מנייתי ממקסם תשואה לאורך זמן');
    }
    actionItems.push('העדף מסלולי השקעה פאסיביים (עוקבי מדד) עם דמי ניהול נמוכים');

    recommendations.push({
      id: generateId(),
      title: `יעד "${goal.name}"`,
      description,
      category: isOffTrack ? 'savings' : 'investment',
      priority: isOffTrack ? goal.priority : 'medium',
      source: 'rules',
      actionItems,
      createdAt: now,
    });
  }

  // Mislaka investment track vs retirement horizon
  if (allMislakaProducts.length > 0 && profile.retirementAge) {
    for (const product of allMislakaProducts) {
      if (!product.investmentTrack || product.totalBalance === 0) continue;
      const track = product.investmentTrack.toLowerCase();
      const isStockTrack = track.includes('מניות') || track.includes('מנייתי') || track.includes('s&p') || track.includes('500');
      const isConservative = track.includes('שמרני') || track.includes('אג"ח') || track.includes('טווח קצר');

      if (yearsToRetirement < 5 && yearsToRetirement > 0 && isStockTrack && product.totalBalance > 50000) {
        recommendations.push({
          id: generateId(),
          title: `${product.providerName} - מסלול מנייתי קרוב לפרישה`,
          description: `${product.planName} (${product.totalBalance.toLocaleString()} ₪) במסלול "${product.investmentTrack}" - נותרו ${yearsToRetirement} שנים לפרישה.`,
          category: 'investment',
          priority: 'high',
          source: 'rules',
          actionItems: [
            'שקול מעבר למסלול מאוזן או שמרני קרוב לגיל הפרישה',
            'ב-5 השנים האחרונות לפרישה מומלץ להפחית חשיפה למניות',
            'התייעץ עם יועץ פנסיוני לגבי מעבר מסלול',
          ],
          createdAt: now,
        });
      }

      if (yearsToRetirement > 15 && isConservative && product.totalBalance > 20000) {
        recommendations.push({
          id: generateId(),
          title: `${product.providerName} - מסלול שמרני עם טווח ארוך`,
          description: `${product.planName} (${product.totalBalance.toLocaleString()} ₪) במסלול "${product.investmentTrack}" - נותרו ${yearsToRetirement} שנים. מסלול מנייתי עשוי להניב תשואה גבוהה יותר.`,
          category: 'investment',
          priority: 'medium',
          source: 'rules',
          actionItems: [
            'שקול מעבר למסלול מנייתי או מסלול יעד לפרישה',
            'לטווח של 15+ שנים מסלול מניות מניב תשואה עודפת משמעותית',
            'מסלולי "יעד לפרישה" מתאימים את רמת הסיכון אוטומטית עם השנים',
          ],
          createdAt: now,
        });
      }
    }
  }

  // ==================================================================
  // SECTION 4: LIABILITY RULES
  // ==================================================================

  const totalLiabilities = liabilities.reduce((sum, l) => sum + l.currentBalance, 0);
  const totalMonthlyDebt = liabilities.reduce((sum, l) => sum + l.monthlyPayment, 0);

  // High interest debt
  for (const l of liabilities) {
    if (l.interestRate > 6) {
      recommendations.push({
        id: generateId(),
        title: `חוב בריבית גבוהה - ${l.name}`,
        description: `ל-${l.name} ריבית של ${l.interestRate}% עם יתרה של ${l.currentBalance.toLocaleString()} ₪. מומלץ לפרוע חוב זה בהקדם.`,
        category: 'general',
        priority: 'high',
        source: 'rules',
        actionItems: [
          'שקול לרכז הלוואות (מיחזור) בריבית נמוכה יותר',
          'הפנה עודפים חודשיים לפירעון מוקדם',
          'בדוק אפשרות להמרה למסלול ריבית קבועה',
        ],
        createdAt: now,
      });
    }
  }

  // Debt-to-income ratio
  if (profile.monthlyIncome > 0 && totalMonthlyDebt > 0) {
    const dtiRatio = (totalMonthlyDebt / profile.monthlyIncome) * 100;
    if (dtiRatio > 40) {
      recommendations.push({
        id: generateId(),
        title: 'יחס חוב להכנסה גבוה',
        description: `${dtiRatio.toFixed(0)}% מההכנסה שלך הולכת להחזרי חובות (${totalMonthlyDebt.toLocaleString()} ₪/חודש). מומלץ לא לעבור 40%.`,
        category: 'general',
        priority: 'high',
        source: 'rules',
        actionItems: [
          'מפה את כל ההתחייבויות ותעדף פירעון לפי ריבית',
          'שקול מיחזור משכנתא להפחתת ההחזר החודשי',
          'הימנע מלקיחת הלוואות נוספות',
        ],
        createdAt: now,
      });
    }
  }

  // Mortgage review from liabilities
  const mortgageLiabilities = liabilities.filter(l => l.category === 'mortgage');
  for (const m of mortgageLiabilities) {
    const marketRate = m.name.includes('צמודה') ? 3.5 : 4.8;
    if (m.interestRate > marketRate + 0.3) {
      recommendations.push({
        id: generateId(),
        title: `מיחזור משכנתא - ${m.name}`,
        description: `ריבית המשכנתא (${m.interestRate}%) גבוהה מממוצע השוק (${marketRate}%). שקול מיחזור.`,
        category: 'general',
        priority: 'medium',
        source: 'rules',
        actionItems: [
          'קבל הצעות ממספר בנקים',
          'בדוק עלויות מיחזור (קנסות פירעון מוקדם)',
          'השווה בין מסלולי ריבית קבועה, משתנה ופריים',
        ],
        createdAt: now,
      });
    }
  }

  // Retirement Goals Gap Analysis
  if (retirementGoals && mislakaReports && mislakaReports.length > 0) {
    const allProducts = mislakaReports.flatMap(r => r.products);
    const projectedPension = allProducts.reduce((s, p) => s + (p.monthlyPensionEstimate || 0), 0);
    const projectedLumpSum = allProducts.filter(p => !p.monthlyPensionEstimate).reduce((s, p) => s + (p.projectedRetirementBalance || 0), 0);

    if (retirementGoals.pensionTarget > 0 && projectedPension < retirementGoals.pensionTarget) {
      const gap = retirementGoals.pensionTarget - projectedPension;
      recommendations.push({
        id: generateId(),
        title: 'פער ביעד הקצבה החודשית',
        description: `יעד: ${retirementGoals.pensionTarget.toLocaleString()} ₪/חודש. צפי: ${Math.round(projectedPension).toLocaleString()} ₪/חודש. פער: ${Math.round(gap).toLocaleString()} ₪/חודש.`,
        category: 'pension',
        priority: gap > retirementGoals.pensionTarget * 0.3 ? 'high' : 'medium',
        source: 'rules',
        actionItems: [
          'הגדל את אחוזי ההפרשה לפנסיה',
          'בדוק אפשרות להפקדה עצמאית לקופת גמל',
          'שקול דחיית גיל הפרישה להגדלת הקצבה',
          'בדוק האם דמי הניהול אופטימליים',
        ],
        createdAt: now,
      });
    }

    if (retirementGoals.lumpSumTarget > 0 && projectedLumpSum < retirementGoals.lumpSumTarget) {
      const gap = retirementGoals.lumpSumTarget - projectedLumpSum;
      recommendations.push({
        id: generateId(),
        title: 'פער ביעד ההוני לפרישה',
        description: `יעד: ${retirementGoals.lumpSumTarget.toLocaleString()} ₪. צפי: ${Math.round(projectedLumpSum).toLocaleString()} ₪. פער: ${Math.round(gap).toLocaleString()} ₪.`,
        category: 'savings',
        priority: gap > retirementGoals.lumpSumTarget * 0.3 ? 'high' : 'medium',
        source: 'rules',
        actionItems: [
          'הגדל הפקדות לגמל להשקעה או קרן השתלמות',
          'שקול השקעות נוספות לטווח ארוך',
          'בדוק ניוד כספי פיצויים שאינם משמשים לקצבה',
          'בחן מסלולי השקעה מנייתיים לטווח ארוך',
        ],
        createdAt: now,
      });
    }
  }

  // ==================================================================
  // SECTION 5: TRANSACTION-BASED SPENDING ANALYSIS
  // ==================================================================

  if (hasTransactions) {
    // Rule: Declared vs actual expenses
    if (profile.monthlyExpenses > 0 && txTotalExpenses > 0) {
      const diff = txTotalExpenses - profile.monthlyExpenses;
      const diffPct = (diff / profile.monthlyExpenses) * 100;
      if (Math.abs(diffPct) > 20) {
        recommendations.push({
          id: generateId(),
          title: 'פער בין הוצאות מוצהרות לבפועל',
          description: diffPct > 0
            ? `הוצאות בפועל (${txTotalExpenses.toLocaleString()} ₪) גבוהות ב-${diffPct.toFixed(0)}% מהמוצהר בפרופיל (${profile.monthlyExpenses.toLocaleString()} ₪).`
            : `הוצאות בפועל (${txTotalExpenses.toLocaleString()} ₪) נמוכות ב-${Math.abs(diffPct).toFixed(0)}% מהמוצהר (${profile.monthlyExpenses.toLocaleString()} ₪). עדכן את הפרופיל.`,
          category: 'general',
          priority: diffPct > 30 ? 'high' : 'medium',
          source: 'rules',
          actionItems: [
            'עדכן את ההוצאות החודשיות בפרופיל לפי הנתונים בפועל',
            'הפער משפיע על חישוב שיעור החיסכון וקרן החירום',
            diffPct > 0 ? 'בדוק אילו הוצאות גדלו מעבר למצופה' : 'ייתכן שלא כל ההוצאות מופיעות בדוח הבנק (מזומן, כרטיסי אשראי אחרים)',
          ],
          createdAt: now,
        });
      }
    }

    // Rule: Spending category thresholds
    const thresholds: { cats: string[]; label: string; maxPct: number }[] = [
      { cats: ['דיור-משכנתא', 'דיור-שכירות', 'דיור-ועד-בית'], label: 'דיור', maxPct: 30 },
      { cats: ['מזון'], label: 'מזון', maxPct: 15 },
      { cats: ['רכב-דלק', 'רכב-אחזקה'], label: 'רכב', maxPct: 10 },
      { cats: ['תקשורת'], label: 'תקשורת', maxPct: 3 },
      { cats: ['בילוי-פנאי'], label: 'בילוי ופנאי', maxPct: 8 },
      { cats: ['ביגוד-קניות'], label: 'ביגוד וקניות', maxPct: 5 },
    ];

    if (txTotalIncome > 0) {
      for (const th of thresholds) {
        const catTotal = th.cats.reduce((s, c) => s + (txByCategory[c] || 0), 0);
        if (catTotal === 0) continue;
        const pct = (catTotal / txTotalIncome) * 100;
        if (pct > th.maxPct) {
          recommendations.push({
            id: generateId(),
            title: `הוצאות ${th.label} גבוהות`,
            description: `${th.label}: ${catTotal.toLocaleString()} ₪ (${pct.toFixed(0)}% מההכנסה). הנורמה המומלצת: עד ${th.maxPct}%.`,
            category: 'savings',
            priority: pct > th.maxPct * 1.5 ? 'high' : 'medium',
            source: 'rules',
            actionItems: [
              `בדוק את הפירוט בטאב תנועות בנק`,
              `חפש דרכים להפחית הוצאות ${th.label}`,
              `הנורמה המומלצת: עד ${th.maxPct}% מההכנסה`,
            ],
            createdAt: now,
          });
        }
      }
    }

    // Note: Credit card usage is fine as a payment method.
    // Installment purchases are the real issue - handled in credit card statement analysis below.

    // Rule: Actual savings rate from transactions
    if (txTotalIncome > 0) {
      const actualSavingsRate = ((txTotalIncome - txTotalExpenses) / txTotalIncome) * 100;
      if (actualSavingsRate < 20) {
        recommendations.push({
          id: generateId(),
          title: 'שיעור חיסכון בפועל נמוך',
          description: `לפי תנועות הבנק, שיעור החיסכון בפועל: ${actualSavingsRate.toFixed(0)}%. ${actualSavingsRate < 0 ? 'את/ה במינוס!' : 'מומלץ לפחות 20%.'}`,
          category: 'savings',
          priority: actualSavingsRate < 0 ? 'high' : actualSavingsRate < 10 ? 'high' : 'medium',
          source: 'rules',
          actionItems: [
            'בדוק את פירוט ההוצאות בטאב תנועות בנק',
            actualSavingsRate < 0 ? 'דחוף: ההוצאות גבוהות מההכנסות - צמצם הוצאות מיידית' : 'הגדר הוראת קבע אוטומטית לחיסכון בתחילת החודש',
            'העבר את החיסכון לחשבון נפרד כדי למנוע שימוש',
          ],
          createdAt: now,
        });
      }
    }

    // Rule: Recurring expenses review
    const expensePatterns: Record<string, { count: number; total: number }> = {};
    for (const t of allTransactions) {
      if (t.debit > 0 && (t.category === 'בילוי-פנאי' || t.category === 'ביגוד-קניות' || t.category === 'אחר')) {
        const key = t.action.trim();
        if (!key) continue;
        if (!expensePatterns[key]) expensePatterns[key] = { count: 0, total: 0 };
        expensePatterns[key].count++;
        expensePatterns[key].total += t.debit;
      }
    }
    const recurringItems = Object.entries(expensePatterns).filter(([, v]) => v.count >= 3).sort((a, b) => b[1].total - a[1].total);
    if (recurringItems.length > 0) {
      const top3 = recurringItems.slice(0, 3);
      recommendations.push({
        id: generateId(),
        title: 'הוצאות חוזרות לבחינה',
        description: `זוהו ${recurringItems.length} הוצאות חוזרות. למשל: ${top3.map(([k, v]) => `${k} (${v.count} פעמים, ${v.total.toLocaleString()} ₪)`).join(', ')}`,
        category: 'savings',
        priority: 'low',
        source: 'rules',
        actionItems: [
          'בדוק האם כל ההוצאות החוזרות הכרחיות',
          'שקול ביטול מנויים שלא בשימוש',
          'חפש חלופות זולות יותר',
        ],
        createdAt: now,
      });
    }
  }

  // ==================================================================
  // SECTION 6: CASH FLOW RULES
  // ==================================================================

  if (hasTransactions) {
    // Negative cash flow
    if (txTotalExpenses > txTotalIncome && txTotalIncome > 0) {
      recommendations.push({
        id: generateId(),
        title: 'תזרים מזומנים שלילי',
        description: `ההוצאות (${txTotalExpenses.toLocaleString()} ₪) גבוהות מההכנסות (${txTotalIncome.toLocaleString()} ₪) ב-${(txTotalExpenses - txTotalIncome).toLocaleString()} ₪. מצב לא בר-קיימא.`,
        category: 'general',
        priority: 'high',
        source: 'rules',
        actionItems: [
          'מפה את ההוצאות הגדולות ביותר וחפש מקום לחסוך',
          'בדוק האם יש הכנסות שלא הופיעו בתקופה זו',
          'שקול מקורות הכנסה נוספים',
          'הימנע ממימון הפער באשראי',
        ],
        createdAt: now,
      });
    }
  }

  // ==================================================================
  // SECTION 7: HOLISTIC DEBT MANAGEMENT
  // ==================================================================

  // Debt payoff sequencing (avalanche method)
  const activeDebts = liabilities.filter(l => l.currentBalance > 0 && l.interestRate > 0);
  if (activeDebts.length > 1) {
    const sorted = [...activeDebts].sort((a, b) => b.interestRate - a.interestRate);
    const totalInterestCost = sorted.reduce((s, l) => s + (l.currentBalance * l.interestRate / 100), 0);
    recommendations.push({
      id: generateId(),
      title: 'סדר עדיפויות לפירעון חובות',
      description: `יש לך ${activeDebts.length} חובות פעילים. עלות ריבית שנתית משוערת: ${Math.round(totalInterestCost).toLocaleString()} ₪. פירעון לפי ריבית (מהגבוהה) חוסך הכי הרבה.`,
      category: 'general',
      priority: 'medium',
      source: 'rules',
      actionItems: sorted.map((l, i) => `${i + 1}. ${l.name} - ריבית ${l.interestRate}%, יתרה ${l.currentBalance.toLocaleString()} ₪`),
      createdAt: now,
    });
  }

  // Debt-to-asset ratio
  if (totalLiabilities > 0 && (totalAssets + totalPension + mislakaTotal) > 0) {
    const dtaRatio = totalLiabilities / (totalAssets + totalPension + mislakaTotal);
    if (dtaRatio > 0.5) {
      recommendations.push({
        id: generateId(),
        title: 'יחס חוב לנכסים גבוה',
        description: `יחס חוב/נכסים: ${(dtaRatio * 100).toFixed(0)}%. החוב (${totalLiabilities.toLocaleString()} ₪) מהווה חלק משמעותי מהנכסים. מומלץ מתחת ל-50%.`,
        category: 'general',
        priority: dtaRatio > 0.7 ? 'high' : 'medium',
        source: 'rules',
        actionItems: [
          'תעדף פירעון חובות בריבית גבוהה',
          'הגדל את בסיס הנכסים דרך חיסכון והשקעה',
          'הימנע מלקיחת חובות נוספים עד שהיחס משתפר',
        ],
        createdAt: now,
      });
    }
  }

  // Mortgage sub-loan analysis from actual reports
  for (const report of mortgageReports) {
    for (const sl of report.subLoans) {
      if (sl.currentBalance <= 0 || sl.interestRate <= 0) continue;
      const isLinked = (sl.interestType || '').includes('צמוד');
      const marketRate = isLinked ? 3.5 : 4.8;
      if (sl.interestRate > marketRate + 0.3) {
        const monthlyOverpay = sl.monthlyPayment > 0 ? Math.round(sl.monthlyPayment * (sl.interestRate - marketRate) / sl.interestRate) : 0;
        recommendations.push({
          id: generateId(),
          title: `משכנתא ${report.bank} משנה ${sl.subLoanNumber} - ריבית גבוהה`,
          description: `ריבית ${sl.interestRate}% (שוק: ${marketRate}%) | יתרה: ${sl.currentBalance.toLocaleString()} ₪ | סוג: ${sl.interestType || 'לא ידוע'}${monthlyOverpay > 0 ? ` | תשלום עודף: ~${monthlyOverpay.toLocaleString()} ₪/חודש` : ''}`,
          category: 'general',
          priority: sl.interestRate > marketRate + 1 ? 'high' : 'medium',
          source: 'rules',
          actionItems: [
            `ריבית גבוהה ב-${(sl.interestRate - marketRate).toFixed(1)}% מהשוק`,
            'קבל הצעות ממספר בנקים למיחזור מסלול זה',
            'בדוק עלות פירעון מוקדם (קנס יציאה)',
            monthlyOverpay > 0 ? `חיסכון פוטנציאלי: ~${monthlyOverpay.toLocaleString()} ₪/חודש` : 'חשב חיסכון פוטנציאלי עם יועץ משכנתאות',
          ],
          createdAt: now,
        });
      }
    }
  }

  // ==================================================================
  // SECTION 8: GOAL-ASSET LINKAGE (funding adequacy only - unlinked merged into goal recs above)
  // ==================================================================

  for (const goal of goals) {
    if (goal.status !== 'active') continue;

    if (goal.linkedAssetIds && goal.linkedAssetIds.length > 0) {
      // Goal funding adequacy
      const linkedAssets = goal.linkedAssetIds.map(id => assets.find(a => a.id === id)).filter(Boolean);
      const linkedValue = linkedAssets.reduce((s, a) => s + (a?.value || 0), 0);
      const linkedContributions = linkedAssets.reduce((s, a) => s + (a?.monthlyContribution || 0), 0);
      const targetDate = new Date(goal.targetDate);
      const monthsLeft = Math.max(1, (targetDate.getTime() - Date.now()) / (30.44 * 24 * 60 * 60 * 1000));
      const totalFunding = linkedValue + (linkedContributions * monthsLeft);

      if (totalFunding < goal.targetAmount * 0.5 && monthsLeft < 36) {
        recommendations.push({
          id: generateId(),
          title: `מימון לא מספיק ליעד "${goal.name}"`,
          description: `צפי מימון: ${Math.round(totalFunding).toLocaleString()} ₪ (${(totalFunding / goal.targetAmount * 100).toFixed(0)}% מהיעד). חסרים ${Math.round(goal.targetAmount - totalFunding).toLocaleString()} ₪ בפחות מ-3 שנים.`,
          category: 'savings',
          priority: 'high',
          source: 'rules',
          actionItems: [
            `הגדל הפקדה חודשית לנכסים המקושרים`,
            `נדרשים עוד ~${Math.ceil((goal.targetAmount - totalFunding) / monthsLeft).toLocaleString()} ₪/חודש`,
            'שקול להאריך את תאריך היעד או להתאים את הסכום',
          ],
          createdAt: now,
        });
      }
    }
  }

  // ==================================================================
  // SECTION 9: FAMILY & LIFE STAGE RULES
  // ==================================================================

  // Children education fund
  const childrenAges = profile.childrenAges || [];
  for (const age of childrenAges) {
    if (typeof age !== 'number' || age < 0 || age > 18) continue;
    const yearsToUni = Math.max(0, 18 - age);
    if (yearsToUni <= 0) continue;
    const uniCost = 120000; // estimated 4-year university cost
    const monthlyNeeded = Math.ceil(uniCost / (yearsToUni * 12));

    recommendations.push({
      id: generateId(),
      title: `קרן חינוך לילד (גיל ${age})`,
      description: `${yearsToUni} שנים עד גיל 18. עלות אוניברסיטה משוערת: ${uniCost.toLocaleString()} ₪. נדרשת חיסכון של ${monthlyNeeded.toLocaleString()} ₪/חודש.`,
      category: 'savings',
      priority: yearsToUni <= 5 ? 'high' : yearsToUni <= 10 ? 'medium' : 'low',
      source: 'rules',
      actionItems: [
        `פתח קרן חיסכון לילד או קופת חיסכון לכל ילד`,
        `הפקד ${monthlyNeeded.toLocaleString()} ₪/חודש`,
        yearsToUni > 6 ? 'מסלול מנייתי מומלץ לטווח ארוך' : yearsToUni > 2 ? 'מסלול מאוזן מומלץ' : 'מסלול סולידי - הכסף נדרש בקרוב',
      ],
      createdAt: now,
    });
  }

  // Life insurance adequacy from mislaka
  if (allMislakaProducts.length > 0 && (profile.maritalStatus === 'married' || childrenAges.length > 0)) {
    const totalDeathCoverage = allMislakaProducts.reduce((s, p) => s + (p.deathCoverage || 0), 0);
    const recommendedCoverage = familyNetIncome * 12 * 10; // 10 years of income

    if (recommendedCoverage > 0 && totalDeathCoverage < recommendedCoverage * 0.5) {
      recommendations.push({
        id: generateId(),
        title: 'בדיקת כיסוי ביטוח חיים',
        description: `כיסוי נוכחי: ${totalDeathCoverage.toLocaleString()} ₪. מומלץ למשפחה: ${recommendedCoverage.toLocaleString()} ₪ (10 שנות הכנסה). ${totalDeathCoverage === 0 ? 'אין כיסוי כלל!' : `חסרים ${(recommendedCoverage - totalDeathCoverage).toLocaleString()} ₪.`}`,
        category: 'insurance',
        priority: totalDeathCoverage === 0 ? 'high' : 'medium',
        source: 'rules',
        actionItems: [
          'בדוק את הכיסוי הביטוחי בפוליסות הפנסיה',
          'שקול ביטוח חיים ריזיקו נוסף - עלות נמוכה יחסית',
          'כיסוי מומלץ: 10 שנות הכנסה משפחתית',
          'השווה מחירים בין חברות ביטוח',
        ],
        createdAt: now,
      });
    }
  }

  // Disability coverage
  if (allMislakaProducts.length > 0 && profile.monthlyIncome > 0) {
    const totalDisabilityCoverage = allMislakaProducts.reduce((s, p) => s + (p.disabilityCoverage || 0), 0);
    const recommended = (profile.monthlyIncomeGross || profile.monthlyIncome * 1.3) * 0.75;

    if (totalDisabilityCoverage < recommended * 0.5) {
      recommendations.push({
        id: generateId(),
        title: 'כיסוי אובדן כושר עבודה',
        description: `כיסוי נוכחי: ${totalDisabilityCoverage.toLocaleString()} ₪/חודש. מומלץ: 75% מהשכר הברוטו (~${Math.round(recommended).toLocaleString()} ₪/חודש).`,
        category: 'insurance',
        priority: totalDisabilityCoverage === 0 ? 'high' : 'medium',
        source: 'rules',
        actionItems: [
          'בדוק כיסוי אובדן כושר עבודה בפוליסות הפנסיה',
          'וודא שהכיסוי מגן על 75% מהשכר הברוטו',
          'שים לב להגדרת "אובדן כושר" - עיסוקי עדיף על כללי',
          'השווה עלויות בין ביטוח דרך הפנסיה לביטוח פרטי',
        ],
        createdAt: now,
      });
    }
  }

  // Spouse pension gap
  if (profile.maritalStatus === 'married' && profile.spouseMonthlyIncomeNet && profile.spouseMonthlyIncomeNet > 0) {
    const spouseMislakaProducts = allMislakaProducts.filter(p => p.owner === 'spouse');
    if (spouseMislakaProducts.length === 0 && mislakaReports && mislakaReports.length > 0) {
      recommendations.push({
        id: generateId(),
        title: 'פער פנסיוני של בן/בת הזוג',
        description: `לבן/בת הזוג הכנסה של ${profile.spouseMonthlyIncomeNet.toLocaleString()} ₪ אך אין נתוני פנסיה. חשוב לוודא הפרשות מסודרות.`,
        category: 'pension',
        priority: 'high',
        source: 'rules',
        actionItems: [
          'העלה את דוח המסלקה של בן/בת הזוג',
          'וודא שהמעסיק מפריש כחוק',
          'בדוק התאמת מסלול השקעה לגיל הפרישה',
          'שקול הפקדה עצמאית לקופת גמל',
        ],
        createdAt: now,
      });
    }
  }

  // ==================================================================
  // SECTION 10: CROSS-MODULE INTEGRATION
  // ==================================================================

  // Insurance payment vs mislaka coverage
  if (hasTransactions && allMislakaProducts.length > 0) {
    const txInsurance = txByCategory['ביטוח'] || 0;
    const mislakaInsuranceProducts = allMislakaProducts.filter(p => p.productType === 'managers-insurance');
    if (txInsurance > 1000 && mislakaInsuranceProducts.length === 0) {
      recommendations.push({
        id: generateId(),
        title: 'בדיקת התאמה בין תשלומי ביטוח לכיסוי',
        description: `יש תשלומי ביטוח של ${txInsurance.toLocaleString()} ₪ בתנועות הבנק, אך לא נמצא ביטוח מנהלים במסלקה. ייתכנו כפלי ביטוח או פוליסות לא רלוונטיות.`,
        category: 'insurance',
        priority: 'medium',
        source: 'rules',
        actionItems: [
          'מפה את כל פוליסות הביטוח שלך',
          'בדוק כפלי כיסוי בין פוליסות שונות',
          'שקול לבטל פוליסות ישנות שהוחלפו',
          'התייעץ עם סוכן ביטוח לגבי אופטימיזציה',
        ],
        createdAt: now,
      });
    }
  }

  // Pension contributions vs actual salary
  if (hasTransactions) {
    const salaryIncome = txIncomeByCategory['הכנסה-משכורת'] || 0;
    const pensionPayments = txByCategory['חיסכון-פנסיה'] || 0;
    if (salaryIncome > 0 && pensionPayments > 0) {
      const expectedMinContrib = salaryIncome * 0.19; // 6.5% + 6.5% + 6%
      if (pensionPayments < expectedMinContrib * 0.7) {
        recommendations.push({
          id: generateId(),
          title: 'בדיקת הפרשות פנסיה מול שכר בפועל',
          description: `הפרשות פנסיה בפועל: ${pensionPayments.toLocaleString()} ₪. צפוי לפי שכר (${salaryIncome.toLocaleString()} ₪): ~${Math.round(expectedMinContrib).toLocaleString()} ₪ (19% סטטוטורי).`,
          category: 'pension',
          priority: 'high',
          source: 'rules',
          actionItems: [
            'בדוק שהמעסיק מפריש את מלוא הסכום הנדרש בחוק',
            'בדוק שההפרשה מחושבת על השכר הברוטו המלא',
            'ייתכן שחלק מההפרשות לא עוברות דרך חשבון הבנק (הפרשות מעסיק)',
            'שקול הגדלת ההפרשה מעבר למינימום',
          ],
          createdAt: now,
        });
      }
    }
  }

  // ==================================================================
  // SECTION 11: CREDIT CARD INSTALLMENT ANALYSIS
  // ==================================================================

  const creditCards = input.creditCards || [];
  const allCcTransactions = creditCards.flatMap(c => c.transactions);
  const installmentTxs = allCcTransactions.filter(t => t.isInstallment);

  if (installmentTxs.length > 0) {
    const totalInstallmentDebt = installmentTxs.reduce((s, t) => s + t.totalDealAmount, 0);
    const monthlyInstallmentCharge = installmentTxs.reduce((s, t) => s + t.amount, 0);
    const avgInstallments = installmentTxs.reduce((s, t) => s + t.installmentTotal, 0) / installmentTxs.length;

    // Main installment warning
    recommendations.push({
      id: generateId(),
      title: 'עסקאות בתשלומים - חוב נסתר',
      description: `${installmentTxs.length} עסקאות בתשלומים | חוב כולל: ${totalInstallmentDebt.toLocaleString()} ₪ | חיוב חודשי: ${monthlyInstallmentCharge.toLocaleString()} ₪ | ממוצע ${avgInstallments.toFixed(0)} תשלומים לעסקה.`,
      category: 'general',
      priority: totalInstallmentDebt > familyNetIncome * 2 ? 'high' : totalInstallmentDebt > familyNetIncome ? 'medium' : 'low',
      source: 'rules',
      actionItems: [
        'תשלומים מייצרים חוב שלא משתקף בתזרים השוטף',
        'כל עסקה בתשלומים היא למעשה הלוואה - גם אם "בלי ריבית"',
        'מומלץ לשלם באופן מלא ולא בתשלומים',
        `החוב הנסתר שלך: ${totalInstallmentDebt.toLocaleString()} ₪ - זה כסף שכבר הוצאת אבל עדיין לא שילמת`,
      ],
      createdAt: now,
    });

    // Large installment deals
    const largeDeal = installmentTxs
      .filter(t => t.totalDealAmount > 2000)
      .sort((a, b) => b.totalDealAmount - a.totalDealAmount);
    if (largeDeal.length > 0) {
      const top5 = largeDeal.slice(0, 5);
      recommendations.push({
        id: generateId(),
        title: 'עסקאות גדולות בתשלומים',
        description: `${largeDeal.length} עסקאות גדולות (מעל 2,000 ₪) בתשלומים. סה"כ: ${largeDeal.reduce((s, t) => s + t.totalDealAmount, 0).toLocaleString()} ₪.`,
        category: 'savings',
        priority: 'medium',
        source: 'rules',
        actionItems: top5.map(t =>
          `${t.businessName}: ${t.totalDealAmount.toLocaleString()} ₪ ב-${t.installmentTotal} תשלומים (${t.installmentCurrent}/${t.installmentTotal})`
        ),
        createdAt: now,
      });
    }

    // Installment-to-income ratio
    if (familyNetIncome > 0) {
      const instPct = (monthlyInstallmentCharge / familyNetIncome) * 100;
      if (instPct > 15) {
        recommendations.push({
          id: generateId(),
          title: 'חיוב תשלומים גבוה ביחס להכנסה',
          description: `${instPct.toFixed(0)}% מההכנסה (${monthlyInstallmentCharge.toLocaleString()} ₪/חודש) הולך לתשלומים. זה מצמצם את גמישות התקציב.`,
          category: 'general',
          priority: instPct > 25 ? 'high' : 'medium',
          source: 'rules',
          actionItems: [
            'הימנע מעסקאות חדשות בתשלומים עד שהמצב משתפר',
            'שקול לפרוע חלק מהתשלומים מוקדם',
            'הגדר כלל: אם אין כסף לשלם בפעם אחת - אל תקנה',
          ],
          createdAt: now,
        });
      }
    }
  }

  // Per-card summary
  for (const card of creditCards) {
    const cardInstallments = card.transactions.filter(t => t.isInstallment);
    if (cardInstallments.length > 0) {
      const ratio = cardInstallments.length / card.transactions.length;
      if (ratio > 0.3) {
        recommendations.push({
          id: generateId(),
          title: `ריבוי תשלומים - ${card.cardName} ****${card.cardNumber}`,
          description: `${(ratio * 100).toFixed(0)}% מהעסקאות בכרטיס הן בתשלומים (${cardInstallments.length} מתוך ${card.transactions.length}). דפוס התנהלות שמייצר חוב מצטבר.`,
          category: 'general',
          priority: ratio > 0.5 ? 'high' : 'medium',
          source: 'rules',
          actionItems: [
            'ריבוי עסקאות בתשלומים מעיד על רכישות מעבר ליכולת',
            'תשלומים "בלי ריבית" עדיין מייצרים חוב',
            'שנה הרגל: שלם רק בתשלום אחד (מיידי)',
          ],
          createdAt: now,
        });
      }
    }
  }

  return recommendations;
}
