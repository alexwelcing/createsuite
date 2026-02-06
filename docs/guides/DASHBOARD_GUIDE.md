# CreateSuite Dashboard User Guide

The CreateSuite Agent Dashboard provides a comprehensive macOS-style interface for monitoring and managing your multi-agent system. This guide covers all dashboard features and best practices.

## Overview

The dashboard consists of several key components:
- **System Monitor (Activity Monitor)**: Real-time system metrics and monitoring
- **Agent Dashboard**: AI agent spawning and lifecycle management  
- **Terminal Windows**: Embedded OpenCode terminals for direct agent interaction
- **Task Board**: Visual task management with drag-and-drop functionality

## System Monitor (Activity Monitor)

### Overview Tab - Real-Time System Metrics

The Overview tab displays live system statistics updated every 4 seconds:

#### Core Metrics

**CPU Usage**
- Calculated from Node.js heap memory utilization
- Range: 0-100% based on `heapUsed / heapTotal`
- Real-time calculation, not simulated data
- High CPU usage may indicate heavy agent activity or system load

**Memory Usage** 
- Current memory consumption in GB
- Derived from `process.memoryUsage().heapUsed`
- Converted from bytes to GB for readability
- Monitor this to prevent out-of-memory conditions

**Network Activity**
- Estimated based on active terminal sessions and system activity
- Formula: `(sessionCount * 0.3 + randomVariation).toFixed(1) MB/s`
- Indicates data flow between agents, terminals, and backend APIs
- Higher values suggest more active agent communication

**Active Agents**
- Real count from `/api/agents/active` endpoint
- Shows currently running AI agents (Claude, OpenAI, Gemini, etc.)
- Zero agents means no AI processing is currently happening
- Each agent consumes system resources and API credits

#### Additional Information

**System Uptime**
- How long the CreateSuite server has been running
- Format: Human-readable (e.g., "2 hours 15 minutes")
- Source: `/api/health` endpoint's `uptimeFormatted` field
- Useful for understanding system stability

**Active Sessions**
- Number of connected terminal sessions
- Each session represents an active OpenCode terminal or agent connection
- Higher session count indicates more concurrent agent activity
- Sessions automatically clean up when terminals disconnect

#### Status Indicators

The dashboard displays dynamic status messages:
- ✅ "System is running normally with X active agents"
- 🔄 "Metrics updated every 4 seconds from live system data"  
- 💻 "X terminal sessions currently active" (when sessions > 0)

### Skills Tab - Agent Capabilities

Browse available agent skills and specializations:

**Skill Categories**
- View agent types and their capabilities from `agent-skills.json`
- Each skill shows character sprites and specialization areas
- Understand what each agent type can accomplish
- Plan task assignments based on agent strengths

**Character Visualization**
- Visual representation of different agent personalities
- Generated sprites help identify agent types quickly
- Each agent has unique visual characteristics

### API Monitor Tab - Provider Management

**Real-Time Provider Status**

The API Monitor shows the current state of all configured AI providers:

- **Active Providers**: Currently processing tasks or available for immediate use
- **Sleeping Providers**: Idle and available for task assignment via drag-and-drop
- **Provider Details**: Model information, authentication status, and capabilities

**Status Determination Logic**
- Providers with active agents are marked as "active"
- Hash-based consistent status for sleeping providers (changes every 30 seconds)
- Authentication status based on stored credentials in `.createsuite/provider-credentials.json`

**Outstanding Tasks Display**

Tasks are loaded from `.createsuite/tasks/` directory:
- Only non-completed tasks are shown (`status !== 'completed'`)
- Task metadata includes title, description, priority, tags, and creation date
- Real-time updates every 5 seconds ensure current information

**Drag-and-Drop Task Assignment**

To assign a task to an AI provider:
1. Find a "sleeping" provider (yellow status badge)
2. Drag the provider card to any task in the task list
3. The system sends a POST request to `/api/activate`
4. Provider status updates to "active" upon successful assignment

This triggers the agent spawning process and begins task execution.

## Agent Dashboard

### Agent Spawning

Create new AI agents with specific configurations:

**Supported Agent Types**
- **Claude**: Anthropic's Claude models (Opus, Sonnet)
- **OpenAI**: GPT models with API key authentication
- **Gemini**: Google's Gemini Pro models
- **Hugging Face**: Image generation and specialized models

**Spawning Process**
1. Select agent type from available configurations
2. System retrieves API credentials from stored configuration
3. New Fly.io machine is spawned with the agent runtime
4. Agent becomes available for task assignment

**Agent Lifecycle Management**
- Monitor agent uptime and resource consumption
- View agent logs and terminal output
- Stop individual agents or perform bulk cleanup
- Resource management prevents runaway costs

### GitHub Task Assignment

Assign agents to specific repositories:

**Repository Integration**
- Provide GitHub repository URL
- Describe the task or objective  
- Optionally include GitHub token for private repositories
- Agent clones repository and begins autonomous work

**Task Description Best Practices**
- Be specific about the desired outcome
- Include relevant file paths or areas of focus
- Specify coding standards or requirements
- Mention any constraints or limitations

## Terminal Windows

### OpenCode Integration

Embedded terminals provide direct access to spawned agents:

**Terminal Features**
- Full bash/shell emulation using `node-pty`
- Real terminal experience with proper colors and formatting  
- Persistent sessions that survive browser refreshes
- Multiple concurrent terminals for different agents

**Agent Communication**
- Direct command-line interface with AI agents
- Send instructions, code, or questions
- Receive real-time responses and progress updates
- Debug agent behavior and troubleshoot issues

**Session Management**  
- Each terminal gets a unique session ID
- Sessions are tracked by the lifecycle manager
- Automatic cleanup when terminals disconnect
- Environment variables include session and agent context

### UI Command System

Agents can send special commands to the dashboard:

```bash
# Example: Agent displays an image in the UI
echo ":::UI_CMD:::{\"type\":\"image\",\"src\":\"path.png\"}"
```

The dashboard parses these commands and updates the interface accordingly.

## Best Practices

### Performance Optimization

1. **Monitor Resource Usage**: Keep CPU and memory below 80% for optimal performance
2. **Limit Concurrent Agents**: Start with 2-3 agents, scale based on system capacity
3. **Close Unused Terminals**: Each terminal session consumes resources
4. **Regular Cleanup**: Use bulk agent cleanup when done with tasks

### Task Management

1. **Use Descriptive Titles**: Clear task names help with organization
2. **Set Appropriate Priorities**: Use high/medium/low to guide agent selection
3. **Add Relevant Tags**: Tags help filter and categorize work
4. **Monitor Task Progress**: Check agent logs and terminal output regularly

### Provider Management

1. **Configure Multiple Providers**: Different models excel at different tasks
2. **Monitor API Usage**: Track costs and rate limits for each provider
3. **Test Authentication**: Verify provider credentials work before spawning agents
4. **Use Appropriate Models**: Match model capabilities to task complexity

### System Maintenance

1. **Regular Monitoring**: Keep dashboard open during active agent work
2. **Check System Health**: Use `/api/health` endpoint for system status
3. **Backup Workspace**: Git-based storage makes this automatic
4. **Update Dependencies**: Keep CreateSuite and OpenCode up to date

## Troubleshooting

### Common Issues

**High CPU Usage**
- Check number of active agents and terminal sessions
- Consider stopping some agents if system becomes unresponsive
- Monitor for infinite loops in agent code or tasks

**Memory Consumption**
- Large agent contexts consume significant memory
- Restart the CreateSuite server if memory usage grows continuously
- Check for memory leaks in long-running agent sessions

**Provider Authentication Failures**
- Verify API keys in `.createsuite/provider-credentials.json`
- Test provider authentication using `cs provider auth`
- Check for API key expiration or rate limit violations

**Agent Spawn Failures**
- Ensure Fly.io API token is configured (for production deployments)
- Verify sufficient account credits for machine spawning
- Check agent configuration and model availability

### Diagnostic Commands

```bash
# Check system health
curl http://localhost:3001/api/health

# View active agents
curl http://localhost:3001/api/agents/active

# Check provider status  
curl http://localhost:3001/api/providers

# View outstanding tasks
curl http://localhost:3001/api/tasks
```

## Advanced Features

### API Integration

The dashboard exposes REST APIs for programmatic control:

- `/api/health`: System health and metrics
- `/api/agents/*`: Agent lifecycle management
- `/api/providers/*`: Provider configuration and status
- `/api/tasks/*`: Task management and assignment
- `/api/lifecycle/*`: Container lifecycle control

### Webhook Notifications

Configure webhooks for system events:
- Agent spawning and termination
- Task completion notifications  
- System health alerts
- Resource usage warnings

### Environment Configuration

Customize dashboard behavior with environment variables:

```bash
# Enable terminal functionality in production
ENABLE_PTY=true

# Configure automatic shutdown behavior
AUTO_SHUTDOWN=false
GRACE_PERIOD_MS=900000

# Set API authentication
API_TOKEN=your-secure-token
BASIC_AUTH_USER=admin
BASIC_AUTH_PASS=password
```

This comprehensive dashboard provides full visibility and control over your CreateSuite multi-agent system. Regular monitoring and proper configuration ensure optimal performance and successful agent collaboration.