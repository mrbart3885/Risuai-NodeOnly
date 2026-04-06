# Aux Request Floating Status Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 채팅 화면 우하단에 보조 요청 전용 플로팅 상태 표시를 추가해서 `otherAx`, `submodel`, `translate` 요청이 돌 때 사용자가 한눈에 상태를 볼 수 있게 만든다.

**Architecture:** 요청 추적은 `requestChatData` 공통 진입점에서 처리하고, 상태는 전역 저장소 하나로 유지한다. 화면은 `DefaultChatScreen.svelte`에서 이 저장소를 구독해 입력창 위 우하단에 작은 플로팅 버튼형 상태 표시를 그린다. `memory`, `emotion`, 메인 `model` 요청은 집계에서 제외한다.

**Tech Stack:** Svelte 5, TypeScript, Svelte store, Vitest, pnpm

---

### Task 1: 보조 요청 상태 저장소와 집계 규칙 추가

**Files:**
- Create: `src/ts/process/request/requestActivity.ts`
- Test: `src/ts/process/request/requestActivity.test.ts`

**Step 1: Write the failing test**

`requestActivity.test.ts`에 다음 동작을 먼저 적는다.

```ts
it('tracks otherAx, submodel, translate only', () => {
    const state = createRequestActivityState()

    startRequestActivity(state, 'otherAx')
    startRequestActivity(state, 'memory')

    expect(state.activeCount).toBe(1)
    expect(state.byMode.otherAx).toBe(1)
    expect(state.byMode.memory).toBeUndefined()
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/ts/process/request/requestActivity.test.ts`
Expected: FAIL because the helper module does not exist yet.

**Step 3: Write minimal implementation**

- 추적 대상 판별 함수 추가
- `activeCount`, `byMode`, `lastStartedAt`를 가진 상태 생성 함수 추가
- 시작/종료 헬퍼 추가
- 표시 문구 계산 함수 추가

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/ts/process/request/requestActivity.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/ts/process/request/requestActivity.ts src/ts/process/request/requestActivity.test.ts
git commit -m "feat: add aux request activity store"
```

### Task 2: 공통 요청 진입점에 상태 추적 연결

**Files:**
- Modify: `src/ts/process/request/request.ts`
- Modify: `src/ts/process/request/shared.ts`
- Modify: `src/ts/stores.svelte.ts`
- Test: `src/ts/process/request/requestActivity.test.ts`

**Step 1: Write the failing test**

`requestActivity.test.ts` 또는 별도 테스트에 `withTrackedRequestActivity` 같은 래퍼를 통해 카운트가 오르고 `finally`에서 내려가는 동작을 추가한다.

```ts
it('clears tracked activity after failure', async () => {
    const tracked = trackRequestActivity('translate')

    await expect(tracked(Promise.reject(new Error('boom')))).rejects.toThrow('boom')
    expect(getRequestActivityState().activeCount).toBe(0)
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/ts/process/request/requestActivity.test.ts`
Expected: FAIL because request wrapper is not wired yet.

**Step 3: Write minimal implementation**

- 전역 저장소를 `stores.svelte.ts`에서 내보내기
- `request.ts`에서 `otherAx`, `submodel`, `translate`만 추적하도록 `requestChatData`를 감싼다
- 성공/실패/중단 모두 같은 정리 경로를 타게 한다

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/ts/process/request/requestActivity.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/ts/process/request/request.ts src/ts/process/request/shared.ts src/ts/stores.svelte.ts src/ts/process/request/requestActivity.test.ts
git commit -m "feat: track auxiliary request activity"
```

### Task 3: 채팅 화면에 우하단 플로팅 상태 표시 추가

**Files:**
- Modify: `src/lib/ChatScreens/DefaultChatScreen.svelte`
- Modify: `src/ts/process/request/requestActivity.ts`
- Test: `src/ts/process/request/requestActivity.test.ts`

**Step 1: Write the failing test**

표시 문구 계산 규칙을 테스트에 추가한다.

```ts
it('builds a compact label for multiple aux requests', () => {
    const state = createRequestActivityState()

    startRequestActivity(state, 'otherAx')
    startRequestActivity(state, 'translate')

    expect(getRequestActivityLabel(state)).toBe('보조 요청 2개 처리 중')
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/ts/process/request/requestActivity.test.ts`
Expected: FAIL because the label helper does not match the UI rules yet.

**Step 3: Write minimal implementation**

- 플로팅 상태 표시용 문구 계산 마무리
- `DefaultChatScreen.svelte`에서 저장소 구독
- 우하단, 입력창 위에 작은 플로팅 버튼형 상태 표시 추가
- 모바일 안전 영역과 채팅 입력 영역을 고려한 위치 조정

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/ts/process/request/requestActivity.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ChatScreens/DefaultChatScreen.svelte src/ts/process/request/requestActivity.ts src/ts/process/request/requestActivity.test.ts
git commit -m "feat: show auxiliary request floating status"
```

### Task 4: 최종 검증

**Files:**
- Verify: `src/ts/process/request/request.ts`
- Verify: `src/ts/process/request/requestActivity.ts`
- Verify: `src/lib/ChatScreens/DefaultChatScreen.svelte`

**Step 1: Run focused tests**

Run: `pnpm vitest run src/ts/process/request/requestActivity.test.ts`
Expected: PASS

**Step 2: Run type check**

Run: `pnpm check`
Expected: PASS

**Step 3: Manual verification**

- `otherAx` 요청 때 우하단 표시가 뜨는가
- `submodel` 요청 때 우하단 표시가 뜨는가
- `translate` 요청 때 우하단 표시가 뜨는가
- `memory`, `emotion`은 뜨지 않는가
- 입력창과 마지막 메시지를 가리지 않는가
- 동시에 여러 요청일 때 문구가 자연스러운가

**Step 4: Commit final integration**

```bash
git add src/ts/process/request/requestActivity.ts src/ts/process/request/requestActivity.test.ts src/ts/process/request/request.ts src/ts/stores.svelte.ts src/lib/ChatScreens/DefaultChatScreen.svelte
git commit -m "feat: add floating aux request status"
```
