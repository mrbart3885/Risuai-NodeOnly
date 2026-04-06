# Copilot NanoGPT Native Provider Design

**Date:** 2026-04-06

**Goal:** `RSND`의 `develop` 기반 코드에 `GitHub Copilot`과 `NanoGPT`를 네이티브 provider로 추가해, 모델 선택부터 실제 요청, 키 검증, 사용량 확인, 동적 모델 동기화까지 모두 동작하게 만든다.

## Scope

- `GitHub Copilot`, `NanoGPT`를 `LLMProvider`에 새 provider로 추가한다.
- 기준 구현은 `/Users/bliss/Documents/Risuai-NodeOnly`의 Copilot/NanoGPT 이식 코드를 따른다.
- 이번 단계에서는 기능 연결을 우선한다.
- 설정 화면은 동작 가능한 수준까지 맞추되, 전용 팝업 중심의 UX 재설계는 후속 단계로 미룬다.

## Architecture

- 모델 레이어:
  - `src/ts/model/types.ts`에 provider 이름을 추가한다.
  - `src/ts/model/providers/copilot.ts`, `src/ts/model/providers/nanogpt.ts`를 추가한다.
  - `src/ts/model/modellist.ts`에서 정적 모델을 등록하고, 두 provider의 동적 모델 동기화 함수를 노출한다.
- 요청 레이어:
  - `src/ts/process/request/copilot.ts`는 GitHub 토큰으로 Copilot 내부 토큰을 교환한 뒤, 모델 형식에 따라 기존 `requestClaude`, `requestOpenAI`, `requestOpenAIResponseAPI`를 재사용한다.
  - `src/ts/process/request/nanogpt.ts`는 NanoGPT의 OpenAI 호환 엔드포인트로 요청을 보낸다.
  - `src/ts/process/request/request.ts`는 provider 기반 분기를 추가한다.
  - 기존 요청기 재사용을 위해 `RequestDataArgumentExtended`에 추가 헤더 전달 통로를 넣고, 필요한 곳에서 이 헤더를 합친다.
- 저장소/설정 레이어:
  - `src/ts/storage/database.svelte.ts`에 `copilot`, `nanogpt` 설정 구조를 추가한다.
  - `src/lib/Setting/Pages/BotSettings.svelte`에 두 provider의 키 입력, 검증, 키 회전, 사용량/잔액, 모델 동기화 UI를 추가한다.

## Error Handling

- Copilot:
  - 토큰이 없으면 즉시 실패를 반환한다.
  - 인증, 할당량, 네트워크 오류는 키 회전 설정에 따라 다음 토큰으로 재시도한다.
  - Copilot 내부 토큰 캐시는 만료 시간을 기준으로 재사용한다.
- NanoGPT:
  - 키가 없으면 즉시 실패를 반환한다.
  - 인증, 할당량, 네트워크 오류는 키 회전 설정에 따라 다음 키로 재시도한다.
- UI:
  - 검증 실패, 사용량 조회 실패, 모델 동기화 실패는 각 설정 블록 안에서 바로 보이도록 한다.

## Testing Strategy

- 라우팅 테스트:
  - `requestChatDataMain`이 Copilot/NanoGPT 모델을 각 전용 요청기로 보내는지 검증한다.
- 타입/정적 검증:
  - `pnpm check`
- 회귀 검증:
  - `pnpm test src/ts/process/request/request.test.ts`

## Deferred UX Work

- 모델 선택 직후 전용 설정 팝업 띄우기
- Copilot/NanoGPT 설정 전용 모달 분리
- 키 입력 폼 간소화 및 공통 설정 컴포넌트 추출
