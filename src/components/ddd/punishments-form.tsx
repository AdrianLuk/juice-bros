"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { savePunishments } from "@/lib/ddd/actions/live";
import { MAX_PUNISHMENT, PLACES } from "@/lib/ddd/events";
import { useWrite } from "./use-write";

/** An Organizer's four Punishments, 1st place first (#718): editable before or after the DDD. */
export function PunishmentsForm({ eventId, punishments }: { eventId: string; punishments: string[] }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const { pending, problem, run } = useWrite(() => router.refresh());

  function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const data = new FormData(formEvent.currentTarget);
    setSaved(false);
    run(
      () => savePunishments(eventId, PLACES.map((_, index) => String(data.get(`place-${index}`) ?? ""))),
      () => setSaved(true),
    );
  }

  return (
    <form className="ddd-stack" onSubmit={submit} aria-label="Punishments" onChange={() => setSaved(false)}>
      {PLACES.map((place, index) => (
        <div key={place} className="ddd-field">
          <label htmlFor={`ddd-punishment-${index}`}>{place} place</label>
          <input
            id={`ddd-punishment-${index}`}
            name={`place-${index}`}
            required
            maxLength={MAX_PUNISHMENT}
            autoComplete="off"
            defaultValue={punishments[index]}
          />
        </div>
      ))}
      <div className="ddd-actions">
        <button type="submit" className="ddd-btn" disabled={pending}>
          {pending ? "Saving…" : "Save the Punishments"}
        </button>
        <p role="status" className="ddd-note empty:hidden">
          {saved ? "Saved." : ""}
        </p>
      </div>
      <p role="alert" className="ddd-problem empty:hidden">
        {problem}
      </p>
    </form>
  );
}
