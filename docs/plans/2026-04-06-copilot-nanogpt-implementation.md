# Copilot NanoGPT Native Provider Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `develop` 기반 `RSND`에 `GitHub Copilot`, `NanoGPT` 네이티브 provider를 추가하고, 사용자가 바로 키를 넣고 연결을 테스트할 수 있는 수준까지 완성한다.

**Architecture:** 기준 구현은 `Risuai-NodeOnly`의 provider 추가 코드를 따르되, 현재 `RSND` 구조에 맞게 모델 레이어, 요청 레이어, 저장소, 설정 UI를 나눠 이식한다. 라우팅 테스트를 먼저 작성하고, 요청기와 설정 UI는 서로 간섭이 적은 범위로 나눠 병렬 구현한 뒤 마지막에 통합 검증한다.

**Tech Stack:** TypeScript, Svelte 5, Vitest, pnpm, git worktree

---

### Task 1: Provider 라우팅 테스트 추가

**Files:**
- Create: `src/ts/process/request/request.test.ts`
- Modify: `vitest.config.ts` (필요 시만)

**Step 1: Write the failing test**

- Copilot 모델이 `requestCopilot`으로 라우팅되는 테스트를 작성한다.
- NanoGPT 모델이 `requestNanoGPT`로 라우팅되는 테스트를 작성한다.

**Step 2: Run test to verify it fails**

Run: `pnpm test src/ts/process/request/request.test.ts`
Expected: Copilot/NanoGPT 요청기 또는 provider enum/분기 누락으로 FAIL

**Step 3: Commit**

```bash
git add src/ts/process/request/request.test.ts
git commit -m "test: cover copilot and nanogpt routing"
```

### Task 2: 모델/저장소/요청 레이어 이식

**Files:**
- Modify: `src/ts/model/types.ts`
- Modify: `src/ts/model/modellist.ts`
- Create: `src/ts/model/providers/copilot.ts`
- Create: `src/ts/model/providers/nanogpt.ts`
- Modify: `src/ts/storage/database.svelte.ts`
- Modify: `src/ts/process/request/request.ts`
- Create: `src/ts/process/request/copilot.ts`
- Create: `src/ts/process/request/nanogpt.ts`
- Modify: `src/ts/process/request/openAI/requests.ts`
- Modify: `src/ts/process/request/anthropic.ts`

**Step 1: Write minimal implementation**

- provider enum과 provider 이름을 추가한다.
- Copilot/NanoGPT 정적 모델 목록과 동적 모델 등록 함수를 연결한다.
- DB 기본값과 타입에 provider 설정 구조를 추가한다.
- 요청 인자에 추가 헤더 전달 통로를 만들고, 기존 OpenAI/Anthropic 요청기에 합친다.
- `requestChatDataMain`에서 provider 기준 분기를 추가한다.
- Copilot/NanoGPT 요청기를 추가한다.

**Step 2: Run test to verify it passes**

Run: `pnpm test src/ts/process/request/request.test.ts`
Expected: PASS

**Step 3: Run type check**

Run: `pnpm check`
Expected: `0 errors`, `0 warnings`

### Task 3: 설정 UI 이식

**Files:**
- Modify: `src/lib/Setting/Pages/BotSettings.svelte`
- Modify: `src/lang/en.ts` (필요 시만)
- Modify: `src/lang/ko.ts` (필요 시만)

**Step 1: Write the failing verification**

- UI 추가 후 타입 오류가 생기도록 먼저 컴파일 가능한 구조를 만든 뒤, `pnpm check`에서 누락 타입/임포트가 드러나는 상태를 확인한다.

**Step 2: Write minimal implementation**

- Copilot 토큰 목록, 검증, 사용량 조회, 모델 동기화 UI를 이식한다.
- NanoGPT 키 목록, 검증, 잔액/사용량 조회, 모델 동기화 UI를 이식한다.
- 이번 단계에서는 모달 분리는 하지 않고, 나중에 분리하기 쉬운 블록 단위 구조를 유지한다.

**Step 3: Run verification**

Run: `pnpm check`
Expected: `0 errors`, `0 warnings`

### Task 4: 통합 검증

**Files:**
- Modify: 없음

**Step 1: Run targeted test**

Run: `pnpm test src/ts/process/request/request.test.ts`
Expected: PASS

**Step 2: Run full type check**

Run: `pnpm check`
Expected: `0 errors`, `0 warnings`

**Step 3: Smoke-check changed files**

- 모델 목록에 `GitHub Copilot`, `NanoGPT` provider가 노출되는지 확인한다.
- 설정 화면에 두 provider의 키/사용량 블록이 노출되는지 확인한다.
