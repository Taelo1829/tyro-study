import { YouTubeApi } from "./types";

declare global {
    interface Window {
        YT?: YouTubeApi
        onYouTubeIframeAPIReady?: () => void
    }
}

let youtubeApiPromise: Promise<YouTubeApi> | null = null

function loadYouTubeApi() {
    if (window?.YT?.Player) {
        return Promise.resolve(window.YT)
    }

    youtubeApiPromise ??= new Promise<YouTubeApi>((resolve) => {
        const existingCallback = window.onYouTubeIframeAPIReady
        window.onYouTubeIframeAPIReady = () => {
            existingCallback?.()
            if (window.YT) resolve(window.YT)
        }

        if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
            const script = document.createElement("script")
            script.src = "https://www.youtube.com/iframe_api"
            document.body.appendChild(script)
        }
    })

    return youtubeApiPromise
}
export { loadYouTubeApi }