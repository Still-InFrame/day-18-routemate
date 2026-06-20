"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/routemate/crypto";
import {
  buildGoogleMapsUrl,
  computeRouteMetrics,
} from "@/lib/routemate/google";
import type {
  GoogleConnectionStatus,
  RouteInput,
  RouteWithStops,
  SavedRoute,
  SavedStop,
} from "@/lib/routemate/types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) redirect("/login");

  return { supabase, user };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error.";
  }
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function getGoogleConnectionStatus(): Promise<GoogleConnectionStatus> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("routemate_user_settings")
    .select("google_maps_connected, google_maps_key_last4, google_maps_validated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return {
      connected: false,
      last4: null,
      validatedAt: null,
      setupError: "RouteMate tables are not ready yet. Run the Supabase schema file.",
    };
  }

  return {
    connected: Boolean(data?.google_maps_connected),
    last4: data?.google_maps_key_last4 ?? null,
    validatedAt: data?.google_maps_validated_at ?? null,
  };
}

export async function removeGoogleApiKeyAction() {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("routemate_user_settings")
    .update({
      google_maps_api_key_encrypted: null,
      google_maps_key_last4: null,
      google_maps_connected: false,
      google_maps_validated_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/");
  return { ok: true, message: "Google Maps key removed." };
}

export async function listRoutesAction() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("routemate_routes")
    .select("*")
    .eq("user_id", user.id)
    .order("route_date", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) return { routes: [] as SavedRoute[], error: error.message };
  return { routes: (data ?? []) as SavedRoute[], error: null };
}

export async function deleteRouteAction(routeId: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("routemate_routes")
    .delete()
    .eq("id", routeId)
    .eq("user_id", user.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/");
  return { ok: true, message: "Route deleted." };
}

export async function loadRouteAction(routeId: string) {
  const { supabase, user } = await requireUser();
  const { data: route, error } = await supabase
    .from("routemate_routes")
    .select("*")
    .eq("id", routeId)
    .eq("user_id", user.id)
    .single();

  if (error || !route) return { route: null, error: error?.message ?? "Route not found." };

  const { data: stops, error: stopsError } = await supabase
    .from("routemate_route_stops")
    .select("*")
    .eq("route_id", routeId)
    .eq("user_id", user.id)
    .order("manual_order", { ascending: true });

  if (stopsError) return { route: null, error: stopsError.message };

  return {
    route: { ...(route as SavedRoute), stops: (stops ?? []) as SavedStop[] } as RouteWithStops,
    error: null,
  };
}

export async function saveRouteAction(input: RouteInput) {
  const { supabase, user } = await requireUser();
  const stopDurationMinutes = Math.max(0, Math.min(480, Math.round(Number(input.stopDurationMinutes) || 0)));
  const departureTime = input.departureTime ? new Date(input.departureTime).toISOString() : null;
  const cleanStops = input.stops
    .map((stop) => ({
      ...stop,
      address: stop.address.trim(),
      notes: stop.notes.trim(),
    }))
    .filter((stop) => stop.address);

  if (!input.name.trim() || !input.routeDate || !input.startAddress.trim()) {
    return { ok: false, message: "Route name, date, and start address are required." };
  }

  if (!cleanStops.length) {
    return { ok: false, message: "Add at least one stop before saving." };
  }

  const routePayload = {
    id: input.id,
    user_id: user.id,
    name: input.name.trim(),
    route_date: input.routeDate,
    travel_mode: input.travelMode,
    departure_time: departureTime,
    stop_duration_minutes: stopDurationMinutes,
    start_address: input.startAddress.trim(),
    end_address: input.endAddress.trim() || null,
    status: "draft",
    updated_at: new Date().toISOString(),
  };

  let { data: route, error } = await supabase
    .from("routemate_routes")
    .upsert(routePayload)
    .select("*")
    .single();

  if (error && getErrorMessage(error).includes("departure_time")) {
    const fallbackPayload: Omit<typeof routePayload, "departure_time" | "stop_duration_minutes"> &
      Partial<Pick<typeof routePayload, "departure_time" | "stop_duration_minutes">> = { ...routePayload };
    delete fallbackPayload.departure_time;
    delete fallbackPayload.stop_duration_minutes;
    const retry = await supabase
      .from("routemate_routes")
      .upsert(fallbackPayload)
      .select("*")
      .single();
    route = retry.data;
    error = retry.error;
  }

  if (error || !route) {
    return { ok: false, message: error?.message ?? "Could not save route." };
  }

  if (input.id) {
    const { error: deleteError } = await supabase
      .from("routemate_route_stops")
      .delete()
      .eq("route_id", input.id)
      .eq("user_id", user.id);
    if (deleteError) return { ok: false, message: deleteError.message };
  }

  const { error: stopsError } = await supabase.from("routemate_route_stops").insert(
    cleanStops.map((stop, index) => ({
      route_id: route.id,
      user_id: user.id,
      address: stop.address,
      notes: stop.notes || null,
      service_window_start: stop.serviceWindowStart || null,
      service_window_end: stop.serviceWindowEnd || null,
      original_order: index,
      manual_order: index,
      status: stop.status,
    })),
  );

  if (stopsError) return { ok: false, message: stopsError.message };

  revalidatePath("/");
  return { ok: true, message: "Route saved.", routeId: route.id as string };
}

async function loadUserGoogleKey() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("routemate_user_settings")
    .select("google_maps_api_key_encrypted, google_maps_connected")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data?.google_maps_connected || !data.google_maps_api_key_encrypted) {
    throw new Error("Connect your Google Maps API key before optimizing routes.");
  }

  return { supabase, user, apiKey: decryptSecret(data.google_maps_api_key_encrypted) };
}

export async function optimizeRouteAction(routeId: string) {
  try {
    const { supabase, user, apiKey } = await loadUserGoogleKey();
    const loaded = await loadRouteAction(routeId);
    if (!loaded.route) throw new Error(loaded.error ?? "Route not found.");

    const route = loaded.route;
    const orderedStops = [...route.stops].sort(
      (a, b) => (a.manual_order ?? a.original_order) - (b.manual_order ?? b.original_order),
    );

    const endAddress = route.end_address || route.start_address;
    if (!endAddress) throw new Error("Add a start address before optimizing.");

    const metricStops = orderedStops;
    const points = [route.start_address, ...metricStops.map((stop) => stop.address), endAddress];
    const departureTime = route.departure_time ?? null;
    const stopDurationMinutes = Math.max(0, route.stop_duration_minutes ?? 20);
    const stopServiceSeconds = metricStops.length * stopDurationMinutes * 60;

    const original = await computeRouteMetrics(apiKey, points, route.travel_mode, false, departureTime);
    let optimized = original;
    let optimizationWarning = "";

    try {
      optimized = await computeRouteMetrics(apiKey, points, route.travel_mode, true, departureTime);
    } catch (error) {
      optimizationWarning = `Saved route without waypoint reordering: ${getErrorMessage(error)}`;
    }

    const optimizedIndexes = optimized.optimizedIntermediateIndexes.length
      ? optimized.optimizedIntermediateIndexes
      : metricStops.map((_, index) => index);

    const optimizedStops = [
      ...optimizedIndexes.map((index) => metricStops[index]).filter(Boolean),
    ];

    await Promise.all(
      optimizedStops.map((stop, index) =>
        supabase
          .from("routemate_route_stops")
          .update({ optimized_order: index, manual_order: index })
          .eq("id", stop.id)
          .eq("user_id", user.id),
      ),
    );

    const googleMapsUrl = buildGoogleMapsUrl(
      route.start_address,
      optimizedStops.map((stop) => stop.address),
      endAddress,
      route.travel_mode,
    );

    const milesSaved = Math.max(
      0,
      (original.distanceMeters - optimized.distanceMeters) / 1609.344,
    );
    const estimatedFuelSavingsCents =
      route.travel_mode === "driving" ? Math.round((milesSaved / 22) * 3.6 * 100) : null;

    const updatePayload = {
      original_distance_meters: original.distanceMeters,
      original_duration_seconds: original.durationSeconds,
      original_polyline: original.encodedPolyline,
      optimized_distance_meters: optimized.distanceMeters,
      optimized_duration_seconds: optimized.durationSeconds,
      original_workday_duration_seconds: original.durationSeconds + stopServiceSeconds,
      optimized_workday_duration_seconds: optimized.durationSeconds + stopServiceSeconds,
      estimated_fuel_savings_cents: estimatedFuelSavingsCents,
      optimized_polyline: optimized.encodedPolyline,
      google_maps_url: googleMapsUrl,
      status: "optimized",
      updated_at: new Date().toISOString(),
    };

    let { error } = await supabase
      .from("routemate_routes")
      .update(updatePayload)
      .eq("id", routeId)
      .eq("user_id", user.id);

    if (error && (getErrorMessage(error).includes("polyline") || getErrorMessage(error).includes("workday"))) {
      const payloadWithoutPolyline: Omit<
        typeof updatePayload,
        "original_polyline" | "optimized_polyline" | "original_workday_duration_seconds" | "optimized_workday_duration_seconds"
      > &
        Partial<
          Pick<
            typeof updatePayload,
            "original_polyline" | "optimized_polyline" | "original_workday_duration_seconds" | "optimized_workday_duration_seconds"
          >
        > = {
        ...updatePayload,
      };
      delete payloadWithoutPolyline.original_polyline;
      delete payloadWithoutPolyline.optimized_polyline;
      delete payloadWithoutPolyline.original_workday_duration_seconds;
      delete payloadWithoutPolyline.optimized_workday_duration_seconds;
      const retry = await supabase
        .from("routemate_routes")
        .update(payloadWithoutPolyline)
        .eq("id", routeId)
        .eq("user_id", user.id);
      error = retry.error;
      optimizationWarning = [
        optimizationWarning,
        "Route saved without newer timing/polyline storage. Rerun the Supabase schema to add the latest RouteMate columns.",
      ]
        .filter(Boolean)
        .join(" ");
    }

    if (error) throw error;

    revalidatePath("/");
    const refreshed = await loadRouteAction(routeId);
    return {
      ok: true,
      message: optimizationWarning || "Route optimized.",
      route: refreshed.route,
    };
  } catch (error) {
    return {
      ok: false,
      message: getErrorMessage(error),
    };
  }
}

export async function duplicateRouteAction(routeId: string) {
  const loaded = await loadRouteAction(routeId);
  if (!loaded.route) return { ok: false, message: loaded.error ?? "Route not found." };

  const route = loaded.route;
  return saveRouteAction({
    name: `${route.name} copy`,
    routeDate: new Date().toISOString().slice(0, 10),
    travelMode: route.travel_mode,
    departureTime: route.departure_time ?? "",
    stopDurationMinutes: route.stop_duration_minutes ?? 20,
    startAddress: route.start_address,
    endAddress: route.end_address ?? "",
    stops: route.stops.map((stop) => ({
      address: stop.address,
      notes: stop.notes ?? "",
      serviceWindowStart: stop.service_window_start ?? "",
      serviceWindowEnd: stop.service_window_end ?? "",
      status: "pending",
    })),
  });
}
