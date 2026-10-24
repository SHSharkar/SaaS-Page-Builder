import Link from "next/link";
import { adminButtonVariants } from "@/lib/theme-classes";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <div className="w-full text-center sm:w-96">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-400">
          404 | Not published here
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          That page is not live on this domain.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/65">
          Check the address, or sign in to the workspace if you expected to find a draft.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="rounded-lg bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-300"
          >
            Home page
          </Link>
          <Link
            href="/admin"
            className={`${adminButtonVariants({ tone: "secondary", size: "sm" })} border-white/20 bg-transparent text-white hover:bg-white/10`}
          >
            Staff workspace
          </Link>
        </div>
      </div>
    </main>
  );
}
