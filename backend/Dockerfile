FROM node:20-alpine

# Toolchain + deno (JS runtime yt-dlp uses to solve YouTube's signature/n-challenge)
# + native build deps for the PO-token provider's canvas dependency.
RUN corepack enable && corepack prepare pnpm@9 --activate && \
    apk add --no-cache python3 make g++ ffmpeg py3-pip git deno \
      pkgconf cairo-dev pango-dev jpeg-dev giflib-dev pixman-dev && \
    pip3 install --no-cache-dir --break-system-packages --upgrade yt-dlp bgutil-ytdlp-pot-provider

# Build the bgutil PO-token provider (generates the token YouTube requires from
# datacenter IPs → bypasses the bot-check WITHOUT cookies). yt-dlp's plugin
# auto-connects to it on 127.0.0.1:4416.
RUN git clone --depth 1 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /opt/bgutil && \
    cd /opt/bgutil/server && npm install && npx tsc && test -f build/main.js

WORKDIR /app

COPY package*.json ./
RUN pnpm install --prod --ignore-scripts

COPY . .

EXPOSE 3000

RUN mkdir -p /app/database /app/storage

# Supervisor: keep the PO-token provider alive (auto-restart if it dies — this is
# why it stayed down before), logs to stdout; then migrate + boot the API.
CMD ["sh", "-c", "while true; do echo '[POT] starting provider'; node /opt/bgutil/server/build/main.js 2>&1 | sed 's/^/[POT] /'; echo '[POT] provider exited, restarting in 3s'; sleep 3; done & node src/database/migrate.js && node src/server.js"]
