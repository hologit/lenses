FROM ghcr.io/hologit/lenses/base:node-20

# Install PHP CLI + Composer 2 from Alpine community. Composer runs with
# --ignore-platform-reqs (see index.js), so the PHP version here only has to
# run Composer itself, not satisfy the project's own PHP constraint. unzip and
# git cover dist extraction and the source-install fallback.
RUN apk add --no-cache composer unzip

# Copy package files
COPY composer-install/package*.json ./

# Install dependencies
RUN npm install

# Copy lens script
COPY composer-install/index.js ./
