"use client";

import { useCallback, useEffect, useState } from "react";
import { MediaImage } from "@/lib/registry/shell";
import {
  SITE_CAROUSEL_ARROW,
  SITE_MEDIA_PLACEHOLDER,
  cn,
  siteButton,
} from "@/lib/theme-classes";

export type Slide = {
  image: { id: string; url?: string; alt?: string } | null;
  title: string;
  text: string;
  ctaLabel: string;
  ctaHref: string;
};

export function SlideCarousel({
  slides,
  autoplay,
  autoplaySeconds,
  label,
}: {
  slides: Slide[];
  autoplay: boolean;
  autoplaySeconds: number;
  label: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [userStopped, setUserStopped] = useState(false);
  const count = slides.length;

  const go = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (!autoplay || paused || userStopped || count < 2) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % count),
      Math.max(3, autoplaySeconds) * 1000,
    );
    return () => window.clearInterval(id);
  }, [autoplay, autoplaySeconds, paused, userStopped, count]);

  if (count === 0) {
    return (
      <div className={cn(SITE_MEDIA_PLACEHOLDER, "rounded-site-md p-10")}>
        Add a slide to start the carousel.
      </div>
    );
  }

  return (
    <div
      className="relative"
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") go(index + 1);
        if (event.key === "ArrowLeft") go(index - 1);
      }}
      tabIndex={0}
    >
      <div className="overflow-hidden rounded-site-lg border border-site-border bg-site-surface">
        {slides.map((slide, i) => (
          <div
            key={i}
            className={i === index ? "block" : "hidden"}
            aria-hidden={i !== index}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
          >
            <div className="relative min-h-64 sm:min-h-80">
              {slide.image?.id ? (
                <MediaImage
                  value={slide.image}
                  alt={slide.title}
                  rounded={false}
                  className="h-64 w-full object-cover sm:h-80"
                />
              ) : null}
              <div
                className={cn(
                  "flex min-h-64 items-end p-6 sm:min-h-80 sm:p-8",
                  slide.image?.id
                    ? "absolute inset-0 bg-gradient-to-t from-site-bg via-site-bg/70 to-transparent"
                    : "bg-site-surface",
                )}
              >
                <div className="w-full">
                  <p className="font-heading text-2xl leading-tight text-site-text">
                    {slide.title}
                  </p>
                  {slide.text ? (
                    <p className="mt-1.5 text-sm leading-relaxed text-site-muted">
                      {slide.text}
                    </p>
                  ) : null}
                  {slide.ctaLabel ? (
                    <a
                      href={slide.ctaHref || "#"}
                      className={cn(siteButton({ variant: "solid", size: "sm" }), "mt-4")}
                    >
                      {slide.ctaLabel}
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {count > 1 ? (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous slide"
            className={cn(SITE_CAROUSEL_ARROW, "left-3 cursor-pointer")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M15.4 3.6 7 12l8.4 8.4 1.4-1.4L9.8 12l7-7z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next slide"
            className={cn(SITE_CAROUSEL_ARROW, "right-3 cursor-pointer")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8.6 3.6 17 12l-8.4 8.4-1.4-1.4 7-7-7-7z" />
            </svg>
          </button>
          <div className="mt-3 flex items-center justify-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                className={cn(
                  "h-1.5 cursor-pointer rounded-full transition-all",
                  i === index ? "w-6 bg-site-accent" : "w-2 bg-site-border",
                )}
              />
            ))}
            {autoplay ? (
              <button
                type="button"
                onClick={() => setUserStopped((prev) => !prev)}
                className="ml-2 cursor-pointer rounded border border-site-border px-2 py-0.5 text-[11px] font-medium text-site-muted hover:text-site-text"
              >
                {userStopped ? "Play" : "Pause"}
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
