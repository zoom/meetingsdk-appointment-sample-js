# Platform-agnostic image for meetingsdk-appointment-sample-js.
#
# Build:  docker build -t meetingsdk-appointment-sample .
# Run:    docker run --env-file .env -p 3000:3000 meetingsdk-appointment-sample

# ─── Stage 1: build the page ────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY web/package.json web/package-lock.json ./web/
RUN npm --prefix web ci

COPY web ./web
RUN npm --prefix web run build

# ─── Stage 2: runtime ───────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime

RUN groupadd --system --gid 1001 app \
 && useradd --system --uid 1001 --gid app app

WORKDIR /app

# Server dependencies only. The build toolchain stays in the builder stage.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY --from=builder /app/web/dist ./web/dist

ENV NODE_ENV=production
ENV PORT=3000

USER app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
