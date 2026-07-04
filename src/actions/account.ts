"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { safeAction, type ActionResult } from "@/lib/action";

export async function updateMyName(name: string): Promise<ActionResult<null>> {
  return safeAction("Update name", async () => {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Name is required");

    // Mirror into Clerk (best-effort) so the auth profile matches everywhere.
    try {
      const client = await clerkClient();
      const [firstName, ...rest] = trimmed.split(/\s+/);
      await client.users.updateUser(userId, {
        firstName,
        lastName: rest.join(" "),
      });
    } catch {}

    await db.workspaceMember.updateMany({
      where: { userId },
      data: { name: trimmed },
    });
    revalidatePath("/account");
    return null;
  });
}

export async function updateMyAvatar(
  formData: FormData,
): Promise<ActionResult<{ imageUrl: string }>> {
  return safeAction("Update photo", async () => {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) throw new Error("No image selected");
    if (!file.type.startsWith("image/")) throw new Error("File must be an image");
    if (file.size > 8 * 1024 * 1024) throw new Error("Image must be under 8 MB");

    // Clerk hosts profile images at a stable URL, which is what the rest of
    // the app (sidebar, chat, mentions) already renders.
    const client = await clerkClient();
    const updated = await client.users.updateUserProfileImage(userId, { file });

    await db.workspaceMember.updateMany({
      where: { userId },
      data: { imageUrl: updated.imageUrl },
    });
    revalidatePath("/account");
    return { imageUrl: updated.imageUrl };
  });
}
