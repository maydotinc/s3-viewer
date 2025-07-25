# S3Viewer

## Package manager and Shadcn

This project uses pnpm as its package manger and shadcn components for modularity.
To add other shadcn components: cd packages/ui && pnpm dlx shadcn@latest add [component]
For server credential encryption, an RSA key pair must be generated and stored in the respective env variables (see below). This RSA key must also have a max payload large enough to handle server credentials, so it is recommended you use at least a 4096-bit key. To generate this key pair, you can use the openssl library:

```
openssl genrsa -out private_key.pem 4096
openssl rsa -pubout -in private_key.pem -out public_key.pem
```

### ENV VARIABLES SETUP

**apps/api .env**

```
BETTER_AUTH_SECRET=(Generate from better-auth.com, used for encryption and generating hashes)
ENCRYPTION_PRIVATE_KEY=(openssl generated priv key)

AWS_ENDPOINT=your_endpoint
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=us-east-1
```

**apps/web .env**

```
NEXT_PUBLIC_API_URL=http://localhost:5001
NEXT_PUBLIC_ENCRYPTION_PUBLIC_KEY=(openssl generated pub key from priv key)
```

**packages/db .env**

```
DATABASE_URL="postgresql..."
```
