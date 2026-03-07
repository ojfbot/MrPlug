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

  /**
   * Walk up from element looking for data-mf-remote attribute.
   * Shell mount points should carry e.g. <div data-mf-remote="cv-builder" />.
   */
  private static detectMFRemoteName(element: Element): string | undefined {
    let node: Element | null = element;
    while (node && node !== document.body) {
      const remote = node.getAttribute('data-mf-remote');
      if (remote) return remote;
      node = node.parentElement;
    }
    return undefined;
  }

  /**
   * Scan <script src> tags for remoteEntry.js to detect which MF remote
   * origins are loaded on the page.  Returns unique origins, e.g. ["http://localhost:3000"].
   */
  private static detectMFRemoteOrigins(): string[] {
    const origins = new Set<string>();
    document.querySelectorAll('script[src]').forEach((script) => {
      const src = (script as HTMLScriptElement).src;
      if (src && src.includes('remoteEntry')) {
        try {
          const { origin } = new URL(src);
          // Only include if the origin differs from the current page (i.e. it's a remote)
          if (origin !== window.location.origin) {
            origins.add(origin);
          }
        } catch {
          // Ignore unparseable URLs
        }
      }
    });
    return Array.from(origins);
  }

  static async captureElement(element: Element): Promise<ElementContext> {
    const rect = element.getBoundingClientRect();
    const parent = element.parentElement;

    const mfRemoteName = this.detectMFRemoteName(element);
    const mfRemoteOrigins = this.detectMFRemoteOrigins();

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
      mfRemoteName: mfRemoteName,
      mfRemoteOrigins: mfRemoteOrigins.length > 0 ? mfRemoteOrigins : undefined,
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
