# Use Node.js LTS version
FROM node:20.18.1-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the extension
RUN pnpm build

# Production stage
FROM node:20.18.1-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

WORKDIR /app

# Copy built extension
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Expose volume for extension output
VOLUME ["/app/dist"]

CMD ["sh", "-c", "echo 'Extension built successfully. Output in /app/dist'"]
