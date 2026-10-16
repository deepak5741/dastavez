# One container runs both parts: Nuxt on $PORT (public) and the Deno API on 8000 (internal only).

# ---- Build the Nuxt app
FROM node:22.22-bookworm-slim AS web
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --ignore-scripts
COPY frontend/ ./
RUN npx nuxt build

# ---- Runtime
FROM node:22.22-bookworm-slim
COPY --from=denoland/deno:bin-2.9.7 /deno /usr/local/bin/deno
ENV DENO_DIR=/app/.deno NODE_ENV=production
WORKDIR /app/backend
COPY backend/ ./
RUN deno cache main.ts scripts/migrate.ts scripts/seed.ts
COPY --from=web /app/frontend/.output /app/frontend/.output
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh && useradd --system --home /app app && chown -R app /app
USER app
EXPOSE 10000
CMD ["/app/start.sh"]
