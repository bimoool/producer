# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 SKIP_TYPECHECK=1
RUN npx next build

# Веб-приложение (Next.js standalone)
FROM node:22-alpine AS web
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 TZ=Asia/Yekaterinburg
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]

# Миграции и Telegram-бот (tsx + исходники)
FROM deps AS tools
WORKDIR /app
ENV NODE_ENV=production TZ=Asia/Yekaterinburg
COPY . .
USER node
CMD ["npx", "tsx", "src/bot/main.ts"]
