# Multi-stage Docker build for Conductor server
FROM node:18-alpine AS server-builder

# Set working directory
WORKDIR /app

# Copy server package files
COPY conductor-server/package*.json ./
RUN npm ci --only=production

# Copy server source code
COPY conductor-server/ ./

# Create necessary directories
RUN mkdir -p logs uploads backups

# Stage 2: Production server image
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S conductor && \
    adduser -S conductor -u 1001

# Set working directory
WORKDIR /app

# Copy server files from builder stage
COPY --from=server-builder --chown=conductor:conductor /app ./

# Create data directory for SQLite database
RUN mkdir -p /app/data && chown conductor:conductor /app/data

# Switch to non-root user
USER conductor

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/conductor.db

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "server.js"]