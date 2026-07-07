# MW-POS Architecture

## Overview

MW-POS is a multi-tenant B2B distribution and POS platform. A central distributor lists products, customer stores order stock, manage inventory, and sell through POS.

## System Design

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js App Router                      │
├─────────────────────────────────────────────────────────────┤
│  Client Layer                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ Superadmin│ │  Admin   │ │ Manager  │ │  Storefront  │  │
│  │ Dashboard │ │Dashboard │ │Dashboard │ │   + POS      │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  Middleware: Session verification + Role-based routing      │
├─────────────────────────────────────────────────────────────┤
│  API Layer                                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Route Handlers / Server Actions                      │   │
│  │ Auth │ Users │ Stores │ Orders │ Inventory │ POS │ Reports │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  Service Layer                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Inventory │ Orders │ POS │ Audit │ Users │ Stores   │   │
│  │ (RTDB transactions, idempotency, ledger)             │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  Firebase Admin SDK (Server)                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Auth │ RTDB │ Custom Claims │ Emulator               │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  Firebase RTDB (Data Layer)                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Users │ Stores │ Products │ Inventory │ Orders │ ... │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Authentication Flow

1. User enters email/phone → POST `/api/auth/request-otp`
2. Server generates 6-digit OTP, stores hashed in RTDB `otpChallenges`
3. OTP provider sends code (mock/email/vobiz)
4. User enters code → POST `/api/auth/verify-otp`
5. Server verifies hash, finds/creates user, mints Firebase custom token
6. Client signs in with Firebase custom token
7. Server creates HttpOnly session cookie with JWE
8. All subsequent requests authenticated via session cookie

## Inventory Architecture

- **Materialized balances** at `inventoryBalances/{storeId}/{skuId}` for fast reads
- **Immutable ledger** at `inventoryLedger/{storeId}/{movementId}` for audit
- **Indexed movements** at `inventoryMovementsBySku/{storeId}/{skuId}/{movementId}`
- All stock changes use RTDB transactions on the balance node
- `onHand`, `reserved`, `available = onHand - reserved` maintained atomically
- Idempotency keys prevent double-processing

## Order Flow

```
Customer submits    Admin approves    Stock reserved    Pick/Pack/Ship    Delivered
     │                   │                 │                │               │
  DRAFT ──────────► SUBMITTED ──────► APPROVED ────► ALLOCATED ───► PICKING ──┐
                                                                              │
  ┌──────────────────────────────────────────────────────────────────────────┘
  │
  ├──► PACKED ──► SHIPPED ──► DELIVERED
  │                      
  └──► CANCELLED (any point before SHIPPED)
  └──► REJECTED (at SUBMITTED state)
```

## Data Integrity

- All monetary values in integer paise
- Server-verified pricing (client prices ignored)
- RTDB transactions prevent race conditions
- Idempotency keys on all mutations
- Immutable audit logs for sensitive operations
- Stock can never go negative
