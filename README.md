# S3Viewer 🪣

A web-based S3-compatible object storage browser that allows users to manage multiple S3 servers through a modern interface, enabling basic operations on objects with the familiarity of a traditional file explorer.

## 📝 Features

- Connect to multiple S3-compatible providers (AWS S3, Cloudflare R2, MinIO, etc.)
- Secure credential encryption and storage
- Server sharing and collaboration
- Multi-user support with role-based permissions
- File upload/download with progress tracking

## 🧬 Architecture

- **Frontend**: Next.js with shadcn/ui components
- **Backend**: Express.js API
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Better Auth
- **Monorepo**: Turborepo with pnpm workspaces

## ✅ Prerequisites

- Node.js 18+
- pnpm
- PostgreSQL database
- OpenSSL (for key generation)

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/maydotinc/s3-viewer
cd s3-viewer
pnpm install
```

### 2. Generate Encryption Keys

For server credential encryption, an RSA key pair must be generated and stored in the respective env variables (see below). This RSA key must also have a max payload large enough to handle server credentials, so it is recommended you use at least a 4096-bit key. To generate this key pair, you can use the openssl library:

```bash
openssl genrsa -out private_key.pem 4096
openssl rsa -pubout -in private_key.pem -out public_key.pem
```

### 3. Environment Variables

**apps/api/.env:**

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/s3viewer"
BETTER_AUTH_SECRET=your_secret_here
ENCRYPTION_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----..."
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_BACKEND_URL=http://localhost:5001
```

**apps/web/.env:**

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:5001
NEXT_PUBLIC_ENCRYPTION_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----..."
```

### 4. Database Setup

```bash
cd apps/api
pnpm run db:migrate
```

### 5. Development

```bash
pnpm dev
```

## Adding UI Components

```bash
cd packages/ui
pnpm dlx shadcn@latest add [component]
```
