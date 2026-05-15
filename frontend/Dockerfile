# ── Stage 1: Build Angular App ───────────────────
FROM node:20-slim AS builder

WORKDIR /app

ENV PATH /app/node_modules/.bin:$PATH
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

RUN npm config set strict-ssl false

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# ── Stage 2: Nginx ────────────────────────────────
FROM nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist/werkstattweb/browser /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
