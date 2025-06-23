FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY index.ts openai-functions.ts ./
RUN npx tsc --target es2020 --module commonjs --moduleResolution node --esModuleInterop true index.ts openai-functions.ts
EXPOSE 8080
CMD ["node", "index.js"]