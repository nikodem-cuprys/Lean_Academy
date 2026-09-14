-- CreateEnum
CREATE TYPE "XpReason" AS ENUM ('SESSION_COMPLETION', 'CONSISTENCY_BONUS', 'NEW_DOMAIN_BONUS', 'ACHIEVEMENT_BONUS');

-- CreateTable
CREATE TABLE "XpEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" "XpReason" NOT NULL,
    "trainingSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "XpEntry_userId_createdAt_idx" ON "XpEntry"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "XpEntry" ADD CONSTRAINT "XpEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpEntry" ADD CONSTRAINT "XpEntry_trainingSessionId_fkey" FOREIGN KEY ("trainingSessionId") REFERENCES "TrainingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
