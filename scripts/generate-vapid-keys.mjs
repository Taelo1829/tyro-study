import crypto from "node:crypto"

function base64Url(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

const ecdh = crypto.createECDH("prime256v1")
ecdh.generateKeys()

console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${base64Url(ecdh.getPublicKey())}`)
console.log(`VAPID_PRIVATE_KEY=${base64Url(ecdh.getPrivateKey())}`)
console.log("VAPID_SUBJECT=mailto:admin@tyro-study.com")
