export function AnimatedCheck({ size = 96 }: { size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <span
        className="absolute inset-0 rounded-full bg-success/30 animate-ping-soft"
        aria-hidden
      />
      <svg
        width={size}
        height={size}
        viewBox="0 0 96 96"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative"
      >
        <circle cx="48" cy="48" r="44" fill="hsl(152, 75%, 50%)" fillOpacity="0.15" />
        <circle
          cx="48"
          cy="48"
          r="36"
          fill="hsl(152, 75%, 50%)"
          fillOpacity="0.25"
        />
        <circle cx="48" cy="48" r="28" fill="hsl(152, 75%, 50%)" />
        <path
          d="M34 48 L44 58 L62 38"
          stroke="white"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-draw-check"
        />
      </svg>
    </div>
  )
}
