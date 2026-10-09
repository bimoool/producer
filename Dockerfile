# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx next build

# Веб-приложение (Next.js standalone)
FROM node:22-alpine AS web
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 TZ=Asia/Yekaterinburg
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
USER app
EXPOSE 3000
CMD ["node", "server.js"]

# Миграции и Telegram-бот (tsx + исходники)
FROM deps AS tools
WORKDIR /app
ENV NODE_ENV=production TZ=Asia/Yekaterinburg
COPY . .
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app
CMD ["npx", "tsx", "src/bot/main.ts"]
