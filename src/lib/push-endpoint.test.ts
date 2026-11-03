import { describe, expect, it } from "vitest"
import { isAllowedPushEndpoint } from "./push-endpoint"

describe("push endpoint allowlist (SSRF guard)", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc:APA91b",
    "https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
    "https://web.push.apple.com/QGd1",
    "https://wns2-par02p.notify.windows.com/w/?token=x",
  ])("accepts %s", url => {
    expect(isAllowedPushEndpoint(url)).toBe(true)
  })

  it.each([
    "http://fcm.googleapis.com/fcm/send/abc", // not https
    "https://169.254.169.254/latest/meta-data", // cloud metadata
    "https://localhost/push",
    "https://internal.example.com/push",
    "https://fcm.googleapis.com.evil.example/x", // look-alike host
    "https://evilfcm.googleapis.com.attacker.io/x",
    "https://user:pw@fcm.googleapis.com/x", // credentials in URL
    "https://fcm.googleapis.com:8443/x", // odd port
    "not a url",
    "",
    42,
    null,
  ])("rejects %s", url => {
    expect(isAllowedPushEndpoint(url)).toBe(false)
  })
})
