import { z } from 'zod';
import GitHubService from '../services/github-service.js';
import InstructionsManager from '../instructions/instructions-manager.js';
import CodeAnalyzer from '../analyzers/code-analyzer.js';
import { getChangedLines } from '../utils/utils.js';
import config from '../config/config.js';

/**
 * GitHub MCP tool definitions
 */
export function registerGitHubTools(server) {
  const githubService = new GitHubService();
  const instructionsManager = new InstructionsManager();

  /**
   * Main tool: Review a GitHub pull request
   */
  server.tool(
    'github_review_pr',
    'Review a GitHub pull request using custom instructions',
    {
      owner: z.string().describe('Repository owner/organization'),
      repo: z.string().describe('Repository name'),
      pullNumber: z.number().describe('Pull request number'),
      instructionsPath: z.string().optional().describe('Path to custom review instructions file (optional, uses default if not provided)'),
      mode: z.enum(['preview', 'direct']).optional().describe('Review mode: preview (return feedback) or direct (post to PR). Default: preview')
    },
    async ({ owner, repo, pullNumber, instructionsPath, mode }) => {
      try {
        const reviewMode = mode || config.review.mode;

        // Load instructions
        const instructions = await instructionsManager.loadInstructions(instructionsPath);

        // Get PR details
        const pr = await githubService.getPullRequest(owner, repo, pullNumber);
        const files = await githubService.getPullRequestFiles(owner, repo, pullNumber);

        // Get file contents for changed files
        const fileContents = [];
        for (const file of files.slice(0, config.review.maxFilesPerReview)) {
          if (file.status !== 'removed') {
            try {
              const content = await githubService.getFileContent(owner, repo, file.filename, pr.head);
              fileContents.push({
                filename: file.filename,
                content: content,
                patch: file.patch
              });
            } catch (error) {
              // Skip files that can't be retrieved
              console.error(`Could not fetch ${file.filename}: ${error.message}`);
            }
          }
        }

        // Parse changed lines from diffs
        const changedLines = {};
        for (const file of fileContents) {
          if (file.patch) {
            changedLines[file.filename] = getChangedLines(file.patch)[file.filename] || [];
          }
        }

        // Analyze code
        const analyzer = new CodeAnalyzer(instructions);
        const comments = analyzer.analyzeFiles(fileContents, changedLines);
        const summary = analyzer.generateSummary(comments);

        // Preview mode: return feedback
        if (reviewMode === 'preview') {
          return {
            mode: 'preview',
            pr: {
              number: pr.number,
              title: pr.title,
              url: pr.url
            },
            summary: summary,
            comments: comments,
            total_issues: comments.length,
            critical: comments.filter(c => c.severity === 'critical').length,
            warnings: comments.filter(c => c.severity === 'warning').length,
            info: comments.filter(c => c.severity === 'info').length
          };
        }

        // Direct mode: post to GitHub
        const commitSha = await githubService.getLatestCommitSha(owner, repo, pullNumber);
        const review = await githubService.submitReview(
          owner,
          repo,
          pullNumber,
          commitSha,
          comments,
          summary,
          'COMMENT'
        );

        return {
          mode: 'direct',
          pr: {
            number: pr.number,
            title: pr.title,
            url: pr.url
          },
          review: {
            id: review.id,
            url: review.url,
            state: review.state
          },
          summary: summary,
          total_comments: comments.length
        };

      } catch (error) {
        throw new Error(`GitHub review failed: ${error.message}`);
      }
    }
  );

  /**
   * Tool: Get GitHub PR details
   */
  server.tool(
    'github_get_pr',
    'Get details about a GitHub pull request',
    {
      owner: z.string().describe('Repository owner/organization'),
      repo: z.string().describe('Repository name'),
      pullNumber: z.number().describe('Pull request number')
    },
    async ({ owner, repo, pullNumber }) => {
      try {
        const pr = await githubService.getPullRequest(owner, repo, pullNumber);
        const files = await githubService.getPullRequestFiles(owner, repo, pullNumber);

        return {
          pr: pr,
          files: files.map(f => ({
            filename: f.filename,
            status: f.status,
            additions: f.additions,
            deletions: f.deletions
          }))
        };
      } catch (error) {
        throw new Error(`Failed to get PR: ${error.message}`);
      }
    }
  );

  /**
   * Tool: Add a single review comment
   */
  server.tool(
    'github_add_comment',
    'Add a single review comment to a GitHub pull request',
    {
      owner: z.string().describe('Repository owner/organization'),
      repo: z.string().describe('Repository name'),
      pullNumber: z.number().describe('Pull request number'),
      path: z.string().describe('File path'),
      line: z.number().describe('Line number'),
      message: z.string().describe('Comment message')
    },
    async ({ owner, repo, pullNumber, path, line, message }) => {
      try {
        const commitSha = await githubService.getLatestCommitSha(owner, repo, pullNumber);
        const comment = await githubService.addReviewComment(
          owner,
          repo,
          pullNumber,
          commitSha,
          path,
          line,
          message
        );

        return {
          success: true,
          comment: comment
        };
      } catch (error) {
        throw new Error(`Failed to add comment: ${error.message}`);
      }
    }
  );
}

export default registerGitHubTools;
