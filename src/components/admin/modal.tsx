'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModalProps {
    open: boolean
    onClose: () => void
    children: React.ReactNode
    /** 'sm' | 'md' | 'lg' | 'xl' | 'full' — default 'md' */
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
    /** Prevent closing when clicking the backdrop */
    persistent?: boolean
}

interface ModalHeaderProps {
    children: React.ReactNode
    onClose?: () => void
    className?: string
}

interface ModalBodyProps {
    children: React.ReactNode
    className?: string
    /** Remove default padding */
    noPadding?: boolean
}

interface ModalFooterProps {
    children: React.ReactNode
    className?: string
    /** 'start' | 'center' | 'end' | 'between' — default 'end' */
    align?: 'start' | 'center' | 'end' | 'between'
}

// ─── Size map ─────────────────────────────────────────────────────────────────

const SIZE = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[calc(100vw-2rem)] h-[calc(100vh-2rem)]',
}

// ─── Modal (root) ─────────────────────────────────────────────────────────────

export function Modal({ open, onClose, children, size = 'md', persistent = false }: ModalProps) {
    const overlayRef = useRef<HTMLDivElement>(null)

    // Close on Escape
    useEffect(() => {
        if (!open) return
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape' && !persistent) onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, onClose, persistent])

    // Lock body scroll
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => { document.body.style.overflow = '' }
    }, [open])

    if (!open) return null

    return (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={e => {
                if (!persistent && e.target === overlayRef.current) onClose()
            }}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150" />

            {/* Panel */}
            <div
                role="dialog"
                aria-modal="true"
                className={cn(
                    'relative z-10 w-full flex flex-col',
                    'bg-card border border-border rounded-2xl shadow-2xl',
                    'animate-in fade-in zoom-in-95 duration-200',
                    SIZE[size],
                    size === 'full' && 'overflow-hidden',
                )}
            >
                {children}
            </div>
        </div>
    )
}

// ─── ModalHeader ──────────────────────────────────────────────────────────────

export function ModalHeader({ children, onClose, className }: ModalHeaderProps) {
    return (
        <div className={cn(
            'flex items-start justify-between gap-4',
            'px-6 py-5 border-b border-border shrink-0',
            className,
        )}>
            <div className="flex-1 min-w-0">
                {children}
            </div>
            {onClose && (
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0 -mt-0.5 -mr-1"
                    aria-label="Close modal"
                >
                    <X className="w-4 h-4" />
                </button>
            )}
        </div>
    )
}

// ─── ModalBody ────────────────────────────────────────────────────────────────

export function ModalBody({ children, className, noPadding = false }: ModalBodyProps) {
    return (
        <div className={cn(
            'flex-1 overflow-y-auto',
            !noPadding && 'px-6 py-5',
            className,
        )}>
            {children}
        </div>
    )
}

// ─── ModalFooter ──────────────────────────────────────────────────────────────

const ALIGN = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
}

export function ModalFooter({ children, className, align = 'end' }: ModalFooterProps) {
    return (
        <div className={cn(
            'flex items-center gap-3 flex-wrap',
            'px-6 py-4 border-t border-border shrink-0',
            ALIGN[align],
            className,
        )}>
            {children}
        </div>
    )
}

// ─── Convenience re-export ────────────────────────────────────────────────────

Modal.Header = ModalHeader
Modal.Body = ModalBody
Modal.Footer = ModalFooter