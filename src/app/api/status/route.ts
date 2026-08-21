import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { describeStatus } from "@/lib/evaluate";
import { listDevices, recentBeats, recentNights } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const [status, beats, nights, devices] = await Promise.all([
    describeStatus(user),
    recentBeats(user.id, 30),
    recentNights(user.id, 30),
    listDevices(user.id),
  ]);

  return NextResponse.json({
    config: user,
    now: Date.now(),
    window: status.window,
    lastBeat: status.beat,
    tonight: status.night,
    decision: status.decision,
    beats,
    nights,
    devices,
    homeSsidRegistered: !!user.homeSsidHash,
    homeIpRegistered: !!user.homeIpHash,
  });
}
