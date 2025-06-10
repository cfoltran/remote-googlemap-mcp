FROM node:slim

# Install flyctl
COPY --from=flyio/flyctl:latest /flyctl /usr/bin/flyctl

# Set working directory
WORKDIR /app

# Install the official Google Maps MCP server
RUN npm install -g @modelcontextprotocol/server-google-maps

# Create data directory
RUN mkdir -p /data

# Expose port
EXPOSE 8080

# Create volume
VOLUME /data

# Create startup script to handle environment variable expansion
COPY <<EOF /app/start.sh
#!/bin/bash
exec /usr/bin/flyctl mcp wrap --mcp=npx -- @modelcontextprotocol/server-google-maps
EOF

RUN chmod +x /app/start.sh

# The GOOGLE_MAPS_API_KEY will be provided as environment variable at runtime
CMD ["/app/start.sh"]