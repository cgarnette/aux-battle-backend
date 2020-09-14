FROM node:12-alpine

COPY src /usr/src
COPY package.json /usr/src

WORKDIR /usr/src

RUN npm install

CMD ["npm", "run", "start"]