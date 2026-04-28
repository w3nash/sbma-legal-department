FROM node:22-alpine AS base

# Install LibreOffice for document conversion
RUN apk add --no-cache libreoffice

WORKDIR /app

COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
