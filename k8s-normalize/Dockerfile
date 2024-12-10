FROM ghcr.io/hologit/lenses/base:node-20

# Copy package files
COPY k8s-normalize/package*.json ./

# Install dependencies
RUN npm install

# Copy lens script
COPY k8s-normalize/index.js ./
