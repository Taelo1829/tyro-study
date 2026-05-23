import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  Layers,
  ClipboardList,
  Settings,
  Shield,
  type LucideIcon,
  MessageCircle,
  LogOut,
} from "lucide-react"

export interface NavItem {
  label: string
  href?: string
  icon: LucideIcon
  adminOnly?: boolean,
  action?: "logout"

}

export const MAIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Modules", href: "/modules", icon: BookOpen },
  { label: "Timetable", href: "/timetable", icon: Calendar },
  // { label: "Flashcards", href: "/flashcards", icon: Layers },
  { label: "Chats", href: "/chat", icon: MessageCircle },
  { label: "Assignments", href: "/assignments", icon: ClipboardList },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Admin", href: "/admin", icon: Shield, adminOnly: true },
  { label: "Logout", href: "/", icon: LogOut, action: "logout" },
]
