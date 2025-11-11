/**
 * Text Humanization Chrome Extension - Main Script
 * Refactored for performance, maintainability, and reliability
 * 
 * Features:
 * - Local LLM integration (LM Studio)
 * - PII masking and restoration
 * - Adaptive prompt generation
 * - State persistence
 */

// ============================================================================
// CONFIGURATION MODULE
// ============================================================================

const CONFIG = {
  LM_STUDIO_URL: 'http://localhost:1234',
  MODEL: 'llama-3.2-3b-instruct',
  
  // Text length thresholds (in words)
  LENGTH_THRESHOLDS: {
    SHORT: 100,      // < 100 words
    MEDIUM: 500,     // 100-500 words
    LONG: 2000,      // 500-2000 words
    VERY_LONG: 2000  // > 2000 words
  },
  
  // Timeout settings (milliseconds)
  TIMEOUTS: {
    SHORT: 30000,
    MEDIUM: 60000,
    LONG: 90000,
    VERY_LONG: 120000
  },
  
  // LLM generation parameters
  LLM_PARAMS: {
    temperature: 0.75,
    top_p: 0.92,
    frequency_penalty: 0.6,
    presence_penalty: 0.5,
    repeat_penalty: 1.15
  },
  
  // Persistent storage keys
  STORAGE_KEYS: {
    INPUT_TEXT: 'inputText',
    PERSPECTIVE: 'perspective',
    TONE: 'tone',
    STYLE: 'style',
    MASK_PII: 'maskPII',
    MASK_BEFORE: 'maskBefore'
  }
};

// ============================================================================
// DOM ELEMENTS MODULE
// ============================================================================

const DOM = {
  elements: {},
  
  init() {
    this.elements = {
      inputText: document.getElementById('inputText'),
      outputText: document.getElementById('outputText'),
      humaniseBtn: document.getElementById('humaniseBtn'),
      copyBtn: document.getElementById('copyBtn'),
      clearBtn: document.getElementById('clearBtn'),
      status: document.getElementById('status'),
      perspectiveSelect: document.getElementById('perspectiveSelect'),
      toneSelect: document.getElementById('toneSelect'),
      styleSelect: document.getElementById('styleSelect'),
      maskPII: document.getElementById('maskPII'),
      maskBefore: document.getElementById('maskBefore'),
      inputCharCount: document.getElementById('inputCharCount'),
      outputCharCount: document.getElementById('outputCharCount'),
      optionsToggle: document.getElementById('optionsToggle'),
      options: document.getElementById('options')
    };
    
    this.validateElements();
  },
  
  validateElements() {
    const missing = Object.entries(this.elements)
      .filter(([key, el]) => !el)
      .map(([key]) => key);
    
    if (missing.length > 0) {
      console.error('Missing DOM elements:', missing);
    }
  },
  
  get(key) {
    return this.elements[key];
  }
};

// ============================================================================
// TEXT PROCESSING UTILITIES MODULE
// ============================================================================

const TextUtils = {
  /**
   * Count words in text with proper whitespace handling
   * @param {string} text - Input text
   * @returns {number} Word count
   */
  countWords(text) {
    if (!text || typeof text !== 'string') return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  },
  
  /**
   * Get text category based on word count
   * @param {string} text - Input text
   * @returns {string} Category: SHORT, MEDIUM, LONG, or VERY_LONG
   */
  getTextCategory(text) {
    const wordCount = this.countWords(text);
    const { SHORT, MEDIUM, LONG } = CONFIG.LENGTH_THRESHOLDS;
    
    if (wordCount < SHORT) return 'SHORT';
    if (wordCount < MEDIUM) return 'MEDIUM';
    if (wordCount < LONG) return 'LONG';
    return 'VERY_LONG';
  },
  
  /**
   * Get timeout duration based on text category
   * @param {string} category - Text category
   * @returns {number} Timeout in milliseconds
   */
  getTimeout(category) {
    return CONFIG.TIMEOUTS[category] || CONFIG.TIMEOUTS.VERY_LONG;
  },
  
  /**
   * Calculate adaptive max_tokens based on input length
   * @param {number} textLength - Length of input text
   * @returns {number} Max tokens for generation
   */
  calculateMaxTokens(textLength) {
    const calculated = Math.ceil(textLength * 1.3);
    return Math.min(calculated, 2500);
  },
  
  /**
   * Validate input text
   * @param {string} text - Input text
   * @returns {{valid: boolean, error: string|null}}
   */
  validateInput(text) {
    if (!text || typeof text !== 'string') {
      return { valid: false, error: 'Input must be valid text' };
    }
    
    if (text.trim().length === 0) {
      return { valid: false, error: 'Cannot process empty text' };
    }
    
    if (this.countWords(text) > 5000) {
      return { valid: false, error: 'Text too long. Max 5000 words' };
    }
    
    return { valid: true, error: null };
  }
};

// ============================================================================
// PII MASKING MODULE
// ============================================================================

class PIIMasker {
  constructor() {
    this.maskMap = new Map();
    this.counter = 0;
  }
  
  /**
   * Reset masker state
   */
  reset() {
    this.maskMap.clear();
    this.counter = 0;
  }
  
  /**
   * Mask PII in text
   * @param {string} text - Input text
   * @param {boolean} shouldMask - Whether to mask
   * @returns {string} Masked text
   */
  mask(text, shouldMask = true) {
    if (!shouldMask) return text;
    
    this.reset();
    let processed = text;
    
    // Email masking
    processed = this._maskEmails(processed);
    
    // Phone masking
    processed = this._maskPhones(processed);
    
    // Name masking
    processed = this._maskNames(processed);
    
    return processed;
  }
  
  /**
   * Unmask PII in text
   * @param {string} text - Text with masks
   * @returns {string} Unmasked text
   */
  unmask(text) {
    let unmasked = text;
    
    // Replace masks with original values
    this.maskMap.forEach((original, token) => {
      const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedToken, 'g');
      unmasked = unmasked.replace(regex, original);
    });
    
    return unmasked;
  }
  
  /**
   * Create and store mask token
   * @param {string} original - Original value
   * @param {string} prefix - Token prefix
   * @returns {string} Mask token
   */
  _createToken(original, prefix) {
    const token = `[${prefix}_${this.counter++}]`;
    this.maskMap.set(token, original);
    return token;
  }
  
  /**
   * Mask email addresses
   * @private
   */
  _maskEmails(text) {
    const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/gi;
    return text.replace(emailRegex, (match) => this._createToken(match, 'EMAIL'));
  }
  
  /**
   * Mask phone numbers (US/international)
   * @private
   */
  _maskPhones(text) {
    const phoneRegex = /(\+?1[-.\\s]?)?\(?([0-9]{3})\)?[-.\\s]?([0-9]{3})[-.\\s]?([0-9]{4})/gi;
    return text.replace(phoneRegex, (match) => this._createToken(match, 'PHONE'));
  }
  
  /**
   * Mask proper names
   * @private
   */
  _maskNames(text) {
    // Match capitalized words that look like names
    const nameRegex = /(?<=\\s|^)([A-Z][a-z]+(?:\\s[A-Z][a-z]+){1,2})(?=\\s|[,.]|$)/g;
    const skipWords = new Set(['The', 'This', 'That', 'These', 'Those', 'When', 'Where', 'What', 'Who', 'Why', 'How']);
    
    return text.replace(nameRegex, (match) => {
      const firstWord = match.split(' ')[0];
      if (skipWords.has(firstWord)) return match;
      return this._createToken(match, 'NAME');
    });
  }
}

// ============================================================================
// PROMPT BUILDER MODULE
// ============================================================================

const PromptBuilder = {
  /**
   * Build system and user prompts based on text category
   * @param {string} text - Input text
   * @param {string} perspective - Writing perspective
   * @param {string} tone - Tone preference
   * @param {string} style - Style preference
   * @param {string} category - Text category
   * @returns {{system: string, user: string}}
   */
  build(text, perspective, tone, style, category) {
    const paramDescription = this._getParamDescription(perspective, tone, style);
    
    switch (category) {
      case 'SHORT':
        return this._buildShortPrompt(text, paramDescription);
      case 'MEDIUM':
        return this._buildMediumPrompt(text, paramDescription);
      case 'LONG':
        return this._buildLongPrompt(text, paramDescription);
      case 'VERY_LONG':
        return this._buildVeryLongPrompt(text, paramDescription);
      default:
        return this._buildShortPrompt(text, paramDescription);
    }
  },
  
  /**
   * Get parameter description
   * @private
   */
  _getParamDescription(perspective, tone, style) {
    return `Parameters:
- Perspective: ${perspective === 'maintain' ? 'Keep original' : perspective.replace('-', ' ')}
- Tone: ${tone}
- Style: ${style}`;
  },
  
  /**
   * Build prompt for SHORT text
   * @private
   */
  _buildShortPrompt(text, paramDescription) {
    const systemRole = `You are a clarity expert. Improve short text while preserving core message.

Rules:
1. Maintain all facts and original meaning exactly
2. Keep similar length (within 10% of original)
3. Use natural, conversational language
4. Remove unnecessary words and jargon
5. Use active voice when possible
6. Preserve formatting (bold, lists, etc.)
7. Replace abstract language with concrete examples

Return ONLY the rewritten text with no explanations.`;

    const userPrompt = `${paramDescription}

Original text:
${text}

Rewritten version:`;

    return { system: systemRole, user: userPrompt };
  },
  
  /**
   * Build prompt for MEDIUM text
   * @private
   */
  _buildMediumPrompt(text, paramDescription) {
    const systemRole = `You are a writing improvement specialist. Enhance medium-length text for clarity and engagement.

Rules:
1. Preserve all factual content and original meaning
2. Keep length within 15% of original
3. Improve clarity and readability
4. Use varied sentence structure
5. Create natural transitions between ideas
6. Add emphasis through structure, not just adverbs
7. Maintain consistent tone throughout

Return ONLY the improved text with no explanations.`;

    const userPrompt = `${paramDescription}

Original text:
${text}

Improved version:`;

    return { system: systemRole, user: userPrompt };
  },
  
  /**
   * Build prompt for LONG text
   * @private
   */
  _buildLongPrompt(text, paramDescription) {
    const systemRole = `You are a professional editor. Refine long-form text for maximum impact.

Rules:
1. Preserve all important information and meaning
2. Maintain consistent style throughout
3. Create natural flow between sections
4. Ensure each paragraph has clear purpose
5. Remove redundancies
6. Use varied pacing to maintain reader engagement
7. Keep similar length (within 20%)

Return ONLY the refined text with no explanations.`;

    const userPrompt = `${paramDescription}

This is a lengthy passage. Maintain consistency while keeping each section natural and engaging.

Original text:
${text}

Refined version:`;

    return { system: systemRole, user: userPrompt };
  },
  
  /**
   * Build prompt for VERY_LONG text
   * @private
   */
  _buildVeryLongPrompt(text, paramDescription) {
    const systemRole = `You are a master editor. Optimize very long text for clarity, readability, and impact.

Rules:
1. Preserve all critical information
2. Maintain consistent voice throughout
3. Ensure logical flow and structure
4. Remove all redundancies
5. Break complex ideas into digestible pieces
6. Use varied pacing strategically
7. Keep length within 25%

Return ONLY the optimized text with no explanations.`;

    const userPrompt = `${paramDescription}

This is very long content. Ensure consistency, clarity, and engagement throughout all sections.

Original text:
${text}

Optimized version:`;

    return { system: systemRole, user: userPrompt };
  }
};

// ============================================================================
// POST-PROCESSING MODULE
// ============================================================================

const PostProcessor = {
  /**
   * Clean up formal phrases from output
   * @param {string} text - Generated text
   * @returns {string} Post-processed text
   */
  process(text) {
    if (!text || typeof text !== 'string') return text;
    
    let result = text;
    
    // Replace overly formal phrases
    const replacements = {
      'it is important to note that': 'note that',
      'it is important to note': 'importantly',
      'it is worth noting that': 'notably',
      'in conclusion': 'finally',
      'to summarize': 'in short',
      'furthermore': 'also',
      'moreover': 'beyond that',
      'in addition': 'plus',
      'due to the fact that': 'because',
      'in the event that': 'if'
    };
    
    Object.entries(replacements).forEach(([formal, casual]) => {
      const regex = new RegExp(`\\b${formal}\\b`, 'gi');
      result = result.replace(regex, casual);
    });
    
    // Clean up extra whitespace
    result = result.replace(/\\s+/g, ' ').trim();
    
    return result;
  }
};

// ============================================================================
// LLM API MODULE
// ============================================================================

class LLMClient {
  /**
   * Call local LLM with adaptive parameters
   * @param {string} systemPrompt - System prompt
   * @param {string} userPrompt - User prompt
   * @param {string} category - Text category (for timeout calculation)
   * @returns {Promise<string>} Generated text
   */
  async call(systemPrompt, userPrompt, category) {
    const controller = new AbortController();
    const timeoutDuration = TextUtils.getTimeout(category);
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);
    
    try {
      const textLength = userPrompt.length;
      const maxTokens = TextUtils.calculateMaxTokens(textLength);
      
      const payload = {
        model: CONFIG.MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: CONFIG.LLM_PARAMS.temperature,
        max_tokens: maxTokens,
        top_p: CONFIG.LLM_PARAMS.top_p,
        frequency_penalty: CONFIG.LLM_PARAMS.frequency_penalty,
        presence_penalty: CONFIG.LLM_PARAMS.presence_penalty,
        repeat_penalty: CONFIG.LLM_PARAMS.repeat_penalty,
        stream: false
      };
      
      const response = await fetch(`${CONFIG.LM_STUDIO_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }
      
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new Error('Empty response from LLM');
      }
      
      return content.trim();
      
    } catch (error) {
      clearTimeout(timeoutId);
      this._handleError(error);
    }
  }
  
  /**
   * Handle and translate errors
   * @private
   */
  _handleError(error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timeout. Text too long or LM Studio slow. Try shorter text.');
    }
    
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error('Cannot connect to LM Studio. Ensure it\'s running on localhost:1234.');
    }
    
    throw error;
  }
}

// ============================================================================
// STATE MANAGEMENT MODULE
// ============================================================================

class StateManager {
  /**
   * Load state from Chrome storage
   * @returns {Promise<Object>} Saved state
   */
  async load() {
    return new Promise((resolve) => {
      chrome.storage.local.get(Object.values(CONFIG.STORAGE_KEYS), (result) => {
        resolve(result || {});
      });
    });
  }
  
  /**
   * Save state to Chrome storage
   * @param {Object} state - State to save
   * @returns {Promise<void>}
   */
  async save(state) {
    return new Promise((resolve) => {
      chrome.storage.local.set(state, resolve);
    });
  }
  
  /**
   * Clear all saved state
   * @returns {Promise<void>}
   */
  async clear() {
    return new Promise((resolve) => {
      chrome.storage.local.clear(resolve);
    });
  }
  
  /**
   * Get current UI state
   * @returns {Object} Current UI state
   */
  getUIState() {
    return {
      [CONFIG.STORAGE_KEYS.INPUT_TEXT]: DOM.get('inputText').value,
      [CONFIG.STORAGE_KEYS.PERSPECTIVE]: DOM.get('perspectiveSelect').value,
      [CONFIG.STORAGE_KEYS.TONE]: DOM.get('toneSelect').value,
      [CONFIG.STORAGE_KEYS.STYLE]: DOM.get('styleSelect').value,
      [CONFIG.STORAGE_KEYS.MASK_PII]: DOM.get('maskPII').checked,
      [CONFIG.STORAGE_KEYS.MASK_BEFORE]: DOM.get('maskBefore').checked
    };
  }
}

// ============================================================================
// UI CONTROLLER MODULE
// ============================================================================

class UIController {
  constructor() {
    this.piiMasker = new PIIMasker();
    this.llmClient = new LLMClient();
    this.stateManager = new StateManager();
    this.isProcessing = false;
  }
  
  /**
   * Initialize UI and event listeners
   */
  async init() {
    DOM.init();
    await this.loadState();
    this.attachEventListeners();
  }
  
  /**
   * Load saved state
   */
  async loadState() {
    try {
      const state = await this.stateManager.load();
      
      if (state[CONFIG.STORAGE_KEYS.INPUT_TEXT]) {
        DOM.get('inputText').value = state[CONFIG.STORAGE_KEYS.INPUT_TEXT];
      }
      if (state[CONFIG.STORAGE_KEYS.PERSPECTIVE]) {
        DOM.get('perspectiveSelect').value = state[CONFIG.STORAGE_KEYS.PERSPECTIVE];
      }
      if (state[CONFIG.STORAGE_KEYS.TONE]) {
        DOM.get('toneSelect').value = state[CONFIG.STORAGE_KEYS.TONE];
      }
      if (state[CONFIG.STORAGE_KEYS.STYLE]) {
        DOM.get('styleSelect').value = state[CONFIG.STORAGE_KEYS.STYLE];
      }
      if (state[CONFIG.STORAGE_KEYS.MASK_PII] !== undefined) {
        DOM.get('maskPII').checked = state[CONFIG.STORAGE_KEYS.MASK_PII];
      }
      if (state[CONFIG.STORAGE_KEYS.MASK_BEFORE] !== undefined) {
        DOM.get('maskBefore').checked = state[CONFIG.STORAGE_KEYS.MASK_BEFORE];
      }
      
      this.updateCharCounts();
    } catch (error) {
      console.error('Error loading state:', error);
    }
  }
  
  /**
   * Attach event listeners
   */
  attachEventListeners() {
    const inputText = DOM.get('inputText');
    const outputText = DOM.get('outputText');
    const humaniseBtn = DOM.get('humaniseBtn');
    const copyBtn = DOM.get('copyBtn');
    const clearBtn = DOM.get('clearBtn');
    
    // Input events
    inputText.addEventListener('input', () => this.updateCharCounts());
    inputText.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        this.humanizeText();
      }
    });
    
    outputText.addEventListener('input', () => this.updateCharCounts());
    
    // Button events
    humaniseBtn.addEventListener('click', () => this.humanizeText());
    copyBtn.addEventListener('click', () => this.copyToClipboard());
    clearBtn.addEventListener('click', () => this.clearAll());
    
    // Options toggle
    DOM.get('optionsToggle')?.addEventListener('click', () => this.toggleOptions());
    
    // Auto-save state
    inputText.addEventListener('change', () => this.saveState());
    DOM.get('perspectiveSelect').addEventListener('change', () => this.saveState());
    DOM.get('toneSelect').addEventListener('change', () => this.saveState());
    DOM.get('styleSelect').addEventListener('change', () => this.saveState());
    DOM.get('maskPII').addEventListener('change', () => this.saveState());
    DOM.get('maskBefore').addEventListener('change', () => this.saveState());
  }
  
  /**
   * Update character and word counts
   */
  updateCharCounts() {
    const inputText = DOM.get('inputText').value;
    const outputText = DOM.get('outputText').value;
    
    const inputWords = TextUtils.countWords(inputText);
    const inputChars = inputText.length;
    const outputWords = TextUtils.countWords(outputText);
    const outputChars = outputText.length;
    
    DOM.get('inputCharCount').textContent = `${inputWords} words • ${inputChars} chars`;
    DOM.get('outputCharCount').textContent = `${outputWords} words • ${outputChars} chars`;
  }
  
  /**
   * Show status message
   */
  showStatus(message, type = 'info') {
    const statusEl = DOM.get('status');
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    statusEl.style.display = 'block';
    
    if (type === 'success') {
      setTimeout(() => { statusEl.style.display = 'none'; }, 3000);
    }
  }
  
  /**
   * Update UI processing state
   */
  updateUIProcessing(processing = true) {
    const humaniseBtn = DOM.get('humaniseBtn');
    humaniseBtn.disabled = processing;
    humaniseBtn.textContent = processing ? 'Processing...' : 'Humanize Text (Ctrl+Enter)';
    
    if (processing) {
      DOM.get('outputText').value = '';
    }
    
    this.isProcessing = processing;
  }
  
  /**
   * Main humanize text function
   */
  async humanizeText() {
    if (this.isProcessing) return;
    
    const inputText = DOM.get('inputText').value;
    
    // Validate input
    const validation = TextUtils.validateInput(inputText);
    if (!validation.valid) {
      this.showStatus(validation.error, 'error');
      return;
    }
    
    this.updateUIProcessing(true);
    this.showStatus('Processing your text...', 'info');
    
    try {
      const perspective = DOM.get('perspectiveSelect').value;
      const tone = DOM.get('toneSelect').value;
      const style = DOM.get('styleSelect').value;
      const maskBefore = DOM.get('maskBefore').checked;
      const maskAfter = DOM.get('maskPII').checked;
      
      // Determine text category
      const category = TextUtils.getTextCategory(inputText);
      
      // Step 1: Mask PII if needed
      let textToProcess = inputText;
      if (maskBefore) {
        textToProcess = this.piiMasker.mask(inputText, true);
      }
      
      // Step 2: Build prompt
      const { system, user } = PromptBuilder.build(textToProcess, perspective, tone, style, category);
      
      // Step 3: Call LLM
      let result = await this.llmClient.call(system, user, category);
      
      // Step 4: Post-process
      result = PostProcessor.process(result);
      
      // Step 5: Unmask PII if it was masked
      if (maskBefore && maskAfter) {
        result = this.piiMasker.unmask(result);
      }
      
      // Display result
      DOM.get('outputText').value = result;
      this.updateCharCounts();
      this.showStatus('Text humanized successfully!', 'success');
      
    } catch (error) {
      console.error('Humanization error:', error);
      this.showStatus(`Error: ${error.message}`, 'error');
    } finally {
      this.updateUIProcessing(false);
    }
  }
  
  /**
   * Copy output to clipboard
   */
  async copyToClipboard() {
    const outputText = DOM.get('outputText').value;
    
    if (!outputText) {
      this.showStatus('Nothing to copy', 'error');
      return;
    }
    
    try {
      await navigator.clipboard.writeText(outputText);
      this.showStatus('Copied to clipboard!', 'success');
    } catch (error) {
      console.error('Copy error:', error);
      this.showStatus('Failed to copy', 'error');
    }
  }
  
  /**
   * Clear all text
   */
  clearAll() {
    if (confirm('Clear all text and settings?')) {
      DOM.get('inputText').value = '';
      DOM.get('outputText').value = '';
      this.updateCharCounts();
      this.piiMasker.reset();
      this.showStatus('Cleared', 'success');
    }
  }
  
  /**
   * Toggle options panel
   */
  toggleOptions() {
    const options = DOM.get('options');
    const isHidden = options.style.display === 'none';
    options.style.display = isHidden ? 'block' : 'none';
  }
  
  /**
   * Save current state
   */
  async saveState() {
    try {
      const state = this.stateManager.getUIState();
      await this.stateManager.save(state);
    } catch (error) {
      console.error('Error saving state:', error);
    }
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

let uiController;

document.addEventListener('DOMContentLoaded', async () => {
  uiController = new UIController();
  await uiController.init();
});
