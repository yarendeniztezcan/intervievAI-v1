FROM node:22-bookworm-slim

# Kod çalıştırıcı (sandbox) için gereken derleyici/yorumlayıcılar: Python, C (gcc), Java (JDK)
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 gcc libc6-dev default-jdk-headless \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV DB_PATH=/data/database.sqlite

EXPOSE 3001
CMD ["node", "src/index.js"]
