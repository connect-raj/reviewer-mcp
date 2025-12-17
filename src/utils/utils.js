/**
 * Retry helper for API calls with exponential backoff
 */
export async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    backoffMultiplier = 2,
    onRetry = null
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on certain error codes
      if (error.status === 401 || error.status === 403 || error.status === 404) {
        throw error;
      }

      if (attempt < maxRetries) {
        if (onRetry) {
          onRetry(attempt + 1, error, delay);
        }
        
        await sleep(delay);
        delay *= backoffMultiplier;
      }
    }
  }

  throw lastError;
}

/**
 * Sleep utility
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse diff to extract line numbers and context
 */
export function parseDiff(diffContent) {
  const files = [];
  let currentFile = null;
  let currentHunk = null;

  const lines = diffContent.split('\n');
  
  for (const line of lines) {
    // New file
    if (line.startsWith('diff --git')) {
      if (currentFile) {
        files.push(currentFile);
      }
      currentFile = {
        path: '',
        hunks: []
      };
      currentHunk = null;
    }
    
    // File path
    else if (line.startsWith('+++')) {
      const match = line.match(/\+\+\+ b\/(.*)/);
      if (match && currentFile) {
        currentFile.path = match[1];
      }
    }
    
    // Hunk header
    else if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
      if (match && currentFile) {
        currentHunk = {
          oldStart: parseInt(match[1]),
          newStart: parseInt(match[2]),
          changes: []
        };
        currentFile.hunks.push(currentHunk);
      }
    }
    
    // Changed lines
    else if (currentHunk && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))) {
      currentHunk.changes.push({
        type: line[0],
        content: line.substring(1),
        lineNumber: currentHunk.newStart + currentHunk.changes.filter(c => c.type !== '-').length
      });
    }
  }

  if (currentFile) {
    files.push(currentFile);
  }

  return files;
}

/**
 * Get added or modified lines from diff
 */
export function getChangedLines(diffContent) {
  const files = parseDiff(diffContent);
  const changedLines = {};

  for (const file of files) {
    changedLines[file.path] = [];
    
    for (const hunk of file.hunks) {
      let lineNumber = hunk.newStart;
      
      for (const change of hunk.changes) {
        if (change.type === '+') {
          changedLines[file.path].push({
            line: lineNumber,
            content: change.content
          });
        }
        
        if (change.type !== '-') {
          lineNumber++;
        }
      }
    }
  }

  return changedLines;
}

/**
 * Detect language from file extension
 */
export function detectLanguage(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  const languageMap = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'java': 'java',
    'go': 'go',
    'rb': 'ruby',
    'php': 'php',
    'cs': 'csharp',
    'cpp': 'cpp',
    'c': 'c',
    'rs': 'rust',
    'swift': 'swift',
    'kt': 'kotlin',
    'md': 'markdown',
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'xml': 'xml',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'sql': 'sql',
    'sh': 'shell',
    'bash': 'shell'
  };

  return languageMap[ext] || 'unknown';
}

/**
 * Format error message for user display
 */
export function formatError(error) {
  if (error.response) {
    // API error
    return {
      message: error.response.data?.message || error.message,
      status: error.response.status,
      type: 'api_error'
    };
  } else if (error.request) {
    // Network error
    return {
      message: 'Network error: Unable to reach the API',
      type: 'network_error'
    };
  } else {
    // Other error
    return {
      message: error.message,
      type: 'error'
    };
  }
}

/**
 * Validate GitHub repository info
 */
export function validateGitHubRepo(owner, repo) {
  if (!owner || typeof owner !== 'string' || owner.trim() === '') {
    throw new Error('Invalid repository owner');
  }
  if (!repo || typeof repo !== 'string' || repo.trim() === '') {
    throw new Error('Invalid repository name');
  }
}

/**
 * Validate Bitbucket repository info
 */
export function validateBitbucketRepo(workspace, repo) {
  if (!workspace || typeof workspace !== 'string' || workspace.trim() === '') {
    throw new Error('Invalid workspace');
  }
  if (!repo || typeof repo !== 'string' || repo.trim() === '') {
    throw new Error('Invalid repository name');
  }
}
