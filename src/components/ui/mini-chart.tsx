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

  return (
    <div
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => { setIsHovering(false); setHoveredIndex(null) }}
      className={cn("flex items-end gap-1.5 w-full", className)}
      style={{ height }}
    >
      {data.map((item, index) => {
        const heightPx = Math.max(4, (item.value / maxValue) * height)
        const isHovered = hoveredIndex === index
        const isNeighbor = hoveredIndex !== null && (index === hoveredIndex - 1 || index === hoveredIndex + 1)
        const isAnyHovered = hoveredIndex !== null

        const barColor = color || 'var(--tc-90)'

        return (
          <div
            key={index}
            className="relative flex-1 flex flex-col items-center justify-end h-full"
            onMouseEnter={() => setHoveredIndex(index)}
          >
            {/* Tooltip */}
            {isHovered && (
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md text-[10px] font-semibold whitespace-nowrap z-10 pointer-events-none"
                style={{
                  background: barColor,
                  color: 'var(--s-bg)',
                }}>
                {formatter(item.value)}
              </div>
            )}

            {/* Bar */}
            <div
              className="w-full rounded-full transition-all duration-200 origin-bottom"
              style={{
                height: `${heightPx}px`,
                background: barColor,
                opacity: isHovered ? 1 : isNeighbor ? 0.4 : isAnyHovered ? 0.15 : 0.25,
                transform: isHovered ? 'scaleX(1.15) scaleY(1.02)' : isNeighbor ? 'scaleX(1.05)' : 'scaleX(1)',
              }}
            />

            {/* Label */}
            <span
              className="text-[9px] font-medium mt-1.5 transition-all duration-200"
              style={{
                color: isHovered ? barColor : 'var(--tc-25)',
                opacity: isHovering && !isHovered ? 0.5 : 1,
              }}
            >
              {item.label.charAt(0)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
