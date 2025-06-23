FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies including tsx
RUN npm install

# Copy all source files
COPY . .

# Create a simple startup script
RUN echo '#!/bin/sh\necho "Starting AI Processor..."\necho "Port: $PORT"\necho "Environment: $(env | grep -E "PORT|NODE_ENV")"\nnpx tsx index.ts' > start.sh
RUN chmod +x start.sh

EXPOSE 8080

CMD ["./start.sh"]