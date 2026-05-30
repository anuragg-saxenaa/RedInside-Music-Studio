FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate && \
    apk add --no-cache python3 make g++

WORKDIR /app

COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN pnpm install --prod --ignore-scripts

WORKDIR /app
COPY backend/ ./

EXPOSE 3000

CMD ["node", "src/server.js"]