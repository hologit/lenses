FROM ghcr.io/hologit/lenses/base:node-20

# Copy package files
COPY k8s-normalize/package*.json ./

# Install dependencies
RUN npm install

# Copy lens libs
COPY _lens-lib /_lens-lib
COPY _lens-lib-k8s /_lens-lib-k8s

# Copy lens script
COPY k8s-normalize/index.js ./
ENV HOLOLENS_ENTRYPOINT="/lens/index.js"
