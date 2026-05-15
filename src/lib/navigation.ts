import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  Layers,
  ClipboardList,
  Settings,
  Shield,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  adminOnly?: boolean
}

export const MAIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Modules", href: "/modules", icon: BookOpen },
  { label: "Timetable", href: "/timetable", icon: Calendar },
  { label: "Flashcards", href: "/flashcards", icon: Layers },
  { label: "Assignments", href: "/assignments", icon: ClipboardList },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Admin", href: "/admin", icon: Shield, adminOnly: true },
]
