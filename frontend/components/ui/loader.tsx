"use client"

import { cn } from "@/lib/utils"

interface LoaderProps {
  className?: string
  size?: "sm" | "md" | "lg"
  variant?: "default" | "emerald" | "pulse"
}

export function Loader({ className, size = "md", variant = "emerald" }: LoaderProps) {
  const sizeClasses = {
    sm: "h-4 w-4 border-[1.5px]",
    md: "h-5 w-5 border-2",
    lg: "h-8 w-8 border-[3px]",
  }

  if (variant === "pulse") {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              "rounded-full bg-emerald-500",
              size === "sm" ? "h-1.5 w-1.5" : size === "md" ? "h-2 w-2" : "h-3 w-3"
            )}
            style={{
              animation: "pulse 1.4s ease-in-out infinite",
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "animate-spin rounded-full",
        variant === "emerald"
          ? "border-emerald-500/30 border-t-emerald-500"
          : "border-zinc-700 border-t-zinc-100",
        sizeClasses[size],
        className
      )}
    />
  )
}

interface ProgressBarProps {
  progress: number
  className?: string
}

export function ProgressBar({ progress, className }: ProgressBarProps) {
  return (
    <div
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-zinc-800",
        className
      )}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  )
}

// Enhanced loading component with animation
export function LoadingOverlay({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-zinc-900/80 backdrop-blur-sm rounded-xl">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl animate-pulse" />
        <Loader size="lg" variant="emerald" />
      </div>
      <p className="mt-4 text-sm text-zinc-400 animate-pulse">{message}</p>
    </div>
  )
}
