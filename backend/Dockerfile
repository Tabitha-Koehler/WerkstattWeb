# ── Stage 1: Build ────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

ENV PATH /app/node_modules/.bin:$PATH
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

RUN npm config set strict-ssl false

COPY package*.json ./
RUN npm install

COPY . .
RUN nest build

# ── Stage 2: Production ───────────────────────────
FROM node:20-slim AS production

WORKDIR /app

ENV NODE_ENV=production
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

RUN npm config set strict-ssl false

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/uploads /data/rechnungen_pdf

EXPOSE 3000

CMD ["node", "dist/main"]
