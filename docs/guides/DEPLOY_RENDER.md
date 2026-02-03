# Deploy CreateSuite to Render

This guide is for a solo developer who wants to deploy from a copied repository (fork or duplicate) with minimal setup.

## Prerequisites

- A Render account
- A GitHub account connected to Render
- This repository in that GitHub account (forked or duplicated)

## Quick Deploy (Blueprint)

1. **Fork or copy the repo** into the GitHub account connected to Render.
2. In Render, click **New +** → **Blueprint**.
3. Select your forked repo.
4. Click **Apply**.

Render uses [render.yaml](../../render.yaml) to build and run the Agent UI server.

## Security defaults

Production deploys disable the workspace file server and terminal spawn by default.

You can enable them only if you trust the deployment environment:

- `ENABLE_PTY=true` to allow terminal spawn
- `ENABLE_WORKSPACE_STATIC=true` to serve `/workspace`

If you need cross-origin access, set `CORS_ORIGIN` to your UI origin (e.g. `https://your-app.onrender.com`).

## Optional auth & rate limiting

- **API token**: set `API_TOKEN` to require a Bearer token for `/api` and websocket connections.
	- HTTP: `Authorization: Bearer <token>`
	- Socket: pass `auth: { token }`
- **Basic auth**: set `BASIC_AUTH_USER` and `BASIC_AUTH_PASS` to protect the entire UI with HTTP Basic Auth.
- **Rate limiting**: `/api` is limited to 120 requests/minute per IP by default.

## What Render Will Do

- Build the frontend from agent-ui/
- Install the server dependencies from agent-ui/server/
- Start the server with the built frontend

## Verify the deployment

- Open the service URL
- Confirm the health check at `/api/skills`

## Common fixes

- **Build fails on Node version**: set `NODE_VERSION` to 20 in the Render dashboard (already set in [render.yaml](../../render.yaml)).
- **Missing assets**: make sure the build step completes and the service is restarted.

## Local sanity check (optional)

```bash
cd agent-ui
npm install
npm run build
cd server
npm install
node index.js
```

Then open http://localhost:3001.
