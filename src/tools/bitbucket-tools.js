import { z } from 'zod';
import BitbucketService from '../services/bitbucket-service.js';
import InstructionsManager from '../instructions/instructions-manager.js';
import CodeAnalyzer from '../analyzers/code-analyzer.js';
import { getChangedLines } from '../utils/utils.js';
import config from '../config/config.js';

/**
 * Bitbucket MCP tool definitions
 */
export function registerBitbucketTools(server) {
  const bitbucketService = new BitbucketService();
  const instructionsManager = new InstructionsManager();

  /**
   * Main tool: Review a Bitbucket pull request
   */
  server.tool(
    'bitbucket_review_pr',
    'Review a Bitbucket pull request using custom instructions',
    {
      workspace: z.string().optional().describe('Workspace name (optional, uses default from config)'),
      repo: z.string().describe('Repository name'),
      pullRequestId: z.number().describe('Pull request ID'),
      instructionsPath: z.string().optional().describe('Path to custom review instructions file (optional, uses default if not provided)'),
      mode: z.enum(['preview', 'direct']).optional().describe('Review mode: preview (return feedback) or direct (post to PR). Default: preview')
    },
    async ({ workspace, repo, pullRequestId, instructionsPath, mode }) => {
      try {
        const reviewMode = mode || config.review.mode;
        const ws = workspace || config.bitbucket.workspace;

        // Load instructions
        const instructions = await instructionsManager.loadInstructions(instructionsPath);

        // Get PR details
        const pr = await bitbucketService.getPullRequest(ws, repo, pullRequestId);
        const diffFiles = await bitbucketService.getPullRequestDiff(ws, repo, pullRequestId);

        // Get file contents for changed files
        const fileContents = [];
        for (const file of diffFiles.slice(0, config.review.maxFilesPerReview)) {
          if (file.status !== 'removed') {
            try {
              const content = await bitbucketService.getFileContent(ws, repo, file.filename, pr.source);
              fileContents.push({
                filename: file.filename,
                content: content
              });
            } catch (error) {
              // Skip files that can't be retrieved
              console.error(`Could not fetch ${file.filename}: ${error.message}`);
            }
          }
        }

        // Get raw diff for changed lines parsing
        const rawDiff = await bitbucketService.getRawDiff(ws, repo, pullRequestId);
        const changedLines = getChangedLines(rawDiff);

        // Analyze code
        const analyzer = new CodeAnalyzer(instructions);
        const comments = analyzer.analyzeFiles(fileContents, changedLines);
        const summary = analyzer.generateSummary(comments);

        // Preview mode: return feedback
        if (reviewMode === 'preview') {
          return {
            mode: 'preview',
            pr: {
              id: pr.id,
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

        // Direct mode: post to Bitbucket
        const review = await bitbucketService.submitReview(
          ws,
          repo,
          pullRequestId,
          comments,
          summary
        );

        return {
          mode: 'direct',
          pr: {
            id: pr.id,
            title: pr.title,
            url: pr.url
          },
          review: {
            success: review.success,
            comment_count: review.comment_count
          },
          summary: summary,
          total_comments: comments.length
        };

      } catch (error) {
        throw new Error(`Bitbucket review failed: ${error.message}`);
      }
    }
  );

  /**
   * Tool: Get Bitbucket PR details
   */
  server.tool(
    'bitbucket_get_pr',
    'Get details about a Bitbucket pull request',
    {
      workspace: z.string().optional().describe('Workspace name (optional, uses default from config)'),
      repo: z.string().describe('Repository name'),
      pullRequestId: z.number().describe('Pull request ID')
    },
    async ({ workspace, repo, pullRequestId }) => {
      try {
        const ws = workspace || config.bitbucket.workspace;
        const pr = await bitbucketService.getPullRequest(ws, repo, pullRequestId);
        const files = await bitbucketService.getPullRequestDiff(ws, repo, pullRequestId);

        return {
          pr: pr,
          files: files.map(f => ({
            filename: f.filename,
            status: f.status,
            lines_added: f.lines_added,
            lines_removed: f.lines_removed
          }))
        };
      } catch (error) {
        throw new Error(`Failed to get PR: ${error.message}`);
      }
    }
  );

  /**
   * Tool: Add a comment to Bitbucket PR
   */
  server.tool(
    'bitbucket_add_comment',
    'Add a comment to a Bitbucket pull request',
    {
      workspace: z.string().optional().describe('Workspace name (optional, uses default from config)'),
      repo: z.string().describe('Repository name'),
      pullRequestId: z.number().describe('Pull request ID'),
      message: z.string().describe('Comment message'),
      path: z.string().optional().describe('File path for inline comment (optional)'),
      line: z.number().optional().describe('Line number for inline comment (optional)')
    },
    async ({ workspace, repo, pullRequestId, message, path, line }) => {
      try {
        const ws = workspace || config.bitbucket.workspace;
        const inline = (path && line) ? { path, line } : null;
        
        const comment = await bitbucketService.addComment(
          ws,
          repo,
          pullRequestId,
          message,
          inline
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

  /**
   * Tool: Approve Bitbucket PR
   */
  server.tool(
    'bitbucket_approve_pr',
    'Approve a Bitbucket pull request',
    {
      workspace: z.string().optional().describe('Workspace name (optional, uses default from config)'),
      repo: z.string().describe('Repository name'),
      pullRequestId: z.number().describe('Pull request ID')
    },
    async ({ workspace, repo, pullRequestId }) => {
      try {
        const ws = workspace || config.bitbucket.workspace;
        const result = await bitbucketService.approvePullRequest(ws, repo, pullRequestId);

        return {
          success: true,
          approved: result.approved,
          user: result.user
        };
      } catch (error) {
        throw new Error(`Failed to approve PR: ${error.message}`);
      }
    }
  );
}

export default registerBitbucketTools;
