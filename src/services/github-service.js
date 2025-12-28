import { Octokit } from '@octokit/rest';
import config from '../config/config.js';
import { retryWithBackoff, validateGitHubRepo, formatError } from '../utils/utils.js';

/**
 * GitHub service for PR and code review operations
 */
export class GitHubService {
  constructor(token = null) {
    this.octokit = new Octokit({
      auth: token || config.github.token
    });
  }

  /**
   * Get pull request details
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} pullNumber - PR number
   * @returns {Promise<Object>} PR data
   */
  async getPullRequest(owner, repo, pullNumber) {
    validateGitHubRepo(owner, repo);

    try {
      const { data } = await retryWithBackoff(
        () => this.octokit.pulls.get({
          owner,
          repo,
          pull_number: pullNumber
        }),
        config.rateLimit
      );

      return {
        number: data.number,
        title: data.title,
        body: data.body,
        state: data.state,
        author: data.user.login,
        base: data.base.ref,
        head: data.head.ref,
        mergeable: data.mergeable,
        changed_files: data.changed_files,
        additions: data.additions,
        deletions: data.deletions,
        url: data.html_url
      };
    } catch (error) {
      throw new Error(`Failed to fetch PR: ${formatError(error).message}`);
    }
  }

  /**
   * Get files changed in a pull request
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} pullNumber - PR number
   * @returns {Promise<Array>} List of changed files
   */
  async getPullRequestFiles(owner, repo, pullNumber) {
    validateGitHubRepo(owner, repo);

    try {
      const { data } = await retryWithBackoff(
        () => this.octokit.pulls.listFiles({
          owner,
          repo,
          pull_number: pullNumber,
          per_page: config.review.maxFilesPerReview
        }),
        config.rateLimit
      );

      return data.map(file => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        patch: file.patch,
        blob_url: file.blob_url,
        raw_url: file.raw_url
      }));
    } catch (error) {
      throw new Error(`Failed to fetch PR files: ${formatError(error).message}`);
    }
  }

  /**
   * Get file content from repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} path - File path
   * @param {string} ref - Git ref (branch, tag, commit)
   * @returns {Promise<string>} File content
   */
  async getFileContent(owner, repo, path, ref) {
    validateGitHubRepo(owner, repo);

    try {
      const { data } = await retryWithBackoff(
        () => this.octokit.repos.getContent({
          owner,
          repo,
          path,
          ref
        }),
        config.rateLimit
      );

      if (Array.isArray(data) || data.type !== 'file') {
        throw new Error('Path is not a file');
      }

      return Buffer.from(data.content, 'base64').toString('utf-8');
    } catch (error) {
      throw new Error(`Failed to fetch file content: ${formatError(error).message}`);
    }
  }

  /**
   * Get existing review comments on a PR
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} pullNumber - PR number
   * @returns {Promise<Array>} List of comments
   */
  async getReviewComments(owner, repo, pullNumber) {
    validateGitHubRepo(owner, repo);

    try {
      const { data } = await retryWithBackoff(
        () => this.octokit.pulls.listReviewComments({
          owner,
          repo,
          pull_number: pullNumber
        }),
        config.rateLimit
      );

      return data.map(comment => ({
        id: comment.id,
        path: comment.path,
        line: comment.line,
        body: comment.body,
        user: comment.user.login,
        created_at: comment.created_at
      }));
    } catch (error) {
      throw new Error(`Failed to fetch review comments: ${formatError(error).message}`);
    }
  }

  /**
   * Add a single review comment to a PR
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} pullNumber - PR number
   * @param {string} commitId - Commit SHA
   * @param {string} path - File path
   * @param {number} line - Line number
   * @param {string} body - Comment body
   * @returns {Promise<Object>} Created comment
   */
  async addReviewComment(owner, repo, pullNumber, commitId, path, line, body) {
    validateGitHubRepo(owner, repo);

    try {
      const { data } = await retryWithBackoff(
        () => this.octokit.pulls.createReviewComment({
          owner,
          repo,
          pull_number: pullNumber,
          commit_id: commitId,
          path,
          line,
          body
        }),
        config.rateLimit
      );

      return {
        id: data.id,
        url: data.html_url
      };
    } catch (error) {
      throw new Error(`Failed to add review comment: ${formatError(error).message}`);
    }
  }

  /**
   * Submit a complete review with multiple comments
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} pullNumber - PR number
   * @param {string} commitId - Commit SHA
   * @param {Array<Object>} comments - Array of comments
   * @param {string} body - Review summary
   * @param {string} event - Review event (APPROVE, REQUEST_CHANGES, COMMENT)
   * @returns {Promise<Object>} Created review
   */
  async submitReview(owner, repo, pullNumber, commitId, comments, body, event = 'COMMENT') {
    validateGitHubRepo(owner, repo);

    try {
      const reviewComments = comments.map(comment => ({
        path: comment.path,
        line: comment.line,
        body: this.formatCommentBody(comment)
      }));

      const { data } = await retryWithBackoff(
        () => this.octokit.pulls.createReview({
          owner,
          repo,
          pull_number: pullNumber,
          commit_id: commitId,
          body,
          event,
          comments: reviewComments
        }),
        config.rateLimit
      );

      return {
        id: data.id,
        url: data.html_url,
        state: data.state
      };
    } catch (error) {
      throw new Error(`Failed to submit review: ${formatError(error).message}`);
    }
  }

  /**
   * Format comment body with category, confidence, severity and suggestions
   * @param {Object} comment - Comment object
   * @returns {string} Formatted comment body
   */
  formatCommentBody(comment) {
    let body = '';

    // Add category and confidence indicator
    const emoji = comment.emoji || '🔵';
    const category = comment.category || 'SUGGESTION';
    const confidence = comment.confidence !== undefined ? comment.confidence : 70;
    
    // Confidence emoji
    const confidenceEmoji = confidence >= 90 ? '🎯' : confidence >= 75 ? '✅' : confidence >= 60 ? '⚠️' : '❔';
    
    // Header with category, confidence
    body += `${emoji} **${category}** ${confidenceEmoji} (Confidence: ${confidence}%)\n\n`;
    
    // Message
    body += `${comment.message}\n`;

    // Add suggestion if available
    if (comment.suggestion) {
      body += `\n💡 **Suggestion**: ${comment.suggestion}`;
    }

    return body;
  }

  /**
   * Get PR diff
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} pullNumber - PR number
   * @returns {Promise<string>} Diff content
   */
  async getPullRequestDiff(owner, repo, pullNumber) {
    validateGitHubRepo(owner, repo);

    try {
      const { data } = await retryWithBackoff(
        () => this.octokit.pulls.get({
          owner,
          repo,
          pull_number: pullNumber,
          mediaType: {
            format: 'diff'
          }
        }),
        config.rateLimit
      );

      return data;
    } catch (error) {
      throw new Error(`Failed to fetch PR diff: ${formatError(error).message}`);
    }
  }

  /**
   * Get the latest commit SHA from a PR
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {number} pullNumber - PR number
   * @returns {Promise<string>} Commit SHA
   */
  async getLatestCommitSha(owner, repo, pullNumber) {
    const pr = await this.getPullRequest(owner, repo, pullNumber);
    
    const { data: commits } = await this.octokit.pulls.listCommits({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 1,
      page: 1
    });

    // Get the last commit
    const { data: allCommits } = await this.octokit.pulls.listCommits({
      owner,
      repo,
      pull_number: pullNumber
    });

    return allCommits[allCommits.length - 1].sha;
  }
}

export default GitHubService;
