FROM node:20-slim AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production

# Install Playwright's version-matched Chromium + its system dependencies.
# Using the bundled browser avoids mismatches with the Alpine/Debian system package.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install --with-deps chromium

FROM base AS final
COPY . .
RUN npm run migrate 2>/dev/null || true
EXPOSE 4000
CMD ["node", "src/index.js"]
