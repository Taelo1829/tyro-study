"use client";

import React, { useEffect, useRef, useState } from "react";
import { Bold, Italic, Link2, List, Underline, Video } from "lucide-react";

type Props = {
    value: string;
    setHtml: (html: string) => void;
}

function getVideoEmbedHtml(rawUrl: string): string | null {
    const trimmed = rawUrl.trim();
    if (!trimmed) return null;

    let url: URL;
    try {
        url = new URL(trimmed);
    } catch {
        return null;
    }

    if (!["http:", "https:"].includes(url.protocol)) {
        return null;
    }

    const host = url.hostname.replace(/^www\./, "");
    const title = "Embedded topic video";
    let embedUrl = "";

    if (host === "youtube.com" || host === "m.youtube.com") {
        const id = url.searchParams.get("v") ?? url.pathname.split("/").filter(Boolean).at(-1);
        if (id) embedUrl = `https://www.youtube.com/embed/${encodeURIComponent(id)}?enablejsapi=1`;
    } else if (host === "youtu.be") {
        const id = url.pathname.split("/").filter(Boolean)[0];
        if (id) embedUrl = `https://www.youtube.com/embed/${encodeURIComponent(id)}?enablejsapi=1`;
    } else if (host === "vimeo.com" || host === "player.vimeo.com") {
        const id = url.pathname.split("/").filter(Boolean).at(-1);
        if (id) embedUrl = `https://player.vimeo.com/video/${encodeURIComponent(id)}`;
    }

    if (embedUrl) {
        return `<div class="topic-video-embed"><iframe src="${embedUrl}" title="${title}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`;
    }

    if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url.href)) {
        return `<div class="topic-video-embed"><video src="${url.href}" controls></video></div>`;
    }

    return null;
}

export default function NeumorphicEditor({ value, setHtml }: Props) {
    const editorRef = useRef<HTMLDivElement>(null);
    const [videoUrl, setVideoUrl] = useState("");
    const [videoError, setVideoError] = useState("");

    useEffect(() => {
        if (editorRef.current) {
            editorRef.current.innerHTML = value;
        }
    }, [value]);

    const bg = "#1A1D24";

    const updateHTML = () => {
        if (editorRef.current) {
            setHtml(editorRef.current.innerHTML);
        }
    };

    const exec = (command: string, value?: string) => {
        if (!editorRef.current) return;
        editorRef.current.focus();
        document.execCommand(command, false, value);
        updateHTML();
    };

    const insertLink = () => {
        const url = window.prompt("Paste the link URL");
        if (url?.trim()) {
            exec("createLink", url.trim());
        }
    };

    const insertVideo = () => {
        if (!editorRef.current) return;

        const embed = getVideoEmbedHtml(videoUrl);
        if (!embed) {
            setVideoError("Use a YouTube, Vimeo, MP4, WebM, or OGG URL.");
            return;
        }

        setVideoError("");
        editorRef.current.focus();
        document.execCommand("insertHTML", false, `${embed}<p><br></p>`);
        setVideoUrl("");
        updateHTML();
    };

    const neumorph =
        "shadow-[6px_6px_12px_#0f1115,_-6px_-6px_12px_#23272f]";

    const buttonStyle =
        `px-3 py-2 rounded-xl text-sm transition active:scale-95 ` + neumorph;

    return (
        <div
            className="flex items-center justify-center"
            style={{ backgroundColor: bg }}
        >
            <div className="w-full max-w-4xl space-y-4">
                <div
                    className={`p-3 rounded-2xl flex flex-wrap gap-2 ${neumorph}`}
                    style={{ backgroundColor: bg }}
                >
                    <button type="button" onClick={() => exec("bold")} className={buttonStyle} title="Bold">
                        <Bold className="h-4 w-4" />
                    </button>

                    <button type="button" onClick={() => exec("italic")} className={buttonStyle} title="Italic">
                        <Italic className="h-4 w-4" />
                    </button>

                    <button type="button" onClick={() => exec("underline")} className={buttonStyle} title="Underline">
                        <Underline className="h-4 w-4" />
                    </button>

                    <button
                        type="button"
                        onClick={() => exec("insertUnorderedList")}
                        className={buttonStyle}
                        title="Bulleted list"
                    >
                        <List className="h-4 w-4" />
                    </button>

                    <button
                        type="button"
                        onClick={insertLink}
                        className={buttonStyle}
                        title="Insert link"
                    >
                        <Link2 className="h-4 w-4" />
                    </button>

                    <select
                        onChange={(e) => exec("fontSize", e.target.value)}
                        className={buttonStyle}
                        style={{ backgroundColor: bg }}
                    >
                        <option value="3">Normal</option>
                        <option value="5">Large</option>
                        <option value="7">Extra</option>
                    </select>
                </div>

                <div className={`p-3 rounded-2xl ${neumorph}`} style={{ backgroundColor: bg }}>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                            type="url"
                            value={videoUrl}
                            onChange={(event) => {
                                setVideoUrl(event.target.value);
                                setVideoError("");
                            }}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    insertVideo();
                                }
                            }}
                            placeholder="Paste video URL"
                            className="min-h-10 flex-1 rounded-xl bg-transparent px-3 py-2 text-sm outline-none shadow-[inset_4px_4px_8px_#0f1115,inset_-4px_-4px_8px_#23272f]"
                        />
                        <button
                            type="button"
                            onClick={insertVideo}
                            className={`${buttonStyle} justify-center`}
                            title="Insert video"
                        >
                            <Video className="h-4 w-4" />
                            <span>Insert video</span>
                        </button>
                    </div>
                    {videoError && (
                        <p className="mt-2 text-xs text-red-600">{videoError}</p>
                    )}
                </div>

                <div
                    ref={editorRef}
                    contentEditable
                    onInput={updateHTML}
                    suppressContentEditableWarning
                    className="min-h-[250px] p-5 rounded-2xl outline-none"
                    style={{
                        backgroundColor: bg,
                        boxShadow:
                            "inset 6px 6px 12px #0f1115, inset -6px -6px 12px #23272f",
                    }}
                />
            </div>
        </div>
    );
}
