// Runs in the browser before the app starts (Next.js convention).
// Reports uncaught errors and unhandled promise rejections (src/lib/report-client-error.ts).
import { installGlobalErrorHandlers } from "@/lib/report-client-error"

installGlobalErrorHandlers()
