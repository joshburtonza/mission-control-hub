import { useState } from "react"
import { cn } from "@/lib/utils"

export interface MiniChartDataPoint {
  label: string
  value: number
}

interface MiniChartProps {
  data: MiniChartDataPoint[]
  height?: number
  color?: string
  formatter?: (v: number) => string
  className?: string
}

export function MiniChart({
  data,
  height = 80,
  color,
  formatter = (v) => String(v),
  className,
}: MiniChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  if (!data.length) return null
  const maxValue = Math.max(...data.map((d) => d.value), 1)
  const n = data.length
  const barColor = color || 'var(--tc-90)'

  return (
    <div
      onMouseLeave={() => setHoveredIndex(null)}
      className={cn("flex items-end gap-[3px] w-full", className)}
      style={{ height: height + 24 }}
    >
      {data.map((item, index) => {
        const heightPx = Math.max(28, (item.value / maxValue) * height)
        const isHovered = hoveredIndex === index
        const isLatest = index === n - 1

        // Fade: oldest bars are most dim, newest brightest, hovered = full
        const baseOpacity = 0.25 + (index / (n - 1 || 1)) * 0.55
        const opacity = isHovered ? 1 : baseOpacity

        return (
          <div
            key={index}
            className="relative flex-1 flex flex-col items-center justify-end cursor-pointer"
            style={{ height: height + 24 }}
            onMouseEnter={() => setHoveredIndex(index)}
          >
            {/* Tooltip */}
            {isHovered && (
              <div
                className="absolute left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md text-[10px] font-semibold whitespace-nowrap z-20 pointer-events-none"
                style={{
                  bottom: heightPx + 8,
                  background: barColor,
                  color: '#000',
                }}
              >
                {formatter(item.value)}
              </div>
            )}

            {/* Bar */}
            <div
              className="w-full relative transition-all duration-200 overflow-hidden"
              style={{
                height: heightPx,
                background: barColor,
                opacity,
                borderRadius: '6px 6px 2px 2px',
              }}
            >
              {/* Dash indicator inside bar near top */}
              <div
                className="absolute rounded-full"
                style={{
                  top: 8,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '30%',
                  height: 2,
                  background: 'rgba(255,255,255,0.35)',
                }}
              />
            </div>

            {/* Month label */}
            <span
              className="text-[9px] font-medium mt-1.5 text-center transition-colors duration-150"
              style={{
                color: isHovered || isLatest ? barColor : 'var(--tc-25)',
              }}
            >
              {item.label.slice(0, 3)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
