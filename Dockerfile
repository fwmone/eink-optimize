FROM debian:latest

EXPOSE 3030

RUN apt update
RUN apt install -y \
  build-essential \
  libcairo2-dev \
  libpango1.0-dev \
  libjpeg-dev \
  libgif-dev \
  librsvg2-dev \
  libpng-dev \
  nodejs \
  npm

WORKDIR /src
COPY eink-optimize.code-workspace eink-optimize.code-workspace 
COPY package-lock.json package-lock.json
COPY package.json package.json
COPY server.js server.js

RUN npm install

ENTRYPOINT ["node", "server.js"]
