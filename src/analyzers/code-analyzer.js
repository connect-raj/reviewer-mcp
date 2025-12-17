import { detectLanguage } from '../utils/utils.js';

/**
 * Code analyzer that applies custom instructions to code review
 */
export class CodeAnalyzer {
  constructor(instructions) {
    this.instructions = instructions;
  }

  /**
   * Analyze code files based on instructions
   * @param {Array<Object>} files - Files with content and metadata
   * @param {Object} changedLines - Map of file paths to changed line numbers
   * @returns {Array<Object>} Review comments
   */
  analyzeFiles(files, changedLines = {}) {
    const comments = [];

    for (const file of files) {
      const fileComments = this.analyzeFile(file, changedLines[file.filename] || []);
      comments.push(...fileComments);
    }

    return comments;
  }

  /**
   * Analyze a single file
   * @param {Object} file - File object with filename and content
   * @param {Array<Object>} changedLinesList - List of changed lines
   * @returns {Array<Object>} Review comments for this file
   */
  analyzeFile(file, changedLinesList) {
    const language = detectLanguage(file.filename);
    const comments = [];

    // Get relevant instructions for this file
    const relevantInstructions = this.getRelevantInstructions(language);

    // Split content into lines
    const lines = file.content.split('\n');

    // Analyze only changed lines if provided
    const linesToAnalyze = changedLinesList.length > 0
      ? changedLinesList
      : lines.map((content, index) => ({ line: index + 1, content }));

    for (const { line, content } of linesToAnalyze) {
      const lineComments = this.analyzeLine(
        content,
        line,
        file.filename,
        language,
        relevantInstructions
      );
      comments.push(...lineComments);
    }

    return comments;
  }

  /**
   * Analyze a single line of code
   * @param {string} lineContent - Content of the line
   * @param {number} lineNumber - Line number
   * @param {string} filename - File name
   * @param {string} language - Programming language
   * @param {Object} instructions - Relevant instructions
   * @returns {Array<Object>} Comments for this line
   */
  analyzeLine(lineContent, lineNumber, filename, language, instructions) {
    const comments = [];

    // Security checks
    const securityIssues = this.checkSecurity(lineContent, language);
    if (securityIssues.length > 0) {
      for (const issue of securityIssues) {
        comments.push(this.createComment(
          filename,
          lineNumber,
          issue.message,
          'critical',
          issue.suggestion
        ));
      }
    }

    // Apply instruction-based checks
    for (const category in instructions.general) {
      const categoryIssues = this.applyInstructionRules(
        lineContent,
        instructions.general[category],
        language
      );
      
      for (const issue of categoryIssues) {
        comments.push(this.createComment(
          filename,
          lineNumber,
          issue.message,
          issue.severity,
          issue.suggestion
        ));
      }
    }

    // Apply language-specific checks
    const languageIssues = this.applyLanguageRules(
      lineContent,
      instructions.languageSpecific,
      language
    );
    
    for (const issue of languageIssues) {
      comments.push(this.createComment(
        filename,
        lineNumber,
        issue.message,
        issue.severity,
        issue.suggestion
      ));
    }

    return comments;
  }

  /**
   * Get relevant instructions for a language
   * @param {string} language - Programming language
   * @returns {Object} Relevant instructions
   */
  getRelevantInstructions(language) {
    const relevant = {
      general: {},
      languageSpecific: []
    };

    // Organize general instructions by category
    for (const [category, rules] of Object.entries(this.instructions.categories || {})) {
      relevant.general[category] = rules;
    }

    // Get language-specific instructions
    const languageLower = language.toLowerCase();
    relevant.languageSpecific = this.instructions.languageSpecific?.[languageLower] || [];

    return relevant;
  }

  /**
   * Check for security issues
   * @param {string} line - Line of code
   * @param {string} language - Programming language
   * @returns {Array<Object>} Security issues found
   */
  checkSecurity(line, language) {
    const issues = [];

    // Check for hardcoded secrets
    const secretPatterns = [
      { pattern: /(api[_-]?key|apikey)\s*=\s*['"][^'"]+['"]/i, message: 'Potential hardcoded API key detected' },
      { pattern: /(password|passwd|pwd)\s*=\s*['"][^'"]+['"]/i, message: 'Potential hardcoded password detected' },
      { pattern: /(secret|token)\s*=\s*['"][^'"]+['"]/i, message: 'Potential hardcoded secret detected' },
      { pattern: /-----BEGIN (RSA |)PRIVATE KEY-----/, message: 'Private key found in code' }
    ];

    for (const { pattern, message } of secretPatterns) {
      if (pattern.test(line)) {
        issues.push({
          message,
          suggestion: 'Use environment variables or a secure secret management system'
        });
      }
    }

    // Language-specific security checks
    if (language === 'javascript' || language === 'typescript') {
      // Eval usage
      if (/\beval\s*\(/.test(line)) {
        issues.push({
          message: 'Use of eval() detected - potential security risk',
          suggestion: 'Avoid eval() and use safer alternatives'
        });
      }

      // Dangerous innerHTML
      if (/\.innerHTML\s*=/.test(line) && !/\.textContent\s*=/.test(line)) {
        issues.push({
          message: 'Use of innerHTML detected - potential XSS vulnerability',
          suggestion: 'Consider using textContent or sanitize the HTML first'
        });
      }
    }

    if (language === 'python') {
      // SQL injection
      if (/execute\s*\(\s*["'].*%s/.test(line) || /execute\s*\(\s*f["']/.test(line)) {
        issues.push({
          message: 'Potential SQL injection vulnerability',
          suggestion: 'Use parameterized queries instead of string formatting'
        });
      }
    }

    return issues;
  }

  /**
   * Apply instruction rules to a line of code
   * @param {string} line - Line of code
   * @param {Array<Object>} rules - Instruction rules
   * @param {string} language - Programming language
   * @returns {Array<Object>} Issues found
   */
  applyInstructionRules(line, rules, language) {
    const issues = [];

    for (const rule of rules) {
      if (!rule.isPattern) continue;

      const issue = this.matchRule(line, rule, language);
      if (issue) {
        issues.push(issue);
      }
    }

    return issues;
  }

  /**
   * Apply language-specific rules
   * @param {string} line - Line of code
   * @param {Array<Object>} rules - Language-specific rules
   * @param {string} language - Programming language
   * @returns {Array<Object>} Issues found
   */
  applyLanguageRules(line, rules, language) {
    const issues = [];

    for (const rule of rules) {
      const issue = this.matchLanguageRule(line, rule, language);
      if (issue) {
        issues.push(issue);
      }
    }

    return issues;
  }

  /**
   * Match a rule against a line of code
   * @param {string} line - Line of code
   * @param {Object} rule - Rule to match
   * @param {string} language - Programming language
   * @returns {Object|null} Issue if rule matches
   */
  matchRule(line, rule, language) {
    // Simple keyword matching for now
    const ruleLower = rule.text.toLowerCase();
    
    // Check for console.log/print statements
    if (ruleLower.includes('console.log') || ruleLower.includes('print statement')) {
      if ((language === 'javascript' || language === 'typescript') && /console\.log\(/.test(line)) {
        return {
          message: 'console.log() statement found',
          severity: 'info',
          suggestion: 'Remove console.log() statements before merging'
        };
      }
      if (language === 'python' && /\bprint\(/.test(line)) {
        return {
          message: 'print() statement found',
          severity: 'info',
          suggestion: 'Remove print() statements before merging or use proper logging'
        };
      }
    }

    // Check for commented code
    if (ruleLower.includes('commented-out code')) {
      const commentPattern = language === 'python' ? /^\s*#\s*[a-z_]\w*\s*[=(]/ : /^\s*\/\/\s*[a-z_]\w*\s*[=(]/;
      if (commentPattern.test(line)) {
        return {
          message: 'Commented-out code detected',
          severity: 'warning',
          suggestion: 'Remove unused commented code'
        };
      }
    }

    return null;
  }

  /**
   * Match language-specific rule
   * @param {string} line - Line of code
   * @param {Object} rule - Rule to match
   * @param {string} language - Programming language
   * @returns {Object|null} Issue if rule matches
   */
  matchLanguageRule(line, rule, language) {
    const ruleLower = rule.text.toLowerCase();

    // JavaScript/TypeScript specific
    if (language === 'javascript' || language === 'typescript') {
      // Check for var usage
      if (ruleLower.includes('avoid') && ruleLower.includes('var')) {
        if (/\bvar\s+\w+/.test(line)) {
          return {
            message: 'Use of "var" detected',
            severity: 'warning',
            suggestion: 'Use const or let instead of var'
          };
        }
      }

      // Check for template literals
      if (ruleLower.includes('template literal')) {
        if (/['"][^'"]*\+[^'"]*['"]/.test(line)) {
          return {
            message: 'String concatenation with + detected',
            severity: 'info',
            suggestion: 'Consider using template literals instead'
          };
        }
      }
    }

    return null;
  }

  /**
   * Create a review comment
   * @param {string} filename - File name
   * @param {number} line - Line number
   * @param {string} message - Comment message
   * @param {string} severity - Severity level
   * @param {string} suggestion - Suggested fix
   * @returns {Object} Review comment
   */
  createComment(filename, line, message, severity, suggestion = null) {
    return {
      path: filename,
      line: line,
      message: message,
      severity: severity,
      suggestion: suggestion
    };
  }

  /**
   * Generate summary comment for the review
   * @param {Array<Object>} comments - All review comments
   * @returns {string} Summary text
   */
  generateSummary(comments) {
    const criticalCount = comments.filter(c => c.severity === 'critical').length;
    const warningCount = comments.filter(c => c.severity === 'warning').length;
    const infoCount = comments.filter(c => c.severity === 'info').length;

    let summary = '## Code Review Summary\n\n';

    if (comments.length === 0) {
      summary += '✅ No issues found. Code looks good!\n';
    } else {
      summary += `Found ${comments.length} issue(s):\n`;
      if (criticalCount > 0) summary += `- 🔴 ${criticalCount} critical issue(s)\n`;
      if (warningCount > 0) summary += `- 🟡 ${warningCount} warning(s)\n`;
      if (infoCount > 0) summary += `- ℹ️ ${infoCount} info/suggestion(s)\n`;
    }

    summary += '\n' + (this.instructions.tone || 'Please review the comments below.');

    return summary;
  }
}

export default CodeAnalyzer;
