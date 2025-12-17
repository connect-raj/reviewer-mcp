# Code Reviewer MCP Server

An MCP (Model Context Protocol) server that automates code and pull request reviews from GitHub and Bitbucket using custom instructions.

## Features

- 🔍 **Automated PR Review**: Analyze pull requests against custom review guidelines
- 📝 **Custom Instructions**: Define your own review criteria in markdown files
- 🔐 **Security Checks**: Detect hardcoded secrets, SQL injection, XSS vulnerabilities
- 🎯 **Language-Specific Rules**: Support for JavaScript, TypeScript, Python, and more
- 🔄 **Dual Integration**: Works with both GitHub and Bitbucket
- 💬 **Preview & Direct Modes**: Review before posting or auto-post comments
- 🎨 **IDE Integration**: Use from VSCode or any MCP-compatible IDE

## Installation

1. Clone this repository:
   ```bash
   git clone <your-repo-url>
   cd mcp
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` and add your credentials:
   - For GitHub: Add your Personal Access Token
   - For Bitbucket: Add username and app password

## Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
# GitHub Configuration
GITHUB_TOKEN=your_github_personal_access_token_here

# Bitbucket Configuration
BITBUCKET_USERNAME=your_bitbucket_username
BITBUCKET_APP_PASSWORD=your_bitbucket_app_password
BITBUCKET_WORKSPACE=your_workspace_name

# Review Settings
DEFAULT_INSTRUCTIONS_PATH=.reviewrc.md
REVIEW_MODE=preview
```

### Custom Instructions

Create a `.reviewrc.md` file in your project root to define custom review criteria. See `.reviewrc.example.md` for a complete template.

Example structure:
```markdown
## Security
- Check for hardcoded credentials, API keys, or secrets
- Ensure user inputs are validated and sanitized

## Code Quality
- Functions should be under 50 lines when possible
- Variable and function names should be descriptive

## Style (Language-Specific)
### JavaScript/TypeScript
- Use const by default, let when reassignment needed, avoid var
- Prefer arrow functions for callbacks
```

## Usage

### Starting the Server

```bash
node src/server.js
```

### Using with MCP Client (e.g., Claude Desktop)

Configure your MCP client to connect to this server via stdio.

### Available Tools

#### GitHub Tools

1. **`github_review_pr`** - Review a GitHub pull request
   - Inputs: owner, repo, pullNumber, instructionsPath (optional), mode (optional)
   - Returns: Review summary with comments and severity counts
   
2. **`github_get_pr`** - Get PR details
   - Inputs: owner, repo, pullNumber
   - Returns: PR metadata and changed files

3. **`github_add_comment`** - Add a single comment
   - Inputs: owner, repo, pullNumber, path, line, message
   - Returns: Created comment details

#### Bitbucket Tools

1. **`bitbucket_review_pr`** - Review a Bitbucket pull request
   - Inputs: workspace (optional), repo, pullRequestId, instructionsPath (optional), mode (optional)
   - Returns: Review summary with comments and severity counts

2. **`bitbucket_get_pr`** - Get PR details
   - Inputs: workspace (optional), repo, pullRequestId
   - Returns: PR metadata and changed files

3. **`bitbucket_add_comment`** - Add a comment
   - Inputs: workspace (optional), repo, pullRequestId, message, path (optional), line (optional)
   - Returns: Created comment details

4. **`bitbucket_approve_pr`** - Approve a PR
   - Inputs: workspace (optional), repo, pullRequestId
   - Returns: Approval confirmation

### Review Modes

- **Preview Mode** (default): Returns review feedback to the IDE without posting to the PR
- **Direct Mode**: Automatically posts review comments to the PR

## Example Workflow

1. **Create custom instructions**:
   ```bash
   cp .reviewrc.example.md .reviewrc.md
   # Edit .reviewrc.md with your team's guidelines
   ```

2. **Open your IDE** (VSCode with MCP support)

3. **Invoke the review tool**:
   - Tool: `github_review_pr`
   - Owner: `your-org`
   - Repo: `your-repo`
   - Pull Number: `123`
   - Mode: `preview`

4. **Review the feedback** in your IDE

5. **Post to PR** (if satisfied):
   - Change mode to `direct` or manually post selected comments

## MCP Client Configuration

For Claude Desktop or other MCP clients, add this server to your config:

```json
{
  "mcpServers": {
    "code-reviewer": {
      "command": "node",
      "args": ["C:\\path\\to\\mcp\\src\\server.js"],
      "env": {
        "GITHUB_TOKEN": "your_token",
        "REVIEW_MODE": "preview"
      }
    }
  }
}
```

## Supported Languages

The analyzer supports language-specific checks for:
- JavaScript / TypeScript
- Python
- Java
- Go
- Ruby
- PHP
- C# / C / C++
- Rust
- Swift
- Kotlin

## Security Features

Automatically detects:
- Hardcoded API keys and secrets
- Hardcoded passwords
- Private keys in code
- SQL injection vulnerabilities
- XSS vulnerabilities (innerHTML usage)
- Use of dangerous functions (eval, etc.)

## Troubleshooting

### "Configuration validation failed"
Make sure your `.env` file has all required credentials set.

### "Failed to fetch PR"
Check that:
- Your API token/credentials are valid
- You have access to the repository
- The PR number/ID is correct

### "No tools registered"
Ensure at least one set of credentials (GitHub or Bitbucket) is configured in `.env`.

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

ISC

## Author

Raj Trivedi
