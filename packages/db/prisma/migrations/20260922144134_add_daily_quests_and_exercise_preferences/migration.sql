-- AlterEnum
ALTER TYPE "ChallengeType" ADD VALUE 'DAILY';

-- CreateTable
CREATE TABLE "ExercisePreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExercisePreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExercisePreference_userId_method_key" ON "ExercisePreference"("userId", "method");

-- AddForeignKey
ALTER TABLE "ExercisePreference" ADD CONSTRAINT "ExercisePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
