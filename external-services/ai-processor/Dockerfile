FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Compile TypeScript
RUN npx tsc

# Expose port
EXPOSE 8080

# Start the application
CMD ["node", "index.js"]