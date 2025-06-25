u# devlog CLI Tool

A command-line tool that automatically logs git commit messages to your Draft Log API. Perfect for tracking development progress and maintaining a detailed work log.

## Features

- 🔧 **Easy Configuration**: One-time setup with `devlog config`
- 🔄 **Git Integration**: Works seamlessly with git hooks
- 📝 **Automatic Logging**: Logs commit messages with optional commit hashes
- 🎛️ **Flexible Usage**: Manual logging with custom messages and dates
- 🏠 **Local Config**: Stores configuration securely in `~/.config/devlog.json`

## Installation

### Option 1: Global Installation (Recommended)

```bash
# Install globally to use devlog from anywhere
npm install -g devlog-cli
```

### Option 2: Local Installation

```bash
# Clone/download the files to a directory
# Navigate to the directory containing devlog.js and package.json
npm install
npm link  # Makes devlog available globally
```

### Option 3: Direct Usage

```bash
# Make the script executable
chmod +x devlog.js

# Use directly (requires node-fetch)
npm install node-fetch
./devlog.js
```

## Setup

### 1. Configure devlog

First, you need to configure your API key and preferences:

```bash
devlog config
```

This will prompt you for:
- **API Key**: Your Draft Log API key (generate one by POST to `/api/users/api-key`)
- **API Base URL**: The base URL for your API (default: `http://localhost:3001`)
- **Include Commit Hash**: Whether to include short commit hashes in logs
- **Include Date**: Whether to include dates in log entries

### 2. Set up Git Hook (Easy Way)

Use the built-in install command to automatically set up the post-commit hook:

```bash
# Navigate to your git repository
cd /path/to/your/repo

# Install the post-commit hook
devlog install

# If you already have a post-commit hook and want to replace it:
devlog install --force
```

### 2. Set up Git Hook (Manual Way)

Alternatively, you can manually set up the post-commit hook:

```bash
# Navigate to your git repository
cd /path/to/your/repo

# Copy the post-commit hook
cp post-commit .git/hooks/

# Make it executable
chmod +x .git/hooks/post-commit
```

Or create the hook manually:

```bash
# Create the hook file
cat > .git/hooks/post-commit << 'EOF'
#!/bin/bash
if command -v devlog &> /dev/null && [ -f "$HOME/.config/devlog.json" ]; then
    echo "📝 Logging commit to devlog..."
    devlog
fi
EOF

# Make it executable
chmod +x .git/hooks/post-commit
```

## Usage

### Basic Commands

```bash
# Log the last git commit message
devlog

# Configure or reconfigure settings
devlog config

# Install post-commit hook in current git repository
devlog install

# Install hook with force (backup existing hook)
devlog install --force

# Log a custom message
devlog log "Fixed critical bug in payment processing"

# Log a custom message with specific date
devlog log "Started new feature" 2025-06-24

# Show help
devlog help
```

### Examples

```bash
# Set up devlog in a new project
cd my-project
devlog config
devlog install

# After making commits, they'll be logged automatically
git commit -m "Add user authentication"
# Output: 📝 Logging commit to devlog...
#         ✅ Successfully logged to devlog

# Log work that wasn't committed
devlog log "Researched new framework options"

# Log work from a previous date
devlog log "Attended team meeting" 2025-06-23
```

## Configuration File

The configuration is stored in `~/.config/devlog.json`:

```json
{
  "apiKey": "your-api-key-here",
  "apiBaseUrl": "http://localhost:3001",
  "includeCommitHash": true,
  "includeDate": true
}
```

### Configuration Options

- **apiKey**: Your API key for authentication
- **apiBaseUrl**: Base URL for the Draft Log API
- **includeCommitHash**: Include short commit hash (8 chars) in log entries
- **includeDate**: Include current date in API requests

## Git Hook Integration

When the post-commit hook is installed, every git commit will automatically:

1. Check if devlog is available
2. Check if devlog is configured
3. Get the commit message from the last commit
4. Format it according to your preferences
5. Send it to your Draft Log API

### Sample Log Entries

With commit hash enabled:
```
[a1b2c3d4] Add user authentication feature
[e5f6g7h8] Fix memory leak in data processing
```

Without commit hash:
```
Add user authentication feature
Fix memory leak in data processing
```

## API Integration

The tool integrates with your Draft Log API using these endpoints:

- **Generate API Key**: `POST /api/users/api-key`
- **Append to Log**: `POST /api/logs/append`

### API Request Format

```javascript
{
  "text": "Commit message or custom text",
  "date": "2025-06-24"  // optional, defaults to today
}
```

## Troubleshooting

### Common Issues

1. **"devlog command not found"**
   - Make sure devlog is installed globally or linked
   - Try reinstalling: `npm install -g devlog-cli`

2. **"No API key found"**
   - Run `devlog config` to set up your configuration
   - Check that `~/.config/devlog.json` exists and contains your API key

3. **"Error getting last commit message"**
   - Make sure you're in a git repository
   - Ensure you have at least one commit
   - Check git is working: `git log -1 --oneline`

4. **"API request failed"**
   - Verify your API key is correct
   - Check that your API server is running
   - Verify the API base URL in your config

### Debug Mode

For debugging, you can manually check your configuration:

```bash
cat ~/.config/devlog.json
```

And test your git integration:

```bash
git log -1 --pretty=%B  # Should show last commit message
```

## Development

To contribute or modify the tool:

```bash
# Clone the repository
git clone <repository-url>
cd devlog-cli

# Install dependencies
npm install

# Test locally
./devlog.js help

# Install globally for testing
npm install -g .
```

## License

MIT License - feel free to use and modify as needed.
