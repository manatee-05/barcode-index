FROM node:18-slim

# Create and define app directory
WORKDIR /app

# Copy dependency configuration
COPY package.json ./

# Install production dependencies
RUN npm install --omit=dev

# Copy application backend scripts and frontend assets
COPY database.js server.js ./
COPY public ./public

# Create directory for persistent SQLite database storage
RUN mkdir -p /app/data

# Default runtime configuration
ENV PORT=8081
ENV DB_DIR=/app/data

# Expose server port
EXPOSE 8081

# Start execution entry point
CMD ["node", "server.js"]
