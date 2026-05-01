# Frontend Dockerfile for Matrix Admin Panel System (MAPS)
# This container runs the Next.js frontend application

# Use Bun as base image for faster installs and builds
FROM oven/bun:1 AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files and Bun lockfile
# Bun can use bun.lock (text) or bun.lockb (binary) lockfile
COPY package.json bun.lock* bun.lockb* ./

# Install dependencies using Bun
# --frozen-lockfile ensures we use the exact versions from lockfile
# Bun is significantly faster than npm/yarn
RUN bun install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy the rest of the application code
COPY . .

# Client bundle: empty = same-origin /api (rewrites use BACKEND_INTERNAL_URL)
ARG NEXT_PUBLIC_API_URL=
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
# Rewrites are baked at build time — must match the backend service hostname in Compose
ARG BACKEND_INTERNAL_URL=http://backend:8000
ENV BACKEND_INTERNAL_URL=${BACKEND_INTERNAL_URL}

# Build the Next.js application using Bun
# This creates an optimized production build with standalone output
RUN bun run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

# Set environment to production
ENV NODE_ENV=production

# Create a non-root user for security
# Bun image is Debian-based but minimal, so we install passwd package for user management
RUN apt-get update && \
    apt-get install -y --no-install-recommends passwd && \
    groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs && \
    rm -rf /var/lib/apt/lists/*

# Copy necessary files from builder
# - .next/standalone: The standalone server build
# - .next/static: Static assets
# - public: Public assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Switch to non-root user
USER nextjs

# Expose port 3000 (Next.js default port)
EXPOSE 3000

# Set environment variable for port
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
# Using node since Next.js standalone build uses Node.js runtime
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Start the Next.js server from the standalone build
# Using node since Next.js standalone build uses Node.js runtime
CMD ["node", "server.js"]
