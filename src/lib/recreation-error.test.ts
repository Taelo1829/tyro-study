import { expect, it } from "vitest"
import { recreationFailure } from "./recreation-error"
it("identifies missing columns from Prisma and raw database errors", () => {
 for (const error of [{ code: "P2022" }, { code: "P2010", meta: { code: "42703" } }]) {
  expect(recreationFailure(error, "save")).toMatchObject({ status: 503 })
  expect(recreationFailure(error, "save").error).toContain("prisma migrate deploy")
 }
})
it("does not expose raw database details", () => {
 const result = recreationFailure(new Error("password=secret private SQL"), "save")
 expect(result.error).not.toContain("secret")
 expect(result.error).toContain("retry Save")
})
it("distinguishes generation failures from saving failures", () => {
 expect(recreationFailure({ status: 429 }, "draft").error).toContain("usage limit")
 expect(recreationFailure(new Error("The generated response was incomplete"), "draft").status).toBe(502)
})
