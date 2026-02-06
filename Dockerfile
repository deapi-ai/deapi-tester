FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN mkdir -p data output

EXPOSE 3000

CMD ["npm", "run", "dev"]
