
FROM node:18-slim

# Install system dependencies required for Puppeteer and Canvas
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    curl \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libgtk-3-0 \
    libgtk-4-1 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    libu2f-udev \
    libvulkan1 \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Chrome browser
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-archive-keyring.gpg \
    && sh -c 'echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-archive-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Configure Puppeteer to use installed Chrome
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV NODE_ENV=production

# Create app directory and set proper permissions
WORKDIR /app
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Copy package files first for better caching
COPY --chown=node:node package*.json ./

# Install dependencies
RUN npm ci --only=production --no-audit --no-fund

# Install TypeScript globally for build
USER root
RUN npm install -g typescript
USER node

# Copy TypeScript config and source files
COPY --chown=node:node tsconfig.json ./
COPY --chown=node:node *.ts ./

# Build the application
RUN npm run build

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

# The port will be set by Fly.io via the PORT environment variable
EXPOSE ${PORT:-3000}

# Start the application with error handling
CMD ["sh", "-c", "node dist/index.js 2>&1"]
