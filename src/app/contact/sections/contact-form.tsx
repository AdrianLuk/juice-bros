"use client";

import { useState } from "react";
import { CircleAlertIcon, CircleCheckBigIcon, Loader2Icon, SendIcon } from "lucide-react";

import { contactReasons, type ContactReason } from "@/lib/contact";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";

type Status = "idle" | "submitting" | "success" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [reason, setReason] = useState<ContactReason | "">("");
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
      setReason("");
    } catch {
      setErrorMessage("Something went wrong. Try again shortly.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-start gap-3 rounded-2xl border bg-background p-6 shadow-sm sm:p-8">
        <div className="flex size-10 items-center justify-center rounded-full bg-brand-orange/10 text-brand-orange">
          <CircleCheckBigIcon className="size-5" />
        </div>
        <div>
          <p className="font-heading text-lg font-bold">Message sent</p>
          <p className="mt-1 text-muted-foreground">
            Thanks for reaching out - we read everything and will get back to you soon.
          </p>
        </div>
        <Button variant="outline" className="mt-1" onClick={() => setStatus("idle")}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-background p-6 shadow-sm sm:p-8">
      <form onSubmit={handleSubmit} noValidate>
        <FieldGroup>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="contact-name">Name</FieldLabel>
              <Input
                id="contact-name"
                name="name"
                autoComplete="name"
                required
                maxLength={200}
                className="h-11 px-4 text-base md:text-base"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="contact-email">Email</FieldLabel>
              <Input
                id="contact-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="h-11 px-4 text-base md:text-base"
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="contact-reason">Reason for reaching out</FieldLabel>
            <Select
              name="reason"
              items={contactReasons}
              value={reason}
              onValueChange={(value) => setReason(value as ContactReason)}
              required
            >
              <SelectTrigger
                id="contact-reason"
                className="w-full data-[size=default]:h-11 px-4 text-base"
              >
                <SelectValue placeholder="Pick one" />
              </SelectTrigger>
              <SelectContent>
                {contactReasons.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="contact-message">Message</FieldLabel>
            <Textarea
              id="contact-message"
              name="message"
              required
              maxLength={5000}
              rows={7}
              className="min-h-32 px-4 py-3 text-base md:text-base"
            />
          </Field>

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
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />
              <p>{errorMessage}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={status === "submitting"}
            className="h-11 w-fit px-8 text-base"
          >
            {status === "submitting" ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <SendIcon />
            )}
            {status === "submitting" ? "Sending..." : "Send message"}
          </Button>
        </FieldGroup>
      </form>
    </div>
  );
}
