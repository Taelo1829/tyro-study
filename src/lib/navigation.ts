import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  Layers,
  ClipboardList,
  UserRound,
  Shield,
  type LucideIcon,
  MessageCircle,
  LogOut,
} from "lucide-react"
import type { LevelTerms } from "@/lib/levels"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  adminOnly?: boolean,
  action?: "logout",
  badge?: boolean

}

export const MAIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Modules", href: "/modules", icon: BookOpen },
  { label: "Timetable", href: "/timetable", icon: Calendar },
  // { label: "Flashcards", href: "/flashcards", icon: Layers },
  { label: "Chats", href: "/chat", icon: MessageCircle, badge: true },
  // { label: "Assignments", href: "/assignments", icon: ClipboardList },
  { label: "Logout", href: "/", icon: LogOut, action: "logout" },
  { label: "Profile", href: "/profile", icon: UserRound },
  { label: "Admin", href: "/admin", icon: Shield, adminOnly: true },
]

/** The item's label in the student's words ("Subjects" for high school) */
export function navLabel(item: NavItem, terms: LevelTerms): string {
  return item.href === "/modules" ? terms.Modules : item.label
}
