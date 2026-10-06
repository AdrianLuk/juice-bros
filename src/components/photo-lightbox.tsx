"use client";

import { useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode, type TouchEvent } from "react";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";

import type { Photo } from "@/lib/photo-sets";
import { isManagedImage, largestVariantWidth } from "@/lib/image-variants";
import { stepPhoto, swipeStep } from "@/lib/photo-lightbox";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogClose,
  DialogOverlay,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { Picture } from "@/components/picture";

/**
 * The Photos page's viewer: a photo large, with its alt text as the caption,
 * stepped through in page order across every set and into the Loose Photos.
 *
 * It enhances links rather than adding buttons. Every tile is already an
 * `<a>` to the photo's large file (`PhotoRows linked`), carrying its place in
 * `photos` as `data-photo-index`; one click listener on this wrapper catches
 * those and opens the viewer instead. With scripts off, or before they load,
 * the same click just opens the file. A click with a modifier key (new tab,
 * new window, download) is left to the browser.
 *
 * Only the photo on screen is rendered, and always at its largest variant, so
 * the lightbox is sharper than the grid and a large file is fetched only when
 * a photo is opened or stepped to, never ahead of time.
 *
 * Focus goes back to the tile that was opened, however far the visitor
 * stepped, so they land where they left the page. It is set explicitly:
 * Safari doesn't focus a link on click, so "whatever had focus" would be the
 * page itself.
 */
export function PhotoLightbox({ photos, children }: { photos: readonly Photo[]; children: ReactNode }) {
  const [index, setIndex] = useState<number | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const photo = index === null ? null : photos[index];
  const previous = index === null ? null : stepPhoto(index, -1, photos.length);
  const next = index === null ? null : stepPhoto(index, 1, photos.length);

  function onClick(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element).closest<HTMLAnchorElement>("a[data-photo-index]");
    if (!link) return;
    const opened = Number(link.dataset.photoIndex);
    if (!Number.isInteger(opened) || !photos[opened]) return;

    event.preventDefault();
    openerRef.current = link;
    setIndex(opened);
  }

  function go(target: number | null) {
    if (target !== null) setIndex(target);
  }

  /** A click on the dark space around the photo closes, like any viewer. */
  function onStageClick(event: MouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (target === event.currentTarget || target.hasAttribute("data-stage")) setIndex(null);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(previous);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      go(next);
    }
  }

  // One finger only: a second finger means a pinch, not a swipe.
  function onTouchStart(event: TouchEvent) {
    const touch = event.touches.length === 1 ? event.touches[0] : null;
    touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }

  function onTouchEnd(event: TouchEvent) {
    const start = touchStart.current;
    const touch = event.changedTouches[0];
    touchStart.current = null;
    if (!start || !touch || event.touches.length > 0) return;
    const step = swipeStep(touch.clientX - start.x, touch.clientY - start.y);
    if (step !== 0) go(step === 1 ? next : previous);
  }

  // `sizes` names the largest variant's own width, so the browser always picks
  // it whatever the screen: the lightbox width, never a grid one.
  const sizes = photo && isManagedImage(photo.src) ? `${largestVariantWidth(photo.src)}px` : "100vw";

  return (
    <>
      {/* Only the page's tiles are inside this listener. The dialog is a
          sibling, not a child, so its own clicks never reach it. */}
      <div onClick={onClick}>{children}</div>

      <Dialog open={photo !== null} onOpenChange={(open) => !open && setIndex(null)}>
        <DialogPortal>
          <DialogOverlay className="bx-lightbox-motion bg-black/92 supports-backdrop-filter:backdrop-blur-none" />
          <DialogPopup
            finalFocus={openerRef}
            onKeyDown={onKeyDown}
            onClick={onStageClick}
            className="bx-dark bx-lightbox-motion fixed inset-0 z-50 flex flex-col text-(--bx-ink) outline-none transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0"
          >
            <DialogTitle className="sr-only">Photos</DialogTitle>

            <div className="flex items-center justify-between px-4 pt-4 sm:px-6">
              <p className="bx-meta" aria-hidden>
                {index !== null && `${index + 1} / ${photos.length}`}
              </p>
              <DialogClose className={controlClass} aria-label="Close">
                <XIcon className="size-5" />
              </DialogClose>
            </div>

            {photo && index !== null && (
              <div
                data-stage
                className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-4 pb-24 sm:px-20 sm:pb-6"
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
                onTouchCancel={() => (touchStart.current = null)}
              >
                <Picture
                  key={photo.src}
                  src={photo.src}
                  alt={photo.alt}
                  sizes={sizes}
                  className="h-auto max-h-[calc(100dvh-16rem)] w-auto max-w-full rounded-(--bx-radius) object-contain sm:max-h-[calc(100dvh-10rem)]"
                />
                {/* The alt text, shown. Hidden from screen readers, which
                    already hear it as the image's alt and in the live line;
                    for the same reason this is not a <figure>, which would
                    take the caption as its name and read it a third time. */}
                <p
                  aria-hidden
                  data-caption
                  className="max-w-[60ch] text-center text-[0.9375rem] leading-relaxed text-(--bx-muted)"
                >
                  {photo.alt}
                </p>
                <p className="sr-only" aria-live="polite">
                  {`Photo ${index + 1} of ${photos.length}. ${photo.alt}`}
                </p>

                <StepButton direction="previous" target={previous} onStep={go} />
                <StepButton direction="next" target={next} onStep={go} />
              </div>
            )}
          </DialogPopup>
        </DialogPortal>
      </Dialog>
    </>
  );
}

const controlClass =
  "flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-200 hover:bg-white/20 motion-reduce:transition-none";

/**
 * Previous or next. At either end it stays in place but is marked unavailable
 * rather than `disabled`: a disabled button drops focus to the page, which
 * would strand a keyboard user who had just stepped to the last photo.
 */
function StepButton({
  direction,
  target,
  onStep,
}: {
  direction: "previous" | "next";
  target: number | null;
  onStep: (target: number | null) => void;
}) {
  const unavailable = target === null;
  const Icon = direction === "previous" ? ChevronLeftIcon : ChevronRightIcon;

  return (
    <button
      type="button"
      aria-label={direction === "previous" ? "Previous photo" : "Next photo"}
      aria-disabled={unavailable}
      onClick={() => onStep(target)}
      className={cn(
        controlClass,
        // At the bottom on a phone, where a thumb is and where they don't sit
        // on top of the photo; beside it from `sm` up.
        "absolute bottom-6 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2",
        direction === "previous" ? "left-4 sm:left-5" : "right-4 sm:right-5",
        unavailable && "opacity-30 hover:bg-white/10",
      )}
    >
      <Icon className="size-6" />
    </button>
  );
}
