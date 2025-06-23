FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY server.js openai-functions.js ./
EXPOSE 8080
CMD ["node", "server.js"]