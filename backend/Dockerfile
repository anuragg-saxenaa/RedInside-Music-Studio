FROM node:20-alpine

# deno = JS runtime yt-dlp uses to solve YouTube's signature/n-challenge.
# bgutil-ytdlp-pot-provider (pip) = the yt-dlp plugin that talks to the dedicated
# PO-token provider service (running separately on Railway at :4416).
RUN corepack enable && corepack prepare pnpm@9 --activate && \
    apk add --no-cache python3 make g++ ffmpeg py3-pip deno && \
    pip3 install --no-cache-dir --break-system-packages --upgrade yt-dlp bgutil-ytdlp-pot-provider

WORKDIR /app

COPY package*.json ./
RUN pnpm install --prod --ignore-scripts

COPY . .

EXPOSE 3000

RUN mkdir -p /app/database /app/storage

CMD ["sh", "-c", "node src/database/migrate.js && node src/server.js"]
