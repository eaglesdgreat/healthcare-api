#!/bin/sh
export NODE_ENV=dev
export PORT=5501

echo "Running database migrations..."
pnpm exec db-migrate up -e $NODE_ENV 

echo "Starting NestJS in watch mode..."
pnpm run start:dev