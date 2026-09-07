"use client";

import { useState } from "react";

import { contactReasons } from "@/lib/contact";

type Status = "idle" | "submitting" | "success" | "error";

/**
 * The contact form.
 *
 * Built on plain form elements rather than the shadcn Input/Textarea/Select
 * used before. Those carry the light theme's semantic tokens (`border-input`,
 * `bg-popover`, `text-muted-foreground`) as Tailwind utilities, which outrank
 * anything the `.bx-dark` scope declares in the components layer - so dressing
 * them for this ground meant a per-class override at every call site, and the
 * Select's popup portals to the document root outside the scope on top of
 * that. Native elements take `.bx-field` directly and the browser paints their
 * dropdowns from `color-scheme: dark`, which the scope already sets.
 *
 * The native `<select>` also drops the controlled `reason` state the Base UI
 * one needed: the value goes to the server through FormData like every other
 * field.
 *
 * Behaviour is unchanged - same endpoint, same payload, same honeypot, same
 * `startedAt` timing check.
 */
export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [startedAt] = useState(() => Date.now());

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          reason: formData.get("reason"),
          message: formData.get("message"),
          company: formData.get("company"),
          startedAt,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErrorMessage(data?.error ?? "Something went wrong. Try again shortly.");
        setStatus("error");
        return;
      }

      setStatus("success");
      form.reset();
    } catch {
      setErrorMessage("Something went wrong. Try again shortly.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="bx-panel p-7 sm:p-9">
        <h2 className="bx-h2 text-lg sm:text-xl">Message sent</h2>
        <p className="bx-meta mt-2.5">We read everything</p>
        <p className="mt-4 max-w-[46ch] text-[0.9375rem] leading-relaxed text-[var(--bx-muted)]">
          Thanks for reaching out. We&apos;ll get back to you soon.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="bx-btn bx-btn-ghost mt-7"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <div className="bx-panel p-6 sm:p-8">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="contact-name" className="bx-label">
              Name
            </label>
            <input
              id="contact-name"
              name="name"
              autoComplete="name"
              required
              maxLength={200}
              className="bx-field"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="contact-email" className="bx-label">
              Email
            </label>
            <input
              id="contact-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="bx-field"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="contact-reason" className="bx-label">
            What&apos;s this about?
          </label>
          <div className="relative">
            <select
              id="contact-reason"
              name="reason"
              required
              defaultValue=""
              className="bx-field appearance-none pr-11"
            >
              <option value="" disabled>
                Pick one
              </option>
              {contactReasons.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>
            {/* Drawn rather than imported, like every other mark in this look. */}
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-[var(--bx-muted)]"
            >
              <path d="m5 9 7 7 7-7" />
            </svg>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="contact-message" className="bx-label">
            Message
          </label>
          <textarea
            id="contact-message"
            name="message"
            required
            maxLength={5000}
            rows={7}
            className="bx-field min-h-36 resize-y"
          />
        </div>

        {/* Honeypot - hidden from real users, irresistible to bots. */}
        <div className="sr-only" aria-hidden="true">
          <label htmlFor="contact-company">Company</label>
          <input
            id="contact-company"
            name="company"
            type="text"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        {status === "error" && (
          <p
            role="alert"
            className="rounded-lg px-4 py-3 text-[0.9375rem] leading-relaxed text-[var(--bx-ink)] shadow-[0_0_0_1px_var(--bx-line-2)]"
          >
            {errorMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={status === "submitting"}
          className="bx-btn bx-btn-play w-fit px-6 py-3.5 text-base disabled:opacity-60"
        >
          {status === "submitting" ? "Sending..." : "Send message"}
        </button>
      </form>
    </div>
  );
}
