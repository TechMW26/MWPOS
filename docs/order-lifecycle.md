# Order Lifecycle

## Role-aware flow

### ASM places an order for a distributor

```text
PENDING_OTP -> OTP_VERIFIED or PENDING_CF_APPROVAL -> CF_APPROVED
            -> ALLOCATED -> PICKING -> PACKED -> SHIPPED -> DELIVERED
```

1. The server validates the ASM's territory, distributor, warehouse, SKU prices, quantities, and totals.
2. The distributor receives an in-app/push notification containing item quantities and the order total.
3. The linked distributor reviews the order and requests an SMS through Firebase Phone Authentication.
4. The server verifies the fresh Firebase ID token, phone provider, application user link, session phone, and distributor phone.
5. Pay-later orders enter the distributor's khata only after Firebase approval.
6. If an approved order's quantity changes before C&F approval, the old approval is cleared and a fresh distributor Firebase OTP is required.

No application-generated OTP, email OTP, WhatsApp OTP, or master OTP is accepted for order approval.

### Distributor places an order

Distributor-created orders start at `PENDING_CF_APPROVAL`. The authenticated distributor is the person placing the order, so a second OTP is not required.

### C&F places an order

C&F-created orders start at `PENDING_CF_APPROVAL` and are immediately passed through C&F approval. The assigned approved warehouse is always used; the API does not fall back to another C&F warehouse.

## State transitions

| From | Allowed next states |
| --- | --- |
| `DRAFT` | `PENDING_OTP`, `CANCELLED` |
| `PENDING_OTP` | `OTP_VERIFIED`, `CANCELLED`, `DRAFT` |
| `OTP_VERIFIED` | `PENDING_CF_APPROVAL`, `CF_APPROVED`, `CANCELLED` |
| `PENDING_CF_APPROVAL` | `CF_APPROVED`, `CF_REJECTED`, `CANCELLED` |
| `CF_APPROVED` | `ALLOCATED`, `CANCELLED` |
| `CF_REJECTED` | `DRAFT` |
| `ALLOCATED` | `PICKING`, `CANCELLED` |
| `PICKING` | `PACKED`, `CANCELLED` |
| `PACKED` | `SHIPPED`, `CANCELLED` |
| `SHIPPED` | `DELIVERED` |
| `DELIVERED`, `CANCELLED`, `REJECTED` | None |

## Inventory and accounting

| Event | Effect |
| --- | --- |
| C&F approval | Reserve stock in the assigned source warehouse |
| Shipment | Fulfil reserved stock from the source warehouse |
| Delivery | Receive stock at the distributor |
| Cancellation before shipment | Release reservations |
| Firebase approval of ASM pay-later order | Create the khata debit |

Every status change is written to the order history and audit log. Quantity edits include actor, reason, old and new quantities, old and new totals, and whether renewed distributor approval was required.
