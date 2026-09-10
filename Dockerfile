# ---------- 1) 의존성 설치 ----------
FROM node:22-slim AS deps
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ---------- 2) 빌드 (migrate 서비스도 이 스테이지를 사용) ----------
FROM node:22-slim AS builder
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
# 빌드 시점에는 DB에 접속하지 않음 (전 페이지 dynamic 렌더링) — 형식상 더미 값
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV AUTH_SECRET="build-time-secret"
ENV AUTH_TRUST_HOST="true"
# NEXT_PUBLIC_* 는 빌드 시점에 클라이언트 번들에 박히므로 build arg로 받아야 한다
# (.env는 .dockerignore로 제외되어 있어 런타임 environment만으로는 결제창이 열리지 않음)
ARG NEXT_PUBLIC_PORTONE_STORE_ID
ARG NEXT_PUBLIC_PORTONE_CHANNEL_KEY
ENV NEXT_PUBLIC_PORTONE_STORE_ID=$NEXT_PUBLIC_PORTONE_STORE_ID
ENV NEXT_PUBLIC_PORTONE_CHANNEL_KEY=$NEXT_PUBLIC_PORTONE_CHANNEL_KEY
RUN npm run build

# ---------- 3) 실행 ----------
FROM node:22-slim AS runner
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/* \
  && groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs nextjs

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Next standalone 서버 + 정적 파일 (Prisma 쿼리 엔진 포함)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# 프로그램 설치 파일 (compose에서 볼륨으로 덮어쓸 수 있음)
COPY --from=builder --chown=nextjs:nodejs /app/private-files ./private-files

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
