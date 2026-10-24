"use client";

import { useEffect, useState } from "react";
import { MediaImage } from "@/lib/registry/shell";
import { cn, siteButton } from "@/lib/theme-classes";

export type GalleryItem = {
  image: { id: string; url?: string; alt?: string } | null;
  caption: string;
};

export function GalleryLightbox({
  items,
  columns,
  enableLightbox,
}: {
  items: GalleryItem[];
  columns: "2" | "3" | "4";
  enableLightbox: boolean;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenIndex(null);
      if (event.key === "ArrowRight") setOpenIndex((i) => (i === null ? null : (i + 1) % items.length));
      if (event.key === "ArrowLeft") {
        setOpenIndex((i) => (i === null ? null : (i - 1 + items.length) % items.length));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, items.length]);

  const grid =
    columns === "2"
      ? "sm:grid-cols-2"
      : columns === "4"
        ? "sm:grid-cols-2 lg:grid-cols-4"
        : "sm:grid-cols-3";

  const current = openIndex !== null ? items[openIndex] : null;

  return (
    <>
      <div className={cn("grid gap-4", grid)}>
        {items.map((item, index) => (
          <figure
            key={index}
            className="overflow-hidden rounded-site-md border border-site-border bg-site-surface"
          >
            {enableLightbox ? (
              <button
                type="button"
                onClick={() => setOpenIndex(index)}
                className="block w-full cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-site-accent"
                aria-label={item.caption ? `Expand ${item.caption}` : `Expand image ${index + 1}`}
              >
                <div className="aspect-[4/3] overflow-hidden">
                  <MediaImage
                    value={item.image}
                    alt={item.caption}
                    rounded={false}
                    className="h-full w-full object-cover"
                    fallbackLabel={`Image ${index + 1}`}
                  />
                </div>
              </button>
            ) : (
              <div className="aspect-[4/3] overflow-hidden">
                <MediaImage
                  value={item.image}
                  alt={item.caption}
                  rounded={false}
                  className="h-full w-full object-cover"
                  fallbackLabel={`Image ${index + 1}`}
                />
              </div>
            )}
            {item.caption ? (
              <figcaption className="px-3 py-2 text-xs text-site-muted">{item.caption}</figcaption>
            ) : null}
          </figure>
        ))}
      </div>

      {current !== null && openIndex !== null ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink-950/85 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={current.caption || `Image ${openIndex + 1}`}
        >
          <div className="w-full rounded-site-lg border border-site-border bg-site-surface p-4 shadow-modal sm:w-3/4 lg:w-2/3">
            <div className="overflow-hidden rounded-site-md">
              <MediaImage
                value={current.image}
                alt={current.caption}
                rounded={false}
                className="w-full object-contain"
                fallbackLabel={`Image ${openIndex + 1}`}
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-site-muted">
                {current.caption || `Image ${openIndex + 1} of ${items.length}`}
              </p>
              <div className="flex items-center gap-2">
                {items.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setOpenIndex((openIndex - 1 + items.length) % items.length)}
                      className={siteButton({ variant: "outline", size: "sm" })}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenIndex((openIndex + 1) % items.length)}
                      className={siteButton({ variant: "outline", size: "sm" })}
                    >
                      Next
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => setOpenIndex(null)}
                  className={siteButton({ variant: "solid", size: "sm" })}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
