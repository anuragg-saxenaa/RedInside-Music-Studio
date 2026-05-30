FROM node:20-alpine

WORKDIR /app

COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

RUN corepack enable && \
    cd backend && npm ci --omit=dev && \
    cd ../frontend && npm ci --omit=dev

COPY backend/ ./backend/
COPY frontend/ ./frontend/

EXPOSE 3000

CMD ["node", "backend/src/server.js"]