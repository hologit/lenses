FROM ghcr.io/hologit/lenses/base:node-20

# Install Ruby 3.1 from Alpine 3.17 repos (compass 1.0.3 needs Ruby <=3.1)
RUN echo 'https://dl-cdn.alpinelinux.org/alpine/v3.17/main' >> /etc/apk/repositories \
    && apk add --no-cache ruby=3.1.5-r0 ruby-dev=3.1.5-r0 build-base

# Install compass gem
RUN gem install compass -v 1.0.3 --no-document

# Remove build dependencies to reduce image size
RUN apk del ruby-dev build-base

# Copy package files
COPY compass/package*.json ./

# Install dependencies
RUN npm install

# Copy lens script
COPY compass/index.js ./
