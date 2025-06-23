FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package.json ./
RUN npm install

# Copy application files
COPY server.js ./
COPY openai-functions.js ./

# Test that dependencies work
RUN node -e "console.log('Testing dependencies...'); require('express'); require('cors'); require('dotenv'); require('openai'); console.log('✅ All dependencies loaded successfully')"

# Create non-root user and set permissions
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 8080

CMD ["node", "server.js"]