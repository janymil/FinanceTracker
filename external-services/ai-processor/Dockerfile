FROM node:20-alpine

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json ./

# Install dependencies including tsx
RUN npm install

# Copy the JavaScript server file and openai functions
COPY server.js ./
COPY openai-functions.js ./

# Install tsx globally for better performance
RUN npm install -g tsx

# Create a non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change to non-root user
USER nodejs

EXPOSE 8080

# Start with Node.js to run JavaScript
CMD ["node", "server.js"]