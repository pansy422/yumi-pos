import { cn } from '@/lib/utils'

export function Sparkline({
  data,
  width = 220,
  height = 56,
  className,
  stroke = 'hsl(168, 75%, 52%)',
  fillFrom = 'hsl(168, 75%, 52%)',
}: {
  data: number[]
  width?: number
  height?: number
  className?: string
  stroke?: string
  fillFrom?: string
}) {
  if (data.length === 0) return <div className={cn('h-14 w-full', className)} />
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = Math.max(1, max - min)
  const stepX = data.length > 1 ? width / (data.length - 1) : 0
  const pad = 4
  const points = data.map((v, i) => {
    const x = data.length === 1 ? width / 2 : i * stepX
    const y = pad + (1 - (v - min) / range) * (height - pad * 2)
    return [x, y] as const
  })
  const path = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(' ')
  const area = `${path} L ${width} ${height} L 0 ${height} Z`
  const id = `spark-${stroke.replace(/[^a-z0-9]/gi, '')}`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn('w-full', className)}
      style={{ height }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={fillFrom} stopOpacity="0.45" />
          <stop offset="1" stopColor={fillFrom} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {points.length > 0 && (
        <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="3" fill={stroke} />
      )}
    </svg>
  )
}
