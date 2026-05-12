# ── Stage 1: Build ────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Production ───────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Uploads-Ordner anlegen
RUN mkdir -p /app/uploads /data/rechnungen_pdf

EXPOSE 3000

CMD ["node", "dist/main"]
