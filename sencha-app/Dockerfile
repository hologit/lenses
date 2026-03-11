FROM --platform=linux/amd64 node:20-bookworm-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ruby \
    sed \
    gawk \
    curl \
    unzip \
    fontconfig \
    libfreetype6 \
    patch \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install Eclipse Temurin JDK 8
RUN mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://packages.adoptium.net/artifactory/api/gpg/key/public | gpg --dearmor -o /etc/apt/keyrings/adoptium.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/adoptium.gpg] https://packages.adoptium.net/artifactory/deb bookworm main" > /etc/apt/sources.list.d/adoptium.list \
    && apt-get update && apt-get install -y --no-install-recommends temurin-8-jre \
    && rm -rf /var/lib/apt/lists/*

# Download and install Sencha CMD 6.6.0.13
RUN curl -fsSL -o /tmp/sencha-cmd.zip "http://cdn.sencha.com/cmd/6.6.0.13/no-jre/SenchaCmd-6.6.0.13-linux-amd64.sh.zip" \
    && cd /tmp && unzip sencha-cmd.zip \
    && chmod +x SenchaCmd-*.sh \
    && ./SenchaCmd-*.sh -Dall=true -q -dir /opt/sencha-cmd \
    && rm -rf /tmp/sencha-cmd.zip /tmp/SenchaCmd-*

# Apply cache patch
COPY sencha-app/cache.patch /tmp/cache.patch
RUN patch -p0 -i /tmp/cache.patch -d /opt/sencha-cmd && rm /tmp/cache.patch

# Create sencha wrapper
RUN printf '#!/bin/sh\nexec /opt/sencha-cmd/sencha "$@"\n' > /usr/local/bin/sencha \
    && chmod +x /usr/local/bin/sencha

# Create workspace .sencha directory
RUN mkdir -p /opt/sencha-cmd/repo && chmod 777 /opt/sencha-cmd/repo

# --- Replicate hologit base image setup ---
RUN npm install -g hologit

RUN git init --bare /repo \
    && mkdir /working \
    && git config --global user.email "hololens@container" \
    && git config --global user.name "Holo lens"

WORKDIR /lens-server
COPY _base-image/package*.json ./
COPY _base-image/git-hooks/package*.json /repo/hooks/
RUN npm ci && cd /repo/hooks && npm ci
COPY _base-image/lib ./lib
COPY _base-image/server.js ./
COPY _base-image/git-hooks/ /repo/hooks/

COPY _lens-lib-k8s /_lens-lib-k8s
RUN cd /_lens-lib-k8s && npm install
COPY _lens-lib /_lens-lib
RUN cd /_lens-lib && npm install

EXPOSE 9000
ENV PORT=9000
ENV GIT_DIR=/repo
ENV GIT_WORK_TREE=/working
CMD ["node", "/lens-server/server.js"]
ENV HOLOLENS_ENTRYPOINT=/lens/index.js
WORKDIR /lens
COPY _base-image/index.js .
# --- End base image setup ---

# Copy lens files
COPY sencha-app/package*.json ./
RUN npm install
COPY sencha-app/index.js ./
