/**
 * Confidence Scorer - Calculates confidence percentage for each issue
 * 
 * Scoring factors:
 * - Pattern Match Strength (0-30 points): How well the code matches the detection pattern
 * - Context Appropriateness (0-30 points): Whether the issue makes sense given file type
 * - Rule Specificity (0-20 points): Custom rules score higher than generic ones
 * - Historical Accuracy (0-20 points): Track false positive rate per rule
 */

export default class ConfidenceScorer {
    constructor() {
        // Track historical accuracy of rules (can be persisted later)
        this.ruleHistory = new Map();
    }

    /**
     * Calculate confidence score for an issue
     * @param {Object} issue - The detected issue
     * @param {Object} context - Context about the file and code
     * @returns {number} Confidence score (0-100)
     */
    calculateConfidence(issue, context) {
        let score = 0;

        // 1. Pattern match strength (0-30 points)
        score += this.scorePatternMatch(issue);

        // 2. Context appropriateness (0-30 points)
        score += this.scoreContext(issue, context);

        // 3. Rule specificity (0-20 points)
        score += this.scoreRuleType(issue);

        // 4. Historical accuracy (0-20 points)
        score += this.scoreHistory(issue.ruleId);

        return Math.min(100, Math.max(0, score));
    }

    /**
     * Score based on pattern match strength
     */
    scorePatternMatch(issue) {
        if (!issue.pattern) return 15; // Default medium score

        // Security patterns get high confidence
        if (issue.tags?.includes('security')) {
            return 30;
        }

        // Exact matches (AST-based or specific patterns)
        if (issue.matchType === 'exact' || issue.matchType === 'ast') {
            return 25;
        }

        // Regex matches
        if (issue.matchType === 'regex') {
            return 20;
        }

        // Keyword matches (less reliable)
        if (issue.matchType === 'keyword') {
            return 10;
        }

        return 15; // Default
    }

    /**
     * Score based on context appropriateness
     */
    scoreContext(issue, context) {
        const { filename, isTestFile, isConfigFile, isMigrationFile, language } = context;

        // Production-only rules in test files = very low confidence
        if (isTestFile && issue.tags?.includes('production-only')) {
            return 0;
        }

        // Console.log in debug/test files
        if ((isTestFile || filename.includes('debug')) && issue.ruleId === 'no-console') {
            return 5;
        }

        // Config files can have magic numbers
        if (isConfigFile && issue.ruleId === 'magic-numbers') {
            return 0;
        }

        // Migration files can have raw SQL
        if (isMigrationFile && issue.tags?.includes('raw-sql')) {
            return 5;
        }

        // Language-specific rules in matching language = high confidence
        if (issue.language && issue.language === language) {
            return 30;
        }

        // Generic rules in any file = medium confidence
        if (!issue.language) {
            return 20;
        }

        // Language mismatch = low confidence
        return 10;
    }

    /**
     * Score based on rule specificity
     */
    scoreRuleType(issue) {
        // Custom team rules (from .reviewrc.md) = highest confidence
        if (issue.source === 'custom') {
            return 20;
        }

        // Language-specific built-in rules
        if (issue.language) {
            return 15;
        }

        // Security rules (always important)
        if (issue.tags?.includes('security')) {
            return 18;
        }

        // Generic best practices
        return 10;
    }

    /**
     * Score based on historical accuracy
     * (For now, use defaults; can be enhanced with ML later)
     */
    scoreHistory(ruleId) {
        if (!ruleId) return 10;

        // Check if we have history for this rule
        if (this.ruleHistory.has(ruleId)) {
            const history = this.ruleHistory.get(ruleId);
            const accuracy = history.correct / (history.correct + history.falsePositive);
            return Math.floor(accuracy * 20);
        }

        // Default scores for known rule types
        const highAccuracyRules = [
            'sql-injection',
            'xss-vulnerability',
            'hardcoded-secrets',
            'null-reference',
            'undefined-variable'
        ];

        const mediumAccuracyRules = [
            'function-length',
            'complexity',
            'no-console',
            'no-var'
        ];

        if (highAccuracyRules.includes(ruleId)) {
            return 18; // 90% historical accuracy
        }

        if (mediumAccuracyRules.includes(ruleId)) {
            return 14; // 70% historical accuracy
        }

        return 10; // Default 50% accuracy for unknown rules
    }

    /**
     * Record feedback on an issue (for learning)
     * @param {string} ruleId - Rule identifier
     * @param {boolean} wasCorrect - Whether the issue was valid
     */
    recordFeedback(ruleId, wasCorrect) {
        if (!this.ruleHistory.has(ruleId)) {
            this.ruleHistory.set(ruleId, { correct: 0, falsePositive: 0 });
        }

        const history = this.ruleHistory.get(ruleId);
        if (wasCorrect) {
            history.correct++;
        } else {
            history.falsePositive++;
        }
    }

    /**
     * Get confidence emoji for display
     */
    static getConfidenceEmoji(confidence) {
        if (confidence >= 90) return '🎯'; // Very high confidence
        if (confidence >= 75) return '✅'; // High confidence
        if (confidence >= 60) return '⚠️';  // Medium confidence
        return '❔'; // Low confidence
    }

    /**
     * Get confidence label
     */
    static getConfidenceLabel(confidence) {
        if (confidence >= 90) return 'Very High';
        if (confidence >= 75) return 'High';
        if (confidence >= 60) return 'Medium';
        return 'Low';
    }
}
