FROM ghcr.io/hologit/lenses/base:node-20

# Yarn 1 (classic) ships with the node base image. Add a toolchain so native
# modules can build via node-gyp, matching the habitat lens's gcc/make/python
# dependencies.
RUN apk add --no-cache python3 make g++

# Older Node runtimes for legacy lockfiles that only build on them (e.g.
# webpack < 5.61 needs OpenSSL 1.1 md4; packages using deprecated "./"
# exports mappings break on Node 17+). Node 18 is left out: it has the same
# OpenSSL 3 / strict-exports behavior as 20. Selected per-lens via
# [hololens.yarn-run] node_version; the default stays the base image's Node 20.
# Each runtime carries its own npm (and headers for node-gyp), since build
# tools like laravel-mix shell out to npx. These tags are final releases, so
# the binaries do not drift.
COPY --from=node:14.21.3-alpine /usr/local/bin/node /opt/node14/bin/node
COPY --from=node:14.21.3-alpine /usr/local/lib/node_modules/npm /opt/node14/lib/node_modules/npm
COPY --from=node:14.21.3-alpine /usr/local/include/node /opt/node14/include/node
COPY --from=node:16.20.2-alpine /usr/local/bin/node /opt/node16/bin/node
COPY --from=node:16.20.2-alpine /usr/local/lib/node_modules/npm /opt/node16/lib/node_modules/npm
COPY --from=node:16.20.2-alpine /usr/local/include/node /opt/node16/include/node
RUN for v in 14 16; do \
        ln -s ../lib/node_modules/npm/bin/npm-cli.js /opt/node$v/bin/npm \
        && ln -s ../lib/node_modules/npm/bin/npx-cli.js /opt/node$v/bin/npx; \
    done

# Copy package files
COPY yarn-run/package*.json ./

# Install dependencies
RUN npm install

# Copy lens script
COPY yarn-run/index.js ./
