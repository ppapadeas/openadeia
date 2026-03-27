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
EXPOSE 4000
CMD ["sh", "-c", "npx knex migrate:latest && node src/index.js"]
