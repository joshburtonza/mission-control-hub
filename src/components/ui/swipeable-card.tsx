import React from 'react';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { useSwipe } from '@/hooks/use-swipe';

const THRESHOLD = 80; // px to commit action

interface SwipeableCardProps {
  children: React.ReactNode;
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  rightLabel?: string;
  leftLabel?: string;
  rightColor?: string;
  leftColor?: string;
  disabled?: boolean;
}

export function SwipeableCard({
  children,
  onSwipeRight,
  onSwipeLeft,
  rightLabel = 'Approve',
  leftLabel  = 'Reject',
  rightColor = '#22c55e',
  leftColor  = '#ef4444',
  disabled   = false,
}: SwipeableCardProps) {
  const { delta, dragging, handlers } = useSwipe({
    threshold: THRESHOLD,
    lockAxis: 'horizontal',
    onSwipeLeft,
    onSwipeRight,
    disabled,
  });

  // Cap visual travel at 130px, ease with rubber-band resist past threshold
  const raw = delta.x;
  const sign = raw >= 0 ? 1 : -1;
  const abs  = Math.abs(raw);
  const x    = sign * Math.min(abs > THRESHOLD ? THRESHOLD + (abs - THRESHOLD) * 0.25 : abs, 130);

  const progress     = Math.min(Math.abs(x) / THRESHOLD, 1);
  const isCommitting = Math.abs(x) >= THRESHOLD;

  const goingRight = x > 0;
  const goingLeft  = x < 0;
  const moving     = Math.abs(x) > 4;

  return (
    <div className="relative overflow-hidden" style={{ borderRadius: '20px' }}>

      {/* Right reveal — approve */}
      <div
        className="absolute inset-0 flex items-center px-6 pointer-events-none"
        style={{
          background: rightColor,
          opacity: goingRight && moving ? progress : 0,
          transition: dragging ? 'none' : 'opacity 0.2s',
        }}
      >
        <CheckCircle className="h-5 w-5 text-white" style={{ opacity: 0.9 }} />
        <span className="ml-2 text-xs font-bold text-white tracking-wide">{rightLabel}</span>
      </div>

      {/* Left reveal — reject/hold */}
      <div
        className="absolute inset-0 flex items-center justify-end px-6 pointer-events-none"
        style={{
          background: leftColor,
          opacity: goingLeft && moving ? progress : 0,
          transition: dragging ? 'none' : 'opacity 0.2s',
        }}
      >
        <span className="mr-2 text-xs font-bold text-white tracking-wide">{leftLabel}</span>
        {leftLabel === 'Hold' ? <Clock className="h-5 w-5 text-white" style={{ opacity: 0.9 }} /> : <XCircle className="h-5 w-5 text-white" style={{ opacity: 0.9 }} />}
      </div>

      {/* The card itself */}
      <div
        {...handlers}
        style={{
          transform:  `translateX(${x}px)`,
          transition: dragging ? 'none' : 'transform 0.35s cubic-bezier(0.34,1.2,0.64,1)',
          willChange: 'transform',
          cursor: disabled ? 'default' : 'grab',
          boxShadow: isCommitting
            ? `0 0 0 2px ${goingRight ? rightColor : leftColor}60`
            : undefined,
          borderRadius: '20px',
        }}
      >
        {children}
      </div>
    </div>
  );
}
