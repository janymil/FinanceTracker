FROM node:20-alpine

WORKDIR /app

# Copy application files
COPY package.json ./
COPY index.ts ./

# Install dependencies
RUN npm install

# Create a non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change to non-root user
USER nodejs

EXPOSE 8080

# Start the server with tsx
CMD ["npm", "start"]