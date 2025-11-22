"use client"

import { cn } from "@/lib/utils"

interface LoaderProps {
  className?: string
  size?: "sm" | "md" | "lg"
}

export function Loader({ className, size = "md" }: LoaderProps) {
  const sizeClasses = {
    sm: "h-4 w-4 border-[1.5px]",
    md: "h-5 w-5 border-2",
    lg: "h-6 w-6 border-2",
  }

  return (
    <div
      className={cn(
        "animate-spin rounded-full border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100",
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
        "h-1 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800",
        className
      )}
    >
      <div
        className="h-full rounded-full bg-zinc-900 transition-all duration-300 ease-out dark:bg-zinc-100"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  )
}
