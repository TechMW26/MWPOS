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

1. User enters an E.164 phone number on `/login`
2. For the configured superadmin phone only, the UI reveals a password field and `/api/auth/superadmin-password` validates the server-only secret and provisioned `SUPERADMIN` role
3. For every other phone, Firebase's web SDK completes invisible reCAPTCHA and sends the SMS OTP
4. The user confirms the code with Firebase Phone Auth
5. The client sends the resulting Firebase ID token to `/api/auth/firebase-phone`
6. Firebase Admin verifies the token and requires the `phone` sign-in provider
7. The backend finds or creates the RTDB user by normalized phone number
8. The backend creates the existing signed HttpOnly application session cookie
9. All subsequent application requests use that role-scoped session

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
