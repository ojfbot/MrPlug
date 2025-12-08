import { describe, it, expect, beforeEach } from 'vitest';
import { ElementCapture } from '../element-capture';

describe('ElementCapture', () => {
  let testElement: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="test-container" class="container main">
        <button id="test-button" class="btn primary">Click me</button>
      </div>
    `;
    testElement = document.getElementById('test-button')!;
  });

  describe('User Behavior: Capturing element context', () => {
    it('should capture element details when user selects an element', async () => {
      // User action: selects a button element
      const context = await ElementCapture.captureElement(testElement);

      // Expected result: element details are captured
      expect(context.tagName).toBe('button');
      expect(context.id).toBe('test-button');
      expect(context.classList).toContain('btn');
      expect(context.classList).toContain('primary');
    });

    it('should capture DOM path for precise element identification', async () => {
      // User action: selects an element
      const context = await ElementCapture.captureElement(testElement);

      // Expected result: DOM path is captured
      expect(context.domPath).toContain('button#test-button');
      expect(context.domPath).toBeTruthy();
    });

    it('should capture parent context for understanding element hierarchy', async () => {
      // User action: selects an element with parent
      const context = await ElementCapture.captureElement(testElement);

      // Expected result: parent context is included
      expect(context.parentContext).toBeDefined();
      expect(context.parentContext?.tagName).toBe('div');
      expect(context.parentContext?.id).toBe('test-container');
    });

    it('should capture bounding rectangle for visual context', async () => {
      // User action: selects an element
      const context = await ElementCapture.captureElement(testElement);

      // Expected result: bounding rect is captured
      expect(context.boundingRect).toBeDefined();
      expect(context.boundingRect.width).toBeGreaterThanOrEqual(0);
      expect(context.boundingRect.height).toBeGreaterThanOrEqual(0);
    });

    it('should capture computed styles for styling analysis', async () => {
      // User action: selects an element
      const context = await ElementCapture.captureElement(testElement);

      // Expected result: relevant styles are captured
      expect(context.computedStyles).toBeDefined();
      expect(typeof context.computedStyles.display).toBe('string');
    });
  });

  describe('User Behavior: Handling different element types', () => {
    it('should capture elements without ID or classes', async () => {
      document.body.innerHTML = '<span>Plain text</span>';
      const span = document.querySelector('span')!;

      // User action: selects a plain element
      const context = await ElementCapture.captureElement(span);

      // Expected result: element is captured without ID/classes
      expect(context.tagName).toBe('span');
      expect(context.id).toBeUndefined();
      expect(context.classList).toHaveLength(0);
      expect(context.textContent).toBe('Plain text');
    });

    it('should truncate long text content', async () => {
      const longText = 'a'.repeat(300);
      document.body.innerHTML = `<p>${longText}</p>`;
      const p = document.querySelector('p')!;

      // User action: selects an element with long text
      const context = await ElementCapture.captureElement(p);

      // Expected result: text is truncated to 200 characters
      expect(context.textContent?.length).toBeLessThanOrEqual(200);
    });
  });
});
