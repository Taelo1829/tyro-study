"use client"

import { useRef, useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TopicContentView } from "@/components/topic/topic-content-view"
import { MathText } from "@/components/ui/math-text"
import { cn } from "@/lib/utils"

/**
 * "Download PDF" for students: lays the topic's lesson (plus key takeaways
 * and flashcards) out as a clean, print-ready page in a hidden frame and opens
 * the browser's print dialog on it, where "Save as PDF" is the destination.
 *
 * Printing the real rendered HTML (instead of drawing it with a PDF library)
 * keeps text selectable and searchable, and keeps maths, tables, code blocks,
 * graphs and images exactly as they look in the app - with no new packages.
 */
export function TopicPdfDownload({
    topicTitle,
    moduleTitle,
    chapterTitle,
    content,
    takeaways = [],
    flashcards = [],
    className,
    size = "sm",
}: {
    topicTitle: string
    moduleTitle?: string
    chapterTitle?: string
    content: string | null | undefined
    takeaways?: string[]
    flashcards?: Array<{ id: string; front: string; back: string }>
    className?: string
    size?: "sm" | "default"
}) {
    const sourceRef = useRef<HTMLDivElement>(null)
    const [isPreparing, setIsPreparing] = useState(false)

    const fileName = [moduleTitle, topicTitle]
        .filter(Boolean)
        .join(" - ")
        .replace(/[\\/:*?"<>|]+/g, "")
        .trim() || "Tyro Study notes"

    async function handleDownload() {
        const source = sourceRef.current
        if (!source || isPreparing) return
        setIsPreparing(true)

        try {
            await printHtml(source.innerHTML, fileName)
        } catch (error) {
            console.error("PDF download failed:", error)
        } finally {
            setIsPreparing(false)
        }
    }

    return (
        <>
            <Button
                type="button"
                variant="outline"
                size={size}
                onClick={handleDownload}
                disabled={isPreparing}
                className={cn("print:hidden", className)}
                title="Download this lesson as a PDF"
            >
                {isPreparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Download PDF
            </Button>

            {/* What goes into the PDF. Rendered with the app's own components (so
                maths and formatting match the lesson) but never shown on screen. */}
            <div ref={sourceRef} hidden aria-hidden="true">
                <header className="pdf-header">
                    {(moduleTitle || chapterTitle) && (
                        <p className="pdf-eyebrow">{[moduleTitle, chapterTitle].filter(Boolean).join("  ·  ")}</p>
                    )}
                    <h1 className="pdf-title">{topicTitle}</h1>
                </header>

                <TopicContentView content={content} part="lesson" empty="This topic has no written lesson yet." />

                {takeaways.length > 0 && (
                    <section className="pdf-section">
                        <h2 className="pdf-section-title">Key takeaways</h2>
                        <ul className="pdf-takeaways">
                            {takeaways.map((point, index) => (
                                <li key={index}><MathText text={point} /></li>
                            ))}
                        </ul>
                    </section>
                )}

                {flashcards.length > 0 && (
                    <section className="pdf-section">
                        <h2 className="pdf-section-title">Flashcards</h2>
                        <ol className="pdf-flashcards">
                            {flashcards.map(card => (
                                <li key={card.id} className="pdf-flashcard">
                                    <p className="pdf-flashcard-front"><MathText text={card.front} /></p>
                                    <p className="pdf-flashcard-back"><MathText text={card.back} /></p>
                                </li>
                            ))}
                        </ol>
                    </section>
                )}

                <footer className="pdf-footer">Tyro Study · www.tyrostudy.co.za</footer>
            </div>
        </>
    )
}

/** Extra styles for the printed page, on top of the app's own stylesheets */
const PRINT_CSS = `
  @page { size: A4; margin: 18mm 16mm; }
  html, body { background: #fff !important; margin: 0; padding: 0; }
  body { color: #16181d; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pdf-root { max-width: 720px; margin: 0 auto; padding: 24px; }
  @media print { .pdf-root { max-width: none; padding: 0; } }

  .pdf-header { margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid #16181d; }
  .pdf-eyebrow { margin: 0 0 0.35rem; font-size: 0.8rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: #6b7280; }
  .pdf-title { margin: 0; font-size: 1.9rem; font-weight: 700; line-height: 1.2; }

  .pdf-section { margin-top: 2rem; padding-top: 1.25rem; border-top: 1px solid #e3e7ec; }
  .pdf-section-title { margin: 0 0 0.75rem; font-size: 1.25rem; font-weight: 700; }
  .pdf-takeaways { margin: 0; padding-left: 1.25rem; list-style: disc; }
  .pdf-takeaways li { margin: 0.35rem 0; line-height: 1.6; }
  .pdf-flashcards { margin: 0; padding-left: 1.5rem; list-style: decimal; }
  .pdf-flashcard { margin: 0 0 0.9rem; break-inside: avoid; page-break-inside: avoid; }
  .pdf-flashcard-front { margin: 0; font-weight: 600; }
  .pdf-flashcard-back { margin: 0.2rem 0 0; color: #374151; }
  .pdf-footer { margin-top: 2.5rem; padding-top: 0.75rem; border-top: 1px solid #e3e7ec; font-size: 0.75rem; color: #6b7280; text-align: center; }

  /* Paper can't scroll: let wide code and tables wrap instead of being cut off */
  .topic-content pre { white-space: pre-wrap !important; overflow: visible !important; word-break: break-word; }
  .topic-content table { display: table !important; overflow: visible !important; }
  .tc-matrix { overflow: visible !important; }

  /* Keep things whole across page breaks */
  .topic-content h1, .topic-content h2, .topic-content h3, .topic-content h4 { break-after: avoid; page-break-after: avoid; }
  .topic-content pre, .topic-content figure, .topic-content img, .topic-content .callout,
  .topic-content tr, .topic-content blockquote { break-inside: avoid; page-break-inside: avoid; }

  /* Videos can't play on paper */
  .topic-video-embed, iframe, video { display: none !important; }
`

/**
 * Prints `bodyHtml` in a hidden iframe that carries the app's stylesheets,
 * so the browser's print dialog (Save as PDF) shows just the notes.
 */
function printHtml(bodyHtml: string, title: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const iframe = document.createElement("iframe")
        iframe.setAttribute("aria-hidden", "true")
        iframe.tabIndex = -1
        // Off-screen but still laid out (a display:none frame won't print in some browsers)
        Object.assign(iframe.style, {
            position: "fixed", right: "0", bottom: "0", width: "1px", height: "1px",
            border: "0", opacity: "0", pointerEvents: "none",
        })
        document.body.appendChild(iframe)

        const frameWindow = iframe.contentWindow
        const doc = iframe.contentDocument
        if (!frameWindow || !doc) {
            iframe.remove()
            reject(new Error("Could not prepare the print frame"))
            return
        }

        // The app's styles (Tailwind, lesson styles, fonts), so the notes look like the lesson
        const appStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
            .map(node => node.outerHTML)
            .join("\n")

        doc.open()
        doc.write(`<!doctype html>
<html lang="en" class="${escapeAttr(document.documentElement.className)}">
<head>
<meta charset="utf-8">
<base href="${escapeAttr(document.baseURI)}">
<title>${escapeHtml(title)}</title>
${appStyles}
<style>${PRINT_CSS}</style>
</head>
<body class="${escapeAttr(document.body.className)}">
<main class="pdf-root">${bodyHtml}</main>
</body>
</html>`)
        doc.close()

        // Most browsers name the PDF after the page title; set both to be safe
        const previousTitle = document.title
        document.title = title

        let cleanedUp = false
        const cleanup = () => {
            if (cleanedUp) return
            cleanedUp = true
            document.title = previousTitle
            iframe.remove()
        }

        const print = async () => {
            try {
                await waitForAssets(doc)
                frameWindow.focus()
                frameWindow.addEventListener("afterprint", () => setTimeout(cleanup, 100), { once: true })
                frameWindow.print()
                resolve()
            } catch (error) {
                cleanup()
                reject(error)
            }
            // Fallback for browsers where print() returns straight away and
            // afterprint never fires (some mobile browsers)
            setTimeout(cleanup, 60_000)
        }

        if (doc.readyState === "complete") void print()
        else iframe.addEventListener("load", () => void print(), { once: true })
    })
}

/** Waits for stylesheets, fonts and images in the frame (max ~8s), so nothing prints half-loaded */
async function waitForAssets(doc: Document) {
    const pending: Promise<unknown>[] = []

    doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]').forEach(link => {
        if (link.sheet) return
        pending.push(new Promise(done => {
            link.addEventListener("load", done, { once: true })
            link.addEventListener("error", done, { once: true })
        }))
    })

    doc.querySelectorAll("img").forEach(img => {
        img.loading = "eager"
        if (img.complete) return
        pending.push(new Promise(done => {
            img.addEventListener("load", done, { once: true })
            img.addEventListener("error", done, { once: true })
        }))
    })

    if (doc.fonts?.ready) pending.push(doc.fonts.ready)

    await Promise.race([
        Promise.all(pending),
        new Promise(done => setTimeout(done, 8000)),
    ])
}

function escapeHtml(value: string) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function escapeAttr(value: string) {
    return escapeHtml(value).replace(/"/g, "&quot;")
}
