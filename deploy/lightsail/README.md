# Lightsail Production Deploy

이 문서는 이미 Docker와 Cloudflare Tunnel이 올라간 Lightsail VM에서, `main` 푸시만으로 프로덕션을 갱신하는 설정 기준입니다.

## 구조

- GitHub Actions가 `main` 푸시마다 `ghcr.io/<owner>/risuai-nodeonly:latest`를 갱신합니다.
- 빌드가 끝나면 Actions가 `deploy.<domain>/v1/update`로 요청을 보냅니다.
- 그 요청은 Cloudflare Tunnel을 통해 `watchtower:8080`으로 전달됩니다.
- Watchtower는 `risuai-nodeonly` 컨테이너만 새 이미지로 갱신합니다.

## 서버 준비

1. 서버에 GHCR pull 인증이 있어야 합니다.
   - 현재 운영 서버 기준으로는 `~/.docker/config.json`을 그대로 씁니다.
2. 현재 tunnel 구성을 보고 compose 템플릿 하나를 선택합니다.
   - 같은 tunnel에서 앱과 배포 hostname을 같이 처리하면 `docker-compose.example.yml`
   - `deploy.<domain>`이 예전 별도 tunnel에 이미 묶여 있으면 `docker-compose.separate-deploy-tunnel.example.yml`
3. `.env.example`을 복사해 `.env`를 만들고 값을 채웁니다.
   - `RISU_IMAGE`는 현재 운영할 GHCR 이미지를 가리킵니다.
   - `CF_DEPLOY_TUNNEL_TOKEN`은 별도 deploy tunnel을 쓸 때만 필요합니다.
4. 적용 후 서버에서 아래 명령을 실행합니다.

```bash
docker-compose up -d
```

## Cloudflare Tunnel

패턴은 두 가지입니다.

1. 같은 tunnel 안에 public hostname 두 개를 둡니다.

- 앱 트래픽: `cloud.<domain>` 또는 기존 앱 도메인
  - Service: `http://risuai-nodeonly:6001`
- 배포 트래픽: `deploy.<domain>`
  - Service: `http://watchtower:8080`

2. 이미 `deploy.<domain>`이 다른 tunnel에 있으면 별도 `cloudflared-deploy` 컨테이너를 띄웁니다.

- 앱 tunnel token: `CF_TUNNEL_TOKEN`
- 배포 tunnel token: `CF_DEPLOY_TUNNEL_TOKEN`

현재 운영 서버는 두 번째 패턴을 사용합니다.

어느 패턴이든 `cloudflared`와 `watchtower`가 같은 compose 네트워크에 있어야 `watchtower` 호스트명이 해석됩니다.

## Cloudflare Access

`deploy.<domain>`에는 별도 Access 애플리케이션을 붙이는 편이 좋습니다.

- 정책: Service Auth 허용
- GitHub Actions용 service token 생성
- 아래 두 값을 GitHub Secrets에 저장
  - `CF_ACCESS_CLIENT_ID`
  - `CF_ACCESS_CLIENT_SECRET`

현재 구성은 Access 없이도 `Authorization: Bearer <WATCHTOWER_HTTP_API_TOKEN>`만으로 동작합니다. Access는 권장 추가 보호 계층입니다.

## GitHub Secrets

저장소 Secrets에 아래 값을 추가합니다.

- `DEPLOY_WEBHOOK_URL`
  - 예: `https://deploy.example.com/v1/update`
- `DEPLOY_WEBHOOK_TOKEN`
  - Watchtower의 `WATCHTOWER_HTTP_API_TOKEN`
- `CF_ACCESS_CLIENT_ID`
- `CF_ACCESS_CLIENT_SECRET`

마지막 두 값은 Zero Trust를 붙일 때만 필요합니다.

## 확인 순서

서버에서 직접 먼저 확인:

```bash
curl -fsS -X POST http://127.0.0.1:8080/v1/update \
  -H "Authorization: Bearer $WATCHTOWER_HTTP_API_TOKEN"
```

예시 템플릿은 watchtower를 `127.0.0.1:8080`에만 바인딩하므로, 외부 공인 IP로는 열리지 않습니다.

그 다음 Cloudflare Access 헤더를 포함해 외부 경로를 확인합니다.

```bash
curl -fsS -X POST https://deploy.example.com/v1/update \
  -H "Authorization: Bearer $DEPLOY_WEBHOOK_TOKEN" \
  -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
  -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET"
```

## 운영 메모

- 앱 데이터는 `risuai-save` 볼륨에 남습니다.
- `cloudflared`는 watchtower 대상이 아닙니다.
- 현재 운영 서버 로그 기준으로 app origin reset이 간헐적으로 보였기 때문에, 대규모 변경 직후에는 앱 접속 확인까지 같이 보는 편이 좋습니다.
