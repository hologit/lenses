FROM ghcr.io/hologit/lenses/base:node-20

# Copy package files
COPY npm-run/package*.json ./

# Install dependencies
RUN npm install

# Copy lens lib
COPY _lens-lib /_lens-lib

# Copy lens script
COPY npm-run/index.js ./
