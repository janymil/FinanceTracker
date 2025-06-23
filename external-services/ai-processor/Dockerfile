FROM node:20-alpine

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json ./

# Install dependencies including tsx
RUN npm install

# Copy application files
COPY index.ts ./
COPY openai-functions.ts ./

# Create a non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change to non-root user
USER nodejs

EXPOSE 8080

# Start with tsx to run TypeScript directly
CMD ["npx", "tsx", "index.ts"]