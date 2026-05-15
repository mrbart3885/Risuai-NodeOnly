<p align="center">
  <a href="../en/termux.md">English</a> | <strong>한국어</strong> | <a href="../de/termux.md">Deutsch</a> | <a href="../cn/termux.md">简体中文</a> | <a href="../es/termux.md">Español</a> | <a href="../vi/termux.md">Tiếng Việt</a> | <a href="../zh-Hant/termux.md">繁體中文</a>
</p>

# Termux 설치 가이드

안드로이드 폰에서 Termux를 통해 PocketRisu를 직접 빌드해 사용하는 방법을 안내합니다. 같은 폰의 브라우저에서 `http://localhost:6001`로 접속하는 사용 패턴이 기본입니다.

- [1. 사전 준비](#1-사전-준비) — F-Droid Termux + 시스템 요구사항
- [2. 설치 및 빌드](#2-설치-및-빌드) — 한 줄 명령으로 자동 진행
- [3. 실행 및 접속](#3-실행-및-접속) — 폰 브라우저로 사용
- [4. 백그라운드 유지](#4-백그라운드-유지) — 화면 꺼진 상태에서도 서버 유지
- [5. 업데이트](#5-업데이트) — 최신 버전 받기
- [6. 제한사항](#6-제한사항) — Termux 환경에서 동작하지 않는 기능


## 시스템 요구사항

| 항목         | 최소           | 권장                          |
| ------------ | -------------- | ----------------------------- |
| **Android**  | 7.0 (API 24)   | 10 이상                       |
| **CPU 아키텍처** | ARM64          | ARM64                         |
| **RAM**      | 2GB            | 4GB 이상                      |
| **여유 공간**  | 2GB            | 4GB 이상 (빌드 결과물 포함)   |

PocketRisu는 Termux에서 미리 컴파일된 바이너리를 제공하지 않으며, 폰에서 직접 빌드합니다. `better-sqlite3` 같은 네이티브 모듈을 포함해 빌드 시간은 폰 성능에 따라 **약 10~40분** 소요됩니다.


---

## 1. 사전 준비

### Termux는 F-Droid 또는 GitHub Releases 버전을 사용

> ⚠️ **Play Store의 Termux는 사용할 수 없습니다.**
> Termux 개발진이 2020년 이후 Play Store 버전 업데이트를 중단했으며, PocketRisu 빌드에 필요한 최신 패키지(Node.js 22 이상 등)가 설치되지 않습니다.

다음 두 곳 중 하나에서 Termux를 받습니다.

- **F-Droid (권장)**: https://f-droid.org/packages/com.termux/
- **GitHub Releases**: https://github.com/termux/termux-app/releases

이미 Play Store 버전이 설치돼 있다면 삭제 후 위 두 곳 중 한 곳에서 새로 설치합니다.


---

## 2. 설치 및 빌드

Termux 앱을 연 후 다음 한 줄을 실행합니다.

```bash
pkg install -y git && \
  git clone https://github.com/PocketRisu/PocketRisu.git && \
  cd PocketRisu && \
  bash scripts/termux/build.sh
```

이 명령이 자동으로 처리합니다.

1. `git` 설치
2. PocketRisu 소스 다운로드
3. 빌드 의존성 설치 (`nodejs-lts`, `python`, `make`, `clang`, `pnpm` 등)
4. `pnpm install` — JavaScript 의존성 다운로드 및 네이티브 모듈 컴파일
5. `pnpm build` — 프론트엔드 번들링

빌드가 완료되면 다음 메시지가 표시됩니다.

```
Build OK. Start the server with:
  node server/node/server.cjs

Then open this address in the phone's own browser:
  http://localhost:6001
```


---

## 3. 실행 및 접속

빌드가 끝난 디렉터리에서 서버를 실행합니다.

```bash
node server/node/server.cjs
```

서버 부팅 로그가 표시되면 폰의 브라우저(Chrome, Firefox 등)에서 다음 주소를 엽니다.

```
http://localhost:6001
```

PocketRisu UI가 표시되면 정상입니다. `localhost`는 브라우저가 자동으로 secure context로 인정하므로 클립보드, crypto.subtle 등 모든 기능이 동작합니다.

서버 종료: 터미널에서 `Ctrl + C`


---

## 4. 백그라운드 유지

화면이 꺼지거나 다른 앱을 사용하는 동안에도 서버를 유지하려면 슬립 방지를 활성화합니다.

```bash
termux-wake-lock
```

Termux 알림 영역에 wake lock 상태가 표시되며, 폰 화면이 꺼져도 서버 프로세스가 종료되지 않습니다.

해제: `termux-wake-unlock`

> Android가 메모리 부족 상황에서 Termux를 강제 종료할 수 있습니다. 안정적으로 항상 켜두려면 폰의 배터리 최적화 설정에서 Termux를 제외해 두는 것을 권장합니다.


---

## 5. 업데이트

PocketRisu 디렉터리에서 다음을 실행합니다.

```bash
cd ~/PocketRisu
git pull
NODE_OPTIONS="--max-old-space-size=2048" pnpm build
```

코드 변경에 따라 새 의존성이 필요한 경우 `pnpm install`이 자동 실행됩니다. 빌드가 끝나면 서버를 재시작합니다.


---

## 6. 제한사항

설정 → 원격 접속 메뉴의 **Quick Tunnel은 Termux에서 사용할 수 없습니다**. cloudflared 바이너리가 Termux의 DNS·TLS 환경과 호환되지 않습니다.

PocketRisu UI는 Termux 환경을 자동 감지하여 해당 메뉴에 경고를 표시하고 버튼을 숨깁니다.


---

← [PocketRisu README로 돌아가기](../../i18n/README.ko.md)
