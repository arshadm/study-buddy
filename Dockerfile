# Build stage
FROM node:22-alpine AS builder

# better-sqlite3 and sharp may need to compile from source on this platform/arch
RUN apk add --no-cache python3 make g++

# Match the npm major version the lockfile was generated with (node:22-alpine ships an
# older npm whose stricter/older lockfile resolution can reject an up-to-date lockfile)
RUN npm install -g npm@11

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy all files
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:22-alpine AS runner

RUN apk add --no-cache python3 make g++
RUN npm install -g npm@11

WORKDIR /app

# Copy necessary files from builder
COPY --from=builder /app/.output /app/.output
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/package-lock.json /app/package-lock.json
# Raw migration SQL files are read from disk at runtime, not bundled into .output
COPY --from=builder /app/server/database/migrations /app/server/database/migrations

# Install production dependencies only (rebuilds native modules for this platform)
RUN npm ci --omit=dev

# Persistent SQLite database + uploaded question images live here (see .kamal deploy volume)
ENV STUDY_BUDDY_DATA_DIR=/data
VOLUME /data

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["node", ".output/server/index.mjs"]
