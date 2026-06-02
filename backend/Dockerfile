FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@9 --activate && \
    apk add --no-cache python3 make g++ ffmpeg py3-pip git \
      pkgconf cairo-dev pango-dev jpeg-dev giflib-dev pixman-dev && \
    pip3 install --no-cache-dir --break-system-packages --upgrade yt-dlp bgutil-ytdlp-pot-provider

# PO-token provider — generates the token YouTube now requires from datacenter
# IPs, so downloads work server-side WITHOUT cookies. The yt-dlp plugin
# (bgutil-ytdlp-pot-provider, pip) auto-connects to this server on :4416.
RUN git clone --depth 1 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /opt/bgutil && \
    cd /opt/bgutil/server && npm install && (npm run build || npx tsc) && ls -la build/

WORKDIR /app

COPY package*.json ./
RUN pnpm install --prod --ignore-scripts

COPY . .

EXPOSE 3000

RUN mkdir -p /app/database /app/storage

# Start the PO-token provider in the background, then migrate + boot the API.
CMD ["sh", "-c", "node /opt/bgutil/server/build/main.js >/tmp/pot.log 2>&1 & node src/database/migrate.js && node src/server.js"]
