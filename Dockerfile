# ------------------------------------------------------------------------------------------

ARG NODE_IMAGE=node:24-slim
ARG PNPM_VERSION=9.12.2
FROM ${NODE_IMAGE} AS base
ARG PNPM_VERSION
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
COPY package.json pnpm-lock.yaml ./

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# ------------------------------------------------------------------------------------------

FROM base AS deps
# better-sqlite3 requires native build tools on Node 24
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
# Install only prod deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

# ------------------------------------------------------------------------------------------

FROM deps AS builder
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm build

# ------------------------------------------------------------------------------------------

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=6001

COPY package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/server ./server
COPY --from=builder /app/dist ./dist

EXPOSE 6001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "const http=require('http');const req=http.get({host:'127.0.0.1',port:process.env.PORT||6001,path:'/'},(res)=>process.exit(res.statusCode < 500 ? 0 : 1));req.on('error',()=>process.exit(1));req.setTimeout(4000,()=>{req.destroy();process.exit(1);});"

CMD ["node", "server/node/server.cjs"]

# ------------------------------------------------------------------------------------------
