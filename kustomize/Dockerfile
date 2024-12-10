FROM ghcr.io/hologit/lenses/base:node-20

# Install kubectl and kustomize using Alpine package manager
RUN apk add --no-cache kubectl kustomize

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy lens script
COPY kustomize.js ./
ENV HOLOLENS_ENTRYPOINT="/lens/kustomize.js"
