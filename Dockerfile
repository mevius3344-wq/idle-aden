# Railway 遊戲主機。素材約 2.2GB，只能 COPY 一次（Nixpacks 會整包複製三次，映像超過試用方案上限而建置失敗）
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY . .
RUN node scripts/inject-version.js
CMD ["node", "_serve.js"]
