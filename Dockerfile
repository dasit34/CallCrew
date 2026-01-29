FROM node:18-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY callcrew-backend/package*.json ./
RUN npm ci --omit=dev

COPY callcrew-backend .

EXPOSE 3000

CMD ["npm", "start"]
