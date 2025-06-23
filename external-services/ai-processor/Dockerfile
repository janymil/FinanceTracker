FROM node:20-alpine

WORKDIR /app

# Install dependencies directly without package.json to avoid any issues
RUN npm install express@4.18.2 cors@2.8.5 dotenv@16.3.1 openai@4.20.1

# Copy application files
COPY server.js openai-functions.js ./

# Verify dependencies are installed
RUN ls -la node_modules/

EXPOSE 8080

CMD ["node", "server.js"]