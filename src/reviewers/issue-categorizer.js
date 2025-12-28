/**
 * Issue Categorizer - Categorizes issues into Bugs, Refactors, and Suggestions
 * 
 * Categories:
 * - 🔴 BUGS: Security vulnerabilities, logic errors, crashes, resource leaks
 * - 🟡 REFACTORS: Code duplication, complexity, performance, maintainability
 * - 🔵 SUGGESTIONS: Style improvements, best practices, modern syntax
 */

export default class IssueCategorizer {
    /**
     * Categorize an issue
     * @param {Object} issue - The detected issue
     * @returns {Object} Category information with emoji and severity
     */
    categorize(issue) {
        // Check if it's a bug
        if (this.isBug(issue)) {
            return {
                category: 'BUG',
                severity: this.getBugSeverity(issue),
                emoji: '🔴',
                sortOrder: 1 // Highest priority
            };
        }

        // Check if it's a refactor
        if (this.isRefactor(issue)) {
            return {
                category: 'REFACTOR',
                severity: this.getRefactorSeverity(issue),
                emoji: '🟡',
                sortOrder: 2 // Medium priority
            };
        }

        // Default to suggestion
        return {
            category: 'SUGGESTION',
            severity: 'low',
            emoji: '🔵',
            sortOrder: 3 // Lowest priority
        };
    }

    /**
     * Determine if an issue is a bug
     */
    isBug(issue) {
        const bugTags = [
            'security',
            'vulnerability',
            'injection',
            'xss',
            'csrf',
            'logic-error',
            'null-reference',
            'undefined',
            'crash',
            'exception',
            'error',
            'race-condition',
            'deadlock',
            'leak',
            'memory-leak',
            'resource-leak',
            'type-error',
            'incorrect-operator',
            'wrong-comparison'
        ];

        // Check tags
        if (issue.tags?.some(tag => bugTags.includes(tag))) {
            return true;
        }

        // Check rule IDs
        const bugRuleIds = [
            'sql-injection',
            'xss-vulnerability',
            'hardcoded-secrets',
            'insecure-random',
            'path-traversal',
            'command-injection',
            'xxe-vulnerability'
        ];

        if (bugRuleIds.includes(issue.ruleId)) {
            return true;
        }

        return false;
    }

    /**
     * Determine if an issue is a refactor
     */
    isRefactor(issue) {
        const refactorTags = [
            'complexity',
            'duplication',
            'dry-violation',
            'performance',
            'n+1-query',
            'inefficient-algorithm',
            'maintainability',
            'naming',
            'unclear-code',
            'documentation',
            'missing-docs',
            'coverage',
            'missing-tests',
            'design-pattern',
            'coupling',
            'cohesion'
        ];

        // Check tags
        if (issue.tags?.some(tag => refactorTags.includes(tag))) {
            return true;
        }

        // Check rule IDs
        const refactorRuleIds = [
            'function-length',
            'function-complexity',
            'code-duplication',
            'nested-loops',
            'missing-error-handling',
            'unused-variable',
            'unused-import'
        ];

        if (refactorRuleIds.includes(issue.ruleId)) {
            return true;
        }

        return false;
    }

    /**
     * Get bug severity level
     */
    getBugSeverity(issue) {
        // Critical: Security vulnerabilities
        if (issue.tags?.includes('security') || issue.tags?.includes('vulnerability')) {
            return 'critical';
        }

        // High: Crashes, exceptions, logic errors
        if (issue.tags?.some(tag => ['crash', 'exception', 'logic-error', 'null-reference'].includes(tag))) {
            return 'high';
        }

        // Medium: Other bugs
        return 'medium';
    }

    /**
     * Get refactor severity level
     */
    getRefactorSeverity(issue) {
        // High: Performance issues, missing error handling
        if (issue.tags?.some(tag => ['performance', 'n+1-query', 'missing-error-handling'].includes(tag))) {
            return 'high';
        }

        // Default medium for refactors
        return 'medium';
    }

    /**
     * Get category color for display
     */
    static getCategoryColor(category) {
        const colors = {
            'BUG': '#ff4444',      // Red
            'REFACTOR': '#ffaa00', // Yellow/Orange
            'SUGGESTION': '#4444ff' // Blue
        };
        return colors[category] || '#888888';
    }

    /**
     * Get category description
     */
    static getCategoryDescription(category) {
        const descriptions = {
            'BUG': 'Must fix - potential errors, security issues, or crashes',
            'REFACTOR': 'Should fix - impacts maintainability or performance',
            'SUGGESTION': 'Nice to have - style improvements and best practices'
        };
        return descriptions[category] || '';
    }

    /**
     * Categorize multiple issues and generate statistics
     */
    categorizeMultiple(issues) {
        const categorized = issues.map(issue => ({
            ...issue,
            ...this.categorize(issue)
        }));

        // Sort by priority (bugs first, then refactors, then suggestions)
        categorized.sort((a, b) => {
            if (a.sortOrder !== b.sortOrder) {
                return a.sortOrder - b.sortOrder;
            }
            // Within same category, sort by confidence (high to low)
            return (b.confidence || 0) - (a.confidence || 0);
        });

        // Generate statistics
        const stats = {
            total: categorized.length,
            bugs: categorized.filter(i => i.category === 'BUG').length,
            refactors: categorized.filter(i => i.category === 'REFACTOR').length,
            suggestions: categorized.filter(i => i.category === 'SUGGESTION').length,
            critical: categorized.filter(i => i.severity === 'critical').length,
            high: categorized.filter(i => i.severity === 'high').length,
            medium: categorized.filter(i => i.severity === 'medium').length,
            low: categorized.filter(i => i.severity === 'low').length
        };

        return {
            issues: categorized,
            stats
        };
    }
}
