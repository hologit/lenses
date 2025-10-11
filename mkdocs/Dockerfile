FROM ghcr.io/hologit/lenses/base:node-20

# Install Python and pip
RUN apk add --no-cache python3 py3-pip

# Copy package files
COPY mkdocs/package*.json ./

# Install dependencies
RUN npm install

# Copy lens script
COPY mkdocs/index.js ./
