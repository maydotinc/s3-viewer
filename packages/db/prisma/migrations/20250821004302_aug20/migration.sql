/*
  Warnings:

  - You are about to drop the `Server` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ServerAccess` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('S3', 'R2', 'Other');

-- DropForeignKey
ALTER TABLE "Server" DROP CONSTRAINT "Server_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "ServerAccess" DROP CONSTRAINT "ServerAccess_serverId_fkey";

-- DropForeignKey
ALTER TABLE "ServerAccess" DROP CONSTRAINT "ServerAccess_userId_fkey";

-- DropTable
DROP TABLE "Server";

-- DropTable
DROP TABLE "ServerAccess";

-- CreateTable
CREATE TABLE "server" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" "Provider" NOT NULL DEFAULT 'Other',
    "credentials" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "server_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "server_access" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,

    CONSTRAINT "server_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_invitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "serverId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,

    CONSTRAINT "pending_invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "server_ownerId_idx" ON "server"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "server_ownerId_name_key" ON "server"("ownerId", "name");

-- CreateIndex
CREATE INDEX "server_access_userId_idx" ON "server_access"("userId");

-- CreateIndex
CREATE INDEX "server_access_serverId_idx" ON "server_access"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "server_access_userId_serverId_key" ON "server_access"("userId", "serverId");

-- CreateIndex
CREATE INDEX "pending_invitation_invitedById_idx" ON "pending_invitation"("invitedById");

-- CreateIndex
CREATE INDEX "pending_invitation_email_idx" ON "pending_invitation"("email");

-- CreateIndex
CREATE UNIQUE INDEX "pending_invitation_email_serverId_key" ON "pending_invitation"("email", "serverId");

-- AddForeignKey
ALTER TABLE "server" ADD CONSTRAINT "server_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_access" ADD CONSTRAINT "server_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_access" ADD CONSTRAINT "server_access_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_invitation" ADD CONSTRAINT "pending_invitation_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_invitation" ADD CONSTRAINT "pending_invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
