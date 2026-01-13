import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"

export const runtime = "nodejs"

function requireEnv(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (user.user_role !== "ADMIN")
    return NextResponse.json({ message: "Forbidden" }, { status: 403 })

  const form = await req.formData()
  const file = form.get("file")

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "file is required" }, { status: 400 })
  }

  const cloudName = requireEnv("CLOUDINARY_CLOUD_NAME")
  const apiKey = requireEnv("CLOUDINARY_API_KEY")
  const apiSecret = requireEnv("CLOUDINARY_API_SECRET")

  // File -> ArrayBuffer
  const ab = await file.arrayBuffer()
  const buffer = Buffer.from(ab)

  // Cloudinary unsigned가 아니라 signed 업로드(서버에서 비밀키 사용)
  // Cloudinary REST: https://api.cloudinary.com/v1_1/{cloud_name}/auto/upload
  const timestamp = Math.floor(Date.now() / 1000)

  // 간단한 signature 생성 (Node crypto)
  const crypto = await import("crypto")
  const signatureBase = `timestamp=${timestamp}${apiSecret}`
  const signature = crypto.createHash("sha1").update(signatureBase).digest("hex")

  const body = new FormData()
  body.append("file", new Blob([buffer]), file.name)
  body.append("api_key", apiKey)
  body.append("timestamp", String(timestamp))
  body.append("signature", signature)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: "POST",
    body,
  })

  const data = await res.json()
  if (!res.ok) {
    return NextResponse.json({ message: "Upload failed", detail: data }, { status: 500 })
  }

  return NextResponse.json({
    url: data.secure_url,
    filename: file.name,
    resourceType: data.resource_type,
    format: data.format,
    bytes: data.bytes,
  })
}
