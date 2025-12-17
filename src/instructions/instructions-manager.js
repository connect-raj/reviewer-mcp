import fs from 'fs/promises';
import path from 'path';
import InstructionsParser from './instructions-parser.js';

/**
 * Manages instruction files and provides caching
 */
export class InstructionsManager {
  constructor() {
    this.cache = new Map();
    this.defaultParser = null;
  }

  /**
   * Load instructions from file with caching
   * @param {string} filePath - Path to instructions file (optional)
   * @returns {Promise<Object>} Parsed instructions
   */
  async loadInstructions(filePath = null) {
    // Use cached if available
    if (filePath && this.cache.has(filePath)) {
      return this.cache.get(filePath);
    }

    const parser = new InstructionsParser();
    
    if (filePath) {
      // Load custom instructions
      const instructions = await parser.loadInstructions(filePath);
      this.cache.set(filePath, instructions);
      return instructions;
    } else {
      // Load default instructions (cached)
      if (!this.defaultParser) {
        this.defaultParser = parser;
        await parser.loadDefaultInstructions();
      }
      return this.defaultParser.getAllInstructions();
    }
  }

  /**
   * Find instruction files in project directory
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<string|null>} Path to instruction file or null
   */
  async findInstructionFile(projectRoot) {
    const possibleNames = [
      '.reviewrc.md',
      'review-instructions.md',
      '.mcp/instructions.md',
      '.github/review-instructions.md'
    ];

    for (const name of possibleNames) {
      const filePath = path.join(projectRoot, name);
      try {
        await fs.access(filePath);
        return filePath;
      } catch {
        // File doesn't exist, try next
        continue;
      }
    }

    return null;
  }

  /**
   * Get relevant instructions based on file context
   * @param {Object} instructions - All instructions
   * @param {string} language - Programming language
   * @param {Array<string>} categories - Categories to include
   * @returns {Object} Relevant instructions
   */
  getRelevantInstructions(instructions, language, categories = null) {
    const relevant = {
      general: [],
      languageSpecific: [],
      tone: instructions.tone || ''
    };

    // Get category-specific instructions
    if (categories && categories.length > 0) {
      for (const category of categories) {
        const categoryInstructions = instructions.categories[category.toLowerCase()] || [];
        relevant.general.push(...categoryInstructions);
      }
    } else {
      // Get all category instructions
      for (const categoryInstructions of Object.values(instructions.categories)) {
        relevant.general.push(...categoryInstructions);
      }
    }

    // Get language-specific instructions
    if (language) {
      const languageLower = language.toLowerCase();
      relevant.languageSpecific = instructions.languageSpecific[languageLower] || [];
      
      // Also check for common language groups
      if (languageLower === 'javascript' || languageLower === 'typescript') {
        const jsInstructions = instructions.languageSpecific['javascript/typescript'] || [];
        relevant.languageSpecific.push(...jsInstructions);
      }
    }

    return relevant;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    this.defaultParser = null;
  }

  /**
   * Merge multiple instruction sets (for global + project-specific)
   * @param {Array<Object>} instructionSets - Array of instruction objects
   * @returns {Object} Merged instructions
   */
  mergeInstructions(...instructionSets) {
    const merged = {
      categories: {},
      languageSpecific: {},
      global: [],
      tone: ''
    };

    for (const instructions of instructionSets) {
      // Merge categories
      for (const [category, rules] of Object.entries(instructions.categories || {})) {
        if (!merged.categories[category]) {
          merged.categories[category] = [];
        }
        merged.categories[category].push(...rules);
      }

      // Merge language-specific
      for (const [language, rules] of Object.entries(instructions.languageSpecific || {})) {
        if (!merged.languageSpecific[language]) {
          merged.languageSpecific[language] = [];
        }
        merged.languageSpecific[language].push(...rules);
      }

      // Merge global rules
      if (instructions.global) {
        merged.global.push(...instructions.global);
      }

      // Use last non-empty tone
      if (instructions.tone) {
        merged.tone = instructions.tone;
      }
    }

    return merged;
  }
}

export default InstructionsManager;
