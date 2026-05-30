FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN echo "=== /app contents ===" && ls -la && echo "=== src contents ===" && ls -la src/ 2>/dev/null || echo "no src/"

EXPOSE 3000

CMD ["node", "src/server.js"]