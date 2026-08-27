FROM node:20-alpine

# Install curl to download ntfy
RUN apk add --no-cache curl

# Download and install ntfy binary
RUN curl -L https://github.com/binwiederhier/ntfy/releases/download/v2.11.0/ntfy_2.11.0_linux_amd64.tar.gz -o ntfy.tar.gz \
    && tar -xzf ntfy.tar.gz \
    && mv ntfy_2.11.0_linux_amd64/ntfy /usr/bin/ntfy \
    && rm -rf ntfy.tar.gz ntfy_2.11.0_linux_amd64 \
    && mkdir -p /var/lib/ntfy /etc/ntfy

# Set working directory for your Node app
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Copy and prepare the startup script
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Render uses the PORT environment variable to expose services
# The startup script handles binding ntfy to this port.
CMD ["/start.sh"]
