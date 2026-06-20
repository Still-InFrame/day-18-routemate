import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/routemate/crypto";
import { testGoogleRoutesKey } from "@/lib/routemate/google";

export async function POST(request: Request) {
  const { apiKey } = (await request.json()) as { apiKey?: string };
  const trimmed = apiKey?.trim() ?? "";

  if (trimmed.length < 20) {
    return NextResponse.json(
      { ok: false, message: "That API key looks too short." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { ok: false, message: "Sign in before connecting Google Maps." },
      { status: 401 },
    );
  }

  try {
    await testGoogleRoutesKey(trimmed);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Could not validate that Google API key.",
      },
      { status: 400 },
    );
  }

  try {
    const { error } = await supabase.from("routemate_user_settings").upsert({
      user_id: user.id,
      google_maps_api_key_encrypted: encryptSecret(trimmed),
      google_maps_key_last4: trimmed.slice(-4),
      google_maps_connected: true,
      google_maps_validated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "RouteMate could not store that key.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, message: "Google Maps is connected." });
}
