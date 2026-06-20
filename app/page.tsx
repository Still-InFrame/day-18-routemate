import { RouteMateApp } from "@/components/routemate/RouteMateApp";
import { getGoogleConnectionStatus, listRoutesAction } from "./actions";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [googleStatus, routesResult] = await Promise.all([
    getGoogleConnectionStatus(),
    listRoutesAction(),
  ]);

  return (
    <RouteMateApp
      userEmail={user?.email ?? "Signed in"}
      googleStatus={googleStatus}
      initialRoutes={routesResult.routes}
      initialRoutesError={routesResult.error}
    />
  );
}
