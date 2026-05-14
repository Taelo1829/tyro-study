"use client"

import * as React from "react"
import type { ToastActionElement, ToastProps } from "@/components/ui/toast"

const TOAST_LIMIT = 5
const TOAST_REMOVE_DELAY = 5000 // 5 seconds
const TOAST_REMOVE_DELAY_ERROR = 10000 // 10 seconds for errors
const TOAST_REMOVE_DELAY_SUCCESS = 3000 // 3 seconds for success

type ToasterToast = ToastProps & {
    id: string
    title?: string
    description?: React.ReactNode
    action?: ToastActionElement
    duration?: number
}

const actionTypes = {
    ADD_TOAST: "ADD_TOAST",
    UPDATE_TOAST: "UPDATE_TOAST",
    DISMISS_TOAST: "DISMISS_TOAST",
    REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function genId() {
    count = (count + 1) % Number.MAX_VALUE
    return count.toString()
}

type ActionType = typeof actionTypes

type Action =
    | {
        type: ActionType["ADD_TOAST"]
        toast: ToasterToast
    }
    | {
        type: ActionType["UPDATE_TOAST"]
        toast: Partial<ToasterToast>
    }
    | {
        type: ActionType["DISMISS_TOAST"]
        toastId?: ToasterToast["id"]
    }
    | {
        type: ActionType["REMOVE_TOAST"]
        toastId?: ToasterToast["id"]
    }

interface State {
    toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string, duration: number = TOAST_REMOVE_DELAY) => {
    if (toastTimeouts.has(toastId)) {
        return
    }

    const timeout = setTimeout(() => {
        toastTimeouts.delete(toastId)
        dispatch({
            type: "REMOVE_TOAST",
            toastId: toastId,
        })
    }, duration)

    toastTimeouts.set(toastId, timeout)
}

export const reducer = (state: State, action: Action): State => {
    switch (action.type) {
        case "ADD_TOAST":
            return {
                ...state,
                toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
            }

        case "UPDATE_TOAST":
            return {
                ...state,
                toasts: state.toasts.map((t) =>
                    t.id === action.toast.id ? { ...t, ...action.toast } : t
                ),
            }

        case "DISMISS_TOAST": {
            const { toastId } = action

            // ! Side effects ! - This could be extracted into a dismissToast() action,
            // but I'll keep it here for simplicity
            if (toastId) {
                addToRemoveQueue(toastId)
            } else {
                state.toasts.forEach((toast) => {
                    addToRemoveQueue(toast.id)
                })
            }

            return {
                ...state,
                toasts: state.toasts.map((t) =>
                    t.id === toastId || toastId === undefined
                        ? {
                            ...t,
                            open: false,
                        }
                        : t
                ),
            }
        }
        case "REMOVE_TOAST":
            if (action.toastId === undefined) {
                return {
                    ...state,
                    toasts: [],
                }
            }
            return {
                ...state,
                toasts: state.toasts.filter((t) => t.id !== action.toastId),
            }
    }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
    memoryState = reducer(memoryState, action)
    listeners.forEach((listener) => {
        listener(memoryState)
    })
}

export interface ToastOptions {
    variant?: "default" | "destructive" | "success" | "warning" | "info"
    duration?: number
    title?: React.ReactNode
    description?: React.ReactNode
    action?: ToastActionElement
}

function toast({ variant = "default", duration, ...props }: ToastOptions) {
    const id = genId()

    const update = (props: ToasterToast) =>
        dispatch({
            type: "UPDATE_TOAST",
            toast: { ...props, id },
        })
    const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

    // Set duration based on variant if not specified
    let toastDuration = duration
    if (!toastDuration) {
        switch (variant) {
            case "destructive":
                toastDuration = TOAST_REMOVE_DELAY_ERROR
                break
            case "success":
                toastDuration = TOAST_REMOVE_DELAY_SUCCESS
                break
            case "warning":
                toastDuration = TOAST_REMOVE_DELAY
                break
            case "info":
                toastDuration = TOAST_REMOVE_DELAY
                break
            default:
                toastDuration = TOAST_REMOVE_DELAY
        }
    }

    dispatch({
        type: "ADD_TOAST",
        toast: {
            ...props,
            id,
            variant,
            open: true,
            duration: toastDuration,
            title: typeof props.title === "string" ? props.title : undefined,
            onOpenChange: (open) => {
                if (!open) dismiss()
            },
        },
    })

    // Auto-dismiss after duration
    setTimeout(() => {
        dismiss()
    }, toastDuration)

    return {
        id: id,
        dismiss,
        update,
    }
}

// Helper functions for common toast types
toast.success = (title: string, description?: string, options?: Omit<ToastOptions, "title" | "description" | "variant">) => {
    return toast({
        title,
        description,
        variant: "success",
        ...options,
    })
}

toast.error = (title: string, description?: string, options?: Omit<ToastOptions, "title" | "description" | "variant">) => {
    return toast({
        title,
        description,
        variant: "destructive",
        ...options,
    })
}

toast.warning = (title: string, description?: string, options?: Omit<ToastOptions, "title" | "description" | "variant">) => {
    return toast({
        title,
        description,
        variant: "warning",
        ...options,
    })
}

toast.info = (title: string, description?: string, options?: Omit<ToastOptions, "title" | "description" | "variant">) => {
    return toast({
        title,
        description,
        variant: "info",
        ...options,
    })
}

toast.loading = (title: string, description?: string, options?: Omit<ToastOptions, "title" | "description" | "variant">) => {
    const id = genId()

    dispatch({
        type: "ADD_TOAST",
        toast: {
            id,
            title,
            description,
            variant: "default",
            duration: Infinity, // Don't auto-dismiss
            open: true,
            onOpenChange: (open) => {
                if (!open) dispatch({ type: "DISMISS_TOAST", toastId: id })
            },
            ...options,
        },
    })

    return {
        id,
        dismiss: () => dispatch({ type: "DISMISS_TOAST", toastId: id }),
        update: (props: Partial<Omit<ToasterToast, "id">>) =>
            dispatch({ type: "UPDATE_TOAST", toast: { id, ...props } }),
        success: (newTitle?: string, newDescription?: string) => {
            dispatch({ type: "DISMISS_TOAST", toastId: id })
            toast.success(newTitle || title, newDescription || description)
        },
        error: (newTitle?: string, newDescription?: string) => {
            dispatch({ type: "DISMISS_TOAST", toastId: id })
            toast.error(newTitle || title, newDescription || description)
        },
    }
}

// Custom hook for using toast
export function useToast() {
    const [state, setState] = React.useState<State>(memoryState)

    React.useEffect(() => {
        listeners.push(setState)
        return () => {
            const index = listeners.indexOf(setState)
            if (index > -1) {
                listeners.splice(index, 1)
            }
        }
    }, [state])

    return {
        ...state,
        toast,
        dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
    }
}

// Export individual functions for convenience
export { toast }

// Type exports
export type { ToasterToast }