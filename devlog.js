#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');
const os = require('os');

class DevLog {
  constructor() {
    this.configPath = path.join(os.homedir(), '.config', 'devlog.json');
    this.apiBaseUrl = 'http://localhost:3001';
  }

  // Ensure config directory exists
  ensureConfigDir() {
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
  }

  // Load configuration
  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        return config;
      }
    } catch (error) {
      console.error('Error reading config:', error.message);
    }
    return {};
  }

  // Save configuration
  saveConfig(config) {
    try {
      this.ensureConfigDir();
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      console.log('Configuration saved successfully.');
    } catch (error) {
      console.error('Error saving config:', error.message);
      process.exit(1);
    }
  }

  // Prompt for user input
  async prompt(question) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  // Configure devlog
  async configure() {
    console.log('Configuring devlog...\n');
    
    const config = this.loadConfig();
    
    // Get API key
    const currentApiKey = config.apiKey ? `(current: ${config.apiKey.substring(0, 8)}...)` : '';
    const apiKey = await this.prompt(`Enter your API key ${currentApiKey}: `);
    
    if (apiKey) {
      config.apiKey = apiKey;
    } else if (!config.apiKey) {
      console.error('API key is required.');
      process.exit(1);
    }

    // Get API base URL (optional)
    const currentBaseUrl = config.apiBaseUrl || this.apiBaseUrl;
    const baseUrl = await this.prompt(`Enter API base URL (default: ${currentBaseUrl}): `);
    config.apiBaseUrl = baseUrl || currentBaseUrl;

    // Ask if they want to include commit hash
    const includeHash = await this.prompt('Include commit hash in logs? (y/n, default: y): ');
    config.includeCommitHash = includeHash !== 'n';

    // Ask about date format preference
    const includeDate = await this.prompt('Include date in log entries? (y/n, default: y): ');
    config.includeDate = includeDate !== 'n';

    this.saveConfig(config);
  }

  // Get the last commit message
  getLastCommitMessage() {
    try {
      // Get the commit message of the last commit
      const commitMessage = execSync('git log -1 --pretty=%B', { encoding: 'utf8' }).trim();
      return commitMessage;
    } catch (error) {
      console.error('Error getting last commit message:', error.message);
      console.error('Make sure you are in a git repository and have at least one commit.');
      process.exit(1);
    }
  }

  // Get the last commit hash
  getLastCommitHash() {
    try {
      return execSync('git log -1 --pretty=%H', { encoding: 'utf8' }).trim().substring(0, 8);
    } catch (error) {
      return null;
    }
  }

  // Get current date in YYYY-MM-DD format
  getCurrentDate() {
    return new Date().toISOString().split('T')[0];
  }

  // Format log entry based on configuration
  formatLogEntry(commitMessage, config) {
    let logEntry = commitMessage;

    if (config.includeCommitHash) {
      const commitHash = this.getLastCommitHash();
      if (commitHash) {
        logEntry = `[${commitHash}] ${logEntry}`;
      }
    }

    return logEntry;
  }

  // Post to the Draft Log API
  async postToApi(text, date, config) {
    const fetch = (await import('node-fetch')).default;
    
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/logs/append`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey
        },
        body: JSON.stringify({
          text: text,
          date: date
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText}\n${errorData}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error posting to API:', error.message);
      process.exit(1);
    }
  }

  // Main log function
  async log(customMessage = null, customDate = null) {
    const config = this.loadConfig();
    
    if (!config.apiKey) {
      console.error('No API key found. Please run "devlog config" first.');
      process.exit(1);
    }

    // Use custom message or get from git
    const commitMessage = customMessage || this.getLastCommitMessage();
    const logEntry = this.formatLogEntry(commitMessage, config);
    
    // Use custom date or current date
    const date = customDate || (config.includeDate ? this.getCurrentDate() : undefined);

    console.log(`Logging: ${logEntry}`);
    if (date) {
      console.log(`Date: ${date}`);
    }

    try {
      const result = await this.postToApi(logEntry, date, config);
      console.log('✅ Successfully logged to devlog');
      
      if (result && result.message) {
        console.log(`Response: ${result.message}`);
      }
    } catch (error) {
      console.error('❌ Failed to log to devlog');
      throw error;
    }
  }

  // Check if current directory is a git repository
  isGitRepository() {
    try {
      execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
      return true;
    } catch (error) {
      return false;
    }
  }

  // Install post-commit hook in current git repository
  installHook() {
    // Check if we're in a git repository
    if (!this.isGitRepository()) {
      console.error('❌ Current directory is not a git repository.');
      console.error('Please run this command from within a git repository.');
      process.exit(1);
    }

    const hooksDir = '.git/hooks';
    const hookPath = path.join(hooksDir, 'post-commit');

    // Check if hooks directory exists
    if (!fs.existsSync(hooksDir)) {
      console.error('❌ .git/hooks directory not found.');
      console.error('This might not be a valid git repository.');
      process.exit(1);
    }

    // Check if hook already exists
    if (fs.existsSync(hookPath)) {
      console.log('⚠️  post-commit hook already exists.');
      
      // Read existing hook to see if it contains devlog
      try {
        const existingHook = fs.readFileSync(hookPath, 'utf8');
        if (existingHook.includes('devlog')) {
          console.log('✅ devlog is already integrated in the existing hook.');
          return;
        }
        
        console.log('The existing hook does not contain devlog integration.');
        console.log('You can manually add "devlog" to your existing post-commit hook,');
        console.log('or backup and replace it by running this command with --force flag.');
        console.log('\nTo backup and replace: devlog install --force');
        return;
      } catch (error) {
        console.error('Error reading existing hook:', error.message);
        process.exit(1);
      }
    }

    // Create the post-commit hook
    const hookContent = `#!/bin/bash

# post-commit hook for devlog
# This script runs after each git commit and automatically logs the commit message

# Check if devlog is available
if ! command -v devlog &> /dev/null; then
    echo "devlog command not found. Please install devlog-cli first."
    exit 0
fi

# Check if devlog is configured
if [ ! -f "$HOME/.config/devlog.json" ]; then
    echo "devlog not configured. Run 'devlog config' first."
    exit 0
fi

# Log the commit
echo "📝 Logging commit to devlog..."
devlog

# Exit with status 0 to not interfere with git operations
exit 0`;

    try {
      fs.writeFileSync(hookPath, hookContent);
      
      // Make the hook executable
      fs.chmodSync(hookPath, 0o755);
      
      console.log('✅ Successfully installed devlog post-commit hook!');
      console.log(`📁 Hook installed at: ${hookPath}`);
      console.log('');
      console.log('🎉 devlog will now automatically log your commit messages.');
      console.log('💡 Make sure to run "devlog config" if you haven\'t already.');
      
    } catch (error) {
      console.error('❌ Error installing hook:', error.message);
      process.exit(1);
    }
  }

  // Install hook with force flag (backup existing)
  installHookForce() {
    if (!this.isGitRepository()) {
      console.error('❌ Current directory is not a git repository.');
      process.exit(1);
    }

    const hooksDir = '.git/hooks';
    const hookPath = path.join(hooksDir, 'post-commit');
    const backupPath = path.join(hooksDir, 'post-commit.backup');

    // Backup existing hook if it exists
    if (fs.existsSync(hookPath)) {
      try {
        fs.copyFileSync(hookPath, backupPath);
        console.log(`📋 Backed up existing hook to: ${backupPath}`);
      } catch (error) {
        console.error('Error backing up existing hook:', error.message);
        process.exit(1);
      }
    }

    // Remove the existing hook and install new one
    if (fs.existsSync(hookPath)) {
      fs.unlinkSync(hookPath);
    }
    
    this.installHook();
  }

  // Show help
  showHelp() {
    console.log(`
devlog - Developer Log CLI Tool

USAGE:
  devlog                    Log the last git commit message
  devlog config             Configure API key and settings
  devlog install            Install post-commit hook in current git repo
  devlog install --force    Install hook, backing up any existing post-commit hook
  devlog log "message"      Log a custom message
  devlog log "message" date Log a custom message with specific date (YYYY-MM-DD)
  devlog help               Show this help message

EXAMPLES:
  devlog config
  devlog install
  devlog
  devlog log "Fixed critical bug in payment processing"
  devlog log "Started new feature" 2025-06-24

CONFIGURATION:
  Configuration is stored in ~/.config/devlog.json
  
GIT HOOK SETUP:
  Use "devlog install" to automatically set up the post-commit hook.
  This will create .git/hooks/post-commit that runs devlog after each commit.
`);
  }

  // Parse command line arguments and run appropriate command
  async run() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
      // Default behavior: log last commit
      await this.log();
    } else if (args[0] === 'config') {
      await this.configure();
    } else if (args[0] === 'install') {
      if (args.includes('--force')) {
        this.installHookForce();
      } else {
        this.installHook();
      }
    } else if (args[0] === 'log') {
      if (args.length === 2) {
        // Custom message
        await this.log(args[1]);
      } else if (args.length === 3) {
        // Custom message and date
        await this.log(args[1], args[2]);
      } else {
        console.error('Usage: devlog log "message" [date]');
        process.exit(1);
      }
    } else if (args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
      this.showHelp();
    } else {
      console.error('Unknown command. Use "devlog help" for usage information.');
      process.exit(1);
    }
  }
}

// Handle errors gracefully
process.on('unhandledRejection', (error) => {
  console.error('Unexpected error:', error.message);
  process.exit(1);
});

// Run the CLI
if (require.main === module) {
  const devlog = new DevLog();
  devlog.run().catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}

module.exports = DevLog;
