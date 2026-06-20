import { GoogleSignInButton } from "@/components/GoogleSignInButton";

type SearchParams = Promise<{ error?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen bg-[#f7f4ec] p-3 md:p-5">
      <div className="grid min-h-[calc(100vh-2rem)] overflow-hidden rounded-[2rem] bg-white shadow-2xl lg:grid-cols-[1.05fr_.95fr]">
        <section className="story-panel flex flex-col justify-between bg-[#101820] p-6 text-white md:p-10">
          <div>
            <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm text-white/75">
              RouteMate
            </div>
            <h1 className="mt-8 max-w-2xl text-4xl font-semibold leading-tight md:text-6xl">
              Optimized routes for crews that do the real moving.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/70 md:text-lg">
              Sign in, connect your own Google Maps key, and turn daily stops into a cleaner route for driving or walking.
            </p>
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {["Saved routes", "Walking mode", "Fuel savings"].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/8 p-4">
                <div className="text-sm text-white/55">Included</div>
                <div className="mt-1 font-medium">{item}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col justify-center gap-6 p-6 md:p-10">
          <div>
            <p className="eyebrow">Welcome back</p>
            <h2 className="mt-2 text-3xl font-semibold text-[#101820]">Sign in to RouteMate</h2>
            <p className="mt-2 text-[#65706a]">Continue with your Google account.</p>
          </div>

          <GoogleSignInButton />

          {error === "oauth_failed" && (
            <p className="text-sm text-red-600">Sign-in failed. Please try again.</p>
          )}

          <div className="rounded-3xl border border-[#e2e9df] bg-[#f8faf6] p-5 text-sm leading-6 text-[#65706a]">
            Your Google Maps API key is stored encrypted after onboarding and is never displayed back to the browser.
          </div>
        </section>
      </div>
    </div>
  );
}
