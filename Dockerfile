# Stage 1: Base & Dependencies
FROM node:20-slim AS base

# Install netcat (nc) for the wait-for.sh script and procps for cleanup
RUN apt-get update && apt-get install -y \
    netcat-openbsd \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Enable pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy configuration files first to leverage Docker cache
COPY package.json pnpm-lock.yaml ./

# Install ALL dependencies (including devDeps for building/testing)
RUN pnpm install --frozen-lockfile

# Copy the rest of the source code
COPY . .

# Ensure shell scripts have correct permissions and LF line endings
RUN chmod +x ./shell/*.sh

# Stage 2: Build (Compiles TS to JS)
FROM base AS build
RUN pnpm build
# Remove development dependencies to keep the production image small
RUN pnpm prune --prod

# Stage 3: Production Release (The "Slim" Runner)
FROM node:20-slim AS release

# Install netcat in release too if you run migrations there
RUN apt-get update && apt-get install -y netcat-openbsd && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only the compiled code and production node_modules from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/shell ./shell

# Set environment defaults
ENV NODE_ENV=production
ENV PORT=5501

# Run as non-root user for security (Healthcare API Best Practice)
USER node

EXPOSE 5501

# The command is usually overridden by docker-compose for dev, 
# but this is the default for production
CMD ["node", "dist/main.js"]