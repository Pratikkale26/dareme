/*
  Warnings:

  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `username` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[privyId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[walletAddress]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[xHandle]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[xId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `privyId` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DareStatus" AS ENUM ('CREATED', 'ACTIVE', 'PROOF_SUBMITTED', 'COMPLETED', 'EXPIRED', 'CANCELLED', 'REJECTED', 'REFUSED');

-- CreateEnum
CREATE TYPE "DareType" AS ENUM ('DIRECT_DARE', 'PUBLIC_BOUNTY');

-- CreateEnum
CREATE TYPE "WinnerSelection" AS ENUM ('CHALLENGER_SELECT', 'COMMUNITY_VOTE');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('VIDEO', 'IMAGE');

-- CreateEnum
CREATE TYPE "ProofStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('DARE_RECEIVED', 'DARE_ACCEPTED', 'DARE_REFUSED', 'PROOF_SUBMITTED', 'DARE_APPROVED', 'DARE_REJECTED', 'DARE_CANCELLED', 'DARE_EXPIRED', 'DARE_EXPIRING_SOON');

-- DropIndex
DROP INDEX "User_username_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "password",
DROP COLUMN "username",
ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "privyId" TEXT NOT NULL,
ADD COLUMN     "walletAddress" TEXT,
ADD COLUMN     "xHandle" TEXT,
ADD COLUMN     "xId" TEXT;

-- CreateTable
CREATE TABLE "Dare" (
    "id" TEXT NOT NULL,
    "onChainId" BIGINT NOT NULL,
    "darePDA" TEXT NOT NULL,
    "vaultPDA" TEXT NOT NULL,
    "challengerId" TEXT NOT NULL,
    "dareeId" TEXT,
    "targetXHandle" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "descriptionHash" TEXT NOT NULL,
    "category" TEXT,
    "tags" TEXT[],
    "amount" BIGINT NOT NULL,
    "dareType" "DareType" NOT NULL,
    "winnerSelection" "WinnerSelection" NOT NULL,
    "status" "DareStatus" NOT NULL DEFAULT 'CREATED',
    "deadline" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "refusedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proof" (
    "id" TEXT NOT NULL,
    "dareId" TEXT NOT NULL,
    "submitterId" TEXT NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "proofHash" TEXT NOT NULL,
    "caption" TEXT,
    "status" "ProofStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dareId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Dare_onChainId_key" ON "Dare"("onChainId");

-- CreateIndex
CREATE UNIQUE INDEX "Dare_darePDA_key" ON "Dare"("darePDA");

-- CreateIndex
CREATE INDEX "Dare_status_idx" ON "Dare"("status");

-- CreateIndex
CREATE INDEX "Dare_challengerId_idx" ON "Dare"("challengerId");

-- CreateIndex
CREATE INDEX "Dare_dareeId_idx" ON "Dare"("dareeId");

-- CreateIndex
CREATE INDEX "Dare_category_idx" ON "Dare"("category");

-- CreateIndex
CREATE INDEX "Dare_createdAt_idx" ON "Dare"("createdAt");

-- CreateIndex
CREATE INDEX "Proof_dareId_idx" ON "Proof"("dareId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_privyId_key" ON "User"("privyId");

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "User_xHandle_key" ON "User"("xHandle");

-- CreateIndex
CREATE UNIQUE INDEX "User_xId_key" ON "User"("xId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Dare" ADD CONSTRAINT "Dare_challengerId_fkey" FOREIGN KEY ("challengerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dare" ADD CONSTRAINT "Dare_dareeId_fkey" FOREIGN KEY ("dareeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proof" ADD CONSTRAINT "Proof_dareId_fkey" FOREIGN KEY ("dareId") REFERENCES "Dare"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proof" ADD CONSTRAINT "Proof_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_dareId_fkey" FOREIGN KEY ("dareId") REFERENCES "Dare"("id") ON DELETE SET NULL ON UPDATE CASCADE;
