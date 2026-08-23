import { NextResponse } from "next/server";
import { databaseUnavailable } from "@/lib/http";
import { denyIfGuest } from "@/lib/session";
import { loadDashboardStats } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const preferredRegion = ["fra1"];

export async function GET() {
  const denied = await denyIfGuest();
  if (denied) return denied;
  try {
    const data = await loadDashboardStats();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, max-age=5" },
    });
  } catch (err) {
    return databaseUnavailable(err);
  }
}
