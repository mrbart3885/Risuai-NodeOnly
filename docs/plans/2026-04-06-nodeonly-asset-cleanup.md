# NodeOnly Asset Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 영구 삭제된 캐릭터가 더 이상 참조하지 않는 `assets/` 파일만 안전하게 서버 저장소에서 정리한다.

**Architecture:** 캐릭터가 참조하던 asset 경로를 별도로 수집한 뒤, 삭제 후 남은 DB 전체 참조 집합과 대조해서 미사용 파일만 제거한다. 이 로직은 수동 영구 삭제와 부팅 시 휴지통 만료 삭제가 같은 helper를 재사용하도록 묶는다.

**Tech Stack:** TypeScript, Svelte stores, Vitest, NodeOnly storage

---

### Task 1: 삭제 자산 정리 실패 테스트 작성

**Files:**
- Create: `src/ts/assetCleanup.test.ts`
- Modify: `src/ts/bootstrap.cleanChunks.test.ts`

**Step 1: Write the failing test**

- 영구 삭제 시 단독 asset은 제거되고, 공유 asset은 유지되는 테스트를 작성한다.
- 3일 지난 휴지통 캐릭터가 부팅 중 제거될 때도 단독 asset이 제거되는 테스트를 작성한다.

**Step 2: Run test to verify it fails**

Run: `pnpm test src/ts/assetCleanup.test.ts src/ts/bootstrap.cleanChunks.test.ts`
Expected: 삭제 자산 정리 관련 assertion 실패

### Task 2: 최소 구현으로 통과

**Files:**
- Create: `src/ts/assetCleanup.ts`
- Modify: `src/ts/characters.ts`
- Modify: `src/ts/bootstrap.ts`

**Step 1: Write minimal implementation**

- 캐릭터별 asset 경로 수집 helper를 만든다.
- 남은 DB 참조와 비교해 미사용 `assets/`만 제거하는 helper를 만든다.
- `removeChar(..., 'permanent' | 'permanentForce')`와 부팅 중 만료 휴지통 삭제에 helper를 연결한다.

**Step 2: Run test to verify it passes**

Run: `pnpm test src/ts/assetCleanup.test.ts src/ts/bootstrap.cleanChunks.test.ts`
Expected: PASS

### Task 3: 전체 검증

**Files:**
- Modify: 없음

**Step 1: Run verification**

Run: `pnpm check`
Expected: `0 errors`, `0 warnings`
