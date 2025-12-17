import axios from 'axios';
import config from '../config/config.js';
import { retryWithBackoff, validateBitbucketRepo, formatError } from '../utils/utils.js';

/**
 * Bitbucket service for PR and code review operations
 */
export class BitbucketService {
  constructor(username = null, appPassword = null, workspace = null) {
    this.username = username || config.bitbucket.username;
    this.appPassword = appPassword || config.bitbucket.appPassword;
    this.workspace = workspace || config.bitbucket.workspace;
    this.apiUrl = config.bitbucket.apiUrl;

    // Create axios instance with basic auth
    this.client = axios.create({
      baseURL: this.apiUrl,
      auth: {
        username: this.username,
        password: this.appPassword
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Get pull request details
   * @param {string} workspace - Workspace name
   * @param {string} repo - Repository name
   * @param {number} pullRequestId - PR ID
   * @returns {Promise<Object>} PR data
   */
  async getPullRequest(workspace, repo, pullRequestId) {
    const ws = workspace || this.workspace;
    validateBitbucketRepo(ws, repo);

    try {
      const { data } = await retryWithBackoff(
        () => this.client.get(`/repositories/${ws}/${repo}/pullrequests/${pullRequestId}`),
        config.rateLimit
      );

      return {
        id: data.id,
        title: data.title,
        description: data.description,
        state: data.state,
        author: data.author.display_name,
        source: data.source.branch.name,
        destination: data.destination.branch.name,
        merge_commit: data.merge_commit,
        comment_count: data.comment_count,
        url: data.links.html.href
      };
    } catch (error) {
      throw new Error(`Failed to fetch PR: ${formatError(error).message}`);
    }
  }

  /**
   * Get files changed in a pull request
   * @param {string} workspace - Workspace name
   * @param {string} repo - Repository name
   * @param {number} pullRequestId - PR ID
   * @returns {Promise<Array>} List of changed files
   */
  async getPullRequestDiff(workspace, repo, pullRequestId) {
    const ws = workspace || this.workspace;
    validateBitbucketRepo(ws, repo);

    try {
      const { data } = await retryWithBackoff(
        () => this.client.get(`/repositories/${ws}/${repo}/pullrequests/${pullRequestId}/diffstat`),
        config.rateLimit
      );

      return data.values.map(file => ({
        filename: file.old?.path || file.new?.path,
        status: file.status,
        lines_added: file.lines_added,
        lines_removed: file.lines_removed,
        type: file.type
      }));
    } catch (error) {
      throw new Error(`Failed to fetch PR diff: ${formatError(error).message}`);
    }
  }

  /**
   * Get raw diff content
   * @param {string} workspace - Workspace name
   * @param {string} repo - Repository name
   * @param {number} pullRequestId - PR ID
   * @returns {Promise<string>} Diff content
   */
  async getRawDiff(workspace, repo, pullRequestId) {
    const ws = workspace || this.workspace;
    validateBitbucketRepo(ws, repo);

    try {
      const { data } = await retryWithBackoff(
        () => this.client.get(
          `/repositories/${ws}/${repo}/pullrequests/${pullRequestId}/diff`,
          { responseType: 'text' }
        ),
        config.rateLimit
      );

      return data;
    } catch (error) {
      throw new Error(`Failed to fetch raw diff: ${formatError(error).message}`);
    }
  }

  /**
   * Get file content from repository
   * @param {string} workspace - Workspace name
   * @param {string} repo - Repository name
   * @param {string} path - File path
   * @param {string} ref - Branch or commit
   * @returns {Promise<string>} File content
   */
  async getFileContent(workspace, repo, path, ref) {
    const ws = workspace || this.workspace;
    validateBitbucketRepo(ws, repo);

    try {
      const { data } = await retryWithBackoff(
        () => this.client.get(
          `/repositories/${ws}/${repo}/src/${ref}/${path}`,
          { responseType: 'text' }
        ),
        config.rateLimit
      );

      return data;
    } catch (error) {
      throw new Error(`Failed to fetch file content: ${formatError(error).message}`);
    }
  }

  /**
   * Get existing comments on a PR
   * @param {string} workspace - Workspace name
   * @param {string} repo - Repository name
   * @param {number} pullRequestId - PR ID
   * @returns {Promise<Array>} List of comments
   */
  async getComments(workspace, repo, pullRequestId) {
    const ws = workspace || this.workspace;
    validateBitbucketRepo(ws, repo);

    try {
      const { data } = await retryWithBackoff(
        () => this.client.get(`/repositories/${ws}/${repo}/pullrequests/${pullRequestId}/comments`),
        config.rateLimit
      );

      return data.values.map(comment => ({
        id: comment.id,
        content: comment.content.raw,
        user: comment.user.display_name,
        created_on: comment.created_on,
        inline: comment.inline || null
      }));
    } catch (error) {
      throw new Error(`Failed to fetch comments: ${formatError(error).message}`);
    }
  }

  /**
   * Add a comment to a PR
   * @param {string} workspace - Workspace name
   * @param {string} repo - Repository name
   * @param {number} pullRequestId - PR ID
   * @param {string} content - Comment content
   * @param {Object} inline - Inline comment location (optional)
   * @returns {Promise<Object>} Created comment
   */
  async addComment(workspace, repo, pullRequestId, content, inline = null) {
    const ws = workspace || this.workspace;
    validateBitbucketRepo(ws, repo);

    try {
      const payload = {
        content: {
          raw: content
        }
      };

      // Add inline comment details if provided
      if (inline) {
        payload.inline = {
          to: inline.line,
          path: inline.path
        };
      }

      const { data } = await retryWithBackoff(
        () => this.client.post(
          `/repositories/${ws}/${repo}/pullrequests/${pullRequestId}/comments`,
          payload
        ),
        config.rateLimit
      );

      return {
        id: data.id,
        url: data.links.html.href
      };
    } catch (error) {
      throw new Error(`Failed to add comment: ${formatError(error).message}`);
    }
  }

  /**
   * Approve a pull request
   * @param {string} workspace - Workspace name
   * @param {string} repo - Repository name
   * @param {number} pullRequestId - PR ID
   * @returns {Promise<Object>} Approval data
   */
  async approvePullRequest(workspace, repo, pullRequestId) {
    const ws = workspace || this.workspace;
    validateBitbucketRepo(ws, repo);

    try {
      const { data } = await retryWithBackoff(
        () => this.client.post(`/repositories/${ws}/${repo}/pullrequests/${pullRequestId}/approve`),
        config.rateLimit
      );

      return {
        approved: true,
        user: data.user.display_name
      };
    } catch (error) {
      throw new Error(`Failed to approve PR: ${formatError(error).message}`);
    }
  }

  /**
   * Request changes on a pull request
   * @param {string} workspace - Workspace name
   * @param {string} repo - Repository name
   * @param {number} pullRequestId - PR ID
   * @param {string} reason - Reason for requesting changes
   * @returns {Promise<Object>} Result
   */
  async requestChanges(workspace, repo, pullRequestId, reason) {
    const ws = workspace || this.workspace;
    validateBitbucketRepo(ws, repo);

    try {
      // Bitbucket doesn't have a direct "request changes" endpoint
      // We'll add a comment and remove approval if present
      await this.client.delete(`/repositories/${ws}/${repo}/pullrequests/${pullRequestId}/approve`);
      
      const comment = await this.addComment(ws, repo, pullRequestId, `⚠️ **Changes Requested**\n\n${reason}`);

      return {
        requested_changes: true,
        comment_id: comment.id
      };
    } catch (error) {
      // If delete fails (not approved yet), just add comment
      if (error.response?.status === 404) {
        const comment = await this.addComment(ws, repo, pullRequestId, `⚠️ **Changes Requested**\n\n${reason}`);
        return {
          requested_changes: true,
          comment_id: comment.id
        };
      }
      throw new Error(`Failed to request changes: ${formatError(error).message}`);
    }
  }

  /**
   * Submit multiple review comments
   * @param {string} workspace - Workspace name
   * @param {string} repo - Repository name
   * @param {number} pullRequestId - PR ID
   * @param {Array<Object>} comments - Array of comments
   * @param {string} summary - Review summary
   * @returns {Promise<Object>} Result with comment IDs
   */
  async submitReview(workspace, repo, pullRequestId, comments, summary) {
    const ws = workspace || this.workspace;
    validateBitbucketRepo(ws, repo);

    const createdComments = [];

    try {
      // Add summary comment first
      if (summary) {
        const summaryComment = await this.addComment(ws, repo, pullRequestId, summary);
        createdComments.push(summaryComment);
      }

      // Add individual line comments
      for (const comment of comments) {
        const inline = comment.line ? {
          path: comment.path,
          line: comment.line
        } : null;

        const formattedContent = this.formatCommentBody(comment);
        const created = await this.addComment(ws, repo, pullRequestId, formattedContent, inline);
        createdComments.push(created);
      }

      return {
        success: true,
        comment_count: createdComments.length,
        comment_ids: createdComments.map(c => c.id)
      };
    } catch (error) {
      throw new Error(`Failed to submit review: ${formatError(error).message}`);
    }
  }

  /**
   * Format comment body with severity and suggestions
   * @param {Object} comment - Comment object
   * @returns {string} Formatted comment body
   */
  formatCommentBody(comment) {
    let body = '';

    // Add severity indicator
    const severityEmoji = {
      critical: '🔴',
      warning: '🟡',
      info: 'ℹ️'
    };

    body += `${severityEmoji[comment.severity] || ''} **${comment.severity.toUpperCase()}**: ${comment.message}\n`;

    // Add suggestion if available
    if (comment.suggestion) {
      body += `\n💡 **Suggestion**: ${comment.suggestion}`;
    }

    return body;
  }
}

export default BitbucketService;
