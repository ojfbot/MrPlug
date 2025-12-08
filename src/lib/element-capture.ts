import type { ElementContext } from '../types';

export class ElementCapture {
  private static getDOMPath(element: Element): string {
    const path: string[] = [];
    let current: Element | null = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector += `#${current.id}`;
        path.unshift(selector);
        break;
      }

      if (current.className) {
        const classes = Array.from(current.classList).join('.');
        if (classes) {
          selector += `.${classes}`;
        }
      }

      const parent: Element | null = current.parentElement;
      if (parent && current) {
        const siblings = Array.from(parent.children).filter(
          (sibling) => sibling.tagName === current!.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }

      path.unshift(selector);
      current = parent;
    }

    return path.join(' > ');
  }

  private static getRelevantStyles(element: Element): Record<string, string> {
    const computed = window.getComputedStyle(element);
    const relevantProps = [
      'display',
      'position',
      'width',
      'height',
      'margin',
      'padding',
      'border',
      'color',
      'backgroundColor',
      'fontSize',
      'fontFamily',
      'lineHeight',
      'textAlign',
      'flexDirection',
      'justifyContent',
      'alignItems',
      'gridTemplateColumns',
      'gridTemplateRows',
      'gap',
      'zIndex',
      'opacity',
      'transform',
    ];

    const styles: Record<string, string> = {};
    relevantProps.forEach((prop) => {
      const value = computed.getPropertyValue(prop);
      if (value) {
        styles[prop] = value;
      }
    });

    return styles;
  }

  static async captureElement(element: Element): Promise<ElementContext> {
    const rect = element.getBoundingClientRect();
    const parent = element.parentElement;

    const context: ElementContext = {
      tagName: element.tagName.toLowerCase(),
      id: element.id || undefined,
      classList: Array.from(element.classList),
      textContent: element.textContent?.slice(0, 200) || undefined,
      computedStyles: this.getRelevantStyles(element),
      boundingRect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      },
      domPath: this.getDOMPath(element),
    };

    if (parent) {
      const parentRect = parent.getBoundingClientRect();
      context.parentContext = {
        tagName: parent.tagName.toLowerCase(),
        id: parent.id || undefined,
        classList: Array.from(parent.classList),
        boundingRect: {
          top: parentRect.top,
          left: parentRect.left,
          width: parentRect.width,
          height: parentRect.height,
        },
      };
    }

    return context;
  }

  static async captureScreenshot(element: Element): Promise<string> {
    const rect = element.getBoundingClientRect();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    const padding = 20;
    canvas.width = rect.width + padding * 2;
    canvas.height = rect.height + padding * 2;

    return new Promise((resolve, reject) => {
      try {
        // Note: This is a simplified version. In production, you'd use
        // chrome.tabs.captureVisibleTab or a similar API
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.strokeRect(padding, padding, rect.width, rect.height);

        resolve(canvas.toDataURL('image/png'));
      } catch (error) {
        reject(error);
      }
    });
  }
}
