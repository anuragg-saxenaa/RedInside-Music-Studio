FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY backend/package*.json ./backend/
RUN npm install -g pnpm && \
    cd backend && npm install --production=false

# Copy source
COPY . .

# Build frontend
RUN cd frontend && npm install --production=false && npm run build

# Expose port
EXPOSE 3000

# Start command
CMD ["node", "backend/src/server.js"]