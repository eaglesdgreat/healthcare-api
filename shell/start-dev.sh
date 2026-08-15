#!/bin/sh

export NODE_ENV=dev
export PORT=5501
# Ensure file watchers use polling mode inside the container (helps with Windows bind mounts)
export CHOKIDAR_USEPOLLING=true
export CHOKIDAR_INTERVAL=1000
export WATCHPACK_POLLING=true
export TSC_WATCHFILE=DynamicPriorityPolling

echo "Running database migrations..."
pnpm exec db-migrate up -e "$NODE_ENV"

echo "Starting NestJS in watch mode..."
pnpm run start:dev