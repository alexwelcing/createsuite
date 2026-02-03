/**
 * CreateSuite Lifecycle Manager
 * 
 * Intelligent container lifecycle management for Fly.io ephemeral deploys.
 * - Tracks active terminal sessions and work status
 * - Auto-shuts down when all work completes (with 15-minute grace period)
 * - Provides agent controls for hold, restart, rebuild operations
 * - Emits events for UI notifications
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

class LifecycleManager {
  constructor(io, server) {
    this.io = io;
    this.server = server;
    
    // Session tracking
    this.activeSessions = new Map(); // sessionId -> { ptyProcess, agentId, createdAt, lastActivity }
    
    // Lifecycle state
    this.state = {
      status: 'running',           // running | grace-period | shutting-down | held
      startedAt: Date.now(),
      lastActivity: Date.now(),
      holdUntil: null,             // Timestamp if agent requested hold
      holdReason: null,
      gracePeriodStart: null,
      scheduledShutdown: null,     // setTimeout reference
      shutdownReason: null
    };
    
    // Configuration (from environment)
    this.config = {
      gracePeriodMs: parseInt(process.env.GRACE_PERIOD_MS) || 15 * 60 * 1000, // 15 minutes default
      autoShutdown: process.env.AUTO_SHUTDOWN !== 'false', // Default: enabled
      checkIntervalMs: parseInt(process.env.CHECK_INTERVAL_MS) || 10000, // 10 seconds
      minUptimeMs: parseInt(process.env.MIN_UPTIME_MS) || 30000, // 30 seconds minimum
    };
    
    // Completion check interval
    this.checkInterval = null;
    
    // Bind methods
    this.checkCompletion = this.checkCompletion.bind(this);
    this.gracefulShutdown = this.gracefulShutdown.bind(this);
    
    console.log('[Lifecycle] Manager initialized', {
      autoShutdown: this.config.autoShutdown,
      gracePeriodMinutes: this.config.gracePeriodMs / 60000
    });
  }

  // ==================== SESSION TRACKING ====================
  
  /**
   * Register a new terminal session
   */
  registerSession(sessionId, ptyProcess, metadata = {}) {
    const session = {
      ptyProcess,
      agentId: metadata.agentId || null,
      taskId: metadata.taskId || null,
      createdAt: Date.now(),
      lastActivity: Date.now()
    };
    
    this.activeSessions.set(sessionId, session);
    this.state.lastActivity = Date.now();
    
    // Cancel any pending shutdown
    this.cancelGracePeriod();
    
    console.log(`[Lifecycle] Session registered: ${sessionId}`, {
      agentId: metadata.agentId,
      totalSessions: this.activeSessions.size
    });
    
    this.emitStatus();
    return session;
  }
  
  /**
   * Update session activity timestamp
   */
  touchSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
      this.state.lastActivity = Date.now();
    }
  }
  
  /**
   * Unregister a terminal session
   */
  unregisterSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      if (session.ptyProcess) {
        try {
          session.ptyProcess.kill();
        } catch (e) {
          // Already dead
        }
      }
      this.activeSessions.delete(sessionId);
      
      console.log(`[Lifecycle] Session unregistered: ${sessionId}`, {
        totalSessions: this.activeSessions.size
      });
      
      this.emitStatus();
      
      // Check if we should start grace period
      if (this.config.autoShutdown && this.activeSessions.size === 0) {
        this.checkCompletion();
      }
    }
  }
  
  /**
   * Get all active sessions info (for API)
   */
  getSessions() {
    const sessions = [];
    for (const [id, session] of this.activeSessions) {
      sessions.push({
        id,
        agentId: session.agentId,
        taskId: session.taskId,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        durationMs: Date.now() - session.createdAt
      });
    }
    return sessions;
  }

  // ==================== COMPLETION DETECTION ====================
  
  /**
   * Start the completion check loop
   */
  startCompletionChecks() {
    if (this.checkInterval) return;
    
    this.checkInterval = setInterval(this.checkCompletion, this.config.checkIntervalMs);
    console.log('[Lifecycle] Completion checks started');
  }
  
  /**
   * Stop the completion check loop
   */
  stopCompletionChecks() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
  
  /**
   * Check if all work is complete
   */
  async checkCompletion() {
    // Skip if auto-shutdown disabled
    if (!this.config.autoShutdown) return;
    
    // Skip if held
    if (this.state.status === 'held') {
      if (this.state.holdUntil && Date.now() > this.state.holdUntil) {
        console.log('[Lifecycle] Hold expired, resuming checks');
        this.state.status = 'running';
        this.state.holdUntil = null;
        this.state.holdReason = null;
        this.emitStatus();
      } else {
        return;
      }
    }
    
    // Skip if already shutting down
    if (this.state.status === 'shutting-down') return;
    
    // Skip if minimum uptime not reached
    const uptime = Date.now() - this.state.startedAt;
    if (uptime < this.config.minUptimeMs) return;
    
    // Check conditions
    const hasActiveSessions = this.activeSessions.size > 0;
    const hasIncompleteTasks = await this.hasIncompleteTasks();
    
    if (hasActiveSessions || hasIncompleteTasks) {
      // Work still in progress - cancel any grace period
      this.cancelGracePeriod();
      return;
    }
    
    // All work complete - start grace period if not already started
    if (this.state.status !== 'grace-period') {
      this.startGracePeriod('All work complete');
    }
  }
  
  /**
   * Check for incomplete tasks in .createsuite/tasks
   */
  async hasIncompleteTasks() {
    try {
      const tasksDir = path.join(process.cwd(), '.createsuite', 'tasks');
      if (!fs.existsSync(tasksDir)) return false;
      
      const taskFiles = fs.readdirSync(tasksDir).filter(f => f.endsWith('.json'));
      
      for (const file of taskFiles) {
        try {
          const taskData = JSON.parse(fs.readFileSync(path.join(tasksDir, file), 'utf-8'));
          if (taskData.status === 'open' || taskData.status === 'in_progress') {
            return true;
          }
        } catch (e) {
          // Skip malformed task files
        }
      }
      
      return false;
    } catch (e) {
      console.error('[Lifecycle] Error checking tasks:', e.message);
      return false; // Assume no tasks on error
    }
  }

  // ==================== GRACE PERIOD & SHUTDOWN ====================
  
  /**
   * Start the grace period before shutdown
   */
  startGracePeriod(reason) {
    if (this.state.status === 'grace-period') return;
    
    this.state.status = 'grace-period';
    this.state.gracePeriodStart = Date.now();
    this.state.shutdownReason = reason;
    
    const shutdownTime = new Date(Date.now() + this.config.gracePeriodMs);
    
    console.log(`[Lifecycle] Grace period started: ${reason}`);
    console.log(`[Lifecycle] Scheduled shutdown at: ${shutdownTime.toISOString()}`);
    
    // Notify all clients
    this.io.emit('lifecycle:grace-period', {
      reason,
      gracePeriodMs: this.config.gracePeriodMs,
      shutdownAt: shutdownTime.toISOString()
    });
    
    // Send webhook notification for work completion
    this.notifyWorkComplete(reason);
    
    // Schedule shutdown
    this.state.scheduledShutdown = setTimeout(() => {
      this.gracefulShutdown(reason);
    }, this.config.gracePeriodMs);
    
    this.emitStatus();
  }
  
  /**
   * Cancel the grace period (new work arrived)
   */
  cancelGracePeriod() {
    if (this.state.status !== 'grace-period') return;
    
    if (this.state.scheduledShutdown) {
      clearTimeout(this.state.scheduledShutdown);
      this.state.scheduledShutdown = null;
    }
    
    this.state.status = 'running';
    this.state.gracePeriodStart = null;
    this.state.shutdownReason = null;
    
    console.log('[Lifecycle] Grace period cancelled - new work detected');
    
    // Notify all clients
    this.io.emit('lifecycle:grace-cancelled', {
      reason: 'New work detected'
    });
    
    this.emitStatus();
  }
  
  /**
   * Execute graceful shutdown
   */
  async gracefulShutdown(reason) {
    if (this.state.status === 'shutting-down') return;
    
    this.state.status = 'shutting-down';
    this.state.shutdownReason = reason;
    
    console.log(`[Lifecycle] ========================================`);
    console.log(`[Lifecycle] GRACEFUL SHUTDOWN: ${reason}`);
    console.log(`[Lifecycle] ========================================`);
    
    // Stop completion checks
    this.stopCompletionChecks();
    
    // Notify all clients with 10 second warning
    this.io.emit('lifecycle:shutdown', {
      reason,
      countdown: 10
    });
    
    // Wait 10 seconds for clients to react
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Kill all PTY processes
    for (const [sessionId, session] of this.activeSessions) {
      console.log(`[Lifecycle] Killing session: ${sessionId}`);
      if (session.ptyProcess) {
        try {
          session.ptyProcess.kill('SIGTERM');
        } catch (e) {
          // Already dead
        }
      }
    }
    this.activeSessions.clear();
    
    // Close HTTP server
    this.server.close(() => {
      console.log('[Lifecycle] HTTP server closed');
      process.exit(0);
    });
    
    // Force exit after 15 seconds if server doesn't close cleanly
    setTimeout(() => {
      console.log('[Lifecycle] Force exit');
      process.exit(1);
    }, 15000);
  }

  // ==================== AGENT CONTROLS ====================
  
  /**
   * Hold the container alive (prevent auto-shutdown)
   */
  hold(durationMs, reason) {
    const holdUntil = Date.now() + durationMs;
    
    this.state.status = 'held';
    this.state.holdUntil = holdUntil;
    this.state.holdReason = reason;
    
    // Cancel any pending shutdown
    if (this.state.scheduledShutdown) {
      clearTimeout(this.state.scheduledShutdown);
      this.state.scheduledShutdown = null;
    }
    this.state.gracePeriodStart = null;
    
    console.log(`[Lifecycle] Hold requested until ${new Date(holdUntil).toISOString()}: ${reason}`);
    
    this.io.emit('lifecycle:held', {
      holdUntil: new Date(holdUntil).toISOString(),
      reason
    });
    
    this.emitStatus();
    
    return { holdUntil, reason };
  }
  
  /**
   * Release a hold early
   */
  releaseHold() {
    if (this.state.status !== 'held') return false;
    
    this.state.status = 'running';
    this.state.holdUntil = null;
    this.state.holdReason = null;
    
    console.log('[Lifecycle] Hold released');
    
    this.io.emit('lifecycle:hold-released', {});
    
    this.emitStatus();
    
    // Trigger completion check
    this.checkCompletion();
    
    return true;
  }
  
  /**
   * Request container restart
   */
  async restart(reason) {
    console.log(`[Lifecycle] Restart requested: ${reason}`);
    
    // Notify clients
    this.io.emit('lifecycle:restarting', { reason });
    
    // In Fly.io, we can trigger restart via SIGTERM and let auto-restart handle it
    // Or we can use the Fly.io API
    await this.gracefulShutdown(`Restart: ${reason}`);
  }
  
  /**
   * Request container rebuild and redeploy
   * This triggers a new deployment on Fly.io
   */
  async rebuild(options = {}) {
    const { branch = 'main', commitSha = null, reason = 'Agent requested rebuild' } = options;
    
    console.log(`[Lifecycle] Rebuild requested: ${reason}`);
    console.log(`[Lifecycle] Branch: ${branch}, Commit: ${commitSha || 'latest'}`);
    
    // Notify clients
    this.io.emit('lifecycle:rebuilding', {
      reason,
      branch,
      commitSha
    });
    
    // Write rebuild request to file (for external orchestrator to pick up)
    const rebuildRequest = {
      requestedAt: new Date().toISOString(),
      reason,
      branch,
      commitSha,
      currentSessionId: this.state.startedAt
    };
    
    const rebuildPath = path.join(process.cwd(), '.createsuite', 'rebuild-request.json');
    try {
      const dir = path.dirname(rebuildPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(rebuildPath, JSON.stringify(rebuildRequest, null, 2));
    } catch (e) {
      console.error('[Lifecycle] Failed to write rebuild request:', e.message);
    }
    
    // Trigger GitHub Actions workflow for rebuild
    await this.triggerGitHubRebuild(branch, commitSha, reason);
    
    // Trigger graceful shutdown - Fly.io will restart and pull new image
    await this.gracefulShutdown(`Rebuild: ${reason}`);
  }
  
  /**
   * Trigger GitHub Actions workflow for rebuild
   */
  async triggerGitHubRebuild(branch, commitSha, reason) {
    const githubToken = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPOSITORY || 'awelcing-alm/createsuite';
    
    if (!githubToken) {
      console.log('[Lifecycle] No GITHUB_TOKEN configured, skipping GitHub Actions trigger');
      return;
    }
    
    const [owner, repoName] = repo.split('/');
    
    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/dispatches`,
        {
          method: 'POST',
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `Bearer ${githubToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            event_type: 'rebuild-request',
            client_payload: {
              branch,
              commit_sha: commitSha,
              reason,
              session_id: String(this.state.startedAt),
              triggered_at: new Date().toISOString()
            }
          })
        }
      );
      
      if (response.ok || response.status === 204) {
        console.log('[Lifecycle] GitHub Actions workflow triggered successfully');
        
        // Send webhook notification about rebuild
        await this.sendWebhook('rebuild', {
          reason,
          branch,
          commitSha,
          githubWorkflowTriggered: true
        });
      } else {
        const error = await response.text();
        console.error('[Lifecycle] Failed to trigger GitHub Actions:', response.status, error);
      }
    } catch (error) {
      console.error('[Lifecycle] Failed to trigger GitHub Actions:', error.message);
    }
  }
  
  /**
   * Extend the grace period
   */
  extendGracePeriod(additionalMs) {
    if (this.state.status !== 'grace-period') {
      return { success: false, reason: 'Not in grace period' };
    }
    
    // Cancel current scheduled shutdown
    if (this.state.scheduledShutdown) {
      clearTimeout(this.state.scheduledShutdown);
    }
    
    // Calculate remaining time and add extension
    const elapsed = Date.now() - this.state.gracePeriodStart;
    const remaining = this.config.gracePeriodMs - elapsed;
    const newDuration = remaining + additionalMs;
    
    const newShutdownTime = new Date(Date.now() + newDuration);
    
    // Reschedule
    this.state.scheduledShutdown = setTimeout(() => {
      this.gracefulShutdown(this.state.shutdownReason);
    }, newDuration);
    
    console.log(`[Lifecycle] Grace period extended by ${additionalMs / 60000} minutes`);
    
    this.io.emit('lifecycle:grace-extended', {
      additionalMs,
      newShutdownAt: newShutdownTime.toISOString()
    });
    
    this.emitStatus();
    
    return { success: true, newShutdownAt: newShutdownTime.toISOString() };
  }
  
  /**
   * Force immediate shutdown (skip grace period)
   */
  async forceShutdown(reason) {
    console.log(`[Lifecycle] Force shutdown: ${reason}`);
    
    // Cancel any scheduled shutdown
    if (this.state.scheduledShutdown) {
      clearTimeout(this.state.scheduledShutdown);
    }
    
    await this.gracefulShutdown(`Force: ${reason}`);
  }

  // ==================== STATUS & EVENTS ====================
  
  /**
   * Get current lifecycle status
   */
  getStatus() {
    const uptime = Date.now() - this.state.startedAt;
    const sessionCount = this.activeSessions.size;
    
    let gracePeriodRemaining = null;
    if (this.state.status === 'grace-period' && this.state.gracePeriodStart) {
      const elapsed = Date.now() - this.state.gracePeriodStart;
      gracePeriodRemaining = Math.max(0, this.config.gracePeriodMs - elapsed);
    }
    
    return {
      status: this.state.status,
      uptime,
      uptimeFormatted: this.formatDuration(uptime),
      startedAt: new Date(this.state.startedAt).toISOString(),
      lastActivity: new Date(this.state.lastActivity).toISOString(),
      sessionCount,
      sessions: this.getSessions(),
      holdUntil: this.state.holdUntil ? new Date(this.state.holdUntil).toISOString() : null,
      holdReason: this.state.holdReason,
      gracePeriodRemaining,
      gracePeriodRemainingFormatted: gracePeriodRemaining ? this.formatDuration(gracePeriodRemaining) : null,
      shutdownReason: this.state.shutdownReason,
      config: {
        autoShutdown: this.config.autoShutdown,
        gracePeriodMinutes: this.config.gracePeriodMs / 60000
      }
    };
  }
  
  /**
   * Emit status to all connected clients
   */
  emitStatus() {
    this.io.emit('lifecycle:status', this.getStatus());
  }
  
  /**
   * Format duration in human-readable form
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // ==================== WEBHOOK NOTIFICATIONS ====================
  
  /**
   * Send webhook notification
   */
  async sendWebhook(event, data) {
    const webhookUrl = process.env.WEBHOOK_URL;
    if (!webhookUrl) {
      console.log('[Lifecycle] No WEBHOOK_URL configured, skipping notification');
      return;
    }
    
    const payload = {
      event,
      timestamp: new Date().toISOString(),
      container: {
        app: process.env.FLY_APP_NAME || 'createsuite-agent-ui',
        region: process.env.FLY_REGION || 'unknown',
        machineId: process.env.FLY_MACHINE_ID || 'unknown'
      },
      data,
      status: this.getStatus()
    };
    
    try {
      // Detect webhook type from URL
      if (webhookUrl.includes('slack.com')) {
        await this.sendSlackWebhook(webhookUrl, event, data);
      } else if (webhookUrl.includes('discord.com')) {
        await this.sendDiscordWebhook(webhookUrl, event, data);
      } else {
        // Generic webhook
        await this.sendGenericWebhook(webhookUrl, payload);
      }
      
      console.log(`[Lifecycle] Webhook sent: ${event}`);
    } catch (error) {
      console.error('[Lifecycle] Webhook failed:', error.message);
    }
  }
  
  /**
   * Send Slack webhook notification
   */
  async sendSlackWebhook(url, event, data) {
    const status = this.getStatus();
    
    const colors = {
      'grace-period': '#FFA500',
      'shutdown': '#FF0000',
      'work-complete': '#00AA00',
      'rebuild': '#0000AA',
      'error': '#AA0000'
    };
    
    const icons = {
      'grace-period': '⏰',
      'shutdown': '🛑',
      'work-complete': '✅',
      'rebuild': '🔨',
      'error': '❌'
    };
    
    const payload = {
      username: 'CreateSuite',
      icon_emoji: ':robot_face:',
      attachments: [{
        color: colors[event] || '#808080',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `${icons[event] || '📢'} CreateSuite: ${event.replace('-', ' ').toUpperCase()}`,
              emoji: true
            }
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Status:*\n${status.status}` },
              { type: 'mrkdwn', text: `*Uptime:*\n${status.uptimeFormatted}` },
              { type: 'mrkdwn', text: `*Sessions:*\n${status.sessionCount}` },
              { type: 'mrkdwn', text: `*Region:*\n${process.env.FLY_REGION || 'local'}` }
            ]
          }
        ]
      }]
    };
    
    if (data.reason) {
      payload.attachments[0].blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*Reason:* ${data.reason}` }
      });
    }
    
    if (data.resultsUrl) {
      payload.attachments[0].blocks.push({
        type: 'actions',
        elements: [{
          type: 'button',
          text: { type: 'plain_text', text: '📋 View Results', emoji: true },
          url: data.resultsUrl,
          style: 'primary'
        }]
      });
    }
    
    if (event === 'grace-period' && status.gracePeriodRemainingFormatted) {
      payload.attachments[0].blocks.push({
        type: 'section',
        text: { 
          type: 'mrkdwn', 
          text: `⏱️ *Shutting down in:* ${status.gracePeriodRemainingFormatted}` 
        }
      });
    }
    
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }
  
  /**
   * Send Discord webhook notification
   */
  async sendDiscordWebhook(url, event, data) {
    const status = this.getStatus();
    
    const colors = {
      'grace-period': 0xFFA500,
      'shutdown': 0xFF0000,
      'work-complete': 0x00AA00,
      'rebuild': 0x0000AA,
      'error': 0xAA0000
    };
    
    const payload = {
      username: 'CreateSuite',
      avatar_url: 'https://avatars.githubusercontent.com/u/9919?s=200&v=4',
      embeds: [{
        title: `CreateSuite: ${event.replace('-', ' ').toUpperCase()}`,
        color: colors[event] || 0x808080,
        fields: [
          { name: 'Status', value: status.status, inline: true },
          { name: 'Uptime', value: status.uptimeFormatted, inline: true },
          { name: 'Sessions', value: String(status.sessionCount), inline: true }
        ],
        timestamp: new Date().toISOString()
      }]
    };
    
    if (data.reason) {
      payload.embeds[0].fields.push({ name: 'Reason', value: data.reason, inline: false });
    }
    
    if (event === 'grace-period' && status.gracePeriodRemainingFormatted) {
      payload.embeds[0].fields.push({ 
        name: '⏱️ Shutting down in', 
        value: status.gracePeriodRemainingFormatted, 
        inline: false 
      });
    }
    
    if (data.resultsUrl) {
      payload.embeds[0].fields.push({ 
        name: '📋 Results', 
        value: `[View Results](${data.resultsUrl})`, 
        inline: false 
      });
    }
    
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }
  
  /**
   * Send generic webhook notification
   */
  async sendGenericWebhook(url, payload) {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }
  
  /**
   * Notify on work completion (called when grace period starts)
   */
  notifyWorkComplete(reason, resultsUrl = null) {
    const appUrl = process.env.FLY_APP_NAME 
      ? `https://${process.env.FLY_APP_NAME}.fly.dev`
      : 'http://localhost:3001';
    
    this.sendWebhook('work-complete', {
      reason,
      resultsUrl: resultsUrl || appUrl,
      completedAt: new Date().toISOString()
    });
  }

  // ==================== SIGNAL HANDLERS ====================
  
  /**
   * Setup process signal handlers
   */
  setupSignalHandlers() {
    process.on('SIGTERM', () => {
      console.log('[Lifecycle] Received SIGTERM');
      this.gracefulShutdown('SIGTERM received');
    });
    
    process.on('SIGINT', () => {
      console.log('[Lifecycle] Received SIGINT');
      this.gracefulShutdown('SIGINT received');
    });
    
    process.on('uncaughtException', (err) => {
      console.error('[Lifecycle] Uncaught exception:', err);
      this.gracefulShutdown(`Uncaught exception: ${err.message}`);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('[Lifecycle] Unhandled rejection:', reason);
      // Don't shutdown on unhandled rejection, just log
    });
  }
}

module.exports = { LifecycleManager };
