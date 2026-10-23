# The Line web app. Built with Next.js "standalone" output.
# It sits at the top of the repository because Clever Cloud looks for it here; the app
# itself is in web/. Runs the same on Clever Cloud (which sets PORT=8080) and on any
# Docker host (the fallback in section 3).
FROM node:22-alpine AS deps
WORKDIR /app
COPY web/package.json web/package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY web/ ./
RUN npx next build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
# Database changes (db/migrations) are applied on start, before the app serves anything.
COPY --from=build --chown=app:app /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=build --chown=app:app /app/db ./db
USER app
EXPOSE 3000 8080
CMD ["sh", "-c", "node scripts/migrate.mjs && exec node server.js"]
