"use server";

import { getRecentActivity } from "@/lib/activity";

export async function fetchRecentActivity(limit = 50) {
  return getRecentActivity(limit);
}
