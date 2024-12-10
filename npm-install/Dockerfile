FROM ghcr.io/hologit/lenses/base:node-20

# Copy package files
COPY npm-install/package*.json ./

# Install dependencies
RUN npm install

# Copy lens script
COPY npm-install/index.js ./
