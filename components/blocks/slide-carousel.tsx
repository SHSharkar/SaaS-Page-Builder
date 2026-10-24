"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MediaImage } from "@/lib/registry/shell";

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
  const regionRef = useRef<HTMLDivElement>(null);
  const count = slides.length;

  const go = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (!autoplay || paused || count < 2) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), Math.max(3, autoplaySeconds) * 1000);
    return () => window.clearInterval(id);
  }, [autoplay, autoplaySeconds, paused, count]);

  if (count === 0) {
    return (
      <div className="media-placeholder rounded-[var(--site-radius-md)] p-10 text-center">
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
      ref={regionRef}
    >
      <div className="overflow-hidden rounded-[var(--site-radius-lg)] border" style={{ borderColor: "var(--site-border)" }}>
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((slide, i) => (
            <div key={i} className="min-w-full" aria-hidden={i !== index} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${count}`}>
              <div className="relative">
                {slide.image?.id ? (
                  <MediaImage value={slide.image} alt={slide.title} rounded={false} className="h-64 w-full object-cover sm:h-80" />
                ) : null}
                <div
                  className="absolute inset-0 flex items-end"
                  style={{
                    background: slide.image?.id
                      ? "linear-gradient(180deg, transparent 30%, color-mix(in srgb, var(--site-bg) 92%, transparent))"
                      : "color-mix(in srgb, var(--site-surface) 92%, var(--site-bg))",
                  }}
                >
                  <div className="p-6 sm:p-8">
                    <p className="font-heading text-2xl leading-tight">{slide.title}</p>
                    {slide.text ? (
                      <p className="mt-1 max-w-lg text-sm" style={{ color: "var(--site-muted)" }}>
                        {slide.text}
                      </p>
                    ) : null}
                    {slide.ctaLabel ? (
                      <a href={slide.ctaHref || "#"} className="btn btn-solid mt-4 px-4 py-2 text-sm">
                        {slide.ctaLabel}
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {count > 1 ? (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous slide"
            className="carousel-arrow left-3"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M15.4 3.6 7 12l8.4 8.4 1.4-1.4L9.8 12l7-7z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next slide"
            className="carousel-arrow right-3"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8.6 3.6 17 12l-8.4 8.4-1.4-1.4 7-7-7-7z" />
            </svg>
          </button>
          <div className="mt-3 flex items-center justify-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === index ? 22 : 8,
                  background: i === index ? "var(--site-accent)" : "var(--site-border)",
                }}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
