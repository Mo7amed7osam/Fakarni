FROM node:20

WORKDIR /app

ENV CI=true
ENV NODE_ENV=development
ENV NPM_CONFIG_AUDIT=false
ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

COPY . .

RUN npm ci

CMD ["npm", "run", "typecheck"]