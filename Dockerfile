FROM node:20-alpine

WORKDIR /app

COPY Backend/package*.json ./Backend/
RUN cd Backend && npm install --omit=dev

COPY Backend ./Backend

WORKDIR /app/Backend

EXPOSE 5000

CMD ["npm", "start"]