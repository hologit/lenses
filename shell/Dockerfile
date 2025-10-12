FROM ghcr.io/hologit/lenses/base:node-20

# Install bash
RUN apk add --no-cache bash

# Copy package files
COPY shell/package*.json ./

# Install dependencies
RUN npm install

# Copy lens script
COPY shell/index.js ./
