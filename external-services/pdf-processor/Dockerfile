FROM node:18-alpine

# Force fresh build
ENV BUILDKIT_INLINE_CACHE=0

# Install system dependencies for Puppeteer and Canvas
RUN apk update && apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    curl \
    build-base \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev

# Tell Puppeteer to skip installing Chromium since we're using Alpine's version
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start the application directly with TypeScript
CMD ["npx", "tsx", "index.ts"]