import Link from "next/link";

export default function NotFound() {
  return (
    <div className="site-scope grid min-h-screen place-items-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--site-accent)" }}>
          404
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight" style={{ fontFamily: "var(--site-font-heading)" }}>
          This page is not available
        </h1>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--site-muted)" }}>
          The address you followed does not exist, is no longer published, or the site is not serving right now.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/" className="btn btn-solid px-4 py-2 text-sm">
            Go to the homepage
          </Link>
          <a href="https://trofeo.example/support" className="btn btn-outline px-4 py-2 text-sm">
            Contact support
          </a>
        </div>
      </div>
    </div>
  );
}
