# MW-POS — Multi-Tenant Distribution POS Platform

A production-grade, multi-tenant B2B distribution and POS system built with Next.js, Firebase RTDB, and TypeScript.

## Architecture

- **Framework:** Next.js 15 (App Router) with TypeScript strict mode
- **Database:** Firebase Realtime Database (denormalized, query-optimized)
- **Authentication:** Email/Phone OTP → Firebase Custom Token → HttpOnly Session Cookie
- **UI:** Tailwind CSS, shadcn/ui, Lucide icons
- **Validation:** Zod, React Hook Form
- **Testing:** Vitest, Firebase Emulator Suite

## Roles

| Role | Description |
|------|-------------|
| SUPERADMIN | Full system access, manages admins, settings, approvals |
| ADMIN | Global operations, creates stores, manages catalog/inventory/orders |
| STORE_MANAGER | Assigned-store access, can create customer stores when approved |
| CUSTOMER | Customer store user — orders stock, manages inventory, POS |

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

# 3. Start Firebase emulators (optional, for local dev)
npx firebase emulators:start --project demo-mxpos

# 4. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

See `.env.example` for all required variables. Key ones:

- `OTP_PROVIDER=mock` — Use mock OTP for development (codes are logged to console)
- `OTP_PROVIDER=email` — Send real emails via SMTP
- `OTP_PROVIDER=vobiz` — Vobiz adapter (requires VOBIZ_API_KEY/VOBIZ_API_URL)

### Seeding Demo Data

```bash
npm run seed
```

This creates:
- 4 users (superadmin, admin, manager, customer)
- 2 stores (1 distribution, 1 customer)
- 4 products with SKUs
- Inventory balances
- Store catalog and memberships

### Mock OTP Mode

When `OTP_PROVIDER=mock`, OTP codes are printed to the server console. Use any 6-digit code to log in with the seeded emails.

### Email OTP

Set `OTP_PROVIDER=email` and configure SMTP:

```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-user
SMTP_PASS=your-pass
SMTP_FROM=noreply@mxpos.app
```

### Vobiz OTP

The Vobiz adapter is disabled by default. When you have a confirmed generic OTP API contract:

1. Set `OTP_PROVIDER=vobiz`
2. Set `VOBIZ_API_KEY` and `VOBIZ_API_URL`
3. Update the `VobizOtpProvider` implementation in `src/lib/auth/otp-provider.ts`

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login, OTP verify pages
│   ├── (superadmin)/    # Superadmin dashboard & pages
│   ├── (admin)/         # Admin dashboard & pages
│   ├── (manager)/       # Store manager dashboard & pages
│   ├── (storefront)/    # Customer storefront & POS
│   └── api/auth/        # Auth API routes
├── lib/
│   ├── auth/            # OTP providers, session, authorization
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
