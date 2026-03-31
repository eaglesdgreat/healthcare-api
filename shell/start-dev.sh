#!/bin/sh
export NODE_ENV=dev
export PORT=5501

echo "Running database migrations..."
# Using pnpm exec to ensure we hit the right binary in the container
pnpm exec db-migrate up -e $NODE_ENV 

echo "Starting NestJS in watch mode..."
pnpm run start:dev