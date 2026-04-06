# Copilot NanoGPT Provider Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `RSND`에 GitHub Copilot, NanoGPT 네이티브 provider를 추가해서 키 설정, 모델 선택, 요청 전송, 상태 확인까지 실제로 동작하게 만든다.

**Architecture:** 모델/DB/요청 계층과 설정 UI를 나눠 구현한다. 요청 분기는 `request.ts`에서 provider 기준으로 우선 처리하고, Copilot/NanoGPT 전용 통신은 각 전용 요청 파일에 격리한다. 설정 화면은 이번 단계에서 동작 우선으로 넣되, 추후 팝업형 UX로 분리하기 쉽도록 관련 상태와 액션을 한 구역에 모은다.

**Tech Stack:** Svelte 5, TypeScript, Vitest, pnpm

---

### Task 1: Provider 타입과 모델 레지스트리 추가

**Files:**
- Modify: `src/ts/model/types.ts`
- Modify: `src/ts/model/modellist.ts`
- Create: `src/ts/model/providers/copilot.ts`
- Create: `src/ts/model/providers/nanogpt.ts`

**Step 1: Write the failing test**

`src/ts/process/request/request.test.ts`에 Copilot/NanoGPT provider 분기 테스트를 먼저 추가한다.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/ts/process/request/request.test.ts`
Expected: FAIL because request router does not know `Copilot` / `NanoGPT`.

**Step 3: Write minimal implementation**

- `LLMProvider`와 `ProviderNames`에 두 provider 추가
- reference의 정적 모델 목록 이식
- `modellist.ts`에서 새 provider 모델을 `LLMModels`에 포함
- 동적 모델 동기화 함수 시그니처 추가

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/ts/process/request/request.test.ts`
Expected: routing-related assertions still fail only on unimplemented request hooks, not on missing provider/model symbols.

**Step 5: Commit**

```bash
git add src/ts/model/types.ts src/ts/model/modellist.ts src/ts/model/providers/copilot.ts src/ts/model/providers/nanogpt.ts src/ts/process/request/request.test.ts
git commit -m "feat: register copilot and nanogpt providers"
```

### Task 2: Copilot/NanoGPT 요청 계층 이식

**Files:**
- Modify: `src/ts/process/request/request.ts`
- Modify: `src/ts/process/request/openAI/requests.ts`
- Modify: `src/ts/process/request/anthropic.ts`
- Create: `src/ts/process/request/copilot.ts`
- Create: `src/ts/process/request/nanogpt.ts`
- Test: `src/ts/process/request/request.test.ts`

**Step 1: Write the failing test**

`request.test.ts`에서 Copilot 모델이 `requestCopilot`, NanoGPT 모델이 `requestNanoGPT`로 분기되는지 검증한다.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/ts/process/request/request.test.ts`
Expected: FAIL because request router and helper imports are missing.

**Step 3: Write minimal implementation**

- `RequestDataArgumentExtended`에 `extraHeaders` 추가
- `request.ts`에서 provider 우선 분기 추가
- reference의 `copilot.ts`, `nanogpt.ts`를 현재 코드 구조에 맞게 이식
- `openAI/requests.ts`에서 `extraHeaders` 병합
- `anthropic.ts`에서 Copilot용 헤더 정리 + `extraHeaders` 병합

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/ts/process/request/request.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/ts/process/request/request.ts src/ts/process/request/openAI/requests.ts src/ts/process/request/anthropic.ts src/ts/process/request/copilot.ts src/ts/process/request/nanogpt.ts src/ts/process/request/request.test.ts
git commit -m "feat: add copilot and nanogpt request handlers"
```

### Task 3: DB 스키마와 동적 모델 동기화 연결

**Files:**
- Modify: `src/ts/storage/database.svelte.ts`
- Modify: `src/ts/model/modellist.ts`

**Step 1: Write the failing test**

이 단계는 저장 구조 추가가 중심이라 별도 테스트 대신 기존 request test와 타입 검사를 안전망으로 사용한다.

**Step 2: Run test to verify it fails**

Run: `pnpm check`
Expected: FAIL if 새 필드 타입/초기화가 빠져 있으면 타입 오류가 발생한다.

**Step 3: Write minimal implementation**

- `copilot`, `nanogpt` 기본값 추가
- 타입 정의와 preset/serialization 경로 보강
- 모델 동기화 함수가 DB 키를 읽도록 연결

**Step 4: Run test to verify it passes**

Run: `pnpm check`
Expected: PASS

**Step 5: Commit**

```bash
git add src/ts/storage/database.svelte.ts src/ts/model/modellist.ts
git commit -m "feat: persist copilot and nanogpt settings"
```

### Task 4: 설정 화면 이식

**Files:**
- Modify: `src/lib/Setting/Pages/BotSettings.svelte`

**Step 1: Write the failing test**

UI 전용 자동 테스트는 이번 단계에서 생략하고 타입 체크와 수동 검증을 사용한다.

**Step 2: Run test to verify it fails**

Run: `pnpm check`
Expected: FAIL if import/state/template 연결이 빠지면 Svelte diagnostics가 발생한다.

**Step 3: Write minimal implementation**

- reference의 Copilot/NanoGPT 섹션을 현재 BotSettings 구조에 맞게 이식
- 키 추가/삭제, 검증, 사용량/잔액 조회, 모델 동기화 버튼 연결
- 다음 단계 팝업 UX로 옮기기 쉽도록 상태/액션을 공급자별로 묶는다

**Step 4: Run test to verify it passes**

Run: `pnpm check`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/Setting/Pages/BotSettings.svelte
git commit -m "feat: add copilot and nanogpt settings UI"
```

### Task 5: 최종 검증

**Files:**
- Verify: `src/ts/process/request/request.test.ts`
- Verify: `src/lib/Setting/Pages/BotSettings.svelte`
- Verify: `src/ts/process/request/copilot.ts`
- Verify: `src/ts/process/request/nanogpt.ts`

**Step 1: Run focused tests**

Run: `pnpm vitest run src/ts/process/request/request.test.ts`
Expected: PASS

**Step 2: Run full type check**

Run: `pnpm check`
Expected: PASS

**Step 3: Review requirements**

- Copilot/NanoGPT 모델이 목록에 보이는가
- 키 저장 구조가 존재하는가
- Copilot/NanoGPT 전용 요청기로 분기되는가
- 검증/사용량/동적 모델 동기화 UI가 있는가
- 다음 UX 개편을 막는 강한 결합이 없는가

**Step 4: Commit final integration**

```bash
git add .
git commit -m "feat: add native copilot and nanogpt providers"
```
