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
      className={cn("flex items-end gap-2 w-full", className)}
      style={{ height: height + 24 }}
    >
      {data.map((item, index) => {
        const barHeight = Math.max(4, (item.value / maxValue) * height)
        const isHovered = hoveredIndex === index
        const isAnyHovered = hoveredIndex !== null

        const barColor = color || 'var(--tc-90)'

        return (
          <div
            key={index}
            className="relative flex-1 flex flex-col items-center justify-end"
            style={{ height: height + 24 }}
            onMouseEnter={() => setHoveredIndex(index)}
          >
            {/* Tooltip */}
            {isHovered && (
              <div
                className="absolute left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md text-[10px] font-semibold whitespace-nowrap z-10 pointer-events-none"
                style={{
                  bottom: `${barHeight + 28}px`,
                  background: barColor,
                  color: '#000',
                }}
              >
                {formatter(item.value)}
              </div>
            )}

            {/* Bar */}
            <div
              className="w-full max-w-[40px] transition-all duration-200"
              style={{
                height: `${barHeight}px`,
                background: barColor,
                opacity: isAnyHovered ? (isHovered ? 1 : 0.3) : 0.85,
                borderRadius: '4px 4px 2px 2px',
                transform: isHovered ? 'scaleY(1.03)' : 'scaleY(1)',
                transformOrigin: 'bottom',
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
              {item.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
