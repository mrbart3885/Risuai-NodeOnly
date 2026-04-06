# Copilot NanoGPT Provider Design

## Goal

`RSND`의 `develop` 기반 코드에 GitHub Copilot, NanoGPT를 네이티브 provider로 추가한다. 기준 구현은 `/Users/bliss/Documents/Risuai-NodeOnly`를 따르되, 이번 단계는 "연결 완성"을 목표로 하고 설정 화면 UX 재설계는 다음 단계에서 안전하게 분리할 수 있게 구조만 정리한다.

## Scope

- `Copilot`, `NanoGPT` provider 타입과 모델 목록 추가
- 요청 분기, 인증/키 회전, Copilot 토큰 교환, NanoGPT OpenAI 호환 호출 추가
- 동적 모델 동기화, 키 검증, 사용량/잔액 조회 이식
- DB 스키마와 설정 화면 연결
- 최소 회귀 테스트 추가

## Non-Goals

- Copilot/NanoGPT 전용 팝업형 설정 UX 완성
- 설정 화면 전면 재배치
- 다른 provider의 UI 개편

## Architecture

### Model Layer

`src/ts/model/types.ts`에 두 provider를 추가하고, `src/ts/model/providers/copilot.ts`, `src/ts/model/providers/nanogpt.ts`를 새로 만든다. `src/ts/model/modellist.ts`는 정적 모델 목록을 포함하고, 키가 있을 때 서버에서 모델 목록을 동기화하는 도우미를 노출한다.

### Request Layer

`src/ts/process/request/request.ts`는 모델 `format` 분기 전에 provider 전용 분기를 추가한다. Copilot은 별도 토큰 교환과 헤더 구성이 필요하므로 `request/copilot.ts`에서 전처리 후 기존 OpenAI/Anthropic 요청기로 넘긴다. NanoGPT는 OpenAI 호환 종단점을 쓰므로 `request/nanogpt.ts`에서 키 회전과 상태 조회를 처리한 뒤 기존 OpenAI 요청기로 넘긴다.

### Shared Request Compatibility

Copilot은 기본 OpenAI/Anthropic 헤더를 그대로 쓰면 안 되므로 `RequestDataArgumentExtended`에 `extraHeaders`를 추가하고, `openAI/requests.ts`, `anthropic.ts`에서 provider별 헤더 병합을 허용한다. 특히 Copilot + Anthropic 조합에서는 Anthropic 전용 헤더를 제거한 뒤 Copilot 헤더를 덮어써야 한다.

### Persistence

`src/ts/storage/database.svelte.ts`에 `copilot`, `nanogpt` 설정 구조를 추가한다.

- `copilot.githubTokens`
- `copilot.keyRotate`
- `copilot.machineId`
- `copilot.vsCodeVersion`
- `copilot.chatVersion`
- `nanogpt.apiKeys`
- `nanogpt.keyRotate`

기존 저장 데이터와 충돌하지 않도록 초기화/타입/프리셋 직렬화 경로를 함께 맞춘다.

### Settings UI

이번 단계에서는 기존 `BotSettings.svelte`에 섹션을 추가해 동작을 우선 완성한다. 다만 Copilot/NanoGPT 관련 상태와 호출 로직은 한곳에 모아, 다음 단계에서 별도 팝업 컴포넌트로 쉽게 분리할 수 있게 만든다.

## Error Handling

- 키가 없으면 provider별 안내 메시지를 반환한다.
- 토큰 교환/검증 실패는 공급자 이름이 드러나는 메시지로 노출한다.
- `on-error` 회전 모드일 때만 인증/한도 계열 오류에서 다음 키로 넘긴다.

## Testing

- `requestChatDataMain`이 Copilot/NanoGPT provider를 올바른 요청기로 보내는지 단위 테스트를 추가한다.
- `pnpm check`와 추가한 Vitest 테스트를 실행한다.

## Follow-up UX Direction

다음 단계에서는 Copilot/NanoGPT 설정을 모델 선택과 느슨하게 결합한 팝업형 흐름으로 분리한다. 이번 구현에서는 그 전단계로서 관련 상태와 API 호출을 BotSettings 내부에서 한 덩어리로 모아두고, 일반 provider 폼과의 결합을 최소화한다.
