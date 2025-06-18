# S3Viewer

## Package manager and Shadcn

This project uses pnpm as its package manger and shadcn components for modularity.
To add other shadcn components: cd packages/ui && pnpm dlx shadcn@latest add [component]

### DEV ENV

**apps/api .env**

```
BETTER_AUTH_SECRET=(Generate from better-auth.com, used for encryption and generating hashes)

AWS_ENDPOINT=your_endpoint
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_REGION=us-east-1
```

**apps/web .env**

```
NEXT_PUBLIC_API_URL=http://localhost:5001
```

**packages/db .env**

```
DATABASE_URL="postgresql..."
```
