/*
  Warnings:

  - You are about to drop the column `issuer` on the `account` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "account_issuer_accountId_key";

-- AlterTable
ALTER TABLE "account" DROP COLUMN "issuer";

-- AlterTable
ALTER TABLE "session" ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "userAgent" TEXT;
