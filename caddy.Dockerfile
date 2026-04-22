FROM golang:1.25-alpine AS builder
RUN apk add --no-cache git
RUN go install github.com/caddyserver/xcaddy/cmd/xcaddy@latest
RUN xcaddy build --with github.com/caddy-dns/cloudflare

# Patch: relax token regex from {35,50} to {35,100} for cfut_ tokens
RUN CF_FILE=$(find $(go env GOPATH)/pkg/mod/github.com/caddy-dns -name "cloudflare.go" | head -1) && \
    chmod +w "$CF_FILE" && \
    sed -i 's/{35,50}/{35,100}/g' "$CF_FILE" && \
    xcaddy build --with github.com/caddy-dns/cloudflare

FROM caddy:2
COPY --from=builder /go/caddy /usr/bin/caddy
