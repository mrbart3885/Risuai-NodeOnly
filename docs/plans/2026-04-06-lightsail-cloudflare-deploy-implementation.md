# Lightsail Cloudflare Deploy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automate production deploys for the fork by shipping Docker images from `main` and triggering a protected deploy endpoint on the existing Lightsail stack.

**Architecture:** Extend the existing Docker publish workflow so `main` pushes update GHCR. Add a deploy phase that calls a Cloudflare-protected Watchtower HTTP API endpoint. Commit production compose templates and documentation so the existing server can be brought in line with the repository.

**Tech Stack:** GitHub Actions, GHCR, Docker Compose, Cloudflare Tunnel, Cloudflare Access, Watchtower

---

### Task 1: Publish fork images from `main`

**Files:**
- Modify: `.github/workflows/docker-build.yml`

**Step 1: Update workflow triggers**

- Add `push.branches: [main]`.
- Keep release tag publishing.

**Step 2: Make image namespace fork-safe**

- Replace the hardcoded upstream image namespace with `${{ github.repository_owner }}/risuai-nodeonly`.

**Step 3: Publish stable and traceable tags**

- Publish `latest` on the default branch.
- Publish `sha-<commit>` on every run.
- Publish release tags on version tag pushes.

**Step 4: Verify workflow YAML loads**

Run:

```bash
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/docker-build.yml"); puts "ok"'
```

Expected: `ok`

### Task 2: Trigger production deploys after publish

**Files:**
- Modify: `.github/workflows/docker-build.yml`

**Step 1: Add a deploy job**

- Run only on `refs/heads/main`.
- Depend on the publish job.

**Step 2: Read deploy secrets from Actions**

- `DEPLOY_WEBHOOK_URL`
- `DEPLOY_WEBHOOK_TOKEN`
- `CF_ACCESS_CLIENT_ID`
- `CF_ACCESS_CLIENT_SECRET`

**Step 3: Skip cleanly when secrets are unset**

- Emit a warning and exit `0`.

**Step 4: Call the protected endpoint**

Use:

```bash
curl -fsS -X POST "$DEPLOY_WEBHOOK_URL" \
  -H "Authorization: Bearer $DEPLOY_WEBHOOK_TOKEN" \
  -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
  -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET"
```

**Step 5: Verify workflow YAML still loads**

Run:

```bash
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/docker-build.yml"); puts "ok"'
```

Expected: `ok`

### Task 3: Commit server deployment templates

**Files:**
- Create: `deploy/lightsail/docker-compose.example.yml`
- Create: `deploy/lightsail/.env.example`
- Create: `deploy/lightsail/README.md`
- Modify: `README.md`

**Step 1: Add a production compose template**

- Include `risuai`, `cloudflared`, and `watchtower`.
- Label only `risuai` for watchtower updates.
- Keep the named save volume.

**Step 2: Add an environment template**

- Include tunnel token and watchtower API token placeholders.

**Step 3: Document Cloudflare side setup**

- Public hostname for app traffic.
- Public hostname for deploy traffic.
- Access service token for the deploy hostname.

**Step 4: Add repository-level doc pointers**

- Link the production deployment guide from the main README.

**Step 5: Verify docs and YAML**

Run:

```bash
ruby -e 'require "yaml"; YAML.load_file("deploy/lightsail/docker-compose.example.yml"); puts "ok"'
```

Expected: `ok`
