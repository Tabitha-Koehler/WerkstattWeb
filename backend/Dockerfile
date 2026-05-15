# ── Stage 1: Build ────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

ENV PATH /app/node_modules/.bin:$PATH
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

RUN npm config set strict-ssl false

# System-Pakete für canvas, tesseract und PDF-Verarbeitung
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

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

# Runtime-Pakete für canvas und PDF
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 \
    libpango-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    librsvg2-2 \
    libpangocairo-1.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/uploads /data/rechnungen_pdf /tmp/rechnungen

EXPOSE 3000

CMD ["node", "dist/main"]
