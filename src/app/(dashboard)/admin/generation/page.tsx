import { requireAdminPage } from "@/lib/admin"
import { GenerationHistory } from "@/components/admin/generation-history"
export default async function GenerationPage() {
  await requireAdminPage()
  return <GenerationHistory />
}
