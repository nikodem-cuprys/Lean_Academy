-- AlterTable
ALTER TABLE "Challenge" ADD COLUMN     "slug" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Challenge_slug_startsAt_key" ON "Challenge"("slug", "startsAt");
