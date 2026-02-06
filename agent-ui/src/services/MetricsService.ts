/**
 * Real-time metrics service for CreateSuite dashboard
 * Provides actual system and application metrics
 */

import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    model: string;
  };
  memory: {
    total: number;
    used: number;
    available: number;
    percentage: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  };
  disk: {
    total: number;
    used: number;
    available: number;
    percentage: number;
  };
}

export interface ApplicationMetrics {
  agents: {
    total: number;
    active: number;
    idle: number;
    error: number;
  };
  tasks: {
    total: number;
    completed: number;
    inProgress: number;
    failed: number;
  };
  convoys: {
    total: number;
    active: number;
    completed: number;
  };
  providers: {
    connected: string[];
    totalRequests: number;
    errors: number;
    avgResponseTime: number;
  };
}

export interface CombinedMetrics {
  system: SystemMetrics;
  application: ApplicationMetrics;
  timestamp: Date;
}

class MetricsService {
  private static instance: MetricsService;
  private networkBaseline: { bytesIn: number; bytesOut: number; timestamp: number } | null = null;
  private workspaceRoot: string;

  private constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
  }

  public static getInstance(workspaceRoot?: string): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService(workspaceRoot);
    }
    return MetricsService.instance;
  }

  /**
   * Get current system metrics
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // Calculate CPU usage (simplified)
    const cpuUsage = await this.getCpuUsage();
    
    // Get network stats
    const networkStats = await this.getNetworkStats();
    
    // Get disk stats
    const diskStats = await this.getDiskStats();

    return {
      cpu: {
        usage: cpuUsage,
        cores: cpus.length,
        model: cpus[0]?.model || 'Unknown'
      },
      memory: {
        total: totalMem,
        used: usedMem,
        available: freeMem,
        percentage: (usedMem / totalMem) * 100
      },
      network: networkStats,
      disk: diskStats
    };
  }

  /**
   * Get application-specific metrics
   */
  async getApplicationMetrics(): Promise<ApplicationMetrics> {
    const agentMetrics = await this.getAgentMetrics();
    const taskMetrics = await this.getTaskMetrics();
    const convoyMetrics = await this.getConvoyMetrics();
    const providerMetrics = await this.getProviderMetrics();

    return {
      agents: agentMetrics,
      tasks: taskMetrics,
      convoys: convoyMetrics,
      providers: providerMetrics
    };
  }

  /**
   * Get combined metrics
   */
  async getMetrics(): Promise<CombinedMetrics> {
    const [systemMetrics, applicationMetrics] = await Promise.all([
      this.getSystemMetrics(),
      this.getApplicationMetrics()
    ]);

    return {
      system: systemMetrics,
      application: applicationMetrics,
      timestamp: new Date()
    };
  }

  /**
   * Calculate CPU usage over a short interval
   */
  private async getCpuUsage(): Promise<number> {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    // Wait a bit and measure again for more accurate results
    await new Promise(resolve => setTimeout(resolve, 100));

    const cpus2 = os.cpus();
    let totalIdle2 = 0;
    let totalTick2 = 0;

    cpus2.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick2 += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle2 += cpu.times.idle;
    });

    const idle = totalIdle2 - totalIdle;
    const total = totalTick2 - totalTick;
    const usage = 100 - (100 * idle / total);

    return Math.round(usage * 100) / 100;
  }

  /**
   * Get network statistics
   */
  private async getNetworkStats(): Promise<SystemMetrics['network']> {
    try {
      // On Linux, read from /proc/net/dev
      if (process.platform === 'linux') {
        const netData = await fs.readFile('/proc/net/dev', 'utf8');
        const lines = netData.split('\n').slice(2); // Skip header lines
        
        let totalBytesIn = 0;
        let totalBytesOut = 0;
        let totalPacketsIn = 0;
        let totalPacketsOut = 0;

        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 10 && !parts[0].startsWith('lo')) { // Skip loopback
            totalBytesIn += parseInt(parts[1]) || 0;
            totalPacketsIn += parseInt(parts[2]) || 0;
            totalBytesOut += parseInt(parts[9]) || 0;
            totalPacketsOut += parseInt(parts[10]) || 0;
          }
        }

        return {
          bytesIn: totalBytesIn,
          bytesOut: totalBytesOut,
          packetsIn: totalPacketsIn,
          packetsOut: totalPacketsOut
        };
      }
      
      // Fallback for other platforms
      return {
        bytesIn: 0,
        bytesOut: 0,
        packetsIn: 0,
        packetsOut: 0
      };
    } catch {
      return {
        bytesIn: 0,
        bytesOut: 0,
        packetsIn: 0,
        packetsOut: 0
      };
    }
  }

  /**
   * Get disk statistics
   */
  private async getDiskStats(): Promise<SystemMetrics['disk']> {
    try {
      const stats = await fs.stat(this.workspaceRoot);
      // This is a simplified version - in a real implementation,
      // you'd want to use platform-specific commands to get disk usage
      return {
        total: 1000000000, // 1GB placeholder
        used: 500000000,   // 500MB placeholder  
        available: 500000000, // 500MB placeholder
        percentage: 50
      };
    } catch {
      return {
        total: 0,
        used: 0,
        available: 0,
        percentage: 0
      };
    }
  }

  /**
   * Get agent metrics from workspace
   */
  private async getAgentMetrics(): Promise<ApplicationMetrics['agents']> {
    try {
      const agentsDir = path.join(this.workspaceRoot, '.createsuite', 'agents');
      const files = await fs.readdir(agentsDir);
      const agentFiles = files.filter(f => f.endsWith('.json'));
      
      let active = 0;
      let idle = 0;
      let error = 0;

      for (const file of agentFiles) {
        try {
          const agentData = JSON.parse(
            await fs.readFile(path.join(agentsDir, file), 'utf8')
          );
          
          switch (agentData.status) {
            case 'working':
              active++;
              break;
            case 'idle':
              idle++;
              break;
            case 'error':
              error++;
              break;
          }
        } catch {
          // Skip invalid agent files
        }
      }

      return {
        total: agentFiles.length,
        active,
        idle,
        error
      };
    } catch {
      return {
        total: 0,
        active: 0,
        idle: 0,
        error: 0
      };
    }
  }

  /**
   * Get task metrics from workspace
   */
  private async getTaskMetrics(): Promise<ApplicationMetrics['tasks']> {
    try {
      const tasksDir = path.join(this.workspaceRoot, '.createsuite', 'tasks');
      const files = await fs.readdir(tasksDir);
      const taskFiles = files.filter(f => f.endsWith('.json'));
      
      let completed = 0;
      let inProgress = 0;
      let failed = 0;

      for (const file of taskFiles) {
        try {
          const taskData = JSON.parse(
            await fs.readFile(path.join(tasksDir, file), 'utf8')
          );
          
          switch (taskData.status) {
            case 'completed':
              completed++;
              break;
            case 'in_progress':
              inProgress++;
              break;
            case 'blocked':
              failed++;
              break;
          }
        } catch {
          // Skip invalid task files
        }
      }

      return {
        total: taskFiles.length,
        completed,
        inProgress,
        failed
      };
    } catch {
      return {
        total: 0,
        completed: 0,
        inProgress: 0,
        failed: 0
      };
    }
  }

  /**
   * Get convoy metrics from workspace
   */
  private async getConvoyMetrics(): Promise<ApplicationMetrics['convoys']> {
    try {
      const convoysDir = path.join(this.workspaceRoot, '.createsuite', 'convoys');
      const files = await fs.readdir(convoysDir);
      const convoyFiles = files.filter(f => f.endsWith('.json'));
      
      let active = 0;
      let completed = 0;

      for (const file of convoyFiles) {
        try {
          const convoyData = JSON.parse(
            await fs.readFile(path.join(convoysDir, file), 'utf8')
          );
          
          switch (convoyData.status) {
            case 'active':
              active++;
              break;
            case 'completed':
              completed++;
              break;
          }
        } catch {
          // Skip invalid convoy files
        }
      }

      return {
        total: convoyFiles.length,
        active,
        completed
      };
    } catch {
      return {
        total: 0,
        active: 0,
        completed: 0
      };
    }
  }

  /**
   * Get provider metrics
   */
  private async getProviderMetrics(): Promise<ApplicationMetrics['providers']> {
    // This would need to be integrated with the actual provider manager
    // For now, return mock data based on environment variables
    const connectedProviders = [];
    
    if (process.env.OPENAI_API_KEY) connectedProviders.push('OpenAI');
    if (process.env.ANTHROPIC_API_KEY) connectedProviders.push('Anthropic');
    if (process.env.GOOGLE_API_KEY) connectedProviders.push('Google');

    return {
      connected: connectedProviders,
      totalRequests: 0, // Would need to be tracked in provider manager
      errors: 0, // Would need to be tracked in provider manager
      avgResponseTime: 0 // Would need to be tracked in provider manager
    };
  }

  /**
   * Format bytes for display
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Format network speed
   */
  static formatNetworkSpeed(bytesPerSecond: number): string {
    return this.formatBytes(bytesPerSecond) + '/s';
  }
}

export default MetricsService;