# syntax=docker/dockerfile:1

# ---- Base Node ----
FROM node:20-alpine AS base

WORKDIR /app

# ---- Dependencies ----
FROM base AS deps

COPY package.json package-lock.json ./

RUN npm ci
# Ensure platform-specific rollup binary is available (npm ci may skip optional deps)
RUN npm install --no-save @rollup/rollup-linux-arm64-musl 2>/dev/null; \
    npm install --no-save @rollup/rollup-linux-x64-musl 2>/dev/null; \
    true

# ---- Builder ----
FROM base AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build:all

# ---- Production ----
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Copy built output (server bundle + frontend assets)
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Install production dependencies only (needed for external packages)
COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev

USER nodejs

EXPOSE 3001

ENV PORT=3001

CMD ["node", "dist/index.js"]
