# CreateSuite API Documentation

This document provides comprehensive API documentation for CreateSuite's REST endpoints and WebSocket connections.

## 📋 Table of Contents

- [Authentication](#authentication)
- [REST API Endpoints](#rest-api-endpoints)
- [WebSocket API](#websocket-api)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [SDK & Client Libraries](#sdk--client-libraries)

## 🔐 Authentication

All API requests require authentication using OAuth 2.0 or personal access tokens.

### OAuth 2.0 Flow
```bash
# 1. Initiate OAuth flow
POST /oauth/initiate
Content-Type: application/json

{
  "scopes": ["repo", "workflow", "read:org"]
}

# 2. User authorizes application
# 3. Exchange code for token
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

client_id=your_client_id&
code=authorization_code&
redirect_uri=http://localhost:8080/callback
```

### API Key Authentication
```bash
# Include in headers
Authorization: Bearer your-api-token
```

## 🚀 REST API Endpoints

### Base URL
```
Development: http://localhost:3001/api
Production: https://your-domain.com/api
```

### Tasks API

#### List Tasks
```http
GET /api/tasks
Authorization: Bearer {token}
```

**Parameters:**
- `status` (optional): Filter by status (`open`, `in_progress`, `completed`, `blocked`)
- `priority` (optional): Filter by priority (`low`, `medium`, `high`, `critical`)
- `assignedAgent` (optional): Filter by assigned agent ID
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)

**Response:**
```json
{
  "tasks": [
    {
      "id": "cs-a1b2c",
      "title": "Implement user authentication",
      "description": "Add OAuth 2.0 authentication flow",
      "status": "in_progress",
      "priority": "high",
      "assignedAgent": "agent-001",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T14:20:00Z",
      "tags": ["auth", "security"]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

#### Create Task
```http
POST /api/tasks
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Task title",
  "description": "Detailed task description",
  "priority": "medium",
  "tags": ["feature", "backend"],
  "assignedAgent": "agent-001"
}
```

**Response:**
```json
{
  "id": "cs-x9y8z",
  "title": "Task title",
  "description": "Detailed task description",
  "status": "open",
  "priority": "medium",
  "assignedAgent": "agent-001",
  "createdAt": "2024-01-15T15:45:00Z",
  "updatedAt": "2024-01-15T15:45:00Z",
  "tags": ["feature", "backend"]
}
```

#### Get Task
```http
GET /api/tasks/{taskId}
Authorization: Bearer {token}
```

#### Update Task
```http
PUT /api/tasks/{taskId}
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "status": "completed",
  "assignedAgent": "agent-002"
}
```

#### Delete Task
```http
DELETE /api/tasks/{taskId}
Authorization: Bearer {token}
```

### Agents API

#### List Agents
```http
GET /api/agents
Authorization: Bearer {token}
```

**Parameters:**
- `status` (optional): Filter by status (`idle`, `working`, `offline`, `error`)
- `capability` (optional): Filter by capability

**Response:**
```json
{
  "agents": [
    {
      "id": "agent-001",
      "name": "Code Assistant",
      "status": "working",
      "currentTask": "cs-a1b2c",
      "capabilities": ["code-generation", "debugging", "testing"],
      "createdAt": "2024-01-10T09:00:00Z",
      "lastActive": "2024-01-15T15:30:00Z",
      "mailbox": []
    }
  ]
}
```

#### Create Agent
```http
POST /api/agents
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Documentation Agent",
  "capabilities": ["documentation", "writing", "markdown"],
  "provider": "openai",
  "model": "gpt-4"
}
```

#### Get Agent
```http
GET /api/agents/{agentId}
Authorization: Bearer {token}
```

#### Update Agent
```http
PUT /api/agents/{agentId}
Authorization: Bearer {token}
Content-Type: application/json
```

#### Delete Agent
```http
DELETE /api/agents/{agentId}
Authorization: Bearer {token}
```

### Convoys API

#### List Convoys
```http
GET /api/convoys
Authorization: Bearer {token}
```

**Response:**
```json
{
  "convoys": [
    {
      "id": "convoy-001",
      "name": "Feature Development",
      "description": "Collaborative feature development convoy",
      "status": "active",
      "agents": ["agent-001", "agent-002", "agent-003"],
      "tasks": ["cs-a1b2c", "cs-d4e5f"],
      "createdAt": "2024-01-12T08:00:00Z"
    }
  ]
}
```

#### Create Convoy
```http
POST /api/convoys
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Bug Fix Convoy",
  "description": "Coordinated bug fixing effort",
  "agents": ["agent-001", "agent-004"],
  "strategy": "parallel"
}
```

### Metrics API

#### Get System Metrics
```http
GET /api/metrics/system
Authorization: Bearer {token}
```

**Response:**
```json
{
  "cpu": {
    "usage": 23.5,
    "cores": 8,
    "model": "Intel Core i7"
  },
  "memory": {
    "total": 17179869184,
    "used": 8589934592,
    "available": 8589934592,
    "percentage": 50.0
  },
  "network": {
    "bytesIn": 1048576,
    "bytesOut": 2097152,
    "packetsIn": 1024,
    "packetsOut": 2048
  },
  "timestamp": "2024-01-15T15:45:00Z"
}
```

#### Get Application Metrics
```http
GET /api/metrics/application
Authorization: Bearer {token}
```

**Response:**
```json
{
  "agents": {
    "total": 5,
    "active": 3,
    "idle": 2,
    "error": 0
  },
  "tasks": {
    "total": 45,
    "completed": 30,
    "inProgress": 10,
    "failed": 5
  },
  "providers": {
    "connected": ["OpenAI", "Anthropic"],
    "totalRequests": 1523,
    "errors": 12,
    "avgResponseTime": 1250
  },
  "timestamp": "2024-01-15T15:45:00Z"
}
```

### Providers API

#### List Providers
```http
GET /api/providers
Authorization: Bearer {token}
```

**Response:**
```json
{
  "providers": [
    {
      "id": "openai",
      "name": "OpenAI",
      "status": "connected",
      "models": ["gpt-4", "gpt-3.5-turbo"],
      "defaultModel": "gpt-4",
      "requestCount": 1234,
      "errorRate": 0.02
    }
  ]
}
```

#### Test Provider
```http
POST /api/providers/{providerId}/test
Authorization: Bearer {token}
```

## 🔄 WebSocket API

### Connection
```javascript
const ws = new WebSocket('ws://localhost:3001/ws');

// Authentication after connection
ws.send(JSON.stringify({
  type: 'authenticate',
  token: 'your-bearer-token'
}));
```

### Message Format
```json
{
  "type": "message_type",
  "payload": { ... },
  "timestamp": "2024-01-15T15:45:00Z",
  "id": "message-uuid"
}
```

### Event Types

#### Task Events
```javascript
// Task created
{
  "type": "task.created",
  "payload": {
    "task": { /* task object */ }
  }
}

// Task updated
{
  "type": "task.updated", 
  "payload": {
    "task": { /* task object */ },
    "changes": ["status", "assignedAgent"]
  }
}

// Task completed
{
  "type": "task.completed",
  "payload": {
    "taskId": "cs-a1b2c",
    "completedAt": "2024-01-15T15:45:00Z"
  }
}
```

#### Agent Events
```javascript
// Agent status changed
{
  "type": "agent.status_changed",
  "payload": {
    "agentId": "agent-001",
    "oldStatus": "idle",
    "newStatus": "working",
    "currentTask": "cs-a1b2c"
  }
}

// Agent message
{
  "type": "agent.message",
  "payload": {
    "agentId": "agent-001",
    "message": "Task completed successfully",
    "taskId": "cs-a1b2c"
  }
}
```

#### System Events
```javascript
// Metrics update
{
  "type": "metrics.update",
  "payload": {
    "system": { /* system metrics */ },
    "application": { /* app metrics */ }
  }
}

// Error occurred
{
  "type": "error",
  "payload": {
    "code": "AGENT_ERROR",
    "message": "Agent failed to complete task",
    "details": { /* error details */ }
  }
}
```

### Subscribing to Events
```javascript
// Subscribe to specific events
ws.send(JSON.stringify({
  type: 'subscribe',
  events: ['task.created', 'agent.status_changed']
}));

// Subscribe to all agent events
ws.send(JSON.stringify({
  type: 'subscribe',
  pattern: 'agent.*'
}));
```

## ❌ Error Handling

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized  
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `429` - Too Many Requests
- `500` - Internal Server Error

### Error Response Format
```json
{
  "error": {
    "code": "INVALID_TASK_STATUS",
    "message": "Invalid task status transition from 'completed' to 'open'",
    "details": {
      "currentStatus": "completed",
      "requestedStatus": "open"
    },
    "timestamp": "2024-01-15T15:45:00Z"
  }
}
```

### Common Error Codes
- `AUTHENTICATION_REQUIRED` - Missing or invalid authentication
- `INSUFFICIENT_PERMISSIONS` - User lacks required permissions
- `RESOURCE_NOT_FOUND` - Requested resource doesn't exist
- `VALIDATION_ERROR` - Request validation failed
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `PROVIDER_ERROR` - AI provider error
- `AGENT_UNAVAILABLE` - No agents available for task

## 🚦 Rate Limiting

Rate limits are enforced per authenticated user:

- **Standard endpoints**: 100 requests per 15 minutes
- **Metrics endpoints**: 60 requests per minute
- **WebSocket connections**: 10 per user

### Rate Limit Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642262400
```

## 📚 SDK & Client Libraries

### JavaScript/TypeScript SDK
```javascript
import { CreateSuiteClient } from '@createsuite/client';

const client = new CreateSuiteClient({
  baseURL: 'http://localhost:3001/api',
  token: 'your-bearer-token'
});

// Create a task
const task = await client.tasks.create({
  title: 'Implement feature X',
  priority: 'high'
});

// Listen to events
client.on('task.completed', (event) => {
  console.log('Task completed:', event.payload.taskId);
});
```

### Python SDK
```python
from createsuite import CreateSuiteClient

client = CreateSuiteClient(
    base_url='http://localhost:3001/api',
    token='your-bearer-token'
)

# Create a task
task = client.tasks.create(
    title='Implement feature Y',
    priority='medium'
)

# Get metrics
metrics = client.metrics.get_system()
```

### cURL Examples

```bash
# Create a task
curl -X POST http://localhost:3001/api/tasks \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fix critical bug",
    "priority": "critical",
    "description": "Memory leak in agent orchestrator"
  }'

# Get task status
curl -X GET http://localhost:3001/api/tasks/cs-a1b2c \
  -H "Authorization: Bearer your-token"

# Update task
curl -X PUT http://localhost:3001/api/tasks/cs-a1b2c \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}'
```

## 🔧 Development & Testing

### API Testing
```bash
# Run API tests
npm run test:api

# Test with different environments
NODE_ENV=test npm run test:api
```

### API Documentation Generation
The API documentation is auto-generated from OpenAPI specifications:

```bash
# Generate docs
npm run docs:api

# Serve docs locally  
npm run docs:serve
```

## 📖 Related Documentation

- [Environment Variables](./ENVIRONMENT_VARIABLES.md)
- [Authentication Setup](./OAUTH_SETUP.md)
- [WebSocket Guide](./WEBSOCKET_API.md)
- [SDK Documentation](./SDK.md)