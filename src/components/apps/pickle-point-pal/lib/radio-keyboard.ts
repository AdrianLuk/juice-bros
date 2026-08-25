import type { KeyboardEvent } from "react";

/**
 * Arrow-key navigation for a `role="radiogroup"` of `role="radio"` buttons,
 * per the WAI-ARIA APG radio-group pattern: arrow keys move focus and
 * selection together (each option is otherwise only reachable via a roving
 * `tabIndex`, not plain Tab).
 */
export function handleRadioKeyDown(
  event: KeyboardEvent<HTMLButtonElement>,
  count: number,
  currentIndex: number,
  onSelectIndex: (index: number) => void
): void {
  const delta =
    event.key === "ArrowRight" || event.key === "ArrowDown"
      ? 1
      : event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? -1
        : 0;
  if (delta === 0) return;

  event.preventDefault();
  const next = (currentIndex + delta + count) % count;
  onSelectIndex(next);

  const group = event.currentTarget.closest('[role="radiogroup"]');
  const buttons = group?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
  buttons?.[next]?.focus();
}
