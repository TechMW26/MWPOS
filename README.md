# MW-POS — Multi-Tenant Distribution POS Platform

A production-grade, multi-tenant B2B distribution and POS system built with Next.js, Firebase RTDB, and TypeScript.

## Architecture

- **Framework:** Next.js 15 (App Router) with TypeScript strict mode
- **Database:** Firebase Realtime Database (denormalized, query-optimized)
- **Authentication:** Firebase Phone OTP for users; configured superadmin phone/password → HttpOnly application session
- **UI:** Tailwind CSS, shadcn/ui, Lucide icons
- **Validation:** Zod, React Hook Form
- **Testing:** Vitest, Firebase Emulator Suite

## Roles

| Role | Description |
|------|-------------|
| SUPERADMIN | Full system access, manages admins, settings, approvals |
| ADMIN | Global operations, creates stores, manages catalog/inventory/orders |
| ASM | District-scoped distributor and order management |
| C_AND_F | Assigned ASM, approval, fulfillment, and inventory operations |
| DISTRIBUTOR | Own-business ordering, inventory, POS, and khata access |

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+
- Firebase project (or use emulators)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment variables
cp .env.example .env.local
# Edit .env.local with your Firebase credentials

# 3. Enable Firebase Authentication > Phone in the Firebase Console
# Add localhost and your deployed domain under Authorized domains

# 4. Start Firebase emulators (optional, for local dev)
npx firebase emulators:start --project demo-mxpos

# 5. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

See `.env.example` for all required variables. Firebase web configuration powers SMS verification and Firebase Admin credentials verify ID tokens on the backend.

### Seeding Demo Data

```bash
npm run seed
```

Set `SEED_SUPERADMIN_PHONE`, `NEXT_PUBLIC_SUPERADMIN_PHONE`, and the server-only `SUPERADMIN_PASSWORD` in `.env.local` first. The seed clears existing application data, then creates or reuses that Firebase Phone Auth identity and stores it as the initial superadmin.

### Firebase Phone OTP

Enable the **Phone** sign-in provider in Firebase Authentication. The browser uses Firebase's invisible reCAPTCHA and SMS verification; the backend accepts only Firebase ID tokens whose sign-in provider is `phone`.

The configured superadmin phone is the only exception: entering it reveals the password field and uses the server-only superadmin password endpoint. Other phone numbers never receive a password option.

For development without sending real SMS messages, configure Firebase Authentication test phone numbers in the Firebase Console. Do not disable app verification in production.

An environment-gated master OTP fallback is also available for controlled deployments. Set `ENABLE_MASTER_OTP=true` and a six-digit server-only `LOGIN_MASTER_OTP`. Keep it disabled for public production environments and rotate it immediately if exposed.

### Order approval OTPs

ASM-created orders use Firebase end to end. Firebase Cloud Messaging notifies the distributor with the order items, quantities, and total. From the order review page, the linked distributor requests a Firebase Phone Auth SMS and enters that code to approve the order. The backend accepts only a fresh Firebase phone ID token belonging to the same distributor session and registered phone number. Firebase Authentication does not support custom order text inside its verification SMS, so the complete summary remains visible in the push notification and approval screen.

### Email Notifications

SMTP remains optional for transactional order notifications:

```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-user
SMTP_PASS=your-pass
SMTP_FROM=noreply@mxpos.app
```

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Firebase phone login
│   ├── (superadmin)/    # Superadmin dashboard & pages
│   ├── (admin)/         # Admin dashboard & pages
│   ├── (manager)/       # Store manager dashboard & pages
│   ├── (storefront)/    # Customer storefront & POS
│   └── api/auth/        # Auth API routes
├── lib/
│   ├── auth/            # Phone normalization, session, authorization
│   ├── db/              # Firebase admin & client init
│   ├── services/        # Business logic (inventory, orders, POS, etc.)
│   ├── validation/      # Zod schemas
│   └── utils.ts         # Money, formatting, helpers
├── types/               # TypeScript type definitions
├── components/ui/       # shadcn-style UI components
└── middleware.ts         # Route protection & role redirects
```

## Running Tests

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Emulator tests (requires Firebase Emulators running)
npm run test:emulators
```

## Key Design Decisions

- **Integer paise for all money** — No floating-point rounding errors
- **RTDB transactions for inventory** — Atomic stock changes, never negative
- **Immutable ledger** — Every inventory change creates an audit trail
- **Server-verified pricing** — Never trust client-submitted prices
- **Idempotency keys** — All mutations are idempotent
- **HttpOnly session cookies** — No JWT in localStorage

## Deployment (Vercel)

1. Push to GitHub
2. Import to Vercel
3. Set all environment variables from `.env.example`
4. Deploy

## Documentation

- [Architecture](./docs/architecture.md)
- [RBAC](./docs/rbac.md)
- [RTDB Schema](./docs/rtdb-schema.md)
- [Order Lifecycle](./docs/order-lifecycle.md)
- [Deployment](./docs/deployment.md)
