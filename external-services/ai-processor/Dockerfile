FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY index.ts openai-functions.js ./
RUN npx tsc index.ts --outDir . --target es2020 --module commonjs
EXPOSE 8080
CMD ["node", "index.js"]