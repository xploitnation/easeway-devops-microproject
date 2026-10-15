# Stage 1: Build & Production Image
FROM node:20-bookworm-slim

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Install build dependencies for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package definitions first for layer caching
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy application source code
COPY config.js db.js seed.js server.js test.js resources.json ./
COPY public ./public

# Create data directory with appropriate permissions
RUN mkdir -p /app/data && chown -R node:node /app

# Run as non-root user for container security hardening
USER node

# Expose application port
EXPOSE 3000

# Declare persistent data volume
VOLUME ["/app/data"]

# Healthcheck to verify container health
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/api/me', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "server.js"]
