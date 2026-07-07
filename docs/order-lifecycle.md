# Order Lifecycle

## Status Flow

```
DRAFT ──► SUBMITTED ──► APPROVED ──► ALLOCATED ──► PICKING ──► PACKED ──► SHIPPED ──► DELIVERED
  │           │            │            │            │           │
  └──► CANCELLED ◄─────────┴────────────┴────────────┴───────────┘
              │
  REJECTED ◄──┘
```

## Transitions

| From | To | Who | What Happens |
|------|----|-----|--------------|
| DRAFT | SUBMITTED | Customer | Order is placed |
| DRAFT | CANCELLED | Customer/Admin | Order cancelled |
| SUBMITTED | APPROVED | Admin/Manager | Order approved, inventory reserved |
| SUBMITTED | REJECTED | Admin/Manager | Order rejected |
| SUBMITTED | CANCELLED | Admin/Manager | Order cancelled |
| APPROVED | ALLOCATED | Admin | Stock allocated in warehouse |
| ALLOCATED | PICKING | Warehouse | Picking started |
| PICKING | PACKED | Warehouse | Items packed |
| PACKED | SHIPPED | Warehouse | Shipped with tracking |
| SHIPPED | DELIVERED | Admin/Manager | Received at customer store (+ inventory) |
| ANY (before SHIPPED) | CANCELLED | Admin/Manager | Reservations released |

## Terminal States

- **DELIVERED** — Successfully completed
- **CANCELLED** — Cancelled before shipping
- **REJECTED** — Rejected at submission

## Inventory Impact

| Transition | Inventory Effect |
|-----------|-----------------|
| SUBMITTED → APPROVED | Reserve stock in source store |
| PACKED → SHIPPED | Deduct from source store (fulfill) |
| SHIPPED → DELIVERED | Add to customer store (receive) |
| → CANCELLED | Release reservations |
| → REJECTED | Release reservations (if any) |

## Audit Trail

Every status transition writes:
- `orders/{orderId}/statusHistory/{timestamp}` — full transition record
- `auditLogs/{auditId}` — immutable audit entry
