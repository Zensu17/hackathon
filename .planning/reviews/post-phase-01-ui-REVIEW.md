---
phase: post-phase-01-ui
reviewed: 2026-11-24T01:49:17Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - src/app/router.tsx
  - src/presentation/components/AppLayout.tsx
  - src/presentation/components/ErrorBoundary.tsx
  - src/presentation/components/FigmaComponents.tsx
  - src/presentation/components/Icons.tsx
  - src/presentation/components/QuickSearchModal.tsx
  - src/presentation/components/StateViews.tsx
  - src/presentation/hooks/useAuthSession.ts
  - src/presentation/hooks/useHomeWorkspace.ts
  - src/presentation/hooks/useInstallPrompt.ts
  - src/presentation/hooks/useMaterialDetail.ts
  - src/presentation/hooks/useMaterialNote.ts
  - src/presentation/hooks/useNetworkStatus.ts
  - src/presentation/hooks/useRepForms.ts
  - src/presentation/hooks/useSyncStatus.ts
  - src/presentation/hooks/useTheme.ts
  - src/presentation/hooks/useUpcomingDeadlines.ts
  - src/presentation/hooks/useWorkspaceSearch.ts
  - src/presentation/i18n/labels.ts
  - src/presentation/pages/CourseDetailPage.tsx
  - src/presentation/pages/CoursesPage.tsx
  - src/presentation/pages/DeadlinesPage.tsx
  - src/presentation/pages/HomePage.tsx
  - src/presentation/pages/JoinClassPage.tsx
  - src/presentation/pages/MaterialDetailPage.tsx
  - src/presentation/pages/RepFormPage.tsx
  - src/presentation/pages/SettingsPage.tsx
  - src/presentation/pages/SignInPage.tsx
  - src/presentation/utils/formatters.ts
findings:
  critical: 4
  warning: 13
  info: 6
  total: 23
  necessity: 1
status: issues_found
---

# Post-Phase 01 UI: Code Review Report

**Reviewed:** 2026-11-24T01:49:17Z
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

## Summary

Reviewed all 29 presentation, router, hook, component, i18n, utility, and page files changed since commit `c4816da` at standard depth (with necessity assessment enabled via `necessity-review.md`).

**What passed verification:**
- **Clean Architecture import boundaries:** Verified clean across all `src/presentation/**` files — zero imports of `src/data`, `dexie`, or `@supabase/supabase-js`. All data access flows through `src/app/di`, `src/application/*`, and `src/domain/*`.
- **External `<a>` links & URL sanitization:** All rendered external `<a target="_blank">` links (`MaterialDetailPage.tsx:295-302, 433-442`) validate URLs through `isSafeHttpUrl` (strict `http:`/`https:` protocol + non-empty hostname) and include `rel="noopener noreferrer"`.
- **Object URL revocation:** All three `URL.createObjectURL` call sites schedule `URL.revokeObjectURL` after 60 seconds (no unbounded leak), though all three share two other concrete defects documented below (`CR-01` and `WR-01`).

**Key concerns requiring attention before shipping:**
1. **Same-origin XSS via unpinned Blob MIME type (`CR-01`)** when opening offline PDFs from IndexedDB.
2. **Data loss / cross-material corruption in `useMaterialNote` (`CR-02`)** during sequential Previous/Next material navigation and debounced auto-save.
3. **Remote attachment deletion on sync (`CR-03`)** when replacing a PDF in `RepFormPage` after toggling "Remove existing PDF attachment".
4. **Frozen sync UI and unhandled `retry()` rejections in `useSyncStatus` (`CR-04`)**, compounded by duplicated `useSyncStatus` instances between `AppLayout` and `SettingsPage` (`WR-04`).
5. **High-impact UX & accessibility bugs** across `window.open(..., 'noopener,noreferrer')` double-downloads (`WR-01`), `QuickSearchModal` keyboard hijacking/focus trapping (`WR-02`), missing async cancellation guards (`WR-03`), unhandled async UI rejections (`WR-06`), and broken ARIA contracts (`WR-08`).

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Same-origin XSS risk from unvalidated `stored.mimeType` in offline PDF `Blob` URLs

**Severity:** Critical (BLOCKER)
**File:** `src/presentation/pages/MaterialDetailPage.tsx:108-112` (duplicated in `src/presentation/pages/HomePage.tsx:149-153` and `src/presentation/pages/CourseDetailPage.tsx:108-112`)
**Issue:** All three offline PDF handlers create a same-origin `blob:` URL using `stored.mimeType || 'application/pdf'` and open it in a browser tab:
```ts
const pdfBlob = new Blob([bytesCopy], {
  type: stored.mimeType || 'application/pdf',
});
const blobUrl = URL.createObjectURL(pdfBlob);
const opened = window.open(blobUrl, '_blank', 'noopener,noreferrer');
```
In `src/data/repositories/HybridMaterialRepository.ts:340, 403, 427`, `stored.mimeType` is persisted directly from the remote HTTP `response.headers.get('content-type')` without enforcing `application/pdf`. Because `blob:` URLs inherit the origin of the creating document even when opened with `noopener,noreferrer`, any downloaded object served as `text/html` or `image/svg+xml` executes arbitrary JavaScript in the LiteLearn origin with full access to IndexedDB (`litelearn_db`, including `localCredentials`, `sessions`, and private `notes`) and session storage.
**Fix:** Pin the Blob MIME type to `'application/pdf'` in a shared helper (e.g., `src/presentation/utils/openOfflinePdf.ts`) used by all three pages, and also validate `content-type` when saving blobs:
```ts
export function openOfflinePdfBlob(bytes: Uint8Array, fileName: string): void {
  const bytesCopy = new Uint8Array(bytes.byteLength);
  bytesCopy.set(bytes);
  // LiteLearn only supports PDF attachments; never trust arbitrary remote MIME types on same-origin blob: URLs.
  const pdfBlob = new Blob([bytesCopy], { type: 'application/pdf' });
  const blobUrl = URL.createObjectURL(pdfBlob);
  const win = window.open(blobUrl, '_blank');
  if (win) {
    win.opener = null;
  } else {
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    anchor.click();
  }
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
```

### CR-02: Silent note loss and cross-material state corruption in `useMaterialNote` auto-save

**Severity:** Critical (BLOCKER)
**File:** `src/presentation/hooks/useMaterialNote.ts:33-119` (interacts with `src/presentation/pages/MaterialDetailPage.tsx:313-345, 528-536`)
**Issue:** `MaterialDetailPage` remains mounted across Previous/Next navigation (`/materials/:materialId`), causing `materialId` to change in place. Three interacting bugs cause data loss or cross-material corruption:
1. **Unflushed debounce on navigation/unmount (lines 108-119):** If a student types a note and navigates to the next/previous material (or leaves the screen) before `AUTO_SAVE_DEBOUNCE_MS` (750 ms) elapses, the effect cleanup runs `window.clearTimeout(timer)` and silently discards the unsaved edit.
2. **Stale in-flight `save()` corrupts the newly opened material's state (lines 77-103):** `save()` performs no identity or sequence check after `await container.usecases.saveMaterialNote.execute(...)` (line 84). If Material A's save resolves after navigating to Material B, line 89 executes `setNote(saved)` with Material A's `Note`. `draft` now holds Material B's text while `note.body` holds Material A's text, turning `isDirty` (line 105) to `true`, displaying Material A's `updatedAt` under Material B, and scheduling a spurious write 750 ms later.
3. **Failed load retains previous material's `note` and `draft` (lines 42-59):** When `materialId` changes, `note` and `draft` are not cleared before calling `getMaterialNote.execute`. If loading Material B's note rejects, Material A's text stays in Material B's editor — any edit or `Ctrl+S` then overwrites Material B's note with Material A's content.

Additionally, `MaterialDetailPage.tsx:528-536` triggers `void handleSaveNote()` on `Ctrl+S` without checking `privateNote.isSaving`, allowing concurrent overlapping `save()` calls.
**Fix:** Reset `note`/`draft` immediately on `materialId` change, guard `save()` with an active-target ref and monotonic save sequence, and flush dirty drafts on `materialId` switch/unmount using captured refs:
```ts
const activeTargetRef = useRef<{ userId: string | null; materialId: string | undefined }>({
  userId,
  materialId,
});
const latestDraftRef = useRef<{ userId: string | null; materialId: string | undefined; draft: string; isDirty: boolean }>({
  userId,
  materialId,
  draft: '',
  isDirty: false,
});
const saveSeqRef = useRef(0);

// On materialId/userId change: flush dirty draft for previous material, then reset state before loading.
useEffect(() => {
  const prev = latestDraftRef.current;
  if (prev.isDirty && prev.userId && prev.materialId && (prev.materialId !== materialId || prev.userId !== userId)) {
    void container.usecases.saveMaterialNote
      .execute({ userId: prev.userId, materialId: prev.materialId, body: prev.draft })
      .catch(() => undefined);
  }
  activeTargetRef.current = { userId, materialId };
  setNote(null);
  setDraftState('');
  setSaveStatus('idle');
  // ...load note for new (userId, materialId)
}, [container, materialId, userId]);

// Inside save(): capture target + seq; only update state if activeTargetRef still matches and seq is latest.
```

### CR-03: Replacing a PDF after checking "Remove existing PDF attachment" deletes the new upload on sync

**Severity:** Critical (BLOCKER)
**File:** `src/presentation/pages/RepFormPage.tsx:608-639, 724-734, 1264-1286`
**Issue:** While editing a material with an existing attachment, checking `"Remove existing PDF attachment"` sets `removeAttachment = true` (line 1276). If the representative then chooses or drops a replacement PDF, `applySelectedPdfFile` (lines 608-639) sets `selectedFile` and line 1264 hides the checkbox (`{existingAttachment && !selectedFile ? ... : null}`), **without resetting `removeAttachment` to `false`**. On submit (lines 724-734), both `file: selectedFile` and `removeAttachment: true` are passed to `saveMaterial`. When saved offline (`src/data/repositories/HybridMaterialRepository.ts:274-276`) and later synced (`src/data/services/LiteLearnSyncService.ts:383-407`), sync first uploads the new PDF (line 386) and then immediately executes `if (payload.removeAttachment === true && previousStoragePath) await this.remote.deleteMaterialPdf(previousStoragePath)` (line 405). Whenever the replacement file has the same name as the original (e.g., an updated `week1.pdf`), sync deletes the newly uploaded PDF from Supabase Storage while leaving the material record pointing to the deleted path.
**Fix:** Reset `removeAttachment` whenever a replacement file is selected and never send `removeAttachment: true` alongside a new file:
```ts
// In applySelectedPdfFile (RepFormPage.tsx:618):
if (file) {
  setRemoveAttachment(false);
}

// In handleSubmit (RepFormPage.tsx:731-733):
file: selectedFile,
removeAttachment: selectedFile ? false : removeAttachment,
```

### CR-04: `useSyncStatus` permanently freezes the sync button in `"Syncing..."` in local mode and drops errors in `retry()`

**Severity:** Critical (BLOCKER)
**File:** `src/presentation/hooks/useSyncStatus.ts:44-69` (affects `src/presentation/pages/SettingsPage.tsx:87-91, 274-286` and `src/presentation/components/AppLayout.tsx:373-389`)
**Issue:** Two defects break sync recovery and leave the UI permanently stuck:
1. **Stuck `isSyncing: true` in local fallback mode (lines 46-48):** `syncNow()` assigns the returned `SyncStateSummary` directly via `setState(next)`. In `src/data/services/LiteLearnSyncService.ts:84-108`, local fallback mode executes `return await this.getSyncState()` inside the `try` block *before* `finally { this.isSyncing = false }` runs, so `next.isSyncing` is always `true`. When `"Sync now"` is clicked on `SettingsPage` with 0 queued changes, no `syncQueue` mutation fires `subscribeSyncChanges`, so `SettingsPage`'s `"Sync now"` button (`disabled={isSyncing || networkState === 'offline'}`) remains permanently disabled and spinning `"Syncing..."` until unmount.
2. **Unhandled rejection & stuck spinner in `retry()` (lines 57-69):** Unlike `syncNow()`, `retry()` sets `isSyncing: true` (line 63) and awaits `container.usecases.runSync.execute({ userId, retryFailed: true })` (or `container.retrySync()` / `reload()`) with no `try/catch`. `AppLayout.tsx:377-379` invokes `void retry()` without `.catch()`. Any failure causes an unhandled promise rejection and leaves `isSyncing` stuck `true`, permanently disabling the `"Try again"` button.

**Fix:** Wrap `retry()` in `try/catch` mirroring `syncNow()`, normalize `isSyncing: false` after `runSync.execute()` resolves, and also update `LiteLearnSyncService.ts:107` to set `this.isSyncing = false` before calling `this.getSyncState()`:
```ts
const syncNow = useCallback(async (): Promise<SyncStateSummary | null> => {
  if (!userId) {
    await reload();
    return null;
  }
  setState((prev) => ({ ...prev, isSyncing: true, lastError: null }));
  try {
    const next = await container.usecases.runSync.execute({ userId });
    const normalized = { ...next, isSyncing: false };
    setState(normalized);
    return normalized;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Sync failed. Local data is safe.';
    setState((prev) => ({ ...prev, isSyncing: false, lastError: message }));
    return null;
  }
}, [container, reload, userId]);

const retry = useCallback(async (): Promise<void> => {
  setState((prev) => ({ ...prev, isSyncing: true, lastError: null }));
  try {
    if (!userId) {
      await container.retrySync();
      await reload();
      return;
    }
    const next = await container.usecases.runSync.execute({
      userId,
      retryFailed: true,
    });
    setState({ ...next, isSyncing: false });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Sync retry failed. Local data is safe.';
    setState((prev) => ({ ...prev, isSyncing: false, lastError: message }));
  }
}, [container, reload, userId]);
```

## Warnings

### WR-01: `window.open(..., 'noopener,noreferrer')` always returns `null`, triggering duplicate PDF downloads and misleading missing-file toasts

**Severity:** Warning
**File:** `src/presentation/pages/MaterialDetailPage.tsx:111-118`, `src/presentation/pages/HomePage.tsx:142-160`, `src/presentation/pages/CourseDetailPage.tsx:101-119`
**Issue:** Per the WHATWG HTML Living Standard, passing `'noopener'` (or `'noreferrer'`) in the window-features string causes `window.open()` to **always return `null`** even when the new tab opens successfully. Consequently, `if (!opened)` evaluates to `true` on every click, forcing the `<a download={stored.fileName}>` fallback to download a duplicate copy to disk immediately after opening the PDF tab. In addition, when `!stored` on `HomePage.tsx:142-145` and `CourseDetailPage.tsx:101-104`, the toast claims `'Offline PDF not found. Downloading again...'` but returns after `reload()` without starting any download.
**Fix:** In the shared offline-PDF helper (see `CR-01`), open the same-origin PDF blob with `const win = window.open(blobUrl, '_blank'); if (win) { win.opener = null; } else { ... }` so `win` accurately detects popup blocking. For the `!stored` branch on `HomePage` and `CourseDetailPage`, either invoke `downloadMaterialFile.execute({ materialId })` or change the message to `'Offline PDF was not found on this device. Download it again while online.'` (matching `MaterialDetailPage.tsx:100`).

### WR-02: `QuickSearchModal` hijacks `Enter` on focused Clear/ESC/result buttons and allows keyboard focus to escape the modal

**Severity:** Warning
**File:** `src/presentation/components/QuickSearchModal.tsx:160-239, 271, 291-311, 313-368`
**Issue:**
1. `handleKeyDown` is attached to the outer `dialogRef` container (line 271) and intercepts `Enter` whenever `flatItems.length > 0` (lines 210-217). If a keyboard user tabs to `"Clear"` (line 292), `"ESC"` (line 303), or a lower result `<button>` (line 341 — which handles `onMouseEnter` but not `onFocus`), pressing `Enter` calls `event.preventDefault()` and navigates to `flatItems[activeIndex]` (often item 0) instead of activating the focused button.
2. `Escape` and `Tab` trapping run only inside `dialogRef`'s `onKeyDown` and only wrap when `document.activeElement === first || last` (lines 231-237). Clicking non-focusable dialog chrome (header, footer, status message) moves focus to `document.body`, after which `Escape` stops closing the modal and `Tab` tabs into the background page behind the backdrop.
3. `<div role="listbox">` (line 313) contains `<ul><li><button role="option">` (violating WAI-ARIA required owned elements for `listbox`, omitting `role="combobox"`/`aria-activedescendant` on the `<input>`, and not calling `scrollIntoView` on the active option during arrow-key navigation).
**Fix:** Restrict the `Enter` shortcut to `event.target === inputRef.current`, add `onFocus={() => setActiveIndex(idx)}` to result buttons, attach `Escape` and Tab-containment handlers to `window` while `isOpen` is true (pulling stray focus back to `first`/`last` when `!dialogRef.current.contains(document.activeElement)`), and fix the ARIA pattern (either `combobox` + direct `role="option"` children with `aria-activedescendant` or a plain list of buttons without `role="listbox"`):
```ts
if (event.key === 'Enter' && event.target === inputRef.current && flatItems.length > 0) {
  const target = flatItems[activeIndex] ?? flatItems[0];
  if (target) {
    event.preventDefault();
    handleSelect(target.to);
  }
  return;
}
```

### WR-03: Missing async cancellation guards create stale-data race conditions in `RepFormPage`, `useMaterialDetail`, `useHomeWorkspace`, and `useUpcomingDeadlines`

**Severity:** Warning
**File:** `src/presentation/pages/RepFormPage.tsx:197-456, 563-606`, `src/presentation/hooks/useMaterialDetail.ts:38-103`, `src/presentation/hooks/useHomeWorkspace.ts:43-118`, `src/presentation/hooks/useUpcomingDeadlines.ts:27-60, 86-94`
**Issue:** None of these async loaders track request freshness or component unmount:
- In `RepFormPage.tsx`, rapidly switching entity tabs, clicking items in the Existing Items browser (`hydrateForm`), or changing courses (`handleCourseSelectionChange`) lets an earlier request resolve last and overwrite form fields and `deleteTarget` with a different item than the active URL `editId` (risking updating or deleting the wrong entity) or leave `selectedWeekId` pointing to a week from the previous course.
- In `useMaterialDetail.ts`, rapid Previous/Next material clicks can resolve out of order and display Material A's detail and adjacent links under `/materials/B`.
- In `useHomeWorkspace.ts` and `useUpcomingDeadlines.ts`, concurrent `reload()` calls or `userId` changes can commit stale responses over newer state.
**Fix:** Use a monotonic `requestIdRef` (and an unmount cleanup flag) in each loader so stale completions return before calling `setState`:
```ts
const requestIdRef = useRef(0);
const reload = useCallback(async (): Promise<void> => {
  const requestId = ++requestIdRef.current;
  // ...after every await:
  if (requestId !== requestIdRef.current) return;
  // ...apply state updates
}, [/* deps */]);
```

### WR-04: Duplicated `useSyncStatus` instances desynchronize `AppLayout`/`SettingsPage`, and `SettingsPage` ignores sync failures and backoff retry

**Severity:** Warning
**File:** `src/presentation/hooks/useSyncStatus.ts:20-102`, `src/presentation/pages/SettingsPage.tsx:33-39, 87-91, 249-286`
**Issue:**
1. Every call to `useSyncStatus()` creates isolated local state and registers its own `window` `'online'` listener plus a 5-minute `setInterval` auto-sync timer (lines 78-102). Because `AppLayout` (`AppLayout.tsx:144`) and `SettingsPage` (`SettingsPage.tsx:39`) both call `useSyncStatus()` simultaneously on `/settings`, duplicate listeners/intervals run concurrently and state changes initiated from `SettingsPage` do not propagate to `AppLayout`'s banner when `syncQueue` rows are unchanged.
2. `SettingsPage.tsx:87-91` ignores the return value of `await syncNow()` and unconditionally fires `toast.success('Workspace sync check complete.')` even when `syncNow()` returns `null` or `result.lastError !== null`.
3. `SettingsPage.tsx:33-39, 249-286` ignores `hasFailedChanges` and `retry`. When failed queue items are in exponential backoff (`nextRetryAt > now`), `DexieSyncQueueRepository.listPending(nowIso)` (`src/data/repositories/DexieSyncQueueRepository.ts:21-30`) skips them during `syncNow()`, so `"Sync now"` on Settings cannot retry failed items — and when `lastError` is non-null with `pendingChanges === 0`, line 250 still renders a green `type="success"` `"Synced"` chip above the error alert.
**Fix:** Move `useSyncStatus` state, listeners, and interval into a single `SyncStatusProvider` context mounted once at the shell/app level. In `SettingsPage`:
```ts
const handleSyncNow = async (): Promise<void> => {
  if (hasFailedChanges) {
    await retry();
  } else {
    const summary = await syncNow();
    if (!summary || summary.lastError) {
      toast.error(summary?.lastError ?? 'Sync failed. Local data remains safe.');
      return;
    }
  }
  await loadStorageInfo();
  toast.success('Workspace sync check complete.');
};
```
Also reflect `hasFailedChanges || Boolean(lastError)` with `type="danger"` on the status chip.

### WR-05: False-success follow toasts and missing pending-state lock on `HomePage` and `CoursesPage`

**Severity:** Warning
**File:** `src/presentation/pages/CoursesPage.tsx:185-196`, `src/presentation/pages/HomePage.tsx:66-72, 205-217, 679-696`
**Issue:** `useCourses.toggleFollow` (`src/presentation/hooks/useCourses.ts:54-88`) catches errors internally, sets `error`, and resolves `Promise<void>` without rethrowing. Both `CoursesPage.tsx:186-195` and `HomePage.tsx:205-217` treat resolution as success, displaying `toast.success('Following ...')` or `toast.info('Unfollowed ...')` even when the follow/unfollow write failed (and `CoursesPage.tsx:186` also leaves `reloadOverview()` without a `.catch()`). Additionally, `HomePage.tsx:66-72, 679-696` neither destructures `pendingCourseId` nor passes `toggleDisabled` to `CourseCard`, so double-clicking a follow toggle fires concurrent mutations with the same stale `c.isFollowed` value.
**Fix:** Change `useCourses.toggleFollow` to return `Promise<boolean>` (`true` on success, `false` on error), check the return value before reloading or toasting in `CoursesPage` and `HomePage`, and pass `toggleDisabled={pendingCourseId === c.id}` to `CourseCard` on `HomePage`.

### WR-06: Unhandled promise rejections across async UI handlers and effects

**Severity:** Warning
**File:** `src/presentation/components/AppLayout.tsx:35-37, 169-172, 305`, `src/presentation/pages/SettingsPage.tsx:52-64, 77-85, 93-102, 120-133, 211, 330`, `src/presentation/pages/JoinClassPage.tsx:105-113`, `src/presentation/hooks/useTheme.ts:58-66, 95-104`, `src/presentation/hooks/useInstallPrompt.ts:48-60`, `src/presentation/hooks/useUpcomingDeadlines.ts:27-34, 90-94`, `src/presentation/pages/HomePage.tsx:112-130`, `src/presentation/pages/DeadlinesPage.tsx:68-86`, `src/presentation/pages/CourseDetailPage.tsx:127-145`
**Issue:** Multiple `void asyncFn()` event callbacks and effect subscriptions omit error handling:
- `handleSignOut` in `AppLayout.tsx:169`, `SettingsPage.tsx:120`, and `JoinClassPage.tsx:105` has no `catch` block (`SignOut.execute` throws `AppError('AUTH_ERROR')` on failure); `AppLayout` also omits `{ replace: true }` and a signing-out disabled guard.
- `handleToggleDeadline` and its Undo toast callback in `HomePage`, `DeadlinesPage`, and `CourseDetailPage` never catch rejections from `toggleCompleted`, and `useUpcomingDeadlines.ts:92` never catches `reloadCompletions()`.
- `useTheme.ts:58` omits `.catch()` on `container.getThemePreference()` (and can overwrite an immediate user toggle if IndexedDB resolves late), and `setTheme` (line 101) has no `try/catch`.
- `useInstallPrompt.ts:48-60` awaits `deferredPrompt.prompt()` without `try/catch/finally`, leaving `deferredPrompt` stale and rejecting unhandled if `.prompt()` throws.
- `SettingsPage.tsx` omits `catch` in `loadStorageInfo()`, `handleToggleDataSaver()` (no state rollback on failure), and `handleClearDownloads()`.
**Fix:** Wrap each async event handler in `try/catch` with `toast.error(...)` (and revert optimistic state in `handleToggleDataSaver`), add `.catch()` on background `useEffect` promises, wrap `useInstallPrompt.install` in `try/catch/finally` clearing `deferredPrompt`, and track user-initiated theme changes in a ref inside `useTheme.ts` so late hydration does not clobber them:
```ts
// Example: useInstallPrompt.ts:48-60
const install = useCallback(async (): Promise<boolean> => {
  if (!deferredPrompt) return false;
  try {
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setIsInstalled(true);
      return true;
    }
    return false;
  } catch {
    return false;
  } finally {
    setDeferredPrompt(null);
  }
}, [deferredPrompt]);
```

### WR-07: `RepFormPage` cannot re-select a cleared PDF file, allows drop/clear while busy, and skips class ownership check on material edit hydration

**Severity:** Warning
**File:** `src/presentation/pages/RepFormPage.tsx:254-279, 608-655, 1219, 1235-1262`
**Issue:**
1. Clicking `"Clear selected file"` (line 1256) calls `applySelectedPdfFile(null)` to clear React state, but never clears the underlying `<input id="rep-material-pdf" type="file">` DOM `.value`. Re-selecting the same PDF file fails silently because browsers do not fire `onChange` when the input value matches the previously selected file.
2. `handlePdfDrop` (line 648) does not check `isBusy`, and `"Clear selected file"` (line 1253) omits `disabled={isBusy}`, permitting file state changes during an in-flight save or delete.
3. In `hydrateForm` (lines 254-279), editing a material loads `loadMaterialForEdit(editId)` without verifying `detail.course.classId === actor.classId` (unlike `course`, `week`, `deadline`, and `announcement`, which restrict lookups to `classCourses`). While writes are still blocked by `assertRepForClass` in `UpdateMaterial`, a foreign cached `materialId` renders foreign content into the editor with a `selectedCourseId` absent from the `<select>` options.
**Fix:** Attach a `fileInputRef` to `#rep-material-pdf` and set `if (fileInputRef.current) fileInputRef.current.value = '';` in `applySelectedPdfFile(null)` and `hydrateForm`; return early in `handlePdfDrop` when `isBusy` and pass `disabled={isBusy}` to the clear button; and verify `if (detail.course.classId !== actor.classId) { setLoadError(labels.repForm.errors.notFound); return; }` at line 256.

### WR-08: Accessibility violations in `SegmentedControl` (`role="tablist"` contract) and `MaterialRow` (nested clickable `<div>` inside `<Link>`)

**Severity:** Warning
**File:** `src/presentation/components/FigmaComponents.tsx:295-331, 615-673`
**Issue:**
1. `SegmentedControl` (lines 304-329, used across `CoursesPage`, `DeadlinesPage`, `RepFormPage`, `SettingsPage`, `SignInPage`) uses `role="tablist"` and `role="tab"` without an accessible label (`aria-label`), roving `tabIndex`, ArrowLeft/ArrowRight/Home/End keyboard navigation, or associated `role="tabpanel"` containers.
2. `MaterialRow` (lines 650-672) nests a clickable `<div onClick={...}>` (calling `e.preventDefault()` to trigger `onDownloadClick`) inside a `<Link>` (`<a>`). Because the `<div>` has no `role`, `tabIndex`, or keyboard handler, keyboard and assistive-technology users cannot activate the download action independently of navigation.
**Fix:** In `SegmentedControl`, accept an `ariaLabel` prop and switch to `role="group"` with `aria-pressed={isActive}` buttons (appropriate for filter/mode toggles without tabpanels) — or implement full WAI-ARIA `tablist` arrow-key navigation with roving `tabIndex` and `aria-controls`. In `MaterialRow` (if kept rather than removed per `IN-01`), render an outer `<div className="figma-material-row">` containing a `<Link>` for navigation and a sibling `<button type="button">` for the download action.

### WR-09: `/manage` lacks a route-level rep guard in `router.tsx` and `LazyScreen` omits `location.search` from `resetKey`

**Severity:** Warning
**File:** `src/app/router.tsx:108-121, 169-176`
**Issue:**
1. `/manage` is placed directly inside `ProtectedShellGuard` without a dedicated `RepRouteGuard` verifying `session.user.role === 'rep'`. Although `RepFormPage.tsx:198, 523` and application use cases enforce rep authorization, any non-rep student visiting `/manage` still downloads and executes the entire 1,563-line `RepFormPage` lazy chunk before seeing the forbidden state.
2. `LazyScreen` sets `resetKey={location.pathname}` (line 115), omitting `location.search`. If `RepFormPage` throws inside the error boundary for a malformed query (e.g., `/manage?type=material&editId=bad`), navigating to `/manage?type=course` keeps `location.pathname === '/manage'` and fails to reset `AppErrorBoundary`.
**Fix:** Add a `RepRouteGuard` wrapper for `/manage` in `router.tsx` (rendering the forbidden `EmptyState` or redirecting non-reps before `<Suspense><RepFormPage /></Suspense>`) and update `LazyScreen` to:
```tsx
<AppErrorBoundary resetKey={`${location.pathname}${location.search}`}>
```

### WR-10: `CourseDetailPage` replays navigation toast on refresh/back, and `MaterialDetailPage` leaks `pdfError` and allows quick-note clicks while loading

**Severity:** Warning
**File:** `src/presentation/pages/CourseDetailPage.tsx:39-45`, `src/presentation/pages/MaterialDetailPage.tsx:40-42, 489-515`
**Issue:**
1. `CourseDetailPage` triggers `toast.success(navToast)` from `location.state` without clearing history state, so refreshing the page or returning via browser Back replays `"Saved on this device. Will sync later."`.
2. `MaterialDetailPage` never clears `pdfError` when `materialId` changes across Previous/Next links, carrying a PDF failure alert from Material A onto Material B. Furthermore, the quick-note snippet buttons (`+ Key concept`, `+ Question`, `+ Exam review`, lines 489-511) render enabled while `privateNote.isLoading` is `true`, letting clicks modify `draft` right before the async note fetch overwrites it.
**Fix:** Clear router state after consuming `navToast` (`navigate(location.pathname + location.search, { replace: true, state: null })` in `CourseDetailPage`), reset `pdfError` in a `useEffect` keyed on `materialId` in `MaterialDetailPage`, and disable or conditionally hide `.notebook-quick-chips` while `privateNote.isLoading`.

### WR-11: `SettingsPage` leaks copy-feedback timer and silently fails when Clipboard API is unavailable

**Severity:** Warning
**File:** `src/presentation/pages/SettingsPage.tsx:104-118`
**Issue:** `handleCopyCode` schedules an unreferenced `setTimeout(() => setCopied(false), 2000)` that is never cleared on unmount or rapid repeat clicks (causing premature reset or post-unmount state updates). Additionally, if `navigator.clipboard` is undefined (common on non-HTTPS LAN HTTP origins in campus/dormitory deployments) or `writeText` rejects, the button fails silently with no fallback or error toast.
**Fix:** Store the timeout ID in a `useRef<number | null>(null)` cleared before rescheduling and in an unmount cleanup effect, and notify the user (or fall back to `document.execCommand('copy')` on a temporary input) when `navigator.clipboard` is unavailable or rejects.

### WR-12: `mapAuthError` matches `'nim'` before `'password'`, misclassifying missing-fields validation errors

**Severity:** Warning
**File:** `src/presentation/hooks/useAuthSession.ts:58-76`
**Issue:** `SignIn.execute` (`src/application/usecases/auth/SignIn.ts:15-20`) throws `AppError('VALIDATION_ERROR', 'NIM and password are required.')` when either input is blank. In `mapAuthError` (lines 69-74), `if (msg.includes('nim'))` executes before `if (msg.includes('password'))`, so `'nim and password are required.'` is misclassified as `labels.auth.errors.invalidNim` (`'Enter a valid IT Del NIM (e.g. 11S22001).'`) instead of `labels.auth.errors.missingFields`, leaving lines 72-74 unreachable for that message.
**Fix:** Match missing-fields before the generic `nim` check:
```ts
if (msg.includes('nim and password') || (msg.includes('password') && msg.includes('required'))) {
  return labels.auth.errors.missingFields;
}
if (msg.includes('nim')) {
  return labels.auth.errors.invalidNim;
}
```

### WR-13: Already-defended-elsewhere — `useAuthSession` maintains unread context `error` state and `clearError()`

**Severity:** Warning
**File:** `src/presentation/hooks/useAuthSession.ts:115, 147-149, 163, 182, 203, 218, 230, 246, 257, 269`
**Category:** necessity
**Issue:** `AuthSessionContext` allocates `error` state, writes to it immediately before throwing `new Error(message)` in every auth/onboarding method, and exposes `clearError()`. Across all callers in the repository (`SignInPage.tsx:20, 29, 111`, `JoinClassPage.tsx:11-18, 23-25, 51, 78, 97`, `AppLayout.tsx`, `router.tsx`, and all other pages), **zero consumers ever read `useAuthSession().error`** — both forms catch the thrown error into local component state while calling `clearError()` only to clear unused context state, causing unnecessary full-tree context re-renders.
**Fix:** Remove `error` and `clearError` from `UseAuthSessionResult` and `useAuthSessionState`, leaving error display owned solely by the calling forms' local state.

## Info

### IN-01: Unused exported components in `FigmaComponents.tsx` and manual label-based input IDs

**Severity:** Info
**File:** `src/presentation/components/FigmaComponents.tsx:22-62, 123-245, 606-673, 754-795`
**Issue:** Seven exported components (`Button`, `Input`, `PasswordInput`, `Card`, `MaterialRow`, `Toast`, `Skeleton`) have zero imports across `src/` and tests (~350 lines of dead code). Additionally, `Input` (line 141) and `PasswordInput` (line 185) build IDs via `field-${label.toLowerCase().replace(/\s+/g, '-')}` instead of the already-imported `useId()`, which can generate duplicate IDs if two fields share a label.
**Fix:** Remove unused components (or relocate them to a dedicated showcase) and replace manual ID synthesis with `useId()`.

### IN-02: `AppErrorBoundary.handleReturnHome` resets state before hard navigation and `componentDidCatch` omits `errorInfo`

**Severity:** Info
**File:** `src/presentation/components/ErrorBoundary.tsx:55-57, 85-94`
**Issue:** `handleReturnHome` calls `this.setState({ hasError: false, ... })` immediately before `window.location.assign('/')`, synchronously re-mounting and re-crashing the broken subtree prior to navigation. Also `componentDidCatch(error: unknown)` drops the second `errorInfo: React.ErrorInfo` argument, losing the React component stack in error logs.
**Fix:** Skip `setState` when navigating via `window.location.assign('/')`, and accept/log `errorInfo.componentStack` in `componentDidCatch`.

### IN-03: Monolithic `RepFormPage.tsx` (1,563 lines) and duplicated offline-PDF / deadline-toggle handlers

**Severity:** Info
**File:** `src/presentation/pages/RepFormPage.tsx:107-1561`, `src/presentation/pages/HomePage.tsx:112-183`, `src/presentation/pages/CourseDetailPage.tsx:74-145`, `src/presentation/pages/MaterialDetailPage.tsx:89-127`, `src/presentation/pages/DeadlinesPage.tsx:68-86`
**Issue:** `RepFormPage` bundles 25+ state variables and five separate entity forms into one 1,563-line component (`hydrateForm` alone is 256 lines; `handleSubmit` is 135 lines). Separately, the offline PDF opening routine (3 pages) and deadline completion + Undo toast handler (3 pages) are duplicated identically across pages.
**Fix:** Split `RepFormPage` into focused entity form components and extract shared `openOfflinePdfBlob()` and `useDeadlineToggle()` utilities.

### IN-04: Hardcoded local demo credentials compiled into production bundle and hardcoded copy bypassing `labels.ts`

**Severity:** Info
**File:** `src/presentation/pages/SignInPage.tsx:349-380`, `src/presentation/components/AppLayout.tsx:50-51, 210, 256, 309, 341, 436`, `src/presentation/pages/HomePage.tsx:246, 328, 415, 459, 494, 665`
**Issue:** `SignInPage` includes hardcoded demo credentials (`11S22001`, `11S22002`, `password123`) gated only at runtime by `isLocalFallbackMode`, so a misconfigured production build lacking Supabase env vars exposes one-click demo logins. Separately, newly added UI labels bypass `src/presentation/i18n/labels.ts` even where keys already exist (`labels.deadlines.heading`, `labels.courses.filterAriaLabel`, `labels.deadlines.filterAriaLabel`).
**Fix:** Gate the demo credentials box on `import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_AUTOFILL === 'true'` in addition to `isLocalFallbackMode`, and move user-visible strings into `labels.ts`.

### IN-05: Synthetic `KeyboardEvent` dispatch for Quick Search, unguarded `event.repeat`, and duplicate navigation landmark labels

**Severity:** Info
**File:** `src/presentation/pages/HomePage.tsx:104-110`, `src/presentation/components/AppLayout.tsx:153-167, 181, 216, 397`
**Issue:** `HomePage` opens `QuickSearchModal` by dispatching a synthetic `KeyboardEvent('keydown', { key: 'k', ctrlKey: true })` on `window`. `AppLayout`'s listener does not guard `if (event.repeat) return;`, so holding `Ctrl+K` rapidly flickers the modal. Additionally, `<aside className="figma-sidenav" aria-label={labels.nav.ariaLabel}>` wraps an unlabeled `<nav>` while `<nav className="figma-bottom-nav" aria-label={labels.nav.ariaLabel}>` reuses the same landmark label.
**Fix:** Expose `openQuickSearch` via React Router `<Outlet context={...} />`, ignore `event.repeat` in `handleGlobalKeyDown`, and label the desktop and mobile `<nav>` elements distinctly.

### IN-06: `CourseCard` navigates on text-selection mouseup and `HomePage` leaves an empty left grid column with 0 followed courses

**Severity:** Info
**File:** `src/presentation/components/FigmaComponents.tsx:379-389`, `src/presentation/pages/HomePage.tsx:321-325`
**Issue:** Dragging to select text inside `CourseCard` fires `handleCardClick` on mouseup and navigates away. On `HomePage`, when `followedCourseCount === 0` and unfollowed class courses exist (`displayCourses.length > 0`), line 321 renders the 2-column `.figma-home-grid` with a completely empty left `.card-stack` container.
**Fix:** Ignore `handleCardClick` when `window.getSelection()?.toString().trim()` is non-empty, and omit or collapse the empty left column on `HomePage` when no deadlines, shelf items, or overview entries exist.

---

_Reviewed: 2026-11-24T01:49:17Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
