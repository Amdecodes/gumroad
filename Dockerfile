# syntax=docker/dockerfile:1
ARG RUBY_VERSION=3.4.3
FROM ruby:${RUBY_VERSION}-bookworm AS base

WORKDIR /app

ENV RAILS_ENV=production \
    BUNDLE_PATH=/bundle_path \
    BUNDLE_WITHOUT="development test" \
    APP_DIR=/app \
    LANG=C.UTF-8

# Install native system dependencies
RUN apt-get update -qq && \
    apt-get install -yq --no-install-recommends \
      build-essential \
      ca-certificates \
      curl \
      default-libmysqlclient-dev \
      default-mysql-client \
      ffmpeg \
      fonts-dejavu \
      fonts-noto-core \
      gnupg \
      imagemagick \
      jq \
      less \
      libcurl4-openssl-dev \
      liblzma-dev \
      libssl-dev \
      libtag1-dev \
      libxml2-dev \
      libyaml-dev \
      libxrender1 \
      shared-mime-info \
      tzdata \
      unzip \
      zlib1g-dev && \
    mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" > /etc/apt/sources.list.d/nodesource.list && \
    apt-get update -qq && \
    apt-get install -yq --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/* /tmp/*

# Build stage: Install gems and precompile frontend assets
FROM base AS build

ARG BUNDLE_GEMS__CONTRIBSYS__COM

COPY Gemfile Gemfile.lock .ruby-version ./
RUN mkdir -p /bundle_path && \
    BUNDLE_GEMS__CONTRIBSYS__COM=$BUNDLE_GEMS__CONTRIBSYS__COM bundle install -j$(nproc) && \
    rm -rf /bundle_path/ruby/*/cache/*.gem

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build-time environment variables for asset precompilation
ENV NODE_OPTIONS="--max-old-space-size=4096" \
    DATABASE_NAME=dummy \
    DATABASE_HOST=localhost \
    DATABASE_PORT=3306 \
    DATABASE_USERNAME=root \
    DEVISE_SECRET_KEY=build-asset-precompile-secret-key-12345678 \
    SECRET_KEY_BASE=build-asset-precompile-secret-key-12345678 \
    REVISION=1 \
    MEMCACHE_SERVERS=localhost:11211 \
    ELASTICSEARCH_HOST=http://localhost:9200 \
    RACK_ATTACK_REDIS_HOST=localhost:6379/3 \
    REDIS_HOST=localhost:6379/0 \
    SIDEKIQ_REDIS_HOST=localhost:6379/1

RUN npm run setup && \
    bundle exec rails assets:precompile && \
    rm -rf node_modules/.cache /app/tmp/cache/assets

# Production runtime stage
FROM base AS production

RUN useradd -ms /bin/bash app && \
    mkdir -p /app/log /app/tmp/pids /app/tmp/cache && \
    chown -R app:app /app

COPY --from=build /bundle_path /bundle_path
COPY --from=build --chown=app:app /app /app

USER app
WORKDIR /app

ENV PORT=3000 \
    RAILS_SERVE_STATIC_FILES=true \
    RAILS_LOG_TO_STDOUT=true

EXPOSE 3000

CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]
