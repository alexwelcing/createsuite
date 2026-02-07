# ── Stage 1: Build frontend & compile native modules ──
FROM node:20-bookworm AS builder

RUN apt-get update && apt-get install -y \
    python3 make g++ curl \
    && rm -rf /var/lib/apt/lists/*

# Install Bun for fast dependency installs
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

WORKDIR /app

# Install dependencies (cached layer)
COPY package*.json ./
COPY server/package*.json ./server/
RUN bun install
RUN cd server && bun install

# Copy source and build frontend
COPY . .
RUN npm run build

# ── Stage 2: Production runtime ──
FROM node:20-bookworm-slim

# Runtime deps: python3 for node-pty, git/gh/curl for agent operations
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ curl git bash ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update && apt-get install -y gh && rm -rf /var/lib/apt/lists/*

# Install Bun (used by agent task scripts)
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

# Install OpenCode
RUN curl -fsSL https://opencode.ai/install | bash
ENV PATH="/root/.opencode/bin:${PATH}"

WORKDIR /app

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Copy server code and its dependencies
COPY --from=builder /app/server ./server
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server/node_modules ./server/node_modules

# Copy public assets (splat files, static content)
COPY --from=builder /app/public ./public

# Copy config files needed at runtime
COPY --from=builder /app/package.json ./package.json
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["/docker-entrypoint.sh"]
