import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/routemate/crypto";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { ok: false, message: "Sign in before loading Google Maps." },
      { status: 401 },
    );
  }

  const { data, error } = await supabase
    .from("routemate_user_settings")
    .select("google_maps_api_key_encrypted, google_maps_connected")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data?.google_maps_connected || !data.google_maps_api_key_encrypted) {
    return NextResponse.json(
      { ok: false, message: "Connect Google Maps in settings first." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    apiKey: decryptSecret(data.google_maps_api_key_encrypted),
  });
}
