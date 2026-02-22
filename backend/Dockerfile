FROM node:20-alpine AS base
WORKDIR /app
COPY package.json ./
RUN npm install --production

FROM base AS final
COPY . .
RUN npm run migrate 2>/dev/null || true
EXPOSE 4000
CMD ["node", "src/index.js"]
