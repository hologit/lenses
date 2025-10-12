FROM ghcr.io/hologit/lenses/base:node-20

# Copy package files
COPY k8s-patch/package*.json ./

# Install dependencies
RUN npm install

# Copy lens script
COPY k8s-patch/index.js ./
