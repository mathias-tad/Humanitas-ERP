# Multi-stage Dockerfile for NestJS Admin Backend

# ----------------------------
# Stage 1: Build
# ----------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools needed for native modules like bcrypt
RUN apk add --no-cache python3 make g++

# Install all dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source and build
COPY . .
RUN npm run build

# ----------------------------
# Stage 2: Production Run
# ----------------------------
FROM node:20-alpine AS production

WORKDIR /app

# Copy built dist and compiled node_modules from builder (avoids recompiling bcrypt)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

# Create logs directory
RUN mkdir -p logs && chown -R node:node logs

USER node

CMD ["node", "dist/main"]
