/**
 * Element hash generation for stable element identification across sessions
 */

export class ElementHash {
  /**
   * Generate hash from element properties
   * Uses: tagName + id + classList + domPath (+ optional position)
   */
  static generate(element: Element, includePosition: boolean = false): string {
    const parts: string[] = [];

    // Tag name (normalized)
    parts.push(element.tagName.toLowerCase());

    // ID (if exists)
    if (element.id) {
      parts.push(`#${element.id}`);
    }

    // Classes (sorted for stability)
    const classes = Array.from(element.classList).sort();
    if (classes.length > 0) {
      parts.push(`.${classes.join('.')}`);
    }

    // DOM path (simplified selector)
    const domPath = this.getSimplifiedDOMPath(element);
    parts.push(domPath);

    // Position (optional - for dynamic content)
    if (includePosition) {
      const rect = element.getBoundingClientRect();
      parts.push(`@${Math.round(rect.top)},${Math.round(rect.left)}`);
    }

    // Combine and hash
    const combined = parts.join('|');
    return this.simpleHash(combined);
  }

  /**
   * Generate simplified DOM path (up to 3 levels or until ID)
   */
  private static getSimplifiedDOMPath(element: Element): string {
    const path: string[] = [];
    let current: Element | null = element;
    let depth = 0;
    const maxDepth = 3;

    while (current && current !== document.body && depth < maxDepth) {
      let selector = current.tagName.toLowerCase();

      // Stop at ID - it's unique enough
      if (current.id) {
        selector += `#${current.id}`;
        path.unshift(selector);
        break;
      }

      // Add first class if exists
      if (current.classList.length > 0) {
        selector += `.${current.classList[0]}`;
      }

      path.unshift(selector);
      current = current.parentElement;
      depth++;
    }

    return path.join('>');
  }

  /**
   * Simple hash function (non-cryptographic)
   * Uses FNV-1a algorithm for speed and low collision
   */
  private static simpleHash(str: string): string {
    let hash = 2166136261; // FNV offset basis

    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash *= 16777619; // FNV prime
    }

    // Convert to hex string
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  /**
   * Generate session title from element
   * Format: "elementType: content" or "elementType#id" or "elementType.class"
   */
  static generateTitle(element: Element, maxLength: number = 50): string {
    const tagName = element.tagName.toLowerCase();

    // Try text content first
    const text = element.textContent?.trim();
    if (text && text.length > 0) {
      // Calculate available length for content (minus tag prefix)
      const prefixLength = tagName.length + 2; // "tag: "
      const contentMaxLength = maxLength - prefixLength;

      const truncatedText = text.length > contentMaxLength
        ? `${text.substring(0, contentMaxLength)}...`
        : text;

      return `${tagName}: ${truncatedText}`;
    }

    // Fallback to selector with ID or class
    if (element.id) {
      return `${tagName}#${element.id}`;
    } else if (element.classList.length > 0) {
      return `${tagName}.${element.classList[0]}`;
    }

    // Just the tag name
    return tagName;
  }

  /**
   * Compare two elements to see if they should share a session
   */
  static areElementsEquivalent(elem1: Element, elem2: Element): boolean {
    return this.generate(elem1, false) === this.generate(elem2, false);
  }
}
