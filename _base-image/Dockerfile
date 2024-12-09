FROM node:20-alpine

# Install git
RUN apk add --no-cache git

# Install Hologit
RUN npm install -g hologit

# Create repository directory
RUN git init --bare /repo

# Create working tree directory
RUN mkdir /working

# Configure default committer
RUN git config --global user.email "hololens@container" \
    && git config --global user.name "Holo lens"

# Create directory for lens-server
WORKDIR /lens-server

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application files
COPY lib ./lib
COPY server.js ./
COPY git-hooks/ /repo/hooks/

# Expose default port
EXPOSE 9000

# Set environment variables
ENV PORT=9000
ENV GIT_DIR=/repo
ENV GIT_WORK_TREE=/working

# Start the server
CMD ["node", "/lens-server/server.js"]

# Set up lens template
ENV HOLOLENS_ENTRYPOINT=/lens/lens-tree
WORKDIR /lens
COPY lens-tree .
