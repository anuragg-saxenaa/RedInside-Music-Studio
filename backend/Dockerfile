FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate && \
    apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN pnpm install --prod --ignore-scripts

COPY . .

EXPOSE 3000

CMD ["node", "src/server.js"]