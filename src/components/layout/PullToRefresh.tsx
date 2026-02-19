import React, { useRef, useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const THRESHOLD = 80;   // px to pull before triggering
const MAX_PULL  = 120;  // px cap on visual stretch

interface Props {
  children: React.ReactNode;
  onRefresh?: () => void;
}

export function PullToRefresh({ children, onRefresh }: Props) {
  const containerRef   = useRef<HTMLDivElement>(null);
  const startYRef      = useRef(0);
  const [pullDist, setPullDist] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const trigger = useCallback(async () => {
    setRefreshing(true);
    setPullDist(0);
    if (onRefresh) {
      onRefresh();
    } else {
      // Default: hard reload — cleanest way to reset all Supabase subs + state
      window.location.reload();
    }
  }, [onRefresh]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const el = containerRef.current;
    if (!el) return;
    // Only start tracking if we're at the very top
    if (el.scrollTop === 0) {
      startYRef.current = e.touches[0].clientY;
    } else {
      startYRef.current = 0;
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!startYRef.current || refreshing) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta <= 0) { setPullDist(0); return; }
    // Resist the pull (rubber-band feel)
    const dist = Math.min(delta * 0.5, MAX_PULL);
    setPullDist(dist);
    // Prevent native scroll bounce competing with our gesture
    if (dist > 4) e.preventDefault();
  }, [refreshing]);

  const onTouchEnd = useCallback(() => {
    if (!startYRef.current) return;
    if (pullDist >= THRESHOLD) {
      trigger();
    } else {
      setPullDist(0);
    }
    startYRef.current = 0;
  }, [pullDist, trigger]);

  const progress = Math.min(pullDist / THRESHOLD, 1);
  const ready    = pullDist >= THRESHOLD;

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto relative"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ overscrollBehavior: 'none' }}
    >
      {/* Pull indicator */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none z-50 transition-all duration-150"
        style={{ height: pullDist > 0 || refreshing ? (refreshing ? 48 : pullDist) : 0, overflow: 'hidden' }}
      >
        <div
          className={cn(
            'flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest transition-all duration-150',
            ready || refreshing ? 'text-primary' : 'text-muted-foreground'
          )}
          style={{ opacity: Math.max(progress * 1.5 - 0.2, 0) }}
        >
          <RefreshCw
            className={cn('h-4 w-4', refreshing && 'animate-spin')}
            style={{ transform: `rotate(${progress * 300}deg)`, transition: refreshing ? undefined : 'transform 0.05s' }}
          />
          {refreshing ? 'Refreshing...' : ready ? 'Release' : 'Pull to refresh'}
        </div>
      </div>

      {/* Page content — shift down while pulling */}
      <div
        style={{
          transform: pullDist > 0 ? `translateY(${pullDist}px)` : undefined,
          transition: pullDist === 0 && !refreshing ? 'transform 0.25s ease' : undefined,
        }}
        className="p-3 sm:p-4 md:p-6 scanline pb-20 sm:pb-6"
      >
        {children}
      </div>
    </div>
  );
}
