FROM ghcr.io/hologit/lenses/base:node-20

# Install helm3 using Alpine package manager
RUN apk add --no-cache helm

# Copy package files
COPY helm3/package*.json ./

# Install dependencies
RUN npm install

# Copy lens libs
COPY _lens-lib /_lens-lib
COPY _lens-lib-k8s /_lens-lib-k8s

# Copy lens script
COPY helm3/index.js ./
ENV HOLOLENS_ENTRYPOINT="/lens/index.js"
