# Lightsail Cloudflare Deploy Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Publish the fork's Docker image on every `main` push, then trigger a protected production deploy on the existing Lightsail VM through Cloudflare Tunnel and Zero Trust.

**Architecture:** GitHub Actions builds and pushes `ghcr.io/<owner>/risuai-nodeonly`. After a successful `main` build, the workflow calls a protected deploy endpoint. That endpoint lives behind the existing Cloudflare Tunnel and forwards to an internal Watchtower HTTP API service on the Lightsail host. Watchtower updates only the `risuai` container and leaves `cloudflared` untouched.

**Tech Stack:** GitHub Actions, GHCR, Docker Compose, Cloudflare Tunnel, Cloudflare Access service tokens, Watchtower HTTP API

---

## Current State

- The Lightsail VM already runs Docker and standalone `docker-compose`.
- The production stack already includes `risuai-nodeonly` and `cloudflared`.
- The production app already pulls `ghcr.io/blissful-y0/risuai-nodeonly:latest`.
- The tunnel already serves the app over `cloud.shinyacal.shop`.
- No deploy trigger exists yet.

## Approved Production Flow

1. Push to `main`.
2. GitHub Actions builds the app image and pushes:
   - `ghcr.io/<owner>/risuai-nodeonly:latest`
   - `ghcr.io/<owner>/risuai-nodeonly:sha-<commit>`
3. The same workflow calls a protected deploy URL such as `https://deploy.<domain>/v1/update`.
4. Cloudflare Access checks the GitHub Actions service token.
5. Watchtower checks its own bearer token.
6. Watchtower pulls the new `risuai` image and restarts only that container.

## Security Model

- The deploy endpoint is not exposed on the VM public IP.
- Cloudflare Tunnel is the only ingress path.
- Cloudflare Access service authentication is the first gate.
- Watchtower HTTP API bearer auth is the second gate.
- GHCR pull auth remains on the server in `~/.docker/config.json`.
- The app container keeps its persistent data volume.

## Server-Side Changes

- Add `watchtower` to the production compose file.
- Add the watchtower HTTP API token to the server `.env`.
- Label only `risuai` for updates.
- Keep `cloudflared` unmanaged by watchtower.
- Create a new Cloudflare public hostname for deploy traffic that targets `http://watchtower:8080`.
- Protect that hostname with a Cloudflare Access application that accepts service tokens.

## Repository Changes

- Make Docker publishing run on `main` as well as release tags.
- Stop hardcoding the upstream GHCR namespace in the workflow.
- Add a deploy job that calls the protected endpoint only for `main`.
- Add production deploy templates and step-by-step docs for the Lightsail host.

## Failure Handling

- If deploy secrets are missing, the publish job still succeeds and the deploy step exits cleanly.
- If Watchtower rejects the request, GitHub Actions fails visibly.
- If the image pull or restart fails, Watchtower returns a non-success response and the workflow fails.
- Existing app data stays on the named volume.
