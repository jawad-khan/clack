-- AlterTable: Add pin fields to DirectMessage
ALTER TABLE "DirectMessage" ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pinnedAt" TIMESTAMP(3),
ADD COLUMN     "pinnedBy" INTEGER;
