# Use a base image with necessary build tools for node-pty
FROM node:20-bookworm

# Install build dependencies and tools
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    curl \
    git \
    bash \
    && rm -rf /var/lib/apt/lists/*

# Install OpenCode
RUN curl -fsSL https://opencode.ai/install | bash
# Add OpenCode to PATH for all future shells
ENV PATH="/root/.opencode/bin:${PATH}"

# Set working directory
WORKDIR /app

# Copy root package files to leverage cache if we were in a monorepo, 
# but here we are just in agent-ui. 
# We'll assume the context is the agent-ui directory.
COPY package*.json ./
COPY server/package*.json ./server/

# Install dependencies
# We install root deps and server deps
RUN npm install
RUN cd server && npm install

# Copy source code
COPY . .

# Build frontend
RUN npm run build

# Expose port
ENV PORT=8080
EXPOSE 8080

# Start server
CMD ["node", "server/index.js"]
