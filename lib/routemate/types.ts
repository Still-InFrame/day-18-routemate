export type TravelMode = "driving" | "walking";
type StopStatus = "pending" | "completed" | "skipped";
type RouteStatus = "draft" | "optimized";

export type GoogleConnectionStatus = {
  connected: boolean;
  last4: string | null;
  validatedAt: string | null;
  setupError?: string;
};

export type RouteStopInput = {
  id?: string;
  address: string;
  notes: string;
  serviceWindowStart: string;
  serviceWindowEnd: string;
  status: StopStatus;
};

export type RouteInput = {
  id?: string;
  name: string;
  routeDate: string;
  travelMode: TravelMode;
  departureTime: string;
  stopDurationMinutes: number;
  startAddress: string;
  endAddress: string;
  stops: RouteStopInput[];
};

export type SavedRoute = {
  id: string;
  name: string;
  route_date: string;
  travel_mode: TravelMode;
  departure_time: string | null;
  stop_duration_minutes: number | null;
  start_address: string;
  end_address: string | null;
  original_distance_meters: number | null;
  original_duration_seconds: number | null;
  original_polyline: string | null;
  optimized_distance_meters: number | null;
  optimized_duration_seconds: number | null;
  original_workday_duration_seconds: number | null;
  optimized_workday_duration_seconds: number | null;
  estimated_fuel_savings_cents: number | null;
  optimized_polyline: string | null;
  google_maps_url: string | null;
  status: RouteStatus;
  created_at: string;
  updated_at: string;
};

export type SavedStop = {
  id: string;
  route_id: string;
  address: string;
  notes: string | null;
  service_window_start: string | null;
  service_window_end: string | null;
  original_order: number;
  optimized_order: number | null;
  manual_order: number | null;
  status: StopStatus;
};

export type RouteWithStops = SavedRoute & {
  stops: SavedStop[];
};

export type RouteMetrics = {
  distanceMeters: number;
  durationSeconds: number;
  optimizedIntermediateIndexes: number[];
  encodedPolyline: string | null;
};
