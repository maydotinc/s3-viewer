# S3Viewer 🪣

A web-based S3-compatible object storage browser that allows users to manage multiple S3 servers through a modern interface, enabling basic operations on objects with the familiarity of a traditional file explorer.

<img src="./apps/landing/public/landing/bucketview.png" alt="Viewer image" width="100%">

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
- **Local dev URLs**: [Portless](https://portless.sh)
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

### 2. Local HTTPS via Portless

Dev URLs are stable HTTPS hostnames via [Portless](https://portless.sh):

- Web → `https://web.localhost`
- Landing → `https://landing.localhost`
- API → `https://api.localhost`

Run once on a fresh machine:

```bash
pnpm bootstrap
```

This installs `portless` globally, trusts its local CA, and starts the proxy on port 443 (one `sudo` prompt). Everything stays on `127.0.0.1`.

If you can't / don't want to use sudo, run `portless proxy start --https` instead — it binds to `:1355`. You'll then need to append `:1355` to every URL in your `.env` files and to the GitHub OAuth callback.

### 3. Generate Encryption Keys

For server credential encryption, an RSA key pair must be generated and stored in the respective env variables (see below). Use at least a 4096-bit key:

```bash
openssl genrsa -out private_key.pem 4096
openssl rsa -pubout -in private_key.pem -out public_key.pem
```

### 4. Environment Variables

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp apps/landing/.env.example apps/landing/.env
```

Fill in secrets, then register your GitHub OAuth app at https://github.com/settings/developers with this **Authorization callback URL**:

```
https://api.localhost/auth/callback/github
```

### 5. Database Setup (Careful, this could wipe all existing data)

```bash
cd packages/db
pnpm db:migrate
```

### 6. Development

```bash
pnpm dev
```

## Adding UI Components

```bash
cd packages/ui
pnpm dlx shadcn@latest add [component]
```
