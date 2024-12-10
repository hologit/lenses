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
COPY _base-image/package*.json ./
COPY _base-image/git-hooks/package*.json /repo/hooks/

# Install dependencies
RUN npm ci
RUN cd /repo/hooks && npm ci

# Copy application files
COPY _base-image/lib ./lib
COPY _base-image/server.js ./
COPY _base-image/git-hooks/ /repo/hooks/

# Copy lens libs and install dependencies
COPY _lens-lib-k8s /_lens-lib-k8s
RUN cd /_lens-lib-k8s && npm install

COPY _lens-lib /_lens-lib
RUN cd /_lens-lib && npm install

# Expose default port
EXPOSE 9000

# Set environment variables
ENV PORT=9000
ENV GIT_DIR=/repo
ENV GIT_WORK_TREE=/working

# Start the server
CMD ["node", "/lens-server/server.js"]

# Set up lens template
ENV HOLOLENS_ENTRYPOINT=/lens/index.js
WORKDIR /lens
COPY _base-image/index.js .
