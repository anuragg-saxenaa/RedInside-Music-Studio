FROM node:20-alpine

WORKDIR /app

COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --omit=dev

COPY backend/ ./

EXPOSE 3000

CMD ["node", "src/server.js"]