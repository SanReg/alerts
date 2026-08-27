#!/bin/sh

# Render dynamically assigns a port for public web traffic via the PORT variable.
# We make ntfy listen on this port so it's accessible from the outside.
export NTFY_LISTEN_HTTP=":${PORT:-8080}"

# If Render provides the public URL, configure ntfy with it
export NTFY_BASE_URL=${RENDER_EXTERNAL_URL:-"http://localhost:${PORT:-8080}"}
export NTFY_CACHE_FILE="/var/lib/ntfy/cache.db"
export NTFY_AUTH_FILE="/var/lib/ntfy/auth.db"

# We tell your Node.js application to send notifications locally to the ntfy instance!
export NTFY_SERVER="http://localhost:${PORT:-8080}"

# Start ntfy server in the background
ntfy serve &

# Wait a second for ntfy to start
sleep 2

# Start the Node.js application in the foreground
echo "Starting Node.js watcher..."
npm start
