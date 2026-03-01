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
  const [isHovering, setIsHovering] = useState(false)

  if (!data.length) return null
  const maxValue = Math.max(...data.map((d) => d.value), 1)

  // bar width scales with number of items — feels dense even with few bars
  const barW = Math.min(36, Math.max(12, Math.floor(320 / data.length) - 8))

  return (
    <div
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => { setIsHovering(false); setHoveredIndex(null) }}
      className={cn("flex items-end justify-around w-full", className)}
      style={{ height: height + 28 }}
    >
      {data.map((item, index) => {
        const barHeight = Math.max(4, (item.value / maxValue) * height)
        const isHovered = hoveredIndex === index
        const isAnyHovered = hoveredIndex !== null
        const barColor = color || 'var(--tc-90)'

        return (
          <div
            key={index}
            className="relative flex flex-col items-center justify-end"
            style={{ height: height + 28, width: barW }}
            onMouseEnter={() => setHoveredIndex(index)}
          >
            {/* Tooltip */}
            {isHovered && (
              <div
                className="absolute left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md text-[10px] font-semibold whitespace-nowrap z-10 pointer-events-none"
                style={{
                  bottom: `${barHeight + 26}px`,
                  background: barColor,
                  color: '#000',
                }}
              >
                {formatter(item.value)}
              </div>
            )}

            {/* Bar */}
            <div
              className="w-full transition-all duration-200"
              style={{
                height: `${barHeight}px`,
                background: barColor,
                opacity: isAnyHovered ? (isHovered ? 1 : 0.25) : 0.8,
                borderRadius: '4px 4px 2px 2px',
                transform: isHovered ? 'scaleY(1.04)' : 'scaleY(1)',
                transformOrigin: 'bottom',
              }}
            />

            {/* Label */}
            <span
              className="text-[9px] font-medium mt-1.5 transition-all duration-200 truncate text-center"
              style={{
                width: barW + 8,
                color: isHovered ? barColor : 'var(--tc-25)',
                opacity: isHovering && !isHovered ? 0.4 : 1,
              }}
            >
              {item.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
