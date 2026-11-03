import { isEnabled } from "@/lib/flags"
import { RegisterForm } from "./register-form"

// Read the flag at request time, so a change in Vercel applies after a redeploy
// without depending on how the page was prerendered.
export const dynamic = "force-dynamic"

export default function RegisterPage() {
  return <RegisterForm allowHighSchool={isEnabled("highschool_signup")} />
}
