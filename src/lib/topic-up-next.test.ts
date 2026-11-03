import { beforeEach, describe, expect, it, vi } from "vitest"
import { getTopicUpNext, type TopicUpNext } from "./topic-up-next"
import { prisma } from "@/lib/prisma"
import { getModuleLocks } from "@/lib/topic-locks"

vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: vi.fn() } }))
vi.mock("@/lib/topic-locks", () => ({ getModuleLocks: vi.fn() }))

const topic = (id: string, answered = 0, totalQuestions = 10, moduleId = "module-1"): TopicUpNext => ({
  id, title: id, moduleId, moduleTitle: moduleId, chapterTitle: "Chapter", answered, totalQuestions,
})
const ofLevel = () => true

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getModuleLocks).mockResolvedValue(new Map([
    ["locked", { previousTopic: { id: "previous", title: "Previous" } }],
  ]))
})

describe("getTopicUpNext", () => {
  it("skips a locked in-progress topic and resumes an open topic", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([topic("locked", 2), topic("open", 3)])
    expect((await getTopicUpNext("student", ofLevel))?.id).toBe("open")
  })

  it("skips a locked unstarted topic", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([topic("locked"), topic("open")])
    expect((await getTopicUpNext("student", ofLevel))?.id).toBe("open")
  })

  it("never falls back to locked topics, including topics without questions", async () => {
    for (const candidate of [topic("locked", 10), topic("locked", 0, 0)]) {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([candidate])
      expect(await getTopicUpNext("student", ofLevel)).toBeNull()
    }
  })

  it("allows a topic once the shared prerequisite rules unlock it", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([topic("locked", 2)])
    vi.mocked(getModuleLocks).mockResolvedValue(new Map())
    expect((await getTopicUpNext("student", ofLevel))?.id).toBe("locked")
  })

  it("keeps level filtering and checks each eligible module only once", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      topic("wrong-level", 1, 10, "other"), topic("locked", 1), topic("open"),
    ])
    expect((await getTopicUpNext("student", id => id === "module-1"))?.id).toBe("open")
    expect(getModuleLocks).toHaveBeenCalledExactlyOnceWith("student", "module-1")
  })

  it("returns null when there are no enrolled topics", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([])
    expect(await getTopicUpNext("student", ofLevel)).toBeNull()
    expect(getModuleLocks).not.toHaveBeenCalled()
  })
})
