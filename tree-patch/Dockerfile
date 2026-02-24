FROM ghcr.io/hologit/lenses/base:node-20

# Copy package files
COPY tree-patch/package*.json ./

# Install dependencies
RUN npm install

# Copy lens script
COPY tree-patch/index.js ./
