import OpenAI from "openai"

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured")
  }
  return new OpenAI({ apiKey })
}

/**
 * Ask the AI for a JSON object and parse it, retrying when the reply is
 * unusable. JSON mode sometimes gets stuck emitting blank lines until it runs
 * out of room, which leaves cut-off JSON ("Expected ',' or '}' … line 8093").
 * So: cap the reply length, and if it's cut off or doesn't parse, ask again
 * (asking for compact JSON) before giving up with a readable message.
 */
export async function chatJson<T>({
  system,
  user,
  temperature = 0.4,
  maxTokens = 8000,
  attempts = 3,
}: {
  system: string
  user: string
  temperature?: number
  maxTokens?: number
  attempts?: number
}): Promise<T> {
  const openai = getOpenAIClient()
  let lastProblem = ""
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const retrying = attempt > 1
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      // A little steadier on a retry
      temperature: retrying ? Math.max(0, temperature - 0.2) : temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: retrying
            ? `${system}\n\nReturn compact JSON on as few lines as possible, with no blank lines or padding, and make sure it is complete and valid.`
            : system,
        },
        { role: "user", content: user },
      ],
    })

    const choice = response.choices[0]
    const raw = (choice?.message?.content ?? "").replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim()
    if (!raw) {
      lastProblem = "empty reply"
      continue
    }
    if (choice?.finish_reason === "length") {
      lastProblem = "reply was cut off"
      continue
    }
    try {
      return JSON.parse(raw) as T
    } catch (err) {
      lastProblem = err instanceof Error ? err.message : "invalid JSON"
    }
  }
  console.warn("AI JSON failed after retries:", lastProblem)
  throw new Error("The AI's answer came back incomplete. Please try again.")
}
