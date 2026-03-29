import type { UserProfile, Asset, Liability, PensionData, Goal, Recommendation, RetirementGoals, MislakaReport } from './types';
import { generateId } from './storage';

interface AnalysisInput {
  profile: UserProfile;
  assets: Asset[];
  liabilities: Liability[];
  pensionData: PensionData[];
  goals: Goal[];
  retirementGoals?: RetirementGoals | null;
  mislakaReports?: MislakaReport[];
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

  // Emergency Fund Check
  const emergencyFundTarget = profile.monthlyExpenses * 6;
  const savingsAssets = assets.filter(a => a.category === 'savings' || a.category === 'bank-account');
  const liquidSavings = savingsAssets.reduce((sum, a) => sum + a.value, 0);

  if (liquidSavings < emergencyFundTarget) {
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

  // Pension Check - check both old pensionData and new mislakaReports
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

  // Retirement Readiness - include mislaka data
  const mislakaTotal = (mislakaReports || []).flatMap(r => r.products).reduce((s, p) => s + (p.totalBalance || 0), 0);
  if (yearsToRetirement > 0 && yearsToRetirement < 20 && !retirementGoals) {
    // Only show generic readiness if no specific retirement goals set (those have their own gap analysis)
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

  // Goal-specific recommendations - ONE recommendation per goal combining all insights
  const allMislakaProducts = (mislakaReports || []).flatMap(r => r.products);

  for (const goal of goals) {
    if (goal.status !== 'active') continue;
    const targetDate = new Date(goal.targetDate);
    const yearsLeft = Math.max(0, (targetDate.getTime() - Date.now()) / (365.25 * 24 * 60 * 60 * 1000));
    const monthsLeft = Math.max(1, yearsLeft * 12);
    const remaining = goal.targetAmount - goal.currentAmount;
    const requiredMonthly = remaining / monthsLeft;
    const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;

    // Determine investment track by time horizon
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

    // Build description combining progress + investment advice
    let description = `${riskLevel} (${yearsLeft.toFixed(1)} שנים) | התקדמות: ${progress.toFixed(0)}%`;
    if (isOffTrack) {
      description += ` | נדרש ${Math.ceil(requiredMonthly).toLocaleString()} ₪/חודש (כרגע ${goal.monthlyContribution.toLocaleString()} ₪)`;
    }
    description += ` | מסלול מומלץ: ${recommendedTrack} (${recommendedStocks})`;

    // Build action items combining all advice
    const actionItems: string[] = [];
    if (isOffTrack) {
      actionItems.push(`הגדל הפקדה חודשית ל-${Math.ceil(requiredMonthly).toLocaleString()} ₪, או הארך תאריך יעד, או התאם סכום`);
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

  // Check Mislaka investment tracks vs retirement time horizon
  if (allMislakaProducts.length > 0 && profile.retirementAge) {
    for (const product of allMislakaProducts) {
      if (!product.investmentTrack || product.totalBalance === 0) continue;
      const track = product.investmentTrack.toLowerCase();
      const isStockTrack = track.includes('מניות') || track.includes('מנייתי') || track.includes('s&p') || track.includes('500');
      const isConservative = track.includes('שמרני') || track.includes('אג"ח') || track.includes('טווח קצר');

      // If close to retirement (< 5 years) and in aggressive track → warning
      if (yearsToRetirement < 5 && yearsToRetirement > 0 && isStockTrack && product.totalBalance > 50000) {
        recommendations.push({
          id: generateId(),
          title: `${product.providerName} - מסלול מנייתי קרוב לפרישה`,
          description: `${product.planName} (${product.totalBalance.toLocaleString()} ₪) במסלול "${product.investmentTrack}" - נותרו ${yearsToRetirement} שנים לפרישה. מומלץ לשקול מעבר למסלול שמרני יותר.`,
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

      // If far from retirement (> 15 years) and in conservative track → suggestion
      if (yearsToRetirement > 15 && isConservative && product.totalBalance > 20000) {
        recommendations.push({
          id: generateId(),
          title: `${product.providerName} - מסלול שמרני עם טווח ארוך`,
          description: `${product.planName} (${product.totalBalance.toLocaleString()} ₪) במסלול "${product.investmentTrack}" - נותרו ${yearsToRetirement} שנים לפרישה. מסלול מנייתי עשוי להניב תשואה גבוהה יותר לטווח ארוך.`,
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

  // ---- Liability Rules ----
  const totalLiabilities = liabilities.reduce((sum, l) => sum + l.currentBalance, 0);
  const totalMonthlyDebt = liabilities.reduce((sum, l) => sum + l.monthlyPayment, 0);

  // High interest debt warning
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

  // Mortgage review - only recommend if rate is ABOVE current market
  const mortgages = liabilities.filter(l => l.category === 'mortgage');
  for (const m of mortgages) {
    // Compare against market rate (~4.8% for non-linked, ~3.5% for linked)
    const marketRate = m.name.includes('צמודה') ? 3.5 : 4.8;
    if (m.interestRate > marketRate + 0.3) {
      recommendations.push({
        id: generateId(),
        title: `מיחזור משכנתא - ${m.name}`,
        description: `ריבית המשכנתא (${m.interestRate}%) גבוהה מממוצע השוק (${marketRate}%). שקול מיחזור להפחתת עלות המשכנתא.`,
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

  // ---- Retirement Goals Gap Analysis ----
  if (retirementGoals && mislakaReports && mislakaReports.length > 0) {
    const allProducts = mislakaReports.flatMap(r => r.products);
    const projectedPension = allProducts.reduce((s, p) => s + (p.monthlyPensionEstimate || 0), 0);
    const projectedLumpSum = allProducts.filter(p => !p.monthlyPensionEstimate).reduce((s, p) => s + (p.projectedRetirementBalance || 0), 0);

    // Pension gap
    if (retirementGoals.pensionTarget > 0 && projectedPension < retirementGoals.pensionTarget) {
      const gap = retirementGoals.pensionTarget - projectedPension;
      recommendations.push({
        id: generateId(),
        title: 'פער ביעד הקצבה החודשית',
        description: `יעד הקצבה שלך: ${retirementGoals.pensionTarget.toLocaleString()} ₪/חודש. צפי נוכחי: ${Math.round(projectedPension).toLocaleString()} ₪/חודש. פער: ${Math.round(gap).toLocaleString()} ₪/חודש.`,
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

    // Lump sum gap
    if (retirementGoals.lumpSumTarget > 0 && projectedLumpSum < retirementGoals.lumpSumTarget) {
      const gap = retirementGoals.lumpSumTarget - projectedLumpSum;
      recommendations.push({
        id: generateId(),
        title: 'פער ביעד ההוני לפרישה',
        description: `יעד הוני: ${retirementGoals.lumpSumTarget.toLocaleString()} ₪. צפי נוכחי: ${Math.round(projectedLumpSum).toLocaleString()} ₪. פער: ${Math.round(gap).toLocaleString()} ₪.`,
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

  return recommendations;
}
