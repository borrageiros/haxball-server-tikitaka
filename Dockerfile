FROM node:22-bookworm-slim AS build

RUN corepack enable

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY tsconfig.json index.ts ./
COPY utils ./utils/
COPY commands ./commands/
COPY match ./match/
RUN yarn build

FROM node:22-bookworm-slim

RUN corepack enable

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production && yarn cache clean

COPY --from=build /app/dist ./dist/
COPY .env.example ./
COPY maps ./maps/
COPY locales ./locales/

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
