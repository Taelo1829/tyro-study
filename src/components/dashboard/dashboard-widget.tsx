"use client"

import { motion } from "framer-motion"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface DashboardWidgetProps {
  title: string
  description?: string
  children: React.ReactNode
  delay?: number
  /** Pastel panel colour, as in the design's feature cards */
  tone?: "white" | "blue" | "mint" | "slate"
}

const TONES = {
  white: "",
  blue: "tint-blue shadow-none",
  mint: "tint-mint shadow-none",
  slate: "tint-slate shadow-none",
} as const

export function DashboardWidget({
  title,
  description,
  children,
  delay = 0,
  tone = "white",
}: DashboardWidgetProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      <Card className={`h-full ${TONES[tone]}`}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </motion.div>
  )
}
