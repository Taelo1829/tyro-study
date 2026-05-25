import crypto from "crypto"
import { prisma } from "@/lib/prisma"

const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:admin@tyro-study.com"
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY

interface StoredPushSubscription {
  id: string
  endpoint: string
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

function base64UrlToBuffer(value: string) {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64")
}

function derToJose(signature: Buffer) {
  let offset = 3
  const rLength = signature[offset++]
  let r = signature.subarray(offset, offset + rLength)
  offset += rLength + 1
  const sLength = signature[offset++]
  let s = signature.subarray(offset, offset + sLength)

  if (r.length > 32) r = r.subarray(r.length - 32)
  if (s.length > 32) s = s.subarray(s.length - 32)

  return Buffer.concat([
    Buffer.concat([Buffer.alloc(32 - r.length), r]),
    Buffer.concat([Buffer.alloc(32 - s.length), s]),
  ])
}

function getVapidPrivateKey() {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return null
  }

  const publicKey = base64UrlToBuffer(VAPID_PUBLIC_KEY)
  const privateKey = base64UrlToBuffer(VAPID_PRIVATE_KEY)

  if (publicKey.length !== 65 || privateKey.length !== 32) {
    return null
  }

  return crypto.createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x: base64Url(publicKey.subarray(1, 33)),
      y: base64Url(publicKey.subarray(33, 65)),
      d: base64Url(privateKey),
    },
    format: "jwk",
  })
}

function getVapidAuthorization(endpoint: string) {
  const privateKey = getVapidPrivateKey()
  if (!privateKey || !VAPID_PUBLIC_KEY) return null

  const aud = new URL(endpoint).origin
  const header = base64Url(JSON.stringify({ typ: "JWT", alg: "ES256" }))
  const payload = base64Url(
    JSON.stringify({
      aud,
      exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
      sub: VAPID_SUBJECT,
    })
  )

  const token = `${header}.${payload}`
  const signature = derToJose(crypto.sign("sha256", Buffer.from(token), privateKey))

  return `vapid t=${token}.${base64Url(signature)}, k=${VAPID_PUBLIC_KEY}`
}

export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY ?? null
}

export async function sendPushNotification(subscription: StoredPushSubscription) {
  const authorization = getVapidAuthorization(subscription.endpoint)
  if (!authorization) return

  const res = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: authorization,
      TTL: "60",
      "Content-Length": "0",
    },
  })

  if (res.status === 404 || res.status === 410) {
    await prisma.pushSubscription.delete({ where: { id: subscription.id } })
  }
}

export async function sendChatPushNotifications(userId: string) {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true },
  })

  await Promise.allSettled(
    subscriptions.map((subscription) => sendPushNotification(subscription))
  )
}
