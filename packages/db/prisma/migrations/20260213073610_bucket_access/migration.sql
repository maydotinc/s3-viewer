-- AlterTable
ALTER TABLE "server" ADD COLUMN     "allowedBuckets" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "bucket_access" (
    "id" TEXT NOT NULL,
    "bucketName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,

    CONSTRAINT "bucket_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation_bucket_access" (
    "id" TEXT NOT NULL,
    "bucketName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "invitationId" TEXT NOT NULL,

    CONSTRAINT "invitation_bucket_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bucket_access_userId_serverId_idx" ON "bucket_access"("userId", "serverId");

-- CreateIndex
CREATE INDEX "bucket_access_serverId_idx" ON "bucket_access"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "bucket_access_userId_serverId_bucketName_key" ON "bucket_access"("userId", "serverId", "bucketName");

-- CreateIndex
CREATE INDEX "invitation_bucket_access_invitationId_idx" ON "invitation_bucket_access"("invitationId");

-- CreateIndex
CREATE UNIQUE INDEX "invitation_bucket_access_invitationId_bucketName_key" ON "invitation_bucket_access"("invitationId", "bucketName");

-- AddForeignKey
ALTER TABLE "bucket_access" ADD CONSTRAINT "bucket_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bucket_access" ADD CONSTRAINT "bucket_access_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_bucket_access" ADD CONSTRAINT "invitation_bucket_access_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "pending_invitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
