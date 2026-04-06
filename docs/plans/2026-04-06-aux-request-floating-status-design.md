# Aux Request Floating Status Design

## Goal

`RSND` 채팅 화면에서 메인 응답과 별개로 도는 보조 요청 상태를 한눈에 볼 수 있는 우하단 플로팅 상태 표시를 추가한다. 이번 범위는 `otherAx`, `submodel`, `translate` 요청을 공통으로 추적하고, `memory`, `emotion`은 제외한다.

## Scope

- `requestChatData` 공통 진입점에서 `otherAx`, `submodel`, `translate` 요청 시작/종료를 집계
- 우하단, 입력창 바로 위에 떠 있는 상태 전용 플로팅 버튼형 UI 추가
- 동시 실행 개수와 현재 요청 종류를 반영한 짧은 문구 표시
- 성공/실패/중단/스트리밍 종료까지 모두 안전하게 정리
- 최소 회귀 테스트 추가

## Non-Goals

- 플로팅 표시 클릭 액션
- `memory`, `emotion` 상태 표시
- 모듈 내부 Relay 전용 비표준 경로 추적
- 기존 메시지 내부 번역 로딩 제거

## Architecture

### Tracking Layer

`src/ts/process/request/request.ts`가 모든 보조 요청의 공통 진입점이므로, 여기서 추적을 거는 것이 가장 유지보수에 맞다. 추적 대상은 `otherAx`, `submodel`, `translate`만이며, 메인 `model`, `memory`, `emotion`은 무시한다.

추적 상태는 전역 저장소 하나로 유지한다. 저장소는 단순 불리언 대신 다음 값을 가진다.

- `activeCount`
- `byMode.otherAx`
- `byMode.submodel`
- `byMode.translate`
- `lastStartedAt`

이렇게 해야 여러 보조 요청이 동시에 돌 때 먼저 끝난 하나 때문에 표시가 사라지지 않는다.

### UI Layer

`src/lib/ChatScreens/DefaultChatScreen.svelte`에 우하단 플로팅 상태 표시를 추가한다. 다만 화면 하단 끝이 아니라 입력창 바로 위 여백에 붙여서, 마지막 메시지와 입력창을 가리지 않게 배치한다.

형태는 작은 둥근 버튼처럼 보이되, 실제 용도는 상태 표시 전용이다. 문구는 현재 활성 모드 조합에 따라 다음처럼 짧게 만든다.

- `보조 모델 처리 중`
- `번역 처리 중`
- `보조 요청 2개 처리 중`

모바일에서는 하단 안전 영역과 입력창 높이를 감안한 여백을 사용한다.

### Extension Path

이번 구현은 `requestChatData`를 타는 앱 내부 보조 요청을 공통으로 잡는다. 나중에 모듈 Relay 같은 비표준 경로도 여기에 합치고 싶다면, 모듈 API에서 같은 저장소를 올리고 내리는 공식 신호 함수를 추가하는 방향으로 확장한다.

## Error Handling

- 요청 결과가 성공이든 실패든 `finally`에서 카운트를 내린다.
- 중단된 요청도 같은 정리 경로를 사용한다.
- 스트리밍 요청도 Promise 수명 기준으로 추적해서 중간 chunk 수신과 무관하게 종료 시점이 맞게 잡히도록 한다.

## Testing

- `otherAx`, `submodel`, `translate` 시작 시 상태가 올라가는지 테스트
- 종료 시 상태가 내려가는지 테스트
- 두 요청이 겹칠 때 카운트가 유지되는지 테스트
- `memory`, `emotion`, `model`은 집계되지 않는지 테스트
- `pnpm check`와 관련 Vitest를 실행한다

## UX Notes

`translate`는 기존 메시지 내부 로딩과 중복될 수 있지만, 사용자가 하단 통합 상태 표시를 더 선호하므로 이번 단계에서는 중복을 허용한다. 이후 번역 로딩 UX를 정리할 때 플로팅 표시를 기준으로 재조정한다.
