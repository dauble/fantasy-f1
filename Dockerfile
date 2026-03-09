# Dockerfile
# Replaces the nginx-based setup with a Node.js Express server
# that both serves the Vite build and proxies the Anthropic API.

# ── Stage 1: Build the Vite app ───────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Production server ────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Copy only what the server needs
COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY server.js ./

# Fly.io sets PORT automatically; default to 8080
ENV PORT=8080
EXPOSE 8080

# ANTHROPIC_API_KEY must be set as a Fly.io secret (fly secrets set ANTHROPIC_API_KEY=...)
# It is intentionally NOT baked into the image.

CMD ["node", "server.js"]
