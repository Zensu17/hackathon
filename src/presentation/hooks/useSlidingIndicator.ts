import type React from 'react';
import { useLayoutEffect, useRef, useState } from 'react';

interface IndicatorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Measure an active item inside a container and return GPU transform styles
 * for a pure-CSS sliding indicator pill with zero external animation dependencies.
 */
export function useSlidingIndicator<T extends HTMLElement = HTMLElement>(
  containerRef: React.RefObject<T | null>,
  activeSelector: string,
  deps: ReadonlyArray<unknown>,
): { indicatorStyle: React.CSSProperties; visible: boolean } {
  const [rect, setRect] = useState<IndicatorRect | null>(null);
  const canAnimateRef = useRef<boolean>(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      setRect(null);
      return;
    }

    const measure = (): void => {
      const target = container.querySelector<HTMLElement>(activeSelector);
      if (!target) {
        setRect(null);
        return;
      }

      let x: number;
      let y: number;
      if (target.offsetParent === container) {
        x = target.offsetLeft;
        y = target.offsetTop;
      } else {
        const containerBox = container.getBoundingClientRect();
        const targetBox = target.getBoundingClientRect();
        x = targetBox.left - containerBox.left + container.scrollLeft;
        y = targetBox.top - containerBox.top + container.scrollTop;
      }

      const next: IndicatorRect = {
        x,
        y,
        width: target.offsetWidth,
        height: target.offsetHeight,
      };

      setRect((prev) => {
        if (
          prev &&
          prev.x === next.x &&
          prev.y === next.y &&
          prev.width === next.width &&
          prev.height === next.height
        ) {
          return prev;
        }
        return next;
      });
    };

    measure();

    const rafId = window.requestAnimationFrame(() => {
      canAnimateRef.current = true;
    });

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => measure())
        : null;
    resizeObserver?.observe(container);
    const activeTarget = container.querySelector<HTMLElement>(activeSelector);
    if (activeTarget) {
      resizeObserver?.observe(activeTarget);
    }

    return () => {
      window.cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSelector, containerRef, ...deps]);

  if (!rect || rect.width === 0 || rect.height === 0) {
    return {
      visible: false,
      indicatorStyle: { opacity: 0 },
    };
  }

  return {
    visible: true,
    indicatorStyle: {
      opacity: 1,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      transform: `translate3d(${rect.x}px, ${rect.y}px, 0)`,
      transition: canAnimateRef.current
        ? 'transform 240ms var(--ease-out), width 240ms var(--ease-out), height 240ms var(--ease-out), opacity 160ms var(--ease-out)'
        : 'none',
    },
  };
}
