"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  suffix?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, suffix, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {label && (
          <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            type={type}
            className={cn(
              "flex h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm",
              "placeholder:text-zinc-400",
              "focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:ring-zinc-100",
              error && "border-red-500 focus:ring-red-500",
              suffix && "pr-14",
              className
            )}
            ref={ref}
            {...props}
          />
          {suffix && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-zinc-500">
              {suffix}
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
