# Slawk Codebase Review Findings

## Critical (4)

### 1. Content-Disposition Header Injection
- **File:** `backend/src/routes/files.ts:263`
- **Issue:** `originalName` from client is unsanitized in the response header. A filename like `evil"; script.html` could inject malicious headers.
- **Fix:** Use the `content-disposition` library to sanitize the filename.

### 2. JWT Token in URL Query Params
- **Files:** `frontend/src/lib/api.ts:8-16`, `backend/src/routes/files.ts:237-239`
- **Issue:** Full JWT exposed in URLs for image/file downloads. Gets logged in browser history, server logs, proxies.
- **Fix:** Use short-lived, single-purpose download tokens instead of the full JWT.

### 3. `leave:channel` WebSocket Has No Validation
- **File:** `backend/src/websocket/index.ts:149-152`
- **Issue:** Unlike `join:channel`, the `leave:channel` and `dm:leave` events don't validate input with Zod.
- **Fix:** Apply the same `wsChannelIdSchema.safeParse()` pattern used in `join:channel`.

### 4. Race Condition in Channel Name Uniqueness
- **File:** `backend/src/routes/channels.ts:30-37`
- **Issue:** Check-then-create without a DB unique constraint. Two concurrent requests can create duplicate channels.
- **Fix:** Add `@@unique([name])` to the Channel model or catch P2002.

## High (6)

### 5. No Rate Limiting
- **File:** `backend/src/app.ts`
- **Issue:** No rate limiting on any endpoint — login, messages, search all unbounded.
- **Fix:** Add `express-rate-limit`.

### 6. N+1 Presence Broadcast
- **File:** `backend/src/websocket/index.ts:26-62`
- **Issue:** 3 queries per connect/disconnect, individual emits per user.
- **Fix:** Cache channel membership or batch presence updates.

### 7. Typing Indicators Hit DB Every Keystroke
- **File:** `backend/src/websocket/index.ts:314-341`
- **Issue:** Every `typing:start` and `typing:stop` event triggers a DB query for membership check.
- **Fix:** Cache membership checks per socket session.

### 8. Search Uses ILIKE Without Index
- **File:** `backend/src/routes/search.ts:42-45`
- **Issue:** `contains` with `insensitive` generates `ILIKE '%query%'` — sequential scan.
- **Fix:** Add GIN trigram index or switch to PostgreSQL full-text search.

### 9. No Unique Constraint on `Channel.name`
- **File:** `backend/prisma/schema.prisma`
- **Issue:** The Channel model has no `@unique` on `name`.
- **Fix:** Add `@@unique([name])` to the Channel model.

### 10. No Cascading Deletes for Channel-Related Data
- **File:** `backend/prisma/schema.prisma`
- **Issue:** If a channel were deleted, related records would be orphaned or cause FK errors.
- **Fix:** Add `onDelete: Cascade` to channel-related relations.

## Medium (8)

### 11. DM Duplicate Events
- **File:** `backend/src/websocket/index.ts:430-435`
- **Issue:** Messages emitted to both user rooms AND DM room, causing duplicates when user is in both.
- **Fix:** Only emit to DM room when joined, or deduplicate.

### 12. Real-Time DM Messages Not Added to Store
- **Files:** `frontend/src/App.tsx:134-139`, `frontend/src/stores/useDMStore.ts`
- **Issue:** `dm:new` only updates sidebar, not the active conversation view (functional bug).
- **Fix:** Also update `useDMStore.messages` in `handleNewDM`.

### 13. Optimistic Reaction Parses JWT Manually
- **File:** `frontend/src/stores/useMessageStore.ts:261-270`
- **Issue:** Manually decodes JWT instead of using `useAuthStore`.
- **Fix:** Use `useAuthStore.getState().user?.id`.

### 14. `AuthRequest` Types Use `any`
- **File:** `backend/src/types.ts:11-13`
- **Issue:** `message`, `file`, `dm` typed as `any` — no type safety.
- **Fix:** Use Prisma-generated types.

### 15. Fragile Pagination Logic
- **File:** `backend/src/utils/pagination.ts:14`
- **Issue:** `slice(0, -1)` is fragile, should use `slice(0, limit)`.
- **Fix:** Replace with explicit `items.slice(0, limit)`.

### 16. Audio MIME Types Not in Allowed Magic Bytes
- **File:** `backend/src/routes/files.ts:101-119`
- **Issue:** `audio/webm` and `audio/ogg` not in `allowedMimesByMagic` — voice recordings may be rejected.
- **Fix:** Add audio mime types to the allowed set.

### 17. CORS `*` in Dev
- **File:** `backend/src/app.ts:36`
- **Issue:** `origin: '*'` in development. Ensure `CORS_ORIGIN` is set in production.

### 18. `ChannelRead.lastReadMessageId` Not a Foreign Key
- **File:** `backend/prisma/schema.prisma:151`
- **Issue:** Plain `Int?` with no relation to Message. Can reference deleted messages.

## Low (6)

### 19. Dead `badge` Property in Sidebar
- **File:** `frontend/src/components/Sidebar/Sidebar.tsx:172`

### 20. Inconsistent Zod Error Handling
- Various route files

### 21. Missing `useCallback` Dependencies
- **File:** `frontend/src/components/Messages/MessageInput.tsx:121`

### 22. Link Rendering Safe (no action needed)

### 23. No Pagination on DM Conversations List
- **File:** `backend/src/routes/dms.ts:65`

### 24. Timer Cleanup Correct (no action needed)

---

## Progress Tracker

- [ ] Fix #1: Content-Disposition Header Injection
- [ ] Fix #2: JWT Token in URL Query Params
- [ ] Fix #3: WebSocket leave validation
- [ ] Fix #4 + #9: Channel name unique constraint
- [ ] Fix #5: Rate limiting
- [ ] Fix #6: Presence broadcast optimization
- [ ] Fix #7: Typing indicator caching
- [ ] Fix #8: Search indexing
- [ ] Fix #10: Cascading deletes
- [ ] Fix #11: DM duplicate events
- [ ] Fix #12: Real-time DM store update
- [ ] Fix #13: Remove manual JWT parsing
- [ ] Fix #14: AuthRequest types
- [ ] Fix #15: Pagination logic
- [ ] Fix #16: Audio MIME types
- [ ] Fix #17: CORS production check
- [ ] Fix #18: ChannelRead FK
