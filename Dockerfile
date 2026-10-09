FROM node:22-alpine
WORKDIR /app

COPY package*.json ./

COPY client/package*.json ./client/
RUN npm install --prefix ./client

COPY server/package*.json ./server/
RUN npm install --prefix ./server

COPY client ./client
RUN npm run build --prefix ./client

COPY server ./server

ENV NODE_ENV=production
USER node
EXPOSE 8000

CMD ["npm", "start", "--prefix", "server"]