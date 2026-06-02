FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@9 --activate && \
    apk add --no-cache python3 make g++ ffmpeg py3-pip && \
    pip3 install --no-cache-dir --break-system-packages --upgrade yt-dlp

WORKDIR /app

COPY package*.json ./
RUN pnpm install --prod --ignore-scripts

COPY . .

EXPOSE 3000

RUN mkdir -p /app/database /app/storage

CMD ["sh", "-c", "node src/database/migrate.js && node src/server.js"]