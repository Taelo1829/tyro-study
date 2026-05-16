import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        success:
          "border-transparent bg-green-500 text-white hover:bg-green-600",
        warning:
          "border-transparent bg-yellow-500 text-white hover:bg-yellow-600",
        info:
          "border-transparent bg-blue-500 text-white hover:bg-blue-600",
        purple:
          "border-transparent bg-purple-500 text-white hover:bg-purple-600",
        pink:
          "border-transparent bg-pink-500 text-white hover:bg-pink-600",
        orange:
          "border-transparent bg-orange-500 text-white hover:bg-orange-600",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs",
        sm: "px-2 py-0.5 text-[10px]",
        lg: "px-3 py-1 text-sm",
      },
      rounded: {
        default: "rounded-full",
        sm: "rounded",
        md: "rounded-md",
        lg: "rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      rounded: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  icon?: React.ReactNode
  count?: number
  dot?: boolean
  animated?: boolean
}

function Badge({ 
  className, 
  variant, 
  size, 
  rounded,
  icon, 
  count, 
  dot,
  animated,
  children, 
  ...props 
}: BadgeProps) {
  return (
    <div
      className={cn(
        badgeVariants({ variant, size, rounded }), 
        animated && "animate-pulse",
        className
      )}
      {...props}
    >
      {dot && (
        <span className={cn(
          "mr-1 h-1.5 w-1.5 rounded-full bg-current",
          animated && "animate-ping"
        )} />
      )}
      {icon && <span className="mr-1">{icon}</span>}
      {children}
      {count !== undefined && count > 0 && (
        <span className={cn(
          "ml-1 rounded-full bg-white/20 px-1 text-[10px] font-bold",
          size === "lg" && "px-1.5 text-xs"
        )}>
          {count > 99 ? "99+" : count}
        </span>
      )}
    </div>
  )
}

// Compound components for specific use cases
export const StatusBadge = ({ status }: { status: "active" | "inactive" | "pending" | "completed" | "failed" }) => {
  const variants = {
    active: { variant: "success" as const, label: "Active" },
    inactive: { variant: "secondary" as const, label: "Inactive" },
    pending: { variant: "warning" as const, label: "Pending" },
    completed: { variant: "success" as const, label: "Completed" },
    failed: { variant: "destructive" as const, label: "Failed" },
  }
  
  const config = variants[status]
  
  return (
    <Badge variant={config.variant}>
      {config.label}
    </Badge>
  )
}

export const DifficultyBadge = ({ difficulty }: { difficulty: "EASY" | "MEDIUM" | "HARD" | "EXPERT" }) => {
  const variants = {
    EASY: { variant: "success" as const, label: "Easy", icon: "🌟" },
    MEDIUM: { variant: "warning" as const, label: "Medium", icon: "⚡" },
    HARD: { variant: "destructive" as const, label: "Hard", icon: "🔥" },
    EXPERT: { variant: "purple" as const, label: "Expert", icon: "🏆" },
  }
  
  const config = variants[difficulty]
  
  return (
    <Badge variant={config.variant}>
      <span className="mr-1">{config.icon}</span>
      {config.label}
    </Badge>
  )
}

export const StreakBadge = ({ days }: { days: number }) => {
  let variant: BadgeProps["variant"] = "secondary"
  let icon = "🔥"
  
  if (days >= 30) {
    variant = "purple"
    icon = "👑"
  } else if (days >= 14) {
    variant = "success"
    icon = "🌟"
  } else if (days >= 7) {
    variant = "info"
    icon = "⚡"
  } else if (days >= 3) {
    variant = "warning"
    icon = "🔥"
  }
  
  return (
    <Badge variant={variant}>
      <span className="mr-1">{icon}</span>
      {days} Day Streak
    </Badge>
  )
}

export const ScoreBadge = ({ score, maxScore = 100 }: { score: number; maxScore?: number }) => {
  const percentage = (score / maxScore) * 100
  let variant: BadgeProps["variant"] = "secondary"
  let icon = "📝"
  
  if (percentage >= 90) {
    variant = "purple"
    icon = "🏆"
  } else if (percentage >= 70) {
    variant = "success"
    icon = "⭐"
  } else if (percentage >= 50) {
    variant = "warning"
    icon = "📊"
  } else if (percentage >= 0) {
    variant = "destructive"
    icon = "📚"
  }
  
  return (
    <Badge variant={variant}>
      <span className="mr-1">{icon}</span>
      {score}/{maxScore}
    </Badge>
  )
}

export const ProgressBadge = ({ progress }: { progress: number }) => {
  let variant: BadgeProps["variant"] = "secondary"
  let label = `${progress}%`
  
  if (progress === 100) {
    variant = "success"
    label = "✅ Complete"
  } else if (progress >= 75) {
    variant = "info"
    label = `${progress}% - Almost There`
  } else if (progress >= 50) {
    variant = "warning"
    label = `${progress}% - Halfway`
  } else if (progress > 0) {
    variant = "default"
    label = `${progress}% - In Progress`
  } else {
    variant = "secondary"
    label = "Not Started"
  }
  
  return (
    <Badge variant={variant}>
      {label}
    </Badge>
  )
}

export { Badge, badgeVariants }