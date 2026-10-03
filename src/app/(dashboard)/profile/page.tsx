import type { Metadata } from "next"
import { ProfileSettings } from "@/components/profile/profile-settings"

export const metadata: Metadata = { title: "Profile" }

export default function ProfilePage() {
  return <ProfileSettings />
}
