FROM node:slim

# Install flyctl
COPY --from=flyio/flyctl:latest /flyctl /usr/bin/flyctl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build

# Create data directory
RUN mkdir -p /data

# Expose port
EXPOSE 8080

# Create volume
VOLUME /data

# Create startup script to handle environment variable expansion
COPY <<EOF /app/start.sh
#!/bin/bash
exec node dist/index.js
EOF

RUN chmod +x /app/start.sh

# The GOOGLE_MAPS_API_KEY will be provided as environment variable at runtime
CMD ["/app/start.sh"]