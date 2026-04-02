-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "idNumber" TEXT,
    "gender" TEXT,
    "age" INTEGER,
    "maritalStatus" TEXT,
    "numberOfChildren" INTEGER,
    "childrenAges" INTEGER[],
    "employmentStatus" TEXT,
    "occupation" TEXT,
    "monthlyIncomeGross" DOUBLE PRECISION,
    "monthlyIncome" DOUBLE PRECISION,
    "monthlyExpenses" DOUBLE PRECISION,
    "spouseFirstName" TEXT,
    "spouseAge" INTEGER,
    "spouseEmploymentStatus" TEXT,
    "spouseMonthlyIncomeGross" DOUBLE PRECISION,
    "spouseMonthlyIncomeNet" DOUBLE PRECISION,
    "spouseRetirementAge" INTEGER,
    "retirementAge" INTEGER NOT NULL DEFAULT 67,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ILS',
    "monthlyContribution" DOUBLE PRECISION DEFAULT 0,
    "interestRate" DOUBLE PRECISION DEFAULT 0,
    "linkedGoalId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Liability" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "originalAmount" DOUBLE PRECISION NOT NULL,
    "currentBalance" DOUBLE PRECISION NOT NULL,
    "interestRate" DOUBLE PRECISION NOT NULL,
    "monthlyPayment" DOUBLE PRECISION NOT NULL,
    "lender" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "loanPurpose" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Liability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MortgageReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "borrowerName" TEXT,
    "reportDate" TEXT,
    "loanNumber" TEXT,
    "totalBalance" DOUBLE PRECISION,
    "totalPrincipal" DOUBLE PRECISION,
    "totalInterest" DOUBLE PRECISION,
    "bank" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MortgageReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MortgageSubLoan" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "subLoanNumber" TEXT,
    "loanNumber" TEXT,
    "originalAmount" DOUBLE PRECISION,
    "currentBalance" DOUBLE PRECISION,
    "interestRate" DOUBLE PRECISION,
    "interestType" TEXT,
    "monthlyPayment" DOUBLE PRECISION,
    "endDate" TEXT,

    CONSTRAINT "MortgageSubLoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MislakaReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "owner" TEXT,
    "ownerName" TEXT,
    "ownerId" TEXT,
    "importDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MislakaReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MislakaProduct" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "owner" TEXT,
    "productType" TEXT,
    "providerName" TEXT,
    "planName" TEXT,
    "policyNumber" TEXT,
    "status" TEXT,
    "totalBalance" DOUBLE PRECISION,
    "redemptionValue" DOUBLE PRECISION,
    "monthlyPensionEstimate" DOUBLE PRECISION,
    "projectedRetirementBalance" DOUBLE PRECISION,
    "employeeContributionPct" DOUBLE PRECISION,
    "employerContributionPct" DOUBLE PRECISION,
    "severanceContributionPct" DOUBLE PRECISION,
    "managementFeeDeposit" DOUBLE PRECISION,
    "managementFeeBalance" DOUBLE PRECISION,
    "investmentTrack" TEXT,
    "returnRate" DOUBLE PRECISION,
    "retirementAge" INTEGER,
    "joinDate" TEXT,
    "lastUpdate" TEXT,
    "deathCoverage" DOUBLE PRECISION,
    "disabilityCoverage" DOUBLE PRECISION,

    CONSTRAINT "MislakaProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PensionData" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT,
    "type" TEXT,
    "currentBalance" DOUBLE PRECISION,
    "monthlyEmployeeContribution" DOUBLE PRECISION,
    "monthlyEmployerContribution" DOUBLE PRECISION,
    "managementFeePercent" DOUBLE PRECISION,
    "investmentTrack" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PensionData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountNumber" TEXT,
    "bank" TEXT,
    "type" TEXT NOT NULL DEFAULT 'personal',
    "owner" TEXT,
    "period" TEXT,
    "importDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankTransaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "date" TEXT,
    "code" TEXT,
    "action" TEXT,
    "details" TEXT,
    "reference" TEXT,
    "debit" DOUBLE PRECISION DEFAULT 0,
    "credit" DOUBLE PRECISION DEFAULT 0,
    "balance" DOUBLE PRECISION DEFAULT 0,
    "category" TEXT,

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditCardStatement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardNumber" TEXT,
    "cardName" TEXT,
    "owner" TEXT,
    "period" TEXT,
    "totalCharged" DOUBLE PRECISION,
    "importDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditCardStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditCardTransaction" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "date" TEXT,
    "businessName" TEXT,
    "category" TEXT,
    "amount" DOUBLE PRECISION,
    "currency" TEXT DEFAULT 'ILS',
    "originalAmount" DOUBLE PRECISION,
    "originalCurrency" TEXT,
    "installmentCurrent" INTEGER DEFAULT 0,
    "installmentTotal" INTEGER DEFAULT 0,
    "totalDealAmount" DOUBLE PRECISION,
    "isInstallment" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CreditCardTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "template" TEXT,
    "targetAmount" DOUBLE PRECISION NOT NULL,
    "currentAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "targetDate" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'active',
    "monthlyContribution" DOUBLE PRECISION DEFAULT 0,
    "linkedAssetIds" TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetirementGoals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pensionTarget" DOUBLE PRECISION,
    "lumpSumTarget" DOUBLE PRECISION,

    CONSTRAINT "RetirementGoals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "category" TEXT,
    "priority" TEXT,
    "source" TEXT,
    "actionItems" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT,
    "description" TEXT,
    "amount" DOUBLE PRECISION,
    "type" TEXT,
    "category" TEXT,
    "source" TEXT,

    CONSTRAINT "FinancialRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadedFile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "fileType" TEXT,
    "size" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizLead" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "score" INTEGER,
    "heatScore" INTEGER,
    "proType" TEXT,
    "answers" JSONB,
    "assignedTo" TEXT,
    "status" TEXT DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Advisor" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "company" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "license" TEXT,
    "specialty" TEXT,
    "rating" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Advisor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE INDEX "Asset_userId_idx" ON "Asset"("userId");

-- CreateIndex
CREATE INDEX "Liability_userId_idx" ON "Liability"("userId");

-- CreateIndex
CREATE INDEX "MortgageReport_userId_idx" ON "MortgageReport"("userId");

-- CreateIndex
CREATE INDEX "MortgageSubLoan_reportId_idx" ON "MortgageSubLoan"("reportId");

-- CreateIndex
CREATE INDEX "MislakaReport_userId_idx" ON "MislakaReport"("userId");

-- CreateIndex
CREATE INDEX "MislakaProduct_reportId_idx" ON "MislakaProduct"("reportId");

-- CreateIndex
CREATE INDEX "PensionData_userId_idx" ON "PensionData"("userId");

-- CreateIndex
CREATE INDEX "BankAccount_userId_idx" ON "BankAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_userId_accountNumber_period_key" ON "BankAccount"("userId", "accountNumber", "period");

-- CreateIndex
CREATE INDEX "BankTransaction_accountId_idx" ON "BankTransaction"("accountId");

-- CreateIndex
CREATE INDEX "CreditCardStatement_userId_idx" ON "CreditCardStatement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditCardStatement_userId_cardNumber_period_key" ON "CreditCardStatement"("userId", "cardNumber", "period");

-- CreateIndex
CREATE INDEX "CreditCardTransaction_statementId_idx" ON "CreditCardTransaction"("statementId");

-- CreateIndex
CREATE INDEX "Goal_userId_idx" ON "Goal"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RetirementGoals_userId_key" ON "RetirementGoals"("userId");

-- CreateIndex
CREATE INDEX "Recommendation_userId_idx" ON "Recommendation"("userId");

-- CreateIndex
CREATE INDEX "FinancialRecord_userId_idx" ON "FinancialRecord"("userId");

-- CreateIndex
CREATE INDEX "UploadedFile_userId_idx" ON "UploadedFile"("userId");

-- AddForeignKey
ALTER TABLE "MortgageSubLoan" ADD CONSTRAINT "MortgageSubLoan_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "MortgageReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MislakaProduct" ADD CONSTRAINT "MislakaProduct_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "MislakaReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCardTransaction" ADD CONSTRAINT "CreditCardTransaction_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "CreditCardStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
