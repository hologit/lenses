FROM ghcr.io/hologit/lenses/base:node-20

# Install kubectl and kustomize using Alpine package manager
RUN apk add --no-cache kubectl kustomize

# Copy package files
COPY kustomize/package*.json ./

# Install dependencies
RUN npm install

# Copy lens libs
COPY _lens-lib /_lens-lib
COPY _lens-lib-k8s /_lens-lib-k8s

# Copy lens script
COPY kustomize/index.js ./
ENV HOLOLENS_ENTRYPOINT="/lens/index.js"
