> 🔗 **원본 프로젝트**: [kwaroran/RisuAI](https://github.com/kwaroran/RisuAI) — 이 프로젝트는 RisuAI를 기반으로 한 커뮤니티 개조 버전입니다.
> 현재 원본 RisuAI **v2026.3.336** 까지의 변경사항이 반영되어 있습니다.

> [!CAUTION]
> 🚧 이 프로젝트는 아직 충분히 테스트되지 않은 버전입니다. **불안정할 수 있습니다.**
> 기존 RisuAI에서 이 버전으로 이사할 경우, 반드시 **기존 데이터를 백업**한 뒤에 진행하세요.
> 백업 없이 데이터를 옮기면 복구가 어려울 수 있습니다.

---

# 📦 RisuAI NodeOnly

[![Latest Release](https://img.shields.io/github/v/release/mrbart3885/Risuai-NodeOnly?label=latest)](https://github.com/mrbart3885/Risuai-NodeOnly/releases)
[![License: GPL-3.0](https://img.shields.io/github/license/mrbart3885/Risuai-NodeOnly)](LICENSE)
[![Node](https://img.shields.io/badge/node-≥22.12-brightgreen)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/docker-supported-blue)](#2--docker)

**RisuAI의 모든 기능 + 전용 편의기능, Node.js 서버 하나로.**

RisuAI NodeOnly는 원본 [RisuAI](https://github.com/kwaroran/RisuAI)를 **Node.js 로컬 서버** 전용으로 단순화 및 개조한 버전입니다.

프로덕션 자동배포 예시는 [deploy/lightsail/README.md](deploy/lightsail/README.md)를 참고하세요.

PC에서 실행하면 브라우저로 바로 사용하고, 간단한 설정 하나면 스마트폰에서도 접속할 수 있습니다.

---

## 🔍 일반 RisuAI와 뭐가 다른가요?

원본 RisuAI는 **웹사이트**, **데스크톱 앱(Tauri)**, **모바일 앱(Capacitor)** 등 여러 환경을 동시에 지원합니다. 이를 위해 데이터 저장, 네트워크 처리, 파일 관리 등에서 환경별로 다른 코드가 실행됩니다.

NodeOnly는 이 모든 분기를 걷어내고 **Node.js 서버 하나**만을 전제로 단순화했습니다.

그 결과:

- 🗄️ **데이터가 서버에 통합 저장됩니다.** 캐릭터, 채팅, 설정, 삽화(인레이) 등 모든 데이터가 서버의 SQLite DB 하나에 담깁니다. 브라우저를 바꾸거나 다른 기기에서 접속해도 항상 같은 데이터를 볼 수 있습니다.
- 🖥️ **브라우저는 화면만 담당합니다.** 데이터 저장이나 파일 관리를 브라우저가 하지 않으므로, 브라우저 종류나 설정에 따라 데이터가 날아가는 문제가 없습니다.
- ⚡ **서버가 직접 파일을 서빙합니다.** 이미지, 오디오 등의 에셋을 서버가 최적화된 방식으로 직접 전달하므로 로딩이 빠릅니다.
- 📉 **데이터 전송량이 최적화되어 있습니다.** 삽화(인레이) 이미지의 WebP 자동 압축, 썸네일 실시간 생성, 브라우저 캐싱, GZIP 응답 압축 등을 적용하여 네트워크 전송량을 크게 줄였습니다. 모바일에서 접속할 때 특히 체감됩니다.
- ✨ **NodeOnly 전용 편의기능이 포함되어 있습니다.** 테마 프리셋, 프롬프트 토글 프리셋, 페르소나 바인드 UI, 삽화 갤러리, 삽화 일괄 압축, 업데이트 자동 알림 등 원본에 없는 기능을 추가했습니다.

한마디로, **"내 PC(또는 서버)에서 돌아가는 나만의 RisuAI"** 입니다.

> 💡 **Node.js 설치가 어렵지 않나요?**
> 걱정하지 마세요. 포터블 패키지를 사용하면 Node.js를 직접 설치할 필요가 없습니다.
> Windows, macOS, Linux 모두 지원하며, 압축을 풀고 실행하면 바로 사용할 수 있습니다. Docker를 사용해도 마찬가지입니다.
> 자세한 내용은 아래 [설치 방법](#-설치-방법)을 참고하세요.

---

## 🙋 이런 분들에게 추천합니다

- 💻 **로컬에서 가볍게** AI 채팅을 즐기고 싶은 분
- 📱 서버에 설치해서 PC, 스마트폰 등 **여러 기기에서 접속**하고 싶은 분
- ✨ 프롬프트 토글 프리셋, 삽화 갤러리, 업데이트 알림 등 **전용 편의기능**이 마음에 드는 분
- 🚀 데이터 로딩 최적화, 서버 직접 서빙 등 **성능 개선**에 관심 있는 분

---

## ⭐ 주요 특징

### NodeOnly 전용 기능

#### 🖼️ 인레이 이미지(삽화) 최적화

삽화 모듈 등에서 사용하는 인레이 이미지를 서버가 통합 관리합니다.
PC에서 만든 삽화를 스마트폰에서도 그대로 볼 수 있고, 기기 간 동기화가 필요 없습니다.

- **WebP 자동 압축** — 인레이 이미지를 저장할 때 자동으로 WebP 형식으로 압축합니다. 서버 측 sharp 라이브러리로 처리하며, 원본 대비 저장 용량을 크게 줄입니다.
- **브라우저 캐싱** — 한번 불러온 인레이 이미지는 브라우저 캐시에 저장됩니다. 같은 채팅을 다시 열거나 페이지를 새로고침해도 서버에 다시 요청하지 않습니다.
- **일괄 압축** — 기존에 저장된 인레이 이미지를 한 번에 WebP로 변환할 수 있습니다. NodeOnly 설정에서 실행하면 절감된 용량을 실시간으로 확인할 수 있습니다.
- **인레이 이미지(삽화) 갤러리** — 저장된 삽화를 한눈에 관리할 수 있는 갤러리입니다. 사용하지 않는 고아 파일을 탐지하여 정리할 수 있고, 이미지 lazy loading으로 대량의 삽화도 부드럽게 탐색할 수 있습니다. (햄버거 메뉴 > 갤러리 아이콘)

> 📱 **모바일 데이터 절감** — WebP 압축 + 썸네일 서빙 + 브라우저 캐싱의 조합으로, 모바일에서 접속할 때 데이터 소모량이 크게 줄어듭니다. 같은 채팅을 다시 열어도 이미지를 다시 다운로드하지 않습니다.

#### 🎨 테마 프리셋

디스플레이 설정 전체(테마, 색상, CSS, 폰트, 크기, 기타 옵션)를 프리셋으로 저장하고 전환할 수 있습니다.
JSON 또는 `.risutheme` 형식으로 내보내기/가져오기가 가능하여, 다른 환경에 테마를 공유할 수 있습니다.
디스플레이 설정의 테마 탭 또는 빠른메뉴(모바일 세 손가락 터치)에서 접근할 수 있습니다.

#### 🎛️ 프롬프트 토글 프리셋

프롬프트 옵션(토글) 값을 프리셋으로 저장하고 불러올 수 있습니다.
자주 쓰는 토글 조합을 프리셋으로 저장해두면 한 번에 불러올 수 있고, 특정 채팅에 토글 값을 고정하면 해당 채팅에 들어갈 때 자동으로 복원됩니다.
캐릭터별로 다른 프롬프트 조합을 쓸 때 편리합니다.

#### 🧑 페르소나 바인드 UI

채팅별로 특정 페르소나를 바인딩할 수 있습니다.
바인딩된 채팅에서는 전역 페르소나 선택과 무관하게 항상 바인딩된 페르소나의 이름·프롬프트가 적용됩니다.
사이드바에서 현재 바인딩 상태를 한눈에 확인하고, 바인딩·변경·해제를 바로 할 수 있습니다.

#### 🔀 사이드바 프리셋/모델 선택

사이드바에서 현재 프리셋이나, 모델, 보조 모델을 확인하고, 클릭하면 바로 변경할 수 있습니다.
설정 페이지로 이동하지 않고도 모델을 빠르게 전환할 수 있어, 사용할 때 편리합니다.

#### ⚡ 에셋 직접 서빙

이미지, 오디오, 비디오 등의 에셋을 서버가 직접 서빙합니다.
원본 RisuAI는 에셋을 API 호출로 Base64 인코딩하여 전달하지만, NodeOnly는 서버가 파일을 그대로 HTTP 응답으로 보내므로 인코딩 오버헤드가 없고, HTTP 캐시 헤더를 통해 동일 에셋의 반복 다운로드를 방지합니다. 여기에 GZIP 응답 압축까지 적용되어, 특히 모바일 환경에서 전송량을 체감할 수 있을 만큼 줄입니다.

#### 💾 SQLite 저장소 & 서버 주도 백업

캐릭터, 채팅, 설정, 에셋 등 모든 데이터를 서버의 SQLite DB 하나에 저장합니다.
로컬 백업(`.bin`)도 서버에서 직접 처리하며, 스트리밍 방식으로 백업 파일을 생성하므로 브라우저 메모리 제한 없이 대용량 데이터도 백업/복원할 수 있습니다.

#### 📉 채팅 메모리 최적화

활성 채팅 하나만 브라우저 메모리에 올리고, 나머지 채팅은 서버에 두었다가 필요할 때 가져옵니다.
캐릭터와 채팅이 많아도 브라우저 메모리 사용량이 일정하게 유지되어, 모바일 브라우저에서 탭이 강제 종료되는 문제를 방지합니다.
저장 파일이나 백업 형식은 변경되지 않으며, 기존 데이터와 완전히 호환됩니다.

#### 🔔 업데이트 알림

새 버전이 출시되면 홈 화면과 팝업으로 자동 알림합니다.
서버가 GitHub Releases API를 주기적으로 확인하여, 일반 업데이트와 필수 업데이트를 구분하여 안내합니다.


## 📊 원본 RisuAI와의 차이점

| 항목         | 원본 RisuAI                           | NodeOnly                            |
| ------------ | ------------------------------------- | ----------------------------------- |
| 실행 방식    | 웹사이트 / 데스크톱 앱 / 모바일 앱    | Node.js 서버 (브라우저 접속)        |
| 데이터 저장  | 환경별로 다름 (localStorage, 파일 등) | SQLite 단일 DB                      |
| 백업         | Google Drive + 로컬                   | 서버 주도 로컬 백업 (스트리밍)      |
| 에셋 로딩    | API → Base64 인코딩                   | 서버 직접 서빙 + HTTP 캐시 + GZIP   |
| 삽화(인레이) | 브라우저 로컬 저장                    | 서버 통합 + WebP 압축 + 썸네일 생성 |
| 채팅 메모리  | 전체 채팅 상주                        | 활성 채팅만 로드 (lazy loading)     |
| 코드 구조    | 멀티 플랫폼 분기                      | 단일 코드 경로                      |

---

## 💻 시스템 요구사항

| 항목        | 최소         | 권장                 |
| ----------- | ------------ | -------------------- |
| **CPU**     | 1코어        | 2코어 이상           |
| **RAM**     | 1GB (실행만) | 4GB 이상 (빌드 포함) |
| **디스크**  | 1GB          | 2GB 이상             |
| **Node.js** | 22.12 이상   | —                    |

> 💡 **포터블 패키지**나 **Docker**를 사용하면 빌드 과정이 없으므로, RAM 1GB로도 실행할 수 있습니다.
> **직접 빌드**하는 경우(Git Clone, 설치 스크립트) 빌드 중 메모리를 많이 사용하므로 4GB 이상을 권장합니다.

---

## 🛠️ 설치 방법

난이도가 쉬운 순서대로 정렬했습니다. 자신에게 맞는 방법을 선택하세요.

---

### 1. 📦 포터블 패키지 (⭐ 추천, 가장 쉬움)

> 압축을 풀고 실행하면 바로 사용할 수 있습니다.
> Node.js, Docker 같은 것을 따로 설치할 필요가 없습니다.
> Windows, macOS(Apple Silicon), Linux를 지원합니다.

#### 설치 순서

**1단계: 다운로드**

[📥 Releases 페이지](https://github.com/mrbart3885/Risuai-NodeOnly/releases)에서 자신의 OS에 맞는 파일을 다운로드하세요.

| OS | 파일명 |
|----|--------|
| 🪟 Windows (x64) | `RisuAI-NodeOnly-vX.X.X-win-x64.zip` |
| 🍎 macOS (Apple Silicon) | `RisuAI-NodeOnly-vX.X.X-macos-arm64.tar.gz` |
| 🐧 Linux (x64) | `RisuAI-NodeOnly-vX.X.X-linux-x64.tar.gz` |

**2단계: 압축 해제**

🪟 **Windows**: 다운로드한 zip 파일의 압축을 원하는 위치에 풀어주세요.

🍎🐧 **macOS/Linux**: 터미널에서 실행:

```bash
tar -xzf RisuAI-NodeOnly-vX.X.X-*.tar.gz
```

> 🍎 **macOS 참고**: 처음 실행 시 "개발자를 확인할 수 없습니다" 경고가 나올 수 있습니다. 이 경우 터미널에서 아래 명령어를 한 번 실행해주세요:
> ```bash
> xattr -cr RisuAI-NodeOnly-vX.X.X-macos-arm64/
> ```

**3단계: 실행**

🪟 **Windows**: `RisuAI.bat`을 더블클릭하면 브라우저가 자동으로 열리며, `http://localhost:6001`로 접속됩니다.

🍎🐧 **macOS/Linux**: 터미널에서 실행:

```bash
cd RisuAI-NodeOnly-vX.X.X-*/
./start.sh
```

브라우저가 자동으로 열리며, `http://localhost:6001`로 접속됩니다.

#### 🔄 업데이트 방법

🪟 **Windows**: `update.bat`을 더블클릭

🍎🐧 **macOS/Linux**: 터미널에서 실행:

```bash
./update.sh
```

자동으로 최신 버전을 다운로드하고 파일을 교체합니다.
채팅, 캐릭터 등의 데이터(`save/` 폴더)는 그대로 보존됩니다.

#### 💻 터미널로 설치 (macOS/Linux)

GUI 없이 터미널에서 직접 다운로드하여 설치할 수 있습니다. 모니터 없는 서버 환경에서 유용합니다.

**Linux (x64):**

```bash
VERSION=$(curl -s https://api.github.com/repos/mrbart3885/Risuai-NodeOnly/releases/latest | grep -o '"tag_name":"[^"]*"' | cut -d'"' -f4)
curl -fsSL "https://github.com/mrbart3885/Risuai-NodeOnly/releases/download/${VERSION}/RisuAI-NodeOnly-${VERSION}-linux-x64.tar.gz" -o risuai.tar.gz
tar -xzf risuai.tar.gz && rm risuai.tar.gz
cd RisuAI-NodeOnly-${VERSION}-linux-x64
./start.sh
```

**macOS (Apple Silicon):**

```bash
VERSION=$(curl -s https://api.github.com/repos/mrbart3885/Risuai-NodeOnly/releases/latest | grep -o '"tag_name":"[^"]*"' | cut -d'"' -f4)
curl -fsSL "https://github.com/mrbart3885/Risuai-NodeOnly/releases/download/${VERSION}/RisuAI-NodeOnly-${VERSION}-macos-arm64.tar.gz" -o risuai.tar.gz
tar -xzf risuai.tar.gz && rm risuai.tar.gz
cd RisuAI-NodeOnly-${VERSION}-macos-arm64
xattr -cr .
./start.sh
```

> 💡 이후 업데이트는 설치된 폴더에서 `./update.sh`를 실행하면 됩니다.

---

### 2. 🐳 Docker

> Docker만 설치되어 있으면 **한 줄**로 끝납니다.

#### Docker가 뭔가요?

Docker는 프로그램을 "컨테이너"라는 독립된 공간에서 실행해주는 도구입니다. Node.js 같은 것을 직접 설치할 필요 없이, 모든 것이 컨테이너 안에 포함되어 있습니다.

#### 설치 순서

**1단계: Docker 설치**

- 🪟🍎 **Windows/Mac**: [Docker Desktop](https://www.docker.com/products/docker-desktop/) 다운로드 후 설치
- 🐧 **Linux**: 터미널에서 실행
  ```bash
  curl -fsSL https://get.docker.com | sh
  ```

**2단계: RisuAI 실행**

터미널(Windows: PowerShell, Mac/Linux: Terminal)을 열고 아래 명령어를 붙여넣으세요:

```bash
curl -L https://raw.githubusercontent.com/mrbart3885/Risuai-NodeOnly/main/docker-compose.yml | docker compose -f - up -d
```

**3단계: 접속**

브라우저를 열고 주소창에 입력:

```
http://localhost:6001
```

#### 🔄 업데이트 방법

```bash
docker compose pull && docker compose up -d
```

#### 💾 데이터 위치

채팅, 캐릭터 등 모든 데이터는 Docker 볼륨(`risuai-save`)에 안전하게 저장됩니다.
업데이트해도 데이터는 그대로 유지됩니다.

---

### 3. 📜 설치 스크립트 (Linux/macOS 서버용)

> 서버에 상시 구동하고 싶을 때 사용합니다. Node.js가 필요합니다.

#### 사전 준비

Node.js 22.12 이상이 설치되어 있어야 합니다.

```bash
# Node.js 버전 확인
node --version
# v22.12.0 이상이면 OK
```

Node.js가 없다면: [Node.js 공식 사이트](https://nodejs.org/)에서 설치하세요.

#### 설치 순서

터미널에서 아래 명령어 한 줄을 실행하세요:

```bash
curl -fsSL https://raw.githubusercontent.com/mrbart3885/Risuai-NodeOnly/main/install.sh | bash
```

설치가 완료되면 안내 메시지가 표시됩니다.

#### ▶️ 서버 시작

```bash
cd ~/risuai-nodeonly
pnpm runserver
```

브라우저에서 `http://localhost:6001`로 접속합니다.

#### 🔄 업데이트 방법

```bash
cd ~/risuai-nodeonly
./update.sh
```

---

### 4. 🧑‍💻 Git Clone (개발자/고급 사용자)

> 소스 코드를 직접 관리하고 싶은 분을 위한 방법입니다.

```bash
git clone https://github.com/mrbart3885/Risuai-NodeOnly.git
cd Risuai-NodeOnly
pnpm install
pnpm build
pnpm runserver
```

브라우저에서 `http://localhost:6001`로 접속합니다.

#### 🔄 업데이트 방법

```bash
git pull
pnpm install
pnpm build
# 서버 재시작
pnpm runserver
```

---

## 🚚 기존 RisuAI에서 이사하기

기존 RisuAI(웹 리스/로컬 리스)에서 NodeOnly로 데이터를 옮기는 방법입니다.

> [!IMPORTANT]
> 이사 전에 반드시 **기존 데이터를 백업**해두세요. 기존 RisuAI의 설정 > 백업에서 `.bin` 파일로 내보낼 수 있습니다.

### 방법 1: 로컬 백업 파일(`.bin`)로 이사 (모든 환경)

가장 간단한 방법입니다. 기존 RisuAI에서 내보낸 백업 파일을 NodeOnly에서 불러옵니다.

1. **기존 RisuAI**에서 설정 > 백업 > "로컬 백업 저장"으로 `.bin` 파일을 내보냅니다.
2. **NodeOnly**에서 설정 > 계정 & 파일 > "로컬 백업 불러오기"로 해당 `.bin` 파일을 불러옵니다.

### 방법 2: Save 폴더 zip 업로드 (소규모 데이터)

기존에 로컬 리스(Node 서버 버전)를 사용하고 있었다면, `save` 폴더를 zip으로 압축해서 직접 업로드할 수 있습니다.

1. 기존 RisuAI 프로젝트의 `save` 폴더를 통째로 **zip으로 압축**합니다.
2. 설정 > 계정 & 파일 > "노드온리로 세이브 불러오기" 섹션에서 "Save 폴더에서 불러오기 (Zip 업로드)"로 zip 파일을 업로드합니다.

> 💡 압축 파일 용량이 큰 경우 업로드에 실패할 수 있습니다. 이 경우 아래 방법 3을 사용하세요.

### 방법 3: Save 폴더 직접 복사 (대용량 데이터, 권장)

데이터가 수십 GB 이상으로 큰 경우 가장 안정적인 방법입니다.

1. NodeOnly 서버를 **정지**합니다.
2. 기존 RisuAI의 `save` 폴더를 NodeOnly의 `save` 폴더에 **통째로 덮어씌웁니다.**
3. NodeOnly 서버를 **재시작**하면 자동으로 마이그레이션이 진행됩니다.
   - 터미널(또는 PM2 로그)에서 진행률을 확인할 수 있습니다.
4. 마이그레이션 완료 후, 설정 > 계정 & 파일 > "마이그레이션된 Save 파일 정리"로 원본 파일을 삭제하여 디스크 공간을 확보할 수 있습니다.

### 어떤 방법을 선택해야 하나요?

| 상황 | 권장 방법 |
|------|-----------|
| 웹 리스에서 이사 | 방법 1 (`.bin` 백업) |
| 로컬 리스에서 이사, 데이터 소규모 | 방법 2 (zip 업로드) |
| 로컬 리스에서 이사, 데이터 대규모 (10GB+) | 방법 3 (직접 복사) |
| 잘 모르겠다 | 방법 1이 가장 쉽고 안전합니다 |

---

## 📱 모바일에서 접속하기 (Tailscale)

PC에서 실행 중인 RisuAI에 스마트폰으로 접속하고 싶다면 **Tailscale**을 추천합니다.

### Tailscale이 뭔가요?

Tailscale은 내 기기들끼리 안전한 사설 네트워크를 만들어주는 앱입니다.
같은 계정으로 로그인한 기기끼리만 접속할 수 있어서, 채팅 데이터가 외부로 노출될 걱정이 없습니다.

### 설정 순서

**1단계: Tailscale 설치**

- 🖥️ PC: [tailscale.com](https://tailscale.com/) 에서 다운로드
- 📱 스마트폰: App Store 또는 Google Play에서 "Tailscale" 검색 후 설치

**2단계: 같은 계정으로 로그인**

PC와 스마트폰 모두 동일한 계정(Google, Microsoft 등)으로 로그인합니다.

**3단계: PC에서 HTTPS 공유 설정**

PC 터미널에서 아래 명령어를 한 번만 실행하면 됩니다:

```bash
tailscale serve --bg http://localhost:6001
```

**4단계: 스마트폰에서 접속**

스마트폰 브라우저에서 아래 형태의 주소로 접속합니다:

```
https://내PC이름.tail어쩌구.ts.net
```

정확한 주소는 Tailscale 앱의 기기 목록에서 PC 이름을 확인하세요.

> 💡 한 번 설정하면 이후에는 PC에서 서버만 실행하면 스마트폰에서 바로 접속할 수 있습니다.
> URL이 항상 같으므로 브라우저 즐겨찾기에 추가해두면 편리합니다.

---

## ⚠️ 주의사항 및 한계점

> [!WARNING]
> 사용 전에 반드시 읽어주세요.

### 🧪 안정성

- 이 프로젝트는 **개인이 관리하는 커뮤니티 수정 버전**이며, 아직 충분한 테스트를 거치지 못했습니다. 예기치 않은 오류가 발생할 수 있습니다.
- 문제가 발생하면 [Issues](https://github.com/mrbart3885/Risuai-NodeOnly/issues)에 보고해주세요.

### 💾 데이터 보호

- **백업을 반드시 생활화하세요.** 설정 > 백업에서 로컬 백업 파일(`.bin`)을 정기적으로 내보내는 것을 권장합니다.
- 기존 RisuAI에서 이 버전으로 이사할 때는 **원본 데이터 백업을 먼저** 만들어두세요. 되돌리기 어려울 수 있습니다.
- 업데이트 전에도 백업을 권장합니다.

### 🖥️ 서버 실행 관련

- RisuAI NodeOnly는 **서버 프로그램**입니다. 서버가 실행 중인 PC(또는 서버)를 끄거나 프로그램을 종료하면, 스마트폰 등 다른 기기에서 접속할 수 없습니다.
- 같은 PC의 브라우저에서 접속하는 경우에도 서버가 실행 중이어야 합니다.

### 🚫 사용 불가 기능

| 기능                   | 상태      | 이유                                                                                                                                                                            |
| ---------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RisuRealm 업로드**   | 사용 불가 | 원본과 내부 구조가 다르기 때문에, Realm에 비정상적인 데이터가 올라가는 것을 방지하기 위해 업로드 기능을 제거했습니다. Realm에서 캐릭터를 **다운로드**하는 것은 정상 동작합니다. 캐릭터를 업로드하고 싶으시다면 [RisuRealm Standalone](https://realm.risuai.net/)을 이용해주시기 바랍니다. |
| **Google Drive 백업**  | 사용 불가 | 로컬 서버 환경에서 Google OAuth 인증이 안정적으로 동작하지 않아 제거했습니다. 대신 서버 주도 로컬 백업(`.bin`)을 사용합니다.                                               |
| **그룹 채팅**          | 지원 중단 | v0.4.1부터 그룹 채팅 생성 및 실행이 중단되었습니다. 기존 그룹 채팅 데이터는 삭제되지 않으며, 사이드바에서 확인·삭제할 수 있습니다.                                              |
| **멀티유저 룸**        | 지원 중단 | 멀티유저 룸(다중 사용자 채팅방) 기능이 제거되었습니다. 로컬 서버 환경에서 사용되지 않는 기능이었습니다.                                                                         |
| **초기 설정 튜토리얼** | 제거됨    | 로컬 서버 환경에서는 불필요하여 제거했습니다. 처음 실행하면 바로 메인 화면이 표시됩니다.                                                                                        |

### 📌 기타

- 원본 RisuAI의 업데이트가 자동으로 반영되지 않습니다. 원본의 새 기능이나 수정 사항은 수동으로 포팅해야 하므로 반영에 시간이 걸릴 수 있습니다.
- 웹 브라우저에서 접속하는 방식이므로, 브라우저 알림(푸시 알림)은 지원되지 않습니다.

---

## 📄 라이선스

이 프로젝트는 원본 RisuAI와 동일한 [GPL-3.0](LICENSE) 라이선스를 따릅니다.
