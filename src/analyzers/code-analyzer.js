import { detectLanguage } from '../utils/utils.js';
import ConfidenceScorer from '../reviewers/confidence-scorer.js';
import IssueCategorizer from '../reviewers/issue-categorizer.js';
import IntentAnalyzer from '../analyzers/intent-analyzer.js';

/**
 * Code analyzer that applies custom instructions to code review
 * Enhanced with confidence scoring, categorization, and intent awareness
 */
export class CodeAnalyzer {
  constructor(instructions, prData = null) {
    this.instructions = instructions;
    this.confidenceScorer = new ConfidenceScorer();
    this.categorizer = new IssueCategorizer();
    this.intentAnalyzer = new IntentAnalyzer();
    
    // Analyze PR intent if PR data is provided
    this.prIntent = prData ? this.intentAnalyzer.analyzePRIntent(
      prData.title || '',
      prData.body || '',
      prData.labels || []
    ) : null;
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

    // Analyze file intent
    const fileIntent = this.intentAnalyzer.analyzeFileIntent(file.filename, file.content);

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
        relevantInstructions,
        fileIntent  // Pass file intent to analyzeLine
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
   * @param {Object} fileIntent - File intent information
   * @returns {Array<Object>} Comments for this line
   */
  analyzeLine(lineContent, lineNumber, filename, language, instructions, fileIntent) {
    const rawIssues = [];

    // Context for confidence scoring
    const context = {
      filename,
      language,
      lineNumber,
      isTestFile: fileIntent.isTestFile,
      isConfigFile: fileIntent.isConfigFile,
      isMigrationFile: fileIntent.isMigrationFile,
      fileType: fileIntent.type
    };

    // Security checks
    const securityIssues = this.checkSecurity(lineContent, language);
    for (const issue of securityIssues) {
      rawIssues.push({
        ...issue,
        tags: issue.tags || ['security'],
        ruleId: issue.ruleId,
        source: 'builtin',
        matchType: 'regex'
      });
    }

    // Apply instruction-based checks
    for (const category in instructions.general) {
      const categoryIssues = this.applyInstructionRules(
        lineContent,
        instructions.general[category],
        language,
        fileIntent
      );
      
      for (const issue of categoryIssues) {
        rawIssues.push({
          ...issue,
          source: 'custom',
          tags: issue.tags || [category.toLowerCase()]
        });
      }
    }

    // Apply language-specific checks
    const languageIssues = this.applyLanguageRules(
      lineContent,
      instructions.languageSpecific,
      language,
      fileIntent
    );
    
    for (const issue of languageIssues) {
      rawIssues.push({
        ...issue,
        language,
        tags: issue.tags || ['style'],
        source: 'builtin'
      });
    }

    // Process each issue: categorize and score confidence
    const comments = [];
    for (const issue of rawIssues) {
      // Calculate confidence
      const confidence = this.confidenceScorer.calculateConfidence(issue, context);
      
      // Categorize issue
      const categoryInfo = this.categorizer.categorize(issue);
      
      // Create enhanced comment
      comments.push(this.createComment(
        filename,
        lineNumber,
        issue.message,
        categoryInfo.severity,
        issue.suggestion,
        confidence,
        categoryInfo.category,
        categoryInfo.emoji
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
      { pattern: /(api[_-]?key|apikey)\s*=\s*['"][^'"]+['"]/i, message: 'Potential hardcoded API key detected', ruleId: 'hardcoded-secrets' },
      { pattern: /(password|passwd|pwd)\s*=\s*['"][^'"]+['"]/i, message: 'Potential hardcoded password detected', ruleId: 'hardcoded-secrets' },
      { pattern: /(secret|token)\s*=\s*['"][^'"]+['"]/i, message: 'Potential hardcoded secret detected', ruleId: 'hardcoded-secrets' },
      { pattern: /-----BEGIN (RSA |)PRIVATE KEY-----/, message: 'Private key found in code', ruleId: 'hardcoded-secrets' }
    ];

    for (const { pattern, message, ruleId } of secretPatterns) {
      if (pattern.test(line)) {
        issues.push({
          message,
          suggestion: 'Use environment variables or a secure secret management system',
          ruleId,
          tags: ['security', 'vulnerability', 'secrets']
        });
      }
    }

    // Language-specific security checks
    if (language === 'javascript' || language === 'typescript') {
      // Eval usage
      if (/\beval\s*\(/.test(line)) {
        issues.push({
          message: 'Use of eval() detected - potential security risk',
          suggestion: 'Avoid eval() and use safer alternatives',
          ruleId: 'dangerous-eval',
          tags: ['security', 'vulnerability']
        });
      }

      // Dangerous innerHTML
      if (/\.innerHTML\s*=/.test(line) && !/\.textContent\s*=/.test(line)) {
        issues.push({
          message: 'Use of innerHTML detected - potential XSS vulnerability',
          suggestion: 'Consider using textContent or sanitize the HTML first',
          ruleId: 'xss-vulnerability',
          tags: ['security', 'vulnerability', 'xss']
        });
      }
    }

    if (language === 'python') {
      // SQL injection
      if (/execute\s*\(\s*["'].*%s/.test(line) || /execute\s*\(\s*f["']/.test(line)) {
        issues.push({
          message: 'Potential SQL injection vulnerability',
          suggestion: 'Use parameterized queries instead of string formatting',
          ruleId: 'sql-injection',
          tags: ['security', 'vulnerability', 'injection']
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
   * @param {Object} fileIntent - File intent information
   * @returns {Array<Object>} Issues found
   */
  applyInstructionRules(line, rules, language, fileIntent) {
    const issues = [];

    for (const rule of rules) {
      if (!rule.isPattern) continue;

      const issue = this.matchRule(line, rule, language, fileIntent);
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
   * @param {Object} fileIntent - File intent information
   * @returns {Array<Object>} Issues found
   */
  applyLanguageRules(line, rules, language, fileIntent) {
    const issues = [];

    for (const rule of rules) {
      const issue = this.matchLanguageRule(line, rule, language, fileIntent);
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
   * @param {Object} fileIntent - File intent information
   * @returns {Object|null} Issue if rule matches
   */
  matchRule(line, rule, language, fileIntent) {
    // Simple keyword matching for now
    const ruleLower = rule.text.toLowerCase();
    
    // Check for console.log/print statements (respect file intent)
    if (ruleLower.includes('console.log') || ruleLower.includes('print statement')) {
      // Allow console.log in test files, debug files, and scripts
      if (fileIntent.allowedPatterns.includes('console.log')) {
        return null; // Skip this rule for this file type
      }
      
      if ((language === 'javascript' || language === 'typescript') && /console\.log\(/.test(line)) {
        return {
          message: 'console.log() statement found in production code',
          severity: 'info',
          suggestion: 'Remove console.log() statements before merging',
          ruleId: 'no-console',
          tags: ['style', 'production-only'],
          matchType: 'regex'
        };
      }
      if (language === 'python' && /\bprint\(/.test(line)) {
        return {
          message: 'print() statement found in production code',
          severity: 'info',
          suggestion: 'Remove print() statements before merging or use proper logging',
          ruleId: 'no-print',
          tags: ['style', 'production-only'],
          matchType: 'regex'
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
          suggestion: 'Remove unused commented code',
          ruleId: 'no-commented-code',
          tags: ['maintainability'],
          matchType: 'regex'
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
   * @param {Object} fileIntent - File intent information
   * @returns {Object|null} Issue if rule matches
   */
  matchLanguageRule(line, rule, language, fileIntent) {
    const ruleLower = rule.text.toLowerCase();

    // JavaScript/TypeScript specific
    if (language === 'javascript' || language === 'typescript') {
      // Check for var usage
      if (ruleLower.includes('avoid') && ruleLower.includes('var')) {
        if (/\bvar\s+\w+/.test(line)) {
          return {
            message: 'Use of "var" detected',
            severity: 'warning',
            suggestion: 'Use const or let instead of var',
            ruleId: 'no-var',
            tags: ['style', 'modern-syntax'],
            matchType: 'regex'
          };
        }
      }

      // Check for template literals
      if (ruleLower.includes('template literal')) {
        if (/['"][^'"]*\+[^'"]*['"]/.test(line)) {
          return {
            message: 'String concatenation with + detected',
            severity: 'info',
            suggestion: 'Consider using template literals instead',
            ruleId: 'prefer-template-literal',
            tags: ['style', 'modern-syntax'],
            matchType: 'regex'
          };
        }
      }
    }

    return null;
  }

  /**
   * Create a review comment with confidence and category
   * @param {string} filename - File name
   * @param {number} line - Line number
   * @param {string} message - Comment message
   * @param {string} severity - Severity level
   * @param {string} suggestion - Suggested fix
   * @param {number} confidence - Confidence score (0-100)
   * @param {string} category - Category (BUG/REFACTOR/SUGGESTION)
   * @param {string} emoji - Category emoji
   * @returns {Object} Review comment
   */
  createComment(filename, line, message, severity, suggestion = null, confidence = 70, category = 'SUGGESTION', emoji = '🔵') {
    return {
      path: filename,
      line: line,
      message: message,
      severity: severity,
      suggestion: suggestion,
      confidence: confidence,
      category: category,
      emoji: emoji
    };
  }

  /**
   * Generate summary comment for the review (with categorization)
   * @param {Array<Object>} comments - All review comments
   * @returns {string} Summary text
   */
  generateSummary(comments) {
    // Categorize comments
    const { issues, stats } = this.categorizer.categorizeMultiple(comments);

    let summary = '## Code Review Summary\n\n';

    if (comments.length === 0) {
      summary += '✅ No issues found. Code looks good!\n';
    } else {
      summary += `Found ${stats.total} issue(s):\n\n`;
      
      // By category
      if (stats.bugs > 0) {
        summary += `🔴 **${stats.bugs} Bugs** - Must fix before merge\n`;
      }
      if (stats.refactors > 0) {
        summary += `🟡 **${stats.refactors} Refactors** - Should fix for quality\n`;
      }
      if (stats.suggestions > 0) {
        summary += `🔵 **${stats.suggestions} Suggestions** - Nice to have\n`;
      }
      
      summary += '\n';
      
      // By severity
      if (stats.critical > 0) {
        summary += `⚠️ ${stats.critical} critical issue(s)\n`;
      }
      
      // Average confidence
      const avgConfidence = Math.round(
        comments.reduce((sum, c) => sum + (c.confidence || 0), 0) / comments.length
      );
      summary += `\n📊 Average confidence: ${avgConfidence}%\n`;
    }

    summary += '\n' + (this.instructions.tone || 'Please review the comments below.');

    return summary;
  }
}

export default CodeAnalyzer;
