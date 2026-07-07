# RBAC — Role-Based Access Control

## Roles

| Role | Access Level | Store Scope |
|------|-------------|-------------|
| SUPERADMIN | Full platform | All stores |
| ADMIN | Global operations | All stores |
| STORE_MANAGER | Assigned stores only | Membership-based |
| CUSTOMER | Own store only | Membership-based |

## Permission Matrix

| Permission | SUPERADMIN | ADMIN | STORE_MANAGER | CUSTOMER |
|-----------|-----------|-------|---------------|----------|
| Create admins | ✅ | ❌ | ❌ | ❌ |
| Approve store managers | ✅ | ❌ | ❌ | ❌ |
| Manage all users | ✅ | ❌ | ❌ | ❌ |
| Create customer stores | ✅ | ✅ | ✅ (if APPROVED) | ❌ |
| Manage catalog | ✅ | ✅ | ❌ | ❌ |
| View catalog | ✅ | ✅ | ✅ (assigned) | ✅ (own) |
| Manage inventory | ✅ | ✅ | ✅ (assigned) | ❌ |
| View inventory | ✅ | ✅ | ✅ (assigned) | ✅ (own) |
| Create orders | ✅ | ✅ | ✅ (assigned) | ✅ (own store) |
| Approve orders | ✅ | ✅ | ✅ (assigned) | ❌ |
| Fulfill orders | ✅ | ✅ | ✅ (assigned) | ❌ |
| POS operations | ✅ | ✅ | ✅ (assigned) | ✅ (own store) |
| View reports | ✅ | ✅ | ✅ (assigned) | ❌ |
| View audit logs | ✅ | ✅ | ❌ | ❌ |
| System settings | ✅ | ❌ | ❌ | ❌ |

## Enforcement Layers

1. **Middleware** — Route-level redirects based on session role
2. **Server-side authorization** — `requireRole()`, `requireStoreAccess()` checks in services
3. **RTDB Security Rules** — Path-level read/write restrictions
4. **UI guards** — Conditional rendering based on role (defense in depth)

## Store Manager Approval

- STORE_MANAGER users have an `approvalStatus` field
- Only SUPERADMIN can change `approvalStatus`
- PENDING managers can log in but have limited functionality
- Creating customer stores requires `approvalStatus === "APPROVED"`
- Custom claims include `approvalStatus` for RTDB rule checks

## Custom Claims

Firebase custom claims include:
- `role` — User role
- `approvalStatus` — Manager approval status
- `isActive` — Account status

Claims are refreshed after any role/status change and propagate on next token refresh.
