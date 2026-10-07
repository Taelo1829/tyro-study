import crypto from "crypto"
import { prisma } from "@/lib/prisma"

const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:admin@tyro-study.com"
// Either name works (.env.local uses VAPID_PUBLIC_KEY)
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY

interface StoredPushSubscription {
  id: string
  endpoint: string
}

interface StoredPushSubscriptionWithKeys extends StoredPushSubscription {
  p256dh: string
  auth: string
}

/** What the service worker (public/sw.js) shows */
export interface PushMessage {
  title: string
  body: string
  /** Page to open when the notification is tapped */
  url?: string
  /** Same tag = replaces the earlier notification instead of stacking */
  tag?: string
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
      TTL: "86400",
      Urgency: "high",
      "Content-Length": "0",
    },
  })

  if (res.status === 404 || res.status === 410) {
    await prisma.pushSubscription.delete({ where: { id: subscription.id } })
  }
}

/**
 * Encrypt a push message for one browser (RFC 8291, "aes128gcm"), which is
 * what lets a notification carry its own text. Browsers reject unencrypted
 * payloads, so this is required for anything beyond an empty "ping".
 */
export function encryptPushPayload(payload: string, p256dh: string, auth: string): Buffer {
  const uaPublic = base64UrlToBuffer(p256dh)
  const authSecret = base64UrlToBuffer(auth)

  // A fresh key pair and salt for every message
  const ecdh = crypto.createECDH("prime256v1")
  const asPublic = ecdh.generateKeys()
  const sharedSecret = ecdh.computeSecret(uaPublic)
  const salt = crypto.randomBytes(16)

  const hmac = (key: Buffer, data: Buffer) => crypto.createHmac("sha256", key).update(data).digest()

  // IKM = HKDF(auth, ecdh_secret, "WebPush: info" || 0x00 || ua_public || as_public, 32)
  const prkKey = hmac(authSecret, sharedSecret)
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic, Buffer.from([1])])
  const ikm = hmac(prkKey, keyInfo)

  // Content-encryption key and nonce
  const prk = hmac(salt, ikm)
  const cek = hmac(prk, Buffer.concat([Buffer.from("Content-Encoding: aes128gcm\0"), Buffer.from([1])])).subarray(0, 16)
  const nonce = hmac(prk, Buffer.concat([Buffer.from("Content-Encoding: nonce\0"), Buffer.from([1])])).subarray(0, 12)

  // One record: the text, then the 0x02 "last record" delimiter
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce)
  const encrypted = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload, "utf8"), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()])

  // Header: salt (16) | record size (4) | key length (1) | sender public key (65)
  const recordSize = Buffer.alloc(4)
  recordSize.writeUInt32BE(4096, 0)
  return Buffer.concat([salt, recordSize, Buffer.from([asPublic.length]), asPublic, encrypted])
}

/**
 * Send a notification with text to one browser. Subscriptions the browser
 * has dropped (404/410) are deleted. Returns true when the push service
 * accepted it.
 */
export async function sendPushMessage(subscription: StoredPushSubscriptionWithKeys, message: PushMessage): Promise<boolean> {
  const authorization = getVapidAuthorization(subscription.endpoint)
  if (!authorization) return false

  const body = encryptPushPayload(JSON.stringify(message), subscription.p256dh, subscription.auth)
  const res = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: authorization,
      TTL: "3600",
      Urgency: "high",
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      "Content-Length": String(body.length),
    },
    body: new Uint8Array(body),
  })

  if (res.status === 404 || res.status === 410) {
    await prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => {})
    return false
  }
  if (!res.ok) {
    console.warn("Push service refused a message:", res.status, await res.text().catch(() => ""))
    return false
  }
  return true
}

/** Send a notification to every browser/device the user turned notifications on for */
export async function sendPushToUser(userId: string, message: PushMessage): Promise<number> {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  })
  const results = await Promise.allSettled(subscriptions.map(s => sendPushMessage(s, message)))
  return results.filter(r => r.status === "fulfilled" && r.value).length
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
