import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { isCloudinaryConfigured, uploadImage } from "@/lib/cloudinary";

const MAX_SIZE_BYTES = 500 * 1024;

export async function POST(request: Request) {
  const admin = await requireAdmin("ADMIN");
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      { error: "Logo uploads aren't available right now — paste a URL instead." },
      { status: 503 }
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are allowed." }, { status: 400 });
  }
  // Client already checks this before uploading, but never trust that alone.
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Logo must be 500KB or smaller." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadImage(buffer, file.name);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("Logo upload failed:", err);
    return NextResponse.json({ error: "Couldn't upload that logo. Please try again." }, { status: 502 });
  }
}
