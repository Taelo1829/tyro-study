"use client";

import React, { useEffect, useRef, useState } from "react";

type Props = {
    value: string;
    setHtml: (html: string) => void;
}
export default function NeumorphicEditor({ value, setHtml }: Props) {
    const editorRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (editorRef.current) {
            editorRef.current.innerHTML = value;
        }
    }, [])
    const bg = "#e4e9f0";

    const exec = (command: string, value?: string) => {
        if (!editorRef.current) return;
        editorRef.current.focus();
        document.execCommand(command, false, value);
        updateHTML();
    };

    const updateHTML = () => {
        if (editorRef.current) {
            setHtml(editorRef.current.innerHTML);
        }
    };

    const neumorph =
        "shadow-[6px_6px_12px_rgba(163,177,198,0.6),_-6px_-6px_12px_rgba(255,255,255,0.9)]";

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
                    <button onClick={() => exec("bold")} className={buttonStyle}>
                        B
                    </button>

                    <button onClick={() => exec("italic")} className={buttonStyle}>
                        I
                    </button>

                    <button onClick={() => exec("underline")} className={buttonStyle}>
                        U
                    </button>
                    <button
                        onClick={() => exec("insertUnorderedList")}
                        className={buttonStyle}
                    >
                        • List
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
                <div
                    ref={editorRef}
                    contentEditable
                    onInput={updateHTML}
                    suppressContentEditableWarning
                    className={`min-h-[250px] p-5 rounded-2xl outline-none`}
                    style={{
                        backgroundColor: bg,
                        boxShadow:
                            "inset 6px 6px 12px rgba(163,177,198,0.5), inset -6px -6px 12px rgba(255,255,255,0.8)",
                    }}
                />
            </div>
        </div>
    );
}