#!/bin/sh
echo "Running database migrations..."
pnpm exec db-migrate up -e $NODE_ENV
echo "Database migration completed."