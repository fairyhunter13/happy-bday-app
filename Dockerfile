# ==============================================================================
# Birthday Message Scheduler - Production Dockerfile
# ==============================================================================
# Multi-stage build for minimal image size and security
# Target: Node.js 20 Alpine with production dependencies only

# ==============================================================================
# Stage 1: Dependencies
# ==============================================================================
FROM node:20-alpine3.20 AS deps

WORKDIR /app

# Install dependencies for native modules (if any) and security updates
RUN apk update && \
    apk add --no-cache libc6-compat && \
    apk upgrade --no-cache && \
    rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci --ignore-scripts && \
    npm cache clean --force

# ==============================================================================
# Stage 2: Builder
# ==============================================================================
FROM node:20-alpine3.20 AS builder

WORKDIR /app

# Apply security updates
RUN apk update && \
    apk upgrade --no-cache && \
    rm -rf /var/cache/apk/*

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN npm run build

# Prune dev dependencies
RUN npm prune --production && \
    npm cache clean --force

# ==============================================================================
# Stage 3: Production Runner
# ==============================================================================
FROM node:20-alpine3.20 AS runner

# Build arguments for labels
ARG NODE_ENV=production
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION=1.0.0

# Labels for container metadata
LABEL org.opencontainers.image.title="Birthday Message Scheduler" \
      org.opencontainers.image.description="Production-ready birthday message scheduler with timezone support" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.vendor="Happy Birthday App" \
      org.opencontainers.image.licenses="Apache-2.0"

WORKDIR /app

# Set environment
ENV NODE_ENV=${NODE_ENV}

# Apply security updates, update npm to fix vulnerabilities, and remove unnecessary packages
# npm update fixes: cross-spawn@7.0.3 -> 7.0.6, glob@10.4.2 -> 10.5.0+
RUN apk update && \
    apk upgrade --no-cache && \
    apk add --no-cache dumb-init && \
    npm install -g npm@latest && \
    npm cache clean --force && \
    rm -rf /var/cache/apk/* /tmp/* /var/tmp/*

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Copy built application
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/package.json ./package.json

# Copy migration files if they exist
COPY --from=builder --chown=appuser:nodejs /app/src/db/migrations ./src/db/migrations

# Set correct permissions
RUN chmod -R 755 /app/dist

# Switch to non-root user
USER appuser

# Expose application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Default command - main API server (using dumb-init for proper signal handling)
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/index.js"]
