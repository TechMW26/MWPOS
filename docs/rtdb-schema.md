# RTDB Schema

All monetary values in integer **paise** (1 INR = 100 paise).
All timestamps in ISO 8601 UTC strings.

## Root Paths

```
/users/{uid}
  email, phone, displayName, role, approvalStatus, isActive, createdAt, updatedAt

/userStoreMemberships/{uid}/{storeId}
  uid, storeId, role, joinedAt

/stores/{storeId}
  name, type (DISTRIBUTION|CUSTOMER), address, city, state, pincode, phone,
  email, gstin, approvalStatus, isActive, createdBy, createdAt, updatedAt

/storeMembers/{storeId}/{uid}
  uid, storeId, role, joinedAt

/products/{productId}
  name, description, categoryId, brand, imageUrl, isActive, createdAt, updatedAt

/productSkus/{skuId}
  productId, sku, barcode, unit, mrp (paise), sellingPrice (paise), costPrice (paise),
  taxType (GST|VAT|NONE), taxRate (%), hsnCode, weightGrams, isActive, createdAt

/storeCatalog/{storeId}/{productId}
  productId, storeId, isAvailable, addedBy, addedAt

/priceLists/{priceListId}
  name, description, isActive, createdAt

/storePriceLists/{storeId}/{priceListId}
  assignedAt, assignedBy

/inventoryBalances/{storeId}/{skuId}
  onHand, reserved, available, reorderThreshold, reorderQuantity, lastCountedAt, updatedAt

/inventoryLedger/{storeId}/{movementId}
  movementId, skuId, movementType, quantity, onHandBefore, onHandAfter,
  reservedBefore, reservedAfter, referenceType, referenceId, idempotencyKey, performedBy, notes, createdAt

/inventoryMovementsBySku/{storeId}/{skuId}/{movementId}
  (same as ledger entry)

/carts/{uid}/{cartId}
  status, storeId, createdAt, updatedAt
  /items/{itemId}: skuId, productId, quantity, unitPrice, addedAt

/orders/{orderId}
  customerStoreId, sourceStoreId, customerId, status, subtotalPaise, taxPaise,
  discountPaise, totalPaise, notes, idempotencyKey, createdAt, updatedAt
  /items/{itemId}: skuId, productId, productName, sku, quantity,
    unitPricePaise, taxRate, taxPaise, discountPaise, totalPaise
  /statusHistory/{timestamp}: from, to, changedBy, changedAt, notes

/ordersByStore/{storeId}/{orderId}
  orderId, status, totalPaise, createdAt

/ordersByStatus/{status}/{orderId}
  orderId, storeId, createdAt

/fulfillments/{orderId}
  status, pickedBy, packedBy, shippedBy, trackingNumber, carrier,
  shippedAt, deliveredAt, createdAt, updatedAt

/stockReservations/{storeId}/{skuId}/{orderId}
  quantity, reservedAt, releasedAt

/registers/{storeId}/{registerId}
  name, isActive, createdAt

/registerSessions/{storeId}/{sessionId}
  registerId, openedBy, openingFloatPaise, expectedCashPaise,
  actualCashPaise, variancePaise, status, openedAt, closedAt, closedBy, notes

/sales/{saleId}
  storeId, registerSessionId, customerId, subtotalPaise, taxPaise,
  discountPaise, totalPaise, paymentMethod, paymentStatus, idempotencyKey, createdAt, createdBy
  /items/{itemId}: skuId, productId, productName, sku, quantity,
    unitPricePaise, taxRate, taxPaise, discountPaise, totalPaise

/salesByStore/{storeId}/{saleId}
  saleId, totalPaise, paymentMethod, createdAt

/returns/{returnId}
  saleId, storeId, totalPaise, reason, status, idempotencyKey, createdAt, createdBy
  /items/{skuId}: returnId, saleItemSkuId, quantity, refundPaise

/payments/{paymentId}
  saleId, orderId, amountPaise, method, status, reference, paidAt, customerId

/otpChallenges/{challengeId}
  destination, channel, hashedCode, attempts, maxAttempts, expiresAt, createdAt, verifiedAt, ipAddress

/idempotencyKeys/{scope}/{key}
  movementId | orderId | saleId, createdAt

/notifications/{uid}/{notificationId}
  title, body, type, read, link, createdAt

/auditLogs/{auditId}
  actorId, action, entityType, entityId, before, after, ipAddress, createdAt

/systemSettings
  appName, currency, defaultTaxRate, lowStockThreshold,
  otpExpiryMinutes, otpResendCooldownSeconds, maxOtpAttempts, enableAppCheck
```

## Indexes

```json
"users": { ".indexOn": ["email", "phone", "role", "approvalStatus"] }
"stores": { ".indexOn": ["type", "approvalStatus"] }
"products": { ".indexOn": ["categoryId", "isActive"] }
"productSkus": { ".indexOn": ["productId", "barcode"] }
"ordersByStore": { ".indexOn": ["status", "createdAt"] }
"ordersByStatus": { ".indexOn": ["createdAt"] }
"salesByStore": { ".indexOn": ["createdAt"] }
"notifications": { ".indexOn": ["read", "createdAt"] }
"auditLogs": { ".indexOn": ["actorId", "entityType", "entityId", "action", "createdAt"] }
```
