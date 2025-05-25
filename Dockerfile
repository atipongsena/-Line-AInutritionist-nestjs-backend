# Multi-stage Docker build for AI Nutritionist Backend
FROM node:24-alpine AS base

# Install pnpm globally
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package management files first
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy scripts directory (สำหรับ preinstall script)
COPY scripts/ ./scripts/

# Copy only package.json files from packages (ไม่ copy node_modules)
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-types/tsconfig.json ./packages/shared-types/
COPY packages/shared-types/src/ ./packages/shared-types/src/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Development stage
FROM base AS development
# Copy source code
COPY src/ ./src/
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
CMD ["pnpm", "start:dev"]

# Build stage
FROM base AS builder
# Copy source code
COPY src/ ./src/
COPY tsconfig.json tsconfig.build.json nest-cli.json ./

# Build the application
RUN pnpm build

# Production stage
FROM node:24-alpine AS production

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy scripts directory (สำหรับ preinstall script)
COPY scripts/ ./scripts/

# Copy only package.json files from packages (ไม่ copy node_modules)
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-types/tsconfig.json ./packages/shared-types/
COPY packages/shared-types/src/ ./packages/shared-types/src/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Change ownership of the app directory
RUN chown -R nestjs:nodejs /app
USER nestjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Start the application (แก้ไขให้ชี้ไปที่ dist/src/main)
CMD ["node", "dist/src/main"] 