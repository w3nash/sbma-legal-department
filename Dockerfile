# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache libc6-compat

FROM base AS deps

COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS builder

COPY . .
RUN --mount=type=secret,id=app_env,required=true \
    set -a; \
    . /run/secrets/app_env; \
    set +a; \
    NODE_ENV=production npm run build

FROM base AS prod-deps

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM base AS app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
RUN mkdir .next && chown nextjs:nodejs .next
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]

FROM base AS worker

ENV NODE_ENV=production

RUN apk add --no-cache libreoffice

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/generated ./generated
COPY package.json package-lock.json prisma.config.ts tsconfig.json ./
COPY prisma ./prisma
COPY env.ts ./env.ts
COPY lib ./lib
COPY workers ./workers

CMD ["npm", "run", "worker:documents"]
