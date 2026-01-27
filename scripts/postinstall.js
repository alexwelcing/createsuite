#!/usr/bin/env node

/**
 * Post-install script for CreateSuite
 * Checks for OpenCode and oh-my-opencode installation
 */

const { execSync } = require('child_process');
const chalk = require('chalk');

function checkCommand(command) {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function main() {
  console.log(chalk.bold.blue('\n🚀 CreateSuite Installation Complete!\n'));

  // Check for OpenCode
  const hasOpencode = checkCommand('opencode');
  
  if (hasOpencode) {
    console.log(chalk.green('✓ OpenCode is installed'));
    
    // Check for oh-my-opencode
    try {
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      const opencodeConfig = path.join(os.homedir(), '.config', 'opencode', 'opencode.json');
      
      if (fs.existsSync(opencodeConfig)) {
        const config = JSON.parse(fs.readFileSync(opencodeConfig, 'utf-8'));
        if (config.plugin && config.plugin.includes('oh-my-opencode')) {
          console.log(chalk.green('✓ oh-my-opencode is configured\n'));
        } else {
          console.log(chalk.yellow('⚠️  oh-my-opencode is not configured yet\n'));
          showOhMyOpencodeSetup();
        }
      } else {
        console.log(chalk.yellow('⚠️  OpenCode config not found\n'));
        showOhMyOpencodeSetup();
      }
    } catch (error) {
      console.log(chalk.yellow('⚠️  Could not check oh-my-opencode configuration\n'));
    }
  } else {
    console.log(chalk.yellow('⚠️  OpenCode is not installed\n'));
    showOpencodeInstructions();
  }

  console.log(chalk.bold.cyan('Getting Started:\n'));
  console.log(chalk.gray('  cs init                 - Initialize a workspace'));
  console.log(chalk.gray('  cs provider setup       - Configure AI providers'));
  console.log(chalk.gray('  cs agent create <name>  - Create an agent'));
  console.log(chalk.gray('  cs task create          - Create a task\n'));
  
  console.log(chalk.gray('Documentation: https://github.com/awelcing-alm/createsuite\n'));
}

function showOpencodeInstructions() {
  console.log(chalk.bold('OpenCode Installation:'));
  console.log(chalk.gray('  Visit: https://opencode.ai/docs'));
  console.log(chalk.gray('  Follow the installation instructions for your platform\n'));
}

function showOhMyOpencodeSetup() {
  console.log(chalk.bold('oh-my-opencode Setup:'));
  console.log(chalk.gray('  Run: bunx oh-my-opencode install'));
  console.log(chalk.gray('  Or:  npx oh-my-opencode install\n'));
  console.log(chalk.gray('  This will configure advanced agent orchestration features\n'));
}

// Run the script
try {
  main();
} catch (error) {
  // Silently fail - this is just informational
  console.error('Post-install check failed:', error.message);
}
