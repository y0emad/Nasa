FROM node:22-alpine AS client
WORKDIR /app
COPY client/package*.json ./client/
RUN npm ci --prefix ./client
COPY client ./client
RUN npm run build --prefix ./client

FROM node:22-alpine AS server-build
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app/server
ENV NODE_ENV=production
ENV PORT=8000

COPY server/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=server-build /app/server/dist ./dist
COPY server/src/data ./src/data
COPY --from=client /app/server/public ./public

USER node
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 8000) + '/planets/get').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]
