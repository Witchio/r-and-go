import Link from 'next/link';
import { OFFICIAL_EVENT_PAGES } from '@/lib/fixtures/scenarios';

export default async function OrganizerEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const key = `/organizer/${slug}`;
  const page = OFFICIAL_EVENT_PAGES[key];

  if (!page) {
    return (
      <div className="min-h-screen bg-slate-50 p-10 font-sans text-slate-800">
        <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold">Organizer Page Not Found</h1>
          <p className="mt-2 text-sm text-slate-600">
            No official event agenda fixture found for <code>{key}</code>.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
          >
            ← Back to Argon Travel Planner
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-12 font-sans text-slate-100">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
            ● Official Organizer Source Page (Demo Fixture)
          </span>
          <Link
            href="/"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            ← Return to Argon Planner
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl">
          <div className="text-xs font-bold uppercase tracking-wider text-indigo-400">
            {page.organizer}
          </div>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white">
            {page.title}
          </h1>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-400">
            <span>Canonical URL: {page.url}</span>
            <span>•</span>
            <span>Published: {new Date(page.publishedAt).toLocaleString()}</span>
          </div>

          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Confirmed Physical Venue
            </div>
            <div className="mt-1 text-sm font-semibold text-white">
              {page.venueAddress}
            </div>
            <div className="mt-0.5 text-xs text-slate-400">
              Neighborhood: {page.venueNeighborhood} ({page.venueCoordinates.lat},{' '}
              {page.venueCoordinates.lng})
            </div>
          </div>

          <h2 className="mt-8 text-sm font-bold uppercase tracking-wider text-slate-300">
            Published Program Breakdown
          </h2>
          <div className="mt-3 space-y-3">
            {page.structuredSchedule.map((item, idx) => (
              <div
                key={idx}
                className="flex flex-col justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/50 p-4 sm:flex-row sm:items-center"
              >
                <div>
                  <div className="text-xs font-bold text-indigo-400">
                    {item.timeRange}
                  </div>
                  <div className="mt-0.5 text-base font-bold text-white">
                    {item.label}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {item.attendancePolicy}
                  </div>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center rounded-lg px-3 py-1 text-xs font-bold uppercase ${
                    item.optionality === 'optional'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {item.optionality}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-xs leading-relaxed text-indigo-200">
            <strong className="block font-bold text-indigo-300">
              Organizer Attendance & Optionality Notice:
            </strong>
            {page.policyNotice}
          </div>
        </div>
      </div>
    </div>
  );
}
