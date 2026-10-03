"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    Bold,
    Code2,
    Eye,
    Heading2,
    Heading3,
    ImageIcon,
    ImagePlus,
    Italic,
    Lightbulb,
    Link2,
    List,
    ListOrdered,
    Loader2,
    Minus,
    Pencil,
    Pilcrow,
    Quote,
    Redo2,
    RemoveFormatting,
    Table,
    TriangleAlert,
    Underline,
    Undo2,
    Video,
    CircleCheck,
} from "lucide-react";
import { TopicContentView } from "@/components/topic/topic-content-view";
import { contentForEditor, getVideoEmbedHtml, legacyToHtml, readingMinutes, sanitizeTopicHtml } from "@/lib/topic-content";
import { cn } from "@/lib/utils";

/**
 * Lesson editor for topic content (and assignments).
 *
 * What you see while writing is what students see: the editing area uses the
 * same `.topic-content` styles as the student page, and "Preview" shows the
 * exact student rendering. Pasted content (Word, Google Docs, PDFs, web
 * pages) is cleaned to plain structure - headings, lists, bold, links,
 * tables - so it matches the rest of the app instead of bringing its own
 * fonts and colours. Images can be uploaded, pasted or dropped in.
 */

type Props = {
    value: string;
    setHtml: (html: string) => void;
    placeholder?: string;
};

type FormatState = Record<string, boolean | string>;

const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const CALLOUTS = {
    idea: { className: "callout", label: "Key idea" },
    tip: { className: "callout callout-tip", label: "Tip" },
    warning: { className: "callout callout-warning", label: "Watch out" },
} as const;

async function uploadImage(file: File): Promise<string> {
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/admin/content-images", { method: "POST", body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Image upload failed");
    return data.url as string;
}

function ToolButton({
    label,
    active,
    onClick,
    disabled,
    children,
}: {
    label: string;
    active?: boolean;
    onClick: () => void;
    disabled?: boolean;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            // Keep the caret/selection in the editor when clicking a tool
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
            disabled={disabled}
            title={label}
            aria-label={label}
            aria-pressed={active}
            className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm transition-colors disabled:opacity-40",
                active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
            )}
        >
            {children}
        </button>
    );
}

/**
 * Browsers sometimes nest blocks inside a paragraph (e.g. a list created from
 * an empty line becomes <p><ol>…</ol></p>). Unwrap those so the structure
 * stays flat. Nodes are moved, not recreated, so the caret stays put.
 */
function normalizeBlocks(root: HTMLElement) {
    root.querySelectorAll("p").forEach((p) => {
        if (!p.querySelector(":scope > ol, :scope > ul, :scope > p, :scope > div, :scope > table, :scope > h2, :scope > h3, :scope > blockquote, :scope > pre")) return;
        p.replaceWith(...p.childNodes);
    });
}

const Divider = () => <span className="mx-1 h-6 w-px shrink-0 bg-border" aria-hidden="true" />;

export default function NeumorphicEditor({ value, setHtml, placeholder = "Start writing the lesson…" }: Props) {
    const editorRef = useRef<HTMLDivElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const savedRange = useRef<Range | null>(null);
    const [mode, setMode] = useState<"write" | "preview">("write");
    const [formats, setFormats] = useState<FormatState>({});
    const [showVideo, setShowVideo] = useState(false);
    const [videoUrl, setVideoUrl] = useState("");
    const [notice, setNotice] = useState<{ kind: "error" | "info"; text: string } | null>(null);
    const [uploading, setUploading] = useState(0);

    // Load outside changes (initial content, reset after save) into the editor.
    // Only touch the DOM when it really differs, or the caret jumps to the start.
    useEffect(() => {
        const el = editorRef.current;
        if (!el) return;
        const next = contentForEditor(value);
        if (el.innerHTML !== value && el.innerHTML !== next) el.innerHTML = next;
    }, [value, mode]);

    const emit = useCallback(() => {
        const el = editorRef.current;
        if (!el) return;
        normalizeBlocks(el);
        setHtml(el.innerHTML);
    }, [setHtml]);

    // Which tools are "on" at the caret
    const refreshFormats = useCallback(() => {
        const el = editorRef.current;
        const sel = document.getSelection();
        if (!el || !sel?.anchorNode || !el.contains(sel.anchorNode)) return;
        const block = String(document.queryCommandValue("formatBlock") || "").toLowerCase();
        setFormats({
            bold: document.queryCommandState("bold"),
            italic: document.queryCommandState("italic"),
            underline: document.queryCommandState("underline"),
            ul: document.queryCommandState("insertUnorderedList"),
            ol: document.queryCommandState("insertOrderedList"),
            block,
        });
    }, []);

    useEffect(() => {
        document.addEventListener("selectionchange", refreshFormats);
        return () => document.removeEventListener("selectionchange", refreshFormats);
    }, [refreshFormats]);

    const focusEditor = () => {
        const el = editorRef.current;
        if (!el) return;
        el.focus();
        document.execCommand("defaultParagraphSeparator", false, "p");
    };

    // Always write in real paragraphs (otherwise the first line is loose text
    // and the browser wraps what follows in <div>s)
    const onFocus = () => {
        const el = editorRef.current;
        if (!el) return;
        document.execCommand("defaultParagraphSeparator", false, "p");
        if (!el.innerHTML.trim() || el.innerHTML === "<br>") {
            el.innerHTML = "<p><br></p>";
            const range = document.createRange();
            range.setStart(el.firstChild!, 0);
            range.collapse(true);
            const sel = document.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
        }
    };

    const exec = (command: string, arg?: string) => {
        focusEditor();
        document.execCommand(command, false, arg);
        emit();
        refreshFormats();
    };

    /** Toggle a block style; clicking it again goes back to a paragraph */
    const block = (tag: "p" | "h2" | "h3" | "blockquote" | "pre") => {
        const current = String(formats.block || "");
        exec("formatBlock", current === tag && tag !== "p" ? "p" : tag);
    };

    const insertHtml = (markup: string) => {
        focusEditor();
        restoreSelection();
        document.execCommand("insertHTML", false, markup);
        emit();
    };

    /**
     * Insert block content (boxes, images, tables, videos, lines) after the
     * paragraph the caret is in - replacing it if it's empty - and move the
     * caret into the element marked data-caret. Done by hand because the
     * browser's insertHTML splits a box apart when the caret is inside a <p>.
     */
    const insertBlock = (markup: string) => {
        const el = editorRef.current;
        if (!el) return;
        focusEditor();
        restoreSelection();
        normalizeBlocks(el);
        const sel = document.getSelection();
        if (sel && !sel.isCollapsed && el.contains(sel.anchorNode)) sel.deleteFromDocument();

        let block: Node | null = sel?.rangeCount && el.contains(sel.anchorNode) ? sel.anchorNode : null;
        // Caret sitting directly in the editor (between blocks): use the child at that spot
        if (block === el) block = el.childNodes[Math.max(0, (sel?.anchorOffset ?? 1) - 1)] ?? null;
        while (block && block.parentNode !== el) block = block.parentNode;

        const tpl = document.createElement("template");
        tpl.innerHTML = markup;
        const nodes = [...tpl.content.childNodes];
        const caretTarget =
            tpl.content.querySelector<HTMLElement>("[data-caret]") ??
            (nodes.filter((n): n is HTMLElement => n.nodeType === Node.ELEMENT_NODE).at(-1) ?? null);

        const blockIsEmpty =
            block instanceof HTMLElement &&
            !block.textContent?.replace(/\u200b/g, "").trim() &&
            !block.querySelector("img, iframe, video, table, hr");

        if (block) {
            (block as ChildNode).after(...nodes);
            if (blockIsEmpty) (block as ChildNode).remove();
        } else {
            el.append(...nodes);
        }

        if (caretTarget) {
            // data-caret="select" highlights placeholder text so typing replaces it
            const selectAll = caretTarget.getAttribute("data-caret") === "select";
            caretTarget.removeAttribute("data-caret");
            const range = document.createRange();
            range.selectNodeContents(caretTarget);
            if (!selectAll) range.collapse(false);
            sel?.removeAllRanges();
            sel?.addRange(range);
        }
        emit();
        refreshFormats();
    };

    const saveSelection = () => {
        const sel = document.getSelection();
        if (sel?.rangeCount && editorRef.current?.contains(sel.anchorNode)) {
            savedRange.current = sel.getRangeAt(0).cloneRange();
        }
    };

    const restoreSelection = () => {
        const range = savedRange.current;
        if (!range) return;
        const sel = document.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        savedRange.current = null;
    };

    const insertCallout = (kind: keyof typeof CALLOUTS) => {
        const { className, label } = CALLOUTS[kind];
        const selected = document.getSelection()?.toString().trim();
        const body = selected ? escapeHtml(selected) : "";
        insertBlock(`<div class="${className}"><p data-caret><strong>${label}:</strong>&nbsp;${body}</p></div><p><br></p>`);
    };

    const insertLink = () => {
        saveSelection();
        const url = window.prompt("Paste the link (https://…)");
        if (!url?.trim()) return;
        const href = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
        focusEditor();
        restoreSelection();
        const sel = document.getSelection();
        if (sel && !sel.isCollapsed) exec("createLink", href);
        else insertHtml(`<a href="${escapeHtml(href)}">${escapeHtml(href)}</a>`);
    };

    const insertImageUrl = () => {
        saveSelection();
        const url = window.prompt("Paste the image address (https://…)");
        if (!url?.trim() || !/^https?:\/\//i.test(url.trim())) return;
        const caption = window.prompt("Caption (optional)") ?? "";
        insertBlock(imageMarkup(url.trim(), caption));
    };

    const imageMarkup = (src: string, caption = "") =>
        caption.trim()
            ? `<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(caption)}"><figcaption>${escapeHtml(caption)}</figcaption></figure><p><br></p>`
            : `<p><img src="${escapeHtml(src)}" alt=""></p><p><br></p>`;

    const uploadAndInsert = async (files: File[]) => {
        const images = files.filter((f) => f.type.startsWith("image/"));
        if (images.length === 0) return;
        saveSelection();
        setNotice({ kind: "info", text: images.length > 1 ? `Uploading ${images.length} images…` : "Uploading image…" });
        setUploading((n) => n + images.length);
        try {
            for (const file of images) {
                const url = await uploadImage(file);
                insertBlock(imageMarkup(url));
                saveSelection();
            }
            setNotice(null);
        } catch (err) {
            setNotice({ kind: "error", text: err instanceof Error ? err.message : "Image upload failed" });
        } finally {
            setUploading((n) => Math.max(0, n - images.length));
        }
    };

    const insertTable = () => {
        const cell = "<td><br></td>";
        insertBlock(
            `<table><thead><tr><th data-caret="select">Heading</th><th>Heading</th><th>Heading</th></tr></thead>` +
            `<tbody><tr>${cell.repeat(3)}</tr><tr>${cell.repeat(3)}</tr></tbody></table><p><br></p>`
        );
    };

    const insertVideo = () => {
        const embed = getVideoEmbedHtml(videoUrl);
        if (!embed) {
            setNotice({ kind: "error", text: "Use a YouTube, Vimeo, MP4, WebM or OGG link." });
            return;
        }
        insertBlock(`${embed}<p><br></p>`);
        setVideoUrl("");
        setShowVideo(false);
        setNotice(null);
    };

    // Paste: images upload; rich text is cleaned; plain text keeps paragraphs/lists
    const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
        const files = [...e.clipboardData.files];
        if (files.some((f) => f.type.startsWith("image/"))) {
            e.preventDefault();
            void uploadAndInsert(files);
            return;
        }
        const pastedHtml = e.clipboardData.getData("text/html");
        const text = e.clipboardData.getData("text/plain");
        if (pastedHtml) {
            e.preventDefault();
            const clean = sanitizeTopicHtml(pastedHtml);
            document.execCommand("insertHTML", false, clean || escapeHtml(text));
            emit();
        } else if (text.includes("\n")) {
            e.preventDefault();
            document.execCommand("insertHTML", false, legacyToHtml(text));
            emit();
        }
        // single-line plain text: let the browser insert it normally
    };

    const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
        const files = [...e.dataTransfer.files];
        if (!files.some((f) => f.type.startsWith("image/"))) return;
        e.preventDefault();
        // Put the caret where the image was dropped
        const doc = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null };
        const range = doc.caretRangeFromPoint?.(e.clientX, e.clientY);
        if (range) {
            const sel = document.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
        }
        void uploadAndInsert(files);
    };

    // Tab / Shift+Tab move between table cells
    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== "Tab") return;
        const sel = document.getSelection();
        const cell = (sel?.anchorNode instanceof Element ? sel.anchorNode : sel?.anchorNode?.parentElement)?.closest("td, th");
        if (!cell || !editorRef.current?.contains(cell)) return;
        const cells = [...(cell.closest("table")?.querySelectorAll("th, td") ?? [])];
        const next = cells[cells.indexOf(cell) + (e.shiftKey ? -1 : 1)];
        if (!next) return;
        e.preventDefault();
        const range = document.createRange();
        range.selectNodeContents(next);
        sel?.removeAllRanges();
        sel?.addRange(range);
    };

    // The parent holds the current HTML (typed, pasted or loaded e.g. from the AI)
    const html = contentForEditor(value);
    const words = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    const blockTag = String(formats.block || "");

    return (
        <div className="w-full space-y-3">
            {/* Write / Preview */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex rounded-full bg-muted p-1" role="tablist" aria-label="Editor mode">
                    {(["write", "preview"] as const).map((m) => (
                        <button
                            key={m}
                            type="button"
                            role="tab"
                            aria-selected={mode === m}
                            onClick={() => setMode(m)}
                            className={cn(
                                "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                                mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {m === "write" ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            {m === "write" ? "Write" : "Preview"}
                        </button>
                    ))}
                </div>
                <p className="text-xs text-muted-foreground">
                    {words} word{words !== 1 ? "s" : ""}
                    {words > 0 && <> · {readingMinutes(html)} min read</>}
                </p>
            </div>

            {mode === "preview" ? (
                <div className="rounded-2xl bg-card p-5 ring-1 ring-border sm:p-8">
                    <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">How students see it</p>
                    <TopicContentView content={html} empty="Nothing written yet." />
                </div>
            ) : (
                <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-border focus-within:ring-2 focus-within:ring-accent/50">
                    {/* Toolbar - scrolls sideways on small screens */}
                    <div className="flex items-center gap-0.5 overflow-x-auto border-b border-border px-2 py-1.5 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible">
                        <ToolButton label="Paragraph" active={blockTag === "p" || blockTag === "div" || blockTag === ""} onClick={() => block("p")}>
                            <Pilcrow className="h-4 w-4" />
                        </ToolButton>
                        <ToolButton label="Heading" active={blockTag === "h2"} onClick={() => block("h2")}>
                            <Heading2 className="h-4 w-4" />
                        </ToolButton>
                        <ToolButton label="Subheading" active={blockTag === "h3"} onClick={() => block("h3")}>
                            <Heading3 className="h-4 w-4" />
                        </ToolButton>
                        <Divider />
                        <ToolButton label="Bold" active={!!formats.bold} onClick={() => exec("bold")}>
                            <Bold className="h-4 w-4" />
                        </ToolButton>
                        <ToolButton label="Italic" active={!!formats.italic} onClick={() => exec("italic")}>
                            <Italic className="h-4 w-4" />
                        </ToolButton>
                        <ToolButton label="Underline" active={!!formats.underline} onClick={() => exec("underline")}>
                            <Underline className="h-4 w-4" />
                        </ToolButton>
                        <ToolButton label="Link" onClick={insertLink}>
                            <Link2 className="h-4 w-4" />
                        </ToolButton>
                        <Divider />
                        <ToolButton label="Bulleted list" active={!!formats.ul} onClick={() => exec("insertUnorderedList")}>
                            <List className="h-4 w-4" />
                        </ToolButton>
                        <ToolButton label="Numbered list" active={!!formats.ol} onClick={() => exec("insertOrderedList")}>
                            <ListOrdered className="h-4 w-4" />
                        </ToolButton>
                        <ToolButton label="Quote" active={blockTag === "blockquote"} onClick={() => block("blockquote")}>
                            <Quote className="h-4 w-4" />
                        </ToolButton>
                        <ToolButton label="Code block" active={blockTag === "pre"} onClick={() => block("pre")}>
                            <Code2 className="h-4 w-4" />
                        </ToolButton>
                        <Divider />
                        <ToolButton label="Key idea box" onClick={() => insertCallout("idea")}>
                            <Lightbulb className="h-4 w-4" />
                        </ToolButton>
                        <ToolButton label="Tip box" onClick={() => insertCallout("tip")}>
                            <CircleCheck className="h-4 w-4" />
                        </ToolButton>
                        <ToolButton label="Watch out box" onClick={() => insertCallout("warning")}>
                            <TriangleAlert className="h-4 w-4" />
                        </ToolButton>
                        <Divider />
                        <ToolButton label="Upload image" onClick={() => { saveSelection(); fileRef.current?.click(); }} disabled={uploading > 0}>
                            {uploading > 0 ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                        </ToolButton>
                        <ToolButton label="Image from link" onClick={insertImageUrl}>
                            <ImageIcon className="h-4 w-4" />
                        </ToolButton>
                        <ToolButton label="Video" active={showVideo} onClick={() => setShowVideo((v) => !v)}>
                            <Video className="h-4 w-4" />
                        </ToolButton>
                        <ToolButton label="Table" onClick={insertTable}>
                            <Table className="h-4 w-4" />
                        </ToolButton>
                        <ToolButton label="Divider line" onClick={() => insertBlock("<hr><p><br></p>")}>
                            <Minus className="h-4 w-4" />
                        </ToolButton>
                        <Divider />
                        <ToolButton label="Clear formatting" onClick={() => { exec("removeFormat"); exec("formatBlock", "p"); }}>
                            <RemoveFormatting className="h-4 w-4" />
                        </ToolButton>
                        <ToolButton label="Undo" onClick={() => exec("undo")}>
                            <Undo2 className="h-4 w-4" />
                        </ToolButton>
                        <ToolButton label="Redo" onClick={() => exec("redo")}>
                            <Redo2 className="h-4 w-4" />
                        </ToolButton>
                    </div>

                    {showVideo && (
                        <div className="flex flex-col gap-2 border-b border-border p-2 sm:flex-row">
                            <input
                                type="url"
                                value={videoUrl}
                                autoFocus
                                onChange={(e) => { setVideoUrl(e.target.value); setNotice(null); }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") { e.preventDefault(); insertVideo(); }
                                    if (e.key === "Escape") setShowVideo(false);
                                }}
                                placeholder="Paste a YouTube, Vimeo or video file link"
                                className="neo-inset min-h-10 flex-1 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/50"
                            />
                            <button
                                type="button"
                                onClick={insertVideo}
                                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                            >
                                <Video className="h-4 w-4" /> Insert video
                            </button>
                        </div>
                    )}

                    <div
                        ref={editorRef}
                        contentEditable
                        role="textbox"
                        aria-multiline="true"
                        aria-label="Lesson content"
                        data-placeholder={placeholder}
                        onInput={emit}
                        onFocus={onFocus}
                        onBlur={saveSelection}
                        onKeyUp={refreshFormats}
                        onMouseUp={refreshFormats}
                        onKeyDown={onKeyDown}
                        onPaste={onPaste}
                        onDrop={onDrop}
                        suppressContentEditableWarning
                        className="lesson-editor topic-content topic-article min-h-[320px] px-5 py-4 outline-none sm:px-8 sm:py-6"
                    />
                </div>
            )}

            <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                multiple
                className="hidden"
                onChange={(e) => {
                    const files = [...(e.target.files ?? [])];
                    e.target.value = "";
                    void uploadAndInsert(files);
                }}
            />

            {notice && (
                <p className={cn("text-sm", notice.kind === "error" ? "text-red-600" : "text-muted-foreground")} role="status">
                    {notice.text}
                </p>
            )}
            {mode === "write" && (
                <p className="text-xs text-muted-foreground">
                    Tip: paste from Word, Google Docs or a PDF and it&apos;s tidied to match the app. Paste or drag images straight in. Matrices like [[1, 2], [3, 4]] show as matrices for students.
                </p>
            )}
        </div>
    );
}
