import { SITE_NAME } from "@/lib/site"

/**
 * Send an email through Resend (RESEND_API_KEY + EMAIL_FROM).
 *
 * In development without those set, the email is printed to the server
 * console instead so sign-up and email changes can still be tested.
 */
export async function sendEmail({ to, subject, text, html }: { to: string; subject: string; text: string; html?: string }) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`\n[email] (not sent: RESEND_API_KEY / EMAIL_FROM not set)\nTo: ${to}\nSubject: ${subject}\n\n${text}\n`)
      return
    }
    throw new Error("Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM.")
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text, ...(html ? { html } : {}) }),
  })
  if (!response.ok) {
    // Include Resend's explanation (e.g. "The gmail.com domain is not verified")
    // so the real cause shows up in the Vercel logs
    const detail = await response.text().catch(() => "")
    throw new Error(`Email provider returned ${response.status}: ${detail}`)
  }
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!)

/** A simple, readable email with one big code in the middle */
export function codeEmailHtml({ intro, code, outro }: { intro: string; code: string; outro: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px">
<tr><td style="font-size:18px;font-weight:bold;padding-bottom:16px">${escapeHtml(SITE_NAME)}</td></tr>
<tr><td style="font-size:15px;line-height:1.5;padding-bottom:20px">${escapeHtml(intro)}</td></tr>
<tr><td align="center" style="padding-bottom:20px"><span style="display:inline-block;font-size:32px;letter-spacing:8px;font-weight:bold;background:#f4f4f5;border-radius:12px;padding:14px 22px">${escapeHtml(code)}</span></td></tr>
<tr><td style="font-size:13px;line-height:1.5;color:#71717a">${escapeHtml(outro)}</td></tr>
</table></td></tr></table></body></html>`
}
