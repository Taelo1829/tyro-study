import { AsyncLocalStorage } from "node:async_hooks"

// Set only inside the trusted worker, never from request headers or input JSON.
export const generationPrincipal = new AsyncLocalStorage<string>()
