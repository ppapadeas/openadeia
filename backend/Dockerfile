FROM node:20-alpine AS base
WORKDIR /app

# Chromium for Playwright-based ADF portal scraping
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY package.json ./
RUN npm install --production

FROM base AS final
COPY . .
RUN npm run migrate 2>/dev/null || true
EXPOSE 4000
CMD ["node", "src/index.js"]
