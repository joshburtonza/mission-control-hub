import { useRef, useState, useCallback } from 'react';

interface UseSwipeOptions {
  threshold?: number;
  lockAxis?: 'horizontal' | 'vertical';
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  disabled?: boolean;
}

export function useSwipe({
  threshold = 72,
  lockAxis,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  disabled = false,
}: UseSwipeOptions = {}) {
  const startRef     = useRef<{ x: number; y: number } | null>(null);
  const axisRef      = useRef<'horizontal' | 'vertical' | null>(null);
  const [delta, setDelta]     = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    startRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    axisRef.current  = null;
    setDragging(true);
    setDelta({ x: 0, y: 0 });
  }, [disabled]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (disabled || !startRef.current) return;
    const dx = e.touches[0].clientX - startRef.current.x;
    const dy = e.touches[0].clientY - startRef.current.y;

    // Determine axis on first significant movement
    if (!axisRef.current && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      axisRef.current = lockAxis ?? (Math.abs(dx) >= Math.abs(dy) ? 'horizontal' : 'vertical');
    }

    const axis = axisRef.current;
    if (axis === 'horizontal') {
      e.preventDefault(); // stop page scroll while swiping sideways
      setDelta({ x: dx, y: 0 });
    } else if (axis === 'vertical') {
      setDelta({ x: 0, y: dy });
    }
  }, [disabled, lockAxis]);

  const onTouchEnd = useCallback(() => {
    if (!startRef.current) return;
    const { x, y } = delta;

    if (axisRef.current === 'horizontal') {
      if (x >= threshold)       onSwipeRight?.();
      else if (x <= -threshold) onSwipeLeft?.();
    } else if (axisRef.current === 'vertical') {
      if (y >= threshold)       onSwipeDown?.();
      else if (y <= -threshold) onSwipeUp?.();
    }

    startRef.current = null;
    axisRef.current  = null;
    setDelta({ x: 0, y: 0 });
    setDragging(false);
  }, [delta, threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  return {
    delta,
    dragging,
    handlers: { onTouchStart, onTouchMove, onTouchEnd } as const,
  };
}
