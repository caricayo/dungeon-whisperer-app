import { memo, useMemo, useState, useEffect, useRef } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

// Memoized component wrapper for expensive renders
export const MemoizedComponent = memo(function MemoizedComponent({ 
  children, 
  dependencies = [] 
}: { 
  children: React.ReactNode; 
  dependencies?: unknown[];
}) {
  return useMemo(() => <>{children}</>, [children, ...(dependencies || [])]);
});

// Virtual list implementation for large datasets
export function VirtualizedList({ 
  items, 
  renderItem, 
  itemHeight = 64,
  containerHeight = 400 
}: {
  items: unknown[];
  renderItem: (item: unknown, index: number) => React.ReactNode;
  itemHeight?: number;
  containerHeight?: number;
}) {
  const visibleItems = useMemo(() => {
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    return items.slice(0, visibleCount + 5); // Render a few extra for smooth scrolling
  }, [items, itemHeight, containerHeight]);

  return (
    <div 
      style={{ 
        height: containerHeight, 
        overflowY: 'auto',
        position: 'relative'
      }}
    >
      <div style={{ height: items.length * itemHeight }}>
        {visibleItems.map((item, _index) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              top: index * itemHeight,
              left: 0,
              right: 0,
              height: itemHeight,
            }}
          >
            <ErrorBoundary>
              {renderItem(item, _index)}
            </ErrorBoundary>
          </div>
        ))}
      </div>
    </div>
  );
}

// Lazy loading wrapper
export function LazyLoader({ 
  children, 
  threshold = 0.1 
}: { 
  children: React.ReactNode;
  threshold?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => observer.disconnect();
  }, [threshold]);

  return (
    <div ref={elementRef}>
      {isVisible ? children : <div style={{ minHeight: '100px' }}>Loading...</div>}
    </div>
  );
}