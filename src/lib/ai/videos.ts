import { chatJson } from "@/lib/ai/openai"
import { UNISA_CONTEXT, htmlToText, moduleLines } from "@/lib/ai/unisa"
import { prisma } from "@/lib/prisma"

/**
 * Find a YouTube video for a topic:
 * 1. The AI reads the module, chapter and topic (and the lesson, if there is
 *    one) and describes the ideal video, plus a YouTube search for it.
 * 2. The YouTube Data API returns embeddable videos for that search.
 * 3. The AI picks the one that best matches the description (or none).
 *
 * Needs YOUTUBE_API_KEY. Quota: each search costs 100 units of YouTube's free
 * 10,000 a day, so about 100 topics a day.
 */

export interface VideoCandidate {
  id: string
  url: string
  title: string
  channel: string
  description: string
  thumbnail: string
  /** Length in seconds */
  seconds: number
  views: number
  publishedAt: string
}

export interface VideoSuggestion {
  /** What the ideal video covers (written by the AI) */
  description: string
  query: string
  /** The AI's pick, or null when nothing found is a good match */
  video: VideoCandidate | null
  reason: string
  /** Other videos the search found, best first */
  alternatives: VideoCandidate[]
}

const MIN_SECONDS = 3 * 60
const MAX_SECONDS = 75 * 60

/** "PT1H2M10S" → 3730 */
function isoSeconds(value: string | undefined) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value ?? "")
  if (!m) return 0
  return (+(m[1] ?? 0)) * 86400 + (+(m[2] ?? 0)) * 3600 + (+(m[3] ?? 0)) * 60 + +(m[4] ?? 0)
}

function youtubeKey() {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) throw new Error("YOUTUBE_API_KEY is not configured")
  return key
}

async function youtube<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`)
  for (const [k, v] of Object.entries({ ...params, key: youtubeKey() })) url.searchParams.set(k, v)
  const res = await fetch(url)
  const body = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; errors?: { reason?: string }[] } }
  if (!res.ok) {
    const reason = body.error?.errors?.[0]?.reason
    if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
      throw new Error("YouTube's daily search limit has been reached. Try again tomorrow.")
    }
    throw new Error(`YouTube search failed: ${body.error?.message ?? res.status}`)
  }
  return body
}

/** Embeddable, public videos for a search, 3 to 75 minutes long, in YouTube's order */
export async function searchYouTube(query: string, max = 10): Promise<VideoCandidate[]> {
  const search = await youtube<{ items?: { id?: { videoId?: string } }[] }>("search", {
    part: "id",
    type: "video",
    q: query,
    maxResults: String(max),
    videoEmbeddable: "true",
    safeSearch: "strict",
    relevanceLanguage: "en",
  })
  const ids = (search.items ?? []).map(i => i.id?.videoId).filter((id): id is string => !!id)
  if (ids.length === 0) return []

  // Details cost 1 unit: length, views, and whether it's really public and embeddable
  const details = await youtube<{
    items?: {
      id: string
      snippet?: { title?: string; channelTitle?: string; description?: string; publishedAt?: string; thumbnails?: Record<string, { url?: string }> }
      contentDetails?: { duration?: string }
      statistics?: { viewCount?: string }
      status?: { embeddable?: boolean; privacyStatus?: string }
    }[]
  }>("videos", { part: "snippet,contentDetails,statistics,status", id: ids.join(",") })

  const byId = new Map((details.items ?? []).map(v => [v.id, v]))
  return ids
    .map(id => byId.get(id))
    .filter(v => !!v && v.status?.embeddable !== false && v.status?.privacyStatus === "public")
    .map(v => ({
      id: v!.id,
      url: `https://www.youtube.com/watch?v=${v!.id}`,
      title: v!.snippet?.title ?? "",
      channel: v!.snippet?.channelTitle ?? "",
      description: (v!.snippet?.description ?? "").slice(0, 300),
      thumbnail: v!.snippet?.thumbnails?.medium?.url ?? v!.snippet?.thumbnails?.default?.url ?? `https://i.ytimg.com/vi/${v!.id}/mqdefault.jpg`,
      seconds: isoSeconds(v!.contentDetails?.duration),
      views: Number(v!.statistics?.viewCount ?? 0),
      publishedAt: v!.snippet?.publishedAt ?? "",
    }))
    .filter(v => v.seconds >= MIN_SECONDS && v.seconds <= MAX_SECONDS)
}

function askJson<T>(system: string, user: string): Promise<T> {
  return chatJson<T>({ system, user, temperature: 0.2, maxTokens: 1000 })
}

const DESCRIBE_PROMPT = `You choose a YouTube video to go with one topic of a UNISA module, for students who study on their own.

${UNISA_CONTEXT}

Describe the ideal video for THIS topic: what it should explain and show, the level, and what it should not be (e.g. not a different topic with a similar name, not a whole-course recording). Then write ONE YouTube search for it: specific to the subject (include the subject area, e.g. "linear algebra", "C++", "accounting"), 3-8 words, no module code, no "UNISA".

Respond with JSON only: { "description": "2-4 sentences", "query": "the search" }`

const PICK_PROMPT = `You pick the best YouTube video for one topic of a UNISA module.

Choose the video that best matches the description: right subject and topic, right level (first-year videos for a first-year module), a clear lesson-style explanation (a lecture, tutorial or worked examples), in English. Prefer clear teaching channels and well-watched videos; avoid clickbait, music, reactions, shorts, course trailers and videos about a different subject that shares a word.
If none of them is a good match, choose none.

Respond with JSON only: { "pick": <the video number, or 0 for none>, "reason": "one sentence", "ranking": [<other suitable video numbers, best first>] }`

/** Find a video for this topic (nothing is saved) */
export async function suggestTopicVideo(
  topicId: string,
  { exclude = [] as string[], tried = [] as string[] } = {}
): Promise<VideoSuggestion> {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: {
      title: true,
      content: true,
      chapter: {
        select: {
          id: true,
          title: true,
          topics: { orderBy: { order: "asc" }, select: { id: true, title: true } },
          module: { select: { title: true, description: true, chapters: { orderBy: { order: "asc" }, select: { id: true } } } },
        },
      },
    },
  })
  if (!topic) throw new Error("Topic not found")

  const mod = topic.chapter.module
  const chapterNo = mod.chapters.findIndex(c => c.id === topic.chapter.id) + 1
  const lesson = htmlToText(topic.content).slice(0, 4000)
  const header = [
    ...moduleLines(mod),
    `Chapter ${chapterNo}: ${topic.chapter.title}`,
    `Topic: ${topic.title}`,
    `Other topics in this chapter: ${topic.chapter.topics.filter(t => t.title !== topic.title).map(t => t.title).join("; ") || "none"}`,
    lesson ? `\nThe topic's lesson (start):\n${lesson}` : "",
  ].join("\n")

  const retry = tried.length
    ? `\n\nSearches already tried (the admin wants different videos): ${tried.map(q => `"${q}"`).join(", ")}. Write a DIFFERENT search for the same topic (other wording, or a narrower or broader angle).`
    : ""
  const plan = await askJson<{ description?: string; query?: string }>(DESCRIBE_PROMPT, header + retry)
  const description = String(plan.description ?? "").trim()
  const query = String(plan.query ?? topic.title).trim().slice(0, 120) || topic.title

  const found = (await searchYouTube(query)).filter(v => !exclude.includes(v.id))
  if (found.length === 0) return { description, query, video: null, reason: "YouTube found no suitable videos for this topic.", alternatives: [] }

  const list = found
    .map((v, i) => `${i + 1}. "${v.title}" by ${v.channel}, ${Math.round(v.seconds / 60)} min, ${v.views.toLocaleString("en")} views. ${v.description.replace(/\s+/g, " ").slice(0, 200)}`)
    .join("\n")
  const choice = await askJson<{ pick?: unknown; reason?: unknown; ranking?: unknown }>(
    PICK_PROMPT,
    `${header}\n\nIdeal video: ${description}\n\nVideos:\n${list}`
  )
  const pick = Number(choice.pick)
  const video = Number.isInteger(pick) && pick >= 1 && pick <= found.length ? found[pick - 1] : null
  const ranked = (Array.isArray(choice.ranking) ? choice.ranking : [])
    .map(n => found[Number(n) - 1])
    .filter((v): v is VideoCandidate => !!v && v.id !== video?.id)
  const rest = found.filter(v => v.id !== video?.id && !ranked.includes(v))

  return {
    description,
    query,
    video,
    reason: String(choice.reason ?? "").trim(),
    alternatives: [...ranked, ...rest].slice(0, 5),
  }
}

/** The YouTube ids already embedded in a lesson */
export function lessonVideoIds(html: string | null | undefined): string[] {
  return [...(html ?? "").matchAll(/youtube\.com\/embed\/([\w-]{6,})/g)].map(m => m[1])
}
