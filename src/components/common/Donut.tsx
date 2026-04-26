import { cn } from '@/lib/utils'

const COLORS = [
  'hsl(168, 75%, 52%)',
  'hsl(260, 85%, 65%)',
  'hsl(36, 95%, 56%)',
  'hsl(200, 95%, 60%)',
  'hsl(330, 75%, 60%)',
  'hsl(152, 75%, 50%)',
]

export function Donut({
  data,
  size = 160,
  thickness = 18,
  className,
  centerLabel,
  centerValue,
}: {
  data: { label: string; value: number }[]
  size?: number
  thickness?: number
  className?: string
  centerLabel?: string
  centerValue?: string
}) {
  const total = data.reduce((a, d) => a + d.value, 0)
  const r = (size - thickness) / 2
  const cx = size / 2
  const cy = size / 2
  const C = 2 * Math.PI * r
  let acc = 0

  return (
    <div className={cn('flex flex-col items-center gap-3 sm:flex-row sm:gap-6', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={cx} cy={cy} r={r} stroke="hsl(var(--muted))" strokeWidth={thickness} fill="none" />
          {total > 0 &&
            data.map((d, i) => {
              const fraction = d.value / total
              const dash = fraction * C
              const offset = -acc * C
              acc += fraction
              return (
                <circle
                  key={d.label}
                  cx={cx}
                  cy={cy}
                  r={r}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={thickness}
                  strokeLinecap="butt"
                  strokeDasharray={`${dash} ${C - dash}`}
                  strokeDashoffset={offset}
                  fill="none"
                />
              )
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerLabel && (
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {centerLabel}
            </div>
          )}
          {centerValue && (
            <div className="num text-lg font-bold leading-none mt-0.5">{centerValue}</div>
          )}
        </div>
      </div>
      {data.length > 0 && (
        <ul className="space-y-1.5 text-sm">
          {data.map((d, i) => (
            <li key={d.label} className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="text-muted-foreground">{d.label}</span>
              <span className="num ml-auto font-medium">
                {total > 0 ? Math.round((d.value / total) * 100) : 0}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
