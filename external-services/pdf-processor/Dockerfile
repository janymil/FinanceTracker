FROM node:20-alpine

WORKDIR /app

# Copy package manifests
COPY package*.json tsconfig.json ./

# Install dependencies (no native Cairo/Chromium needed!)
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build

EXPOSE 3000

ENV PORT=3000 \
    NODE_ENV=production

CMD ["npm", "start"]
