#!/bin/sh
echo "Running database migrations..."
# Using pnpm exec ensures it finds the binary in the container's node_modules
pnpm exec db-migrate up -e $NODE_ENV
echo "Database migration completed."