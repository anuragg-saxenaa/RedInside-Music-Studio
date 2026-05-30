FROM node:20-alpine

WORKDIR /app

RUN rm -rf /app/node_modules 2>/dev/null || true

COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --omit=dev --no-audit --no-fund --ignore-scripts --force

WORKDIR /app
COPY backend/ ./

EXPOSE 3000

CMD ["node", "src/server.js"]