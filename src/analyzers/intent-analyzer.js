/**
 * Intent Analyzer - Understands code context to provide context-aware reviews
 * 
 * Analyzes:
 * - File type and purpose (test, config, migration, production)
 * - PR intent from title and labels (feature, bugfix, refactor)
 * - Function intent from naming patterns
 */

export default class IntentAnalyzer {
    /**
     * Analyze file intent based on filename and content
     * @param {string} filename - File path
     * @param {string} content - File content
     * @returns {Object} Intent information
     */
    analyzeFileIntent(filename, content = '') {
        const type = this.detectFileType(filename);
        const purpose = this.detectFilePurpose(filename, content);

        return {
            type,
            purpose,
            isProduction: type === 'production',
            isTestFile: type === 'test',
            isConfigFile: type === 'config',
            isMigrationFile: type === 'migration',
            allowedPatterns: this.getAllowedPatterns(type),
            strictnessLevel: this.getStrictnessLevel(type),
            maxFunctionLength: this.getMaxFunctionLength(type),
            maxComplexity: this.getMaxComplexity(type)
        };
    }

    /**
     * Detect file type from filename
     */
    detectFileType(filename) {
        const normalizedPath = filename.toLowerCase().replace(/\\/g, '/');

        // Test files
        if (normalizedPath.match(/\.(test|spec)\.(js|ts|jsx|tsx|py|java|go|rb)$/)) {
            return 'test';
        }
        if (normalizedPath.includes('__tests__/') || normalizedPath.includes('/tests/')) {
            return 'test';
        }

        // Mock files
        if (normalizedPath.includes('__mocks__/') || normalizedPath.includes('__fixtures__/')) {
            return 'mock';
        }

        // Config files
        if (normalizedPath.match(/^\.?[a-z]*rc\.(js|json|yaml|yml)$/)) {
            return 'config';
        }
        if (normalizedPath.match(/\.(config|conf)\.(js|ts|json)$/)) {
            return 'config';
        }
        if (normalizedPath.match(/^(config|configuration)\//)) {
            return 'config';
        }
        if (normalizedPath === '.env' || normalizedPath.endsWith('.env.example')) {
            return 'config';
        }

        // Migration files
        if (normalizedPath.includes('/migrations/') || normalizedPath.includes('/migrate/')) {
            return 'migration';
        }
        if (normalizedPath.match(/\d{4}_\d{2}_\d{2}_.*\.(js|sql|py)/)) {
            return 'migration';
        }

        // Script files
        if (normalizedPath.match(/^scripts?\//)) {
            return 'script';
        }
        if (normalizedPath.match(/\.(sh|bash)$/)) {
            return 'script';
        }

        // Type definition files
        if (normalizedPath.endsWith('.d.ts') || normalizedPath.includes('/types/')) {
            return 'types';
        }

        // Build/tooling files
        if (normalizedPath.match(/^(webpack|vite|rollup|babel)\./)) {
            return 'build';
        }

        // Production code (default)
        return 'production';
    }

    /**
     * Detect file purpose from content
     */
    detectFilePurpose(filename, content) {
        if (!content) return null;

        // Look for debug indicators
        if (content.includes('// DEBUG') || content.includes('// TEMPORARY')) {
            return 'debug';
        }

        // Look for experimental code
        if (content.includes('// EXPERIMENTAL') || filename.includes('experiment')) {
            return 'experimental';
        }

        return null;
    }

    /**
     * Get allowed patterns for file type
     */
    getAllowedPatterns(fileType) {
        const allowances = {
            test: [
                'console.log',
                'console.debug',
                'magic-numbers',
                'any-type',
                'mock-data',
                'hardcoded-values'
            ],
            mock: [
                'console.log',
                'magic-numbers',
                'unused-variables',
                'hardcoded-values'
            ],
            config: [
                'magic-numbers',
                'no-validation',
                'hardcoded-values'
            ],
            migration: [
                'raw-sql',
                'no-rollback',
                'magic-numbers'
            ],
            script: [
                'console.log',
                'process.exit',
                'magic-numbers'
            ],
            types: [
                'no-implementation',
                'any-type'
            ],
            build: [
                'magic-numbers',
                'require-calls'
            ]
        };

        return allowances[fileType] || [];
    }

    /**
     * Get strictness level for file type
     */
    getStrictnessLevel(fileType) {
        const strictness = {
            production: 'strict',
            test: 'lenient',
            mock: 'lenient',
            config: 'moderate',
            migration: 'moderate',
            script: 'lenient',
            types: 'strict',
            build: 'moderate'
        };

        return strictness[fileType] || 'moderate';
    }

    /**
     * Get max function length for file type
     */
    getMaxFunctionLength(fileType) {
        const maxLengths = {
            production: 50,
            test: 100,      // Test functions can be longer
            mock: 150,
            config: 200,    // Config can be verbose
            migration: 200,
            script: 100,
            types: 50,
            build: 150
        };

        return maxLengths[fileType] || 50;
    }

    /**
     * Get max complexity for file type
     */
    getMaxComplexity(fileType) {
        const maxComplexity = {
            production: 10,
            test: 15,
            mock: 20,
            config: 5,
            migration: 15,
            script: 12,
            types: 5,
            build: 15
        };

        return maxComplexity[fileType] || 10;
    }

    /**
     * Analyze PR intent from title, body, and labels
     * @param {string} prTitle - PR title
     * @param {string} prBody - PR description
     * @param {Array} labels - PR labels
     * @returns {Object} PR intent information
     */
    analyzePRIntent(prTitle, prBody = '', labels = []) {
        // Parse conventional commit format (feat:, fix:, refactor:, etc.)
        const titleMatch = prTitle.match(/^(feat|fix|refactor|perf|docs|test|chore|style|build|ci)(?:\(([^)]+)\))?:\s*(.+)/i);

        const intent = {
            type: 'general',
            scope: null,
            description: prTitle,
            expectTests: false,
            expectDocs: false,
            allowLargeDiffs: false,
            expectBenchmarks: false,
            skipCodeChecks: false,
            focusAreas: [],
            strictness: 'normal'
        };

        // Parse from conventional commit title
        if (titleMatch) {
            const [, type, scope, description] = titleMatch;
            intent.type = type.toLowerCase();
            intent.scope = scope;
            intent.description = description;

            switch (intent.type) {
                case 'feat':
                    intent.expectTests = true;
                    intent.expectDocs = true;
                    intent.focusAreas = ['functionality', 'edge-cases', 'error-handling'];
                    break;

                case 'fix':
                    intent.expectTests = true;
                    intent.focusAreas = ['correctness', 'regression', 'edge-cases'];
                    break;

                case 'refactor':
                    intent.allowLargeDiffs = true;
                    intent.focusAreas = ['behavior-preservation', 'no-logic-change', 'maintainability'];
                    break;

                case 'perf':
                    intent.expectBenchmarks = true;
                    intent.focusAreas = ['performance', 'benchmarks', 'algorithmic-complexity'];
                    break;

                case 'docs':
                    intent.skipCodeChecks = true;
                    intent.focusAreas = ['documentation-quality'];
                    break;

                case 'test':
                    intent.focusAreas = ['test-coverage', 'test-quality'];
                    break;

                case 'style':
                    intent.focusAreas = ['consistency', 'formatting'];
                    break;

                case 'chore':
                    intent.strictness = 'lenient';
                    break;
            }
        }

        // Parse labels
        for (const label of labels) {
            const labelName = typeof label === 'string' ? label : label.name;
            const normalizedLabel = labelName.toLowerCase();

            if (normalizedLabel.includes('breaking')) {
                intent.requireMigrationGuide = true;
                intent.focusAreas.push('breaking-changes');
            }

            if (normalizedLabel.includes('security')) {
                intent.focusAreas.push('security');
                intent.strictness = 'strict';
            }

            if (normalizedLabel.includes('hotfix') || normalizedLabel.includes('urgent')) {
                intent.isUrgent = true;
            }

            if (normalizedLabel.includes('wip') || normalizedLabel.includes('draft')) {
                intent.isDraft = true;
                intent.strictness = 'lenient';
            }
        }

        return intent;
    }

    /**
     * Analyze function intent from name and context
     * @param {string} functionName - Function name
     * @param {Object} context - Surrounding context
     * @returns {Object} Function intent
     */
    analyzeFunctionIntent(functionName, context = {}) {
        const intent = {
            name: functionName,
            purpose: 'general',
            expectValidation: false,
            expectErrorHandling: false,
            allowLowerStandards: false
        };

        const nameLower = functionName.toLowerCase();

        // Debug/temporary functions
        if (nameLower.startsWith('debug') || nameLower.startsWith('temp') || nameLower.startsWith('tmp')) {
            intent.purpose = 'debug';
            intent.allowLowerStandards = true;
        }

        // Experimental functions
        if (nameLower.startsWith('experiment') || nameLower.includes('test')) {
            intent.purpose = 'experimental';
            intent.allowLowerStandards = true;
        }

        // Validation functions
        if (nameLower.startsWith('validate') || nameLower.startsWith('check') || nameLower.startsWith('verify')) {
            intent.purpose = 'validation';
            intent.expectValidation = true;
            intent.expectErrorHandling = true;
        }

        // Sanitization functions
        if (nameLower.startsWith('sanitize') || nameLower.startsWith('clean') || nameLower.startsWith('escape')) {
            intent.purpose = 'sanitization';
            intent.expectValidation = true;
        }

        // Test/mock functions
        if (nameLower.startsWith('mock') || nameLower.startsWith('stub') || nameLower.startsWith('fake')) {
            intent.purpose = 'test-helper';
            intent.allowLowerStandards = true;
        }

        return intent;
    }

    /**
     * Check if a pattern is allowed based on intent
     */
    isPatternAllowed(pattern, fileIntent) {
        return fileIntent.allowedPatterns.includes(pattern);
    }

    /**
     * Get context summary for display
     */
    getContextSummary(fileIntent, prIntent) {
        const parts = [];

        if (fileIntent.type !== 'production') {
            parts.push(`${fileIntent.type} file`);
        }

        if (prIntent && prIntent.type !== 'general') {
            parts.push(`${prIntent.type} PR`);
        }

        if (fileIntent.strictnessLevel === 'lenient') {
            parts.push('lenient rules');
        } else if (fileIntent.strictnessLevel === 'strict') {
            parts.push('strict rules');
        }

        return parts.join(', ') || 'standard review';
    }
}
