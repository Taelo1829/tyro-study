import { redirect } from "next/navigation"

/** Settings now live on the profile page */
export default function SettingsPage() {
  redirect("/profile")
}
