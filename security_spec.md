# MediFlow AI — Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Workspace Ownership Root**: Every `inventoryBatches`, `salesHistory`, `stockTransfers`, and `recommendations` document MUST reference an existing `/workspaces/{workspaceId}` whose `ownerId` matches `request.auth.uid`, and the document's own `ownerId` MUST match `request.auth.uid`.
2. **Email Verification Mandate**: All write operations (`create`, `update`, `delete`) require `request.auth != null && request.auth.token.email_verified == true`.
3. **Immutable Audit Anchors**: `ownerId`, `workspaceId`, and `createdAt` are strictly immutable after creation.
4. **Server-Enforced Temporal Integrity**: `createdAt` must equal `request.time` on creation; `updatedAt` must equal `request.time` on both creation and updates.
5. **PII Isolation**: User email addresses reside strictly inside `/users/{userId}/private/{docId}` with zero blanket reads and zero `list` access.
6. **Terminal State Locking**:
   - `stockTransfers` with `status` in `['completed', 'cancelled']` cannot transition to any other state.
   - `recommendations` with `status` in `['applied', 'dismissed']` cannot transition back to `'open'`.
7. **ID & Payload Bounds**: Every document ID path variable is validated against `^[a-zA-Z0-9_\-]+$` and max length 128; every string has explicit min/max length bounds; `fromHubId != toHubId` on stock transfers.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Cross-Tenant Read/List Scrape**: User B queries `inventoryBatches` without `where('ownerId', '==', uidB)` -> `PERMISSION_DENIED`.
2. **Identity Spoofing on Create**: User A creates an `inventoryBatch` with `ownerId: "user_B"` -> `PERMISSION_DENIED`.
3. **Orphaned Workspace Reference**: User A creates an `inventoryBatch` referencing a non-existent `workspaceId: "ws_fake"` -> `PERMISSION_DENIED`.
4. **Shadow Ghost Field Injection**: User A creates a `users/{uidA}` doc with extra field `isAdmin: true` -> `PERMISSION_DENIED`.
5. **Role Self-Escalation**: User A creates a `users/{uidA}` doc with `role: "super_admin"` -> `PERMISSION_DENIED`.
6. **Timestamp Forgery**: User A creates a `stockTransfer` with backdated `createdAt: Timestamp(2020-01-01)` -> `PERMISSION_DENIED`.
7. **ID Poisoning Attack**: User A attempts to write `/inventoryBatches/../../../etc/passwd` or a 500-char ID -> `PERMISSION_DENIED`.
8. **Value Poisoning on Update**: User A updates `inventoryBatches/{id}` setting `quantity: -500` or `quantity: "unlimited"` -> `PERMISSION_DENIED`.
9. **Terminal State Reversal**: User A updates a `stockTransfer` whose `status == 'completed'` back to `'in_transit'` -> `PERMISSION_DENIED`.
10. **PII Leak Attempt**: User B reads `/users/{uidA}/private/info` -> `PERMISSION_DENIED`.
11. **Unverified Email Bypass**: User with `email_verified: false` attempts to write to `workspaces` -> `PERMISSION_DENIED`.
12. **Same-Hub Transfer Loop**: User A creates a `stockTransfer` where `fromHubId == toHubId` -> `PERMISSION_DENIED`.
