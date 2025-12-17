import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import config, { validateConfig } from './config/config.js';
import registerGitHubTools from './tools/github-tools.js';
import registerBitbucketTools from './tools/bitbucket-tools.js';

const server = new McpServer({
    name: 'code-reviewer-mcp',
    version: '1.0.0'
});

/**
 * Initialize and validate configuration
 */
function initializeServer() {
    const validation = validateConfig();
    
    if (!validation.valid) {
        console.error('[ERROR] Configuration validation failed:');
        validation.errors.forEach(error => console.error(`  - ${error}`));
        console.error('[INFO] Please check your .env file and ensure required credentials are set.');
        console.error('[INFO] See .env.example for reference.');
    } else {
        console.error('[INFO] Configuration validated successfully');
    }
}

/**
 * Register all MCP tools
 */
function registerTools() {
    console.error('[INFO] Registering GitHub tools...');
    
    // Register GitHub tools if token is configured
    if (config.github.token) {
        registerGitHubTools(server);
        console.error('[INFO] ✓ GitHub tools registered');
    } else {
        console.error('[WARN] GitHub token not configured, skipping GitHub tools');
    }

    // Register Bitbucket tools if credentials are configured
    if (config.bitbucket.username && config.bitbucket.appPassword) {
        registerBitbucketTools(server);
        console.error('[INFO] ✓ Bitbucket tools registered');
    } else {
        console.error('[WARN] Bitbucket credentials not configured, skipping Bitbucket tools');
    }

    console.error(`[INFO] Review mode: ${config.review.mode}`);
    console.error(`[INFO] Default instructions: ${config.review.defaultInstructionsPath}`);
}

/**
 * Main entry point
 */
async function main() {
    try {
        // Initialize and validate configuration
        initializeServer();

        // Register all tools
        registerTools();

        // Start the server
        const transport = new StdioServerTransport();
        await server.connect(transport);
        
        console.error('[SUCCESS] Code Reviewer MCP Server is running!');
        console.error('[INFO] Waiting for tool invocations...');
    } catch (error) {
        console.error('[ERROR] Failed to start server:', error.message);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.error('[INFO] Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.error('[INFO] Shutting down gracefully...');
    process.exit(0);
});

// Start the server
main().catch((err) => {
    console.error('[ERROR] Server Error:', err);
    process.exit(1);
});