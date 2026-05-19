type YouTubePlayer = {
    getCurrentTime: () => number
    seekTo: (seconds: number, allowSeekAhead: boolean) => void
    destroy: () => void
}

type YouTubePlayerEvent = {
    target: YouTubePlayer
    data?: number
}

type YouTubeApi = {
    Player: new (
        element: HTMLIFrameElement,
        options: {
            events: {
                onReady: (event: YouTubePlayerEvent) => void
                onStateChange: (event: YouTubePlayerEvent) => void
            }
        }
    ) => YouTubePlayer
}

export type { YouTubeApi }