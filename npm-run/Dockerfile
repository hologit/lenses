FROM ghcr.io/hologit/lenses/base:node-20

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy lens script
COPY npm-run.js ./
ENV HOLOLENS_ENTRYPOINT="/lens/npm-run.js"
