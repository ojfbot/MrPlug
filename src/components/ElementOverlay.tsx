import { useEffect, useState } from 'react';

interface ElementOverlayProps {
  element: Element | null;
  visible: boolean;
}

export function ElementOverlay({ element, visible }: ElementOverlayProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (element && visible) {
      const updateRect = () => {
        setRect(element.getBoundingClientRect());
      };

      updateRect();

      const observer = new ResizeObserver(updateRect);
      observer.observe(element);

      window.addEventListener('scroll', updateRect, true);
      window.addEventListener('resize', updateRect);

      return () => {
        observer.disconnect();
        window.removeEventListener('scroll', updateRect, true);
        window.removeEventListener('resize', updateRect);
      };
    } else {
      setRect(null);
    }
  }, [element, visible]);

  if (!rect || !visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        border: '2px solid #0f62fe',
        backgroundColor: 'rgba(15, 98, 254, 0.1)',
        pointerEvents: 'none',
        zIndex: 999999,
        transition: 'all 0.1s ease',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '-24px',
          left: '0',
          backgroundColor: '#0f62fe',
          color: 'white',
          padding: '2px 8px',
          fontSize: '12px',
          fontFamily: 'monospace',
          borderRadius: '2px',
          whiteSpace: 'nowrap',
        }}
      >
        {element?.tagName.toLowerCase()}
        {element?.id ? `#${element.id}` : ''}
        {element?.className ? `.${Array.from(element.classList).join('.')}` : ''}
      </div>
    </div>
  );
}
