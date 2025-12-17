import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Parse custom instruction file and extract review rules
 */
export class InstructionsParser {
  constructor() {
    this.instructions = null;
  }

  /**
   * Load and parse instructions from a file
   * @param {string} filePath - Path to instructions file
   * @returns {Promise<Object>} Parsed instructions
   */
  async loadInstructions(filePath) {
    try {
      const resolvedPath = path.isAbsolute(filePath) 
        ? filePath 
        : path.resolve(process.cwd(), filePath);
      
      const content = await fs.readFile(resolvedPath, 'utf-8');
      this.instructions = this.parseMarkdown(content);
      return this.instructions;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File not found, load default instructions
        return this.loadDefaultInstructions();
      }
      throw new Error(`Failed to load instructions: ${error.message}`);
    }
  }

  /**
   * Load default instructions
   * @returns {Promise<Object>} Default instructions
   */
  async loadDefaultInstructions() {
    const defaultPath = path.join(__dirname, 'default-instructions.md');
    const content = await fs.readFile(defaultPath, 'utf-8');
    this.instructions = this.parseMarkdown(content);
    return this.instructions;
  }

  /**
   * Parse markdown content into structured instructions
   * @param {string} content - Markdown content
   * @returns {Object} Structured instructions
   */
  parseMarkdown(content) {
    const instructions = {
      categories: {},
      languageSpecific: {},
      global: [],
      tone: ''
    };

    const lines = content.split('\n');
    let currentCategory = null;
    let currentLanguage = null;
    let isInCodeBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines
      if (!line) continue;

      // Track code blocks to skip them
      if (line.startsWith('```')) {
        isInCodeBlock = !isInCodeBlock;
        continue;
      }

      if (isInCodeBlock) continue;

      // Main category headers (## Security, ## Performance, etc.)
      if (line.startsWith('## ')) {
        const category = line.substring(3).trim();
        currentCategory = category.toLowerCase();
        currentLanguage = null;
        
        if (!instructions.categories[currentCategory]) {
          instructions.categories[currentCategory] = [];
        }
        continue;
      }

      // Language-specific subsections (### JavaScript/TypeScript)
      if (line.startsWith('### ')) {
        const language = line.substring(4).trim().toLowerCase();
        currentLanguage = language;
        
        if (!instructions.languageSpecific[currentLanguage]) {
          instructions.languageSpecific[currentLanguage] = [];
        }
        continue;
      }

      // Extract rules from list items
      if (line.startsWith('- ')) {
        const rule = this.parseRule(line.substring(2));
        
        if (currentLanguage && instructions.languageSpecific[currentLanguage]) {
          instructions.languageSpecific[currentLanguage].push(rule);
        } else if (currentCategory && instructions.categories[currentCategory]) {
          instructions.categories[currentCategory].push(rule);
        } else {
          instructions.global.push(rule);
        }
      }

      // Extract tone guidance
      if (currentCategory === 'review tone' && !line.startsWith('#') && !line.startsWith('-')) {
        instructions.tone += line + ' ';
      }
    }

    instructions.tone = instructions.tone.trim();
    return instructions;
  }

  /**
   * Parse individual rule from markdown list item
   * @param {string} ruleText - Rule text
   * @returns {Object} Rule object
   */
  parseRule(ruleText) {
    // Remove checkbox if present
    const cleanText = ruleText.replace(/^\[[ x]\]\s*/, '');
    
    // Determine if it's a pattern to detect or a guideline
    const isPattern = this.isPatternRule(cleanText);
    
    return {
      text: cleanText,
      isPattern,
      severity: this.determineSeverity(cleanText)
    };
  }

  /**
   * Determine if rule is a pattern to detect
   * @param {string} text - Rule text
   * @returns {boolean}
   */
  isPatternRule(text) {
    const patternKeywords = [
      'check for',
      'ensure',
      'verify',
      'look for',
      'flag',
      'must',
      'should not',
      'avoid'
    ];

    const lowerText = text.toLowerCase();
    return patternKeywords.some(keyword => lowerText.includes(keyword));
  }

  /**
   * Determine severity level based on keywords
   * @param {string} text - Rule text
   * @returns {string} Severity level
   */
  determineSeverity(text) {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('security') || 
        lowerText.includes('vulnerability') ||
        lowerText.includes('must')) {
      return 'critical';
    }
    
    if (lowerText.includes('should') || 
        lowerText.includes('ensure') ||
        lowerText.includes('verify')) {
      return 'warning';
    }
    
    return 'info';
  }

  /**
   * Get instructions for a specific language
   * @param {string} language - Programming language
   * @returns {Array} Language-specific instructions
   */
  getLanguageInstructions(language) {
    if (!this.instructions) {
      return [];
    }

    const languageLower = language.toLowerCase();
    return this.instructions.languageSpecific[languageLower] || [];
  }

  /**
   * Get instructions for a specific category
   * @param {string} category - Category name
   * @returns {Array} Category instructions
   */
  getCategoryInstructions(category) {
    if (!this.instructions) {
      return [];
    }

    const categoryLower = category.toLowerCase();
    return this.instructions.categories[categoryLower] || [];
  }

  /**
   * Get all instructions
   * @returns {Object} All instructions
   */
  getAllInstructions() {
    return this.instructions || {};
  }
}

export default InstructionsParser;
