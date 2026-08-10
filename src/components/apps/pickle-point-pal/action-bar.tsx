"use client";

import { useState } from "react";
import { ListOrdered, MoreHorizontal, Redo2, TriangleAlert, Undo2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { canCallTimeout, teamName, timeoutsRemaining } from "@/components/apps/pickle-point-pal/lib/scoring/selectors";
import { TEAM_IDS, type MatchState, type TeamId, type TimeoutKind } from "@/components/apps/pickle-point-pal/lib/scoring/types";

/**
 * Undo, a timeout control per team, and the technical-call menu.
 *
 * The timeout controls carry the allowance pips and disable at the limit — a
 * ref should not be able to grant a third by mistake, and should have to
 * consciously reach for medical/equipment instead. Undo lives here: reachable,
 * but deliberately not adjacent to the rally buttons.
 */
export function ActionBar({
  state,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onStartTimeout,
  onTechnicalFoul,
  onTechnicalWarning,
  onOpenLog,
}: {
  state: MatchState;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onStartTimeout: (team: TeamId, kind: TimeoutKind) => void;
  onTechnicalFoul: (team: TeamId) => void;
  onTechnicalWarning: (team: TeamId) => void;
  onOpenLog: () => void;
}) {
  const [kindMenuFor, setKindMenuFor] = useState<TeamId | null>(null);
  const [techOpen, setTechOpen] = useState(false);

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      {/* Stacked full-width, not side-by-side — a two-column split leaves too
          little room for long names before the kind-select control gets
          squeezed out. */}
      <div className="grid gap-2">
        {TEAM_IDS.map((team) => (
          <TimeoutControl
            key={team}
            state={state}
            team={team}
            onStandard={() => onStartTimeout(team, "standard")}
            onOpenKinds={() => setKindMenuFor(team)}
          />
        ))}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        <SmallButton icon={<Undo2 />} label="Undo" disabled={!canUndo} onClick={onUndo} />
        <SmallButton icon={<Redo2 />} label="Redo" disabled={!canRedo} onClick={onRedo} />
        <SmallButton
          icon={<TriangleAlert />}
          label="Technical"
          onClick={() => setTechOpen(true)}
        />
        <SmallButton icon={<ListOrdered />} label="Log" onClick={onOpenLog} />
      </div>

      {kindMenuFor && (
        <Sheet
          title={`Timeout — ${teamName(state.config, kindMenuFor)}`}
          onClose={() => setKindMenuFor(null)}
        >
          <SheetOption
            label="Standard timeout"
            hint={`${timeoutsRemaining(state, kindMenuFor)} of ${state.config.timeoutsPerGame} left · ${state.config.timeoutSeconds}s`}
            disabled={!canCallTimeout(state, kindMenuFor, "standard")}
            onClick={() => {
              onStartTimeout(kindMenuFor, "standard");
              setKindMenuFor(null);
            }}
          />
          <SheetOption
            label="Medical timeout"
            hint={`Does not use the allowance · ${Math.round(state.config.medicalTimeoutSeconds / 60)} min`}
            onClick={() => {
              onStartTimeout(kindMenuFor, "medical");
              setKindMenuFor(null);
            }}
          />
          <SheetOption
            label="Equipment timeout"
            hint={`Does not use the allowance · ${Math.round(state.config.equipmentTimeoutSeconds / 60)} min`}
            onClick={() => {
              onStartTimeout(kindMenuFor, "equipment");
              setKindMenuFor(null);
            }}
          />
        </Sheet>
      )}

      {techOpen && (
        <Sheet title="Technical call" onClose={() => setTechOpen(false)}>
          {TEAM_IDS.map((team) => (
            <SheetOption
              key={`warn-${team}`}
              label={`Warning — ${teamName(state.config, team)}`}
              hint="No point awarded"
              onClick={() => {
                onTechnicalWarning(team);
                setTechOpen(false);
              }}
            />
          ))}
          {TEAM_IDS.map((team) => (
            <SheetOption
              key={`foul-${team}`}
              label={`Technical foul — ${teamName(state.config, team)}`}
              hint="Point to their opponent, service unchanged"
              onClick={() => {
                onTechnicalFoul(team);
                setTechOpen(false);
              }}
            />
          ))}
        </Sheet>
      )}
    </div>
  );
}

/**
 * Remaining allowance renders as filled/empty pips, always visible — a ref
 * needs to answer "do they have one left?" without tapping anything, because a
 * team will ask mid-game.
 */
function TimeoutControl({
  state,
  team,
  onStandard,
  onOpenKinds,
}: {
  state: MatchState;
  team: TeamId;
  onStandard: () => void;
  onOpenKinds: () => void;
}) {
  const remaining = timeoutsRemaining(state, team);
  const allowed = canCallTimeout(state, team, "standard");

  return (
    <div className="flex items-stretch gap-1 rounded-lg border border-neutral-300 bg-white p-1">
      <button
        type="button"
        disabled={!allowed}
        onClick={onStandard}
        className="flex min-h-14 min-w-0 flex-1 flex-col items-start justify-center gap-1.5 rounded-md px-3 py-2 text-left touch-manipulation disabled:opacity-40"
      >
        {/* Wraps rather than truncates — a long team name pushes the row
            taller instead of clipping or squeezing the kind-select button. */}
        <span className="text-sm font-semibold wrap-break-word text-neutral-900">
          T/O · {teamName(state.config, team)}
        </span>
        <span className="flex gap-1" aria-label={`${remaining} timeouts remaining`}>
          {Array.from({ length: state.config.timeoutsPerGame }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "size-2.5 rounded-full border",
                i < remaining
                  ? "border-brand-orange bg-brand-orange"
                  : "border-neutral-300 bg-transparent"
              )}
            />
          ))}
        </span>
      </button>
      {/* shrink-0 + fixed size: this can never be squeezed out by a long name
          in the sibling button, no matter how narrow the panel gets. */}
      <button
        type="button"
        onClick={onOpenKinds}
        aria-label={`Other timeout kinds for ${teamName(state.config, team)}`}
        className="flex size-14 shrink-0 items-center justify-center rounded-md border-l border-neutral-200 text-neutral-500 touch-manipulation hover:bg-neutral-50"
      >
        <MoreHorizontal className="size-5" />
      </button>
    </div>
  );
}

function SmallButton({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-lg border border-neutral-300 bg-white px-2 py-2 text-[0.65rem] font-medium text-neutral-700 touch-manipulation disabled:opacity-40 [&_svg]:size-4"
    >
      {icon}
      {label}
    </button>
  );
}

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 p-4">
      {/* The panel is capped to the viewport and scrolls its own body. Without
          the cap, long content (the match log) pushes the sheet past both edges
          of a centred overlay, where nothing can scroll it and Cancel becomes
          unreachable. `dvh` so mobile browser chrome is accounted for, and
          `min-h-0` because a flex child otherwise refuses to shrink below its
          content and the body's overflow never engages. */}
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col rounded-2xl bg-white p-4 shadow-xl">
        <div className="flex shrink-0 items-center justify-between">
          <h2 className="font-heading text-base font-semibold text-neutral-950">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1 text-sm text-neutral-500"
          >
            Close
          </button>
        </div>
        <div className="mt-3 grid min-h-0 gap-2 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
}

export function SheetOption({
  label,
  hint,
  disabled,
  onClick,
}: {
  label: string;
  hint?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg border border-neutral-300 px-3 py-3 text-left touch-manipulation disabled:opacity-40"
    >
      <span className="block text-sm font-semibold text-neutral-950">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-neutral-500">{hint}</span>}
    </button>
  );
}
