# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy scripts folder (needed for postinstall hook)
COPY scripts ./scripts

# Install dependencies
RUN npm ci

# Copy source code
COPY . .
COPY .env .env
COPY .env.local .env.local

# Build the Next.js application
RUN npm run build

# Stage 2: Runtime
FROM node:22-alpine

WORKDIR /app

# Set environment to production
ENV NODE_ENV=production

# Copy package files and scripts
COPY package*.json ./
COPY scripts ./scripts

# Install only production dependencies
RUN npm ci --only=production

# Copy built application from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts

# Expose port 3000 (default Next.js port)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start the application
CMD ["npm", "start"]
