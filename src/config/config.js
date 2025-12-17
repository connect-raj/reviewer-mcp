import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const config = {
  // GitHub Configuration
  github: {
    token: process.env.GITHUB_TOKEN || '',
    apiUrl: 'https://api.github.com'
  },

  // Bitbucket Configuration
  bitbucket: {
    username: process.env.BITBUCKET_USERNAME || '',
    appPassword: process.env.BITBUCKET_APP_PASSWORD || '',
    workspace: process.env.BITBUCKET_WORKSPACE || '',
    apiUrl: process.env.BITBUCKET_API_URL || 'https://api.bitbucket.org/2.0'
  },

  // Review Settings
  review: {
    defaultInstructionsPath: process.env.DEFAULT_INSTRUCTIONS_PATH || '.reviewrc.md',
    mode: process.env.REVIEW_MODE || 'preview', // 'preview' or 'direct'
    maxFilesPerReview: 50,
    maxLinesPerFile: 1000
  },

  // API Rate Limiting
  rateLimit: {
    maxRetries: 3,
    retryDelayMs: 1000,
    backoffMultiplier: 2
  },

  // Paths
  paths: {
    root: join(__dirname, '..', '..'),
    defaultInstructions: join(__dirname, '..', 'instructions', 'default-instructions.md')
  }
};

/**
 * Validate required configuration
 */
export function validateConfig() {
  const errors = [];

  if (!config.github.token && !config.bitbucket.username) {
    errors.push('Either GITHUB_TOKEN or BITBUCKET credentials must be configured');
  }

  if (config.bitbucket.username && !config.bitbucket.appPassword) {
    errors.push('BITBUCKET_APP_PASSWORD is required when BITBUCKET_USERNAME is set');
  }

  if (!['preview', 'direct'].includes(config.review.mode)) {
    errors.push('REVIEW_MODE must be either "preview" or "direct"');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export default config;
