-- CreateTable
CREATE TABLE "AdvancedRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "trialCount" INTEGER NOT NULL,
    "correctCount" INTEGER NOT NULL,
    "startLevel" INTEGER NOT NULL,
    "endLevel" INTEGER NOT NULL,
    "summary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvancedRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdvancedRun_userId_createdAt_idx" ON "AdvancedRun"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "AdvancedRun" ADD CONSTRAINT "AdvancedRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
