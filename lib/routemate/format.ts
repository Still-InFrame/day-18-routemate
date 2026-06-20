export function formatDistance(meters: number | null | undefined) {
  if (!meters) return "0 mi";
  const miles = meters / 1609.344;
  return miles >= 10 ? `${miles.toFixed(0)} mi` : `${miles.toFixed(1)} mi`;
}

export function formatDuration(seconds: number | null | undefined) {
  if (!seconds) return "0 min";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function formatSavingsCents(cents: number | null | undefined) {
  if (!cents || cents <= 0) return "$0.00";
  return `$${(cents / 100).toFixed(2)}`;
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}
