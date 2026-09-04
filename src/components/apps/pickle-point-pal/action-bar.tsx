"use client";

import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { canCallTimeout, teamName, timeoutsRemaining } from "@/components/apps/pickle-point-pal/lib/scoring/selectors";
import { TEAM_IDS, type MatchState, type TeamId, type TimeoutKind } from "@/components/apps/pickle-point-pal/lib/scoring/types";

import {
  EquipmentIcon,
  LogIcon,
  MedicalIcon,
  MoreIcon,
  RedoIcon,
  TechnicalIcon,
  TimerIcon,
  UndoIcon,
} from "./pp-icons";

/**
 * The recessed control shelf: a timeout control per team with its allowance
 * pips, undo/redo, the match log, and the technical-call menu. Deliberately not
 * adjacent to the rally keys — a ref reaches here between rallies, never during
 * one. Every non-score state that can be logged from here carries its own
 * official mark so it can be told apart without reading the label.
 */
export function ActionBar({
  state,
  leftTeam,
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
  /** Which team the ref has on their left; orders the timeout controls to match. */
  leftTeam: TeamId;
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
    <div className="pp-well p-3">
      <div className="grid gap-2 ref-landscape:grid-cols-2">
        {TEAM_IDS.map((team) => (
          <TimeoutControl
            key={team}
            state={state}
            team={team}
            className={cn(
              "ref-landscape:row-start-1",
              team === leftTeam
                ? "ref-landscape:col-start-1"
                : "ref-landscape:col-start-2"
            )}
            onStandard={() => onStartTimeout(team, "standard")}
            onOpenKinds={() => setKindMenuFor(team)}
          />
        ))}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        <SmallButton icon={<UndoIcon />} label="Undo" disabled={!canUndo} onClick={onUndo} />
        <SmallButton icon={<RedoIcon />} label="Redo" disabled={!canRedo} onClick={onRedo} />
        <SmallButton
          icon={<TechnicalIcon />}
          label="Technical"
          onClick={() => setTechOpen(true)}
        />
        <SmallButton icon={<LogIcon />} label="Log" onClick={onOpenLog} />
      </div>

      {kindMenuFor && (
        <Sheet
          title={`Timeout — ${teamName(state.config, kindMenuFor)}`}
          onClose={() => setKindMenuFor(null)}
        >
          <SheetOption
            mark="timeout"
            markIcon={<TimerIcon />}
            label="Standard timeout"
            hint={`${timeoutsRemaining(state, kindMenuFor)} of ${state.config.timeoutsPerGame} left · ${state.config.timeoutSeconds}s`}
            disabled={!canCallTimeout(state, kindMenuFor, "standard")}
            onClick={() => {
              onStartTimeout(kindMenuFor, "standard");
              setKindMenuFor(null);
            }}
          />
          <SheetOption
            mark="alert"
            markIcon={<MedicalIcon />}
            label="Medical timeout"
            hint={`Does not use the allowance · ${Math.round(state.config.medicalTimeoutSeconds / 60)} min`}
            onClick={() => {
              onStartTimeout(kindMenuFor, "medical");
              setKindMenuFor(null);
            }}
          />
          <SheetOption
            mark="structural"
            markIcon={<EquipmentIcon />}
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
              mark="caution"
              markIcon={<TechnicalIcon />}
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
              mark="alert"
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
 * needs to answer "do they have one left?" without tapping anything.
 */
function TimeoutControl({
  state,
  team,
  className,
  onStandard,
  onOpenKinds,
}: {
  state: MatchState;
  team: TeamId;
  className?: string;
  onStandard: () => void;
  onOpenKinds: () => void;
}) {
  const remaining = timeoutsRemaining(state, team);
  const allowed = canCallTimeout(state, team, "standard");

  return (
    <div
      className={cn(
        "flex items-stretch gap-1 rounded-(--pp-radius-key) border border-pp-hairline bg-white p-1",
        className
      )}
    >
      <button
        type="button"
        disabled={!allowed}
        onClick={onStandard}
        className="flex min-h-14 min-w-0 flex-1 flex-col items-start justify-center gap-1.5 rounded-md px-3 py-2 text-left disabled:opacity-40"
        style={{ touchAction: "manipulation" }}
      >
        <span className="pp-legend text-pp-ink">
          T/O · {teamName(state.config, team).split(" / ")[0]}
        </span>
        {/* Allowance pips - a static resource meter, so graphite, not the
            serve/live orange. Filled = still available, hollow = spent. */}
        <span className="flex gap-1" aria-label={`${remaining} timeouts remaining`}>
          {Array.from({ length: state.config.timeoutsPerGame }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "size-2.5 rounded-full border",
                i < remaining
                  ? "border-pp-ink bg-pp-ink"
                  : "border-pp-hairline bg-transparent"
              )}
            />
          ))}
        </span>
      </button>
      <button
        type="button"
        onClick={onOpenKinds}
        aria-label={`Other timeout kinds for ${teamName(state.config, team)}`}
        className="flex size-14 shrink-0 items-center justify-center rounded-md border-l border-pp-hairline text-pp-ink-dim"
        style={{ touchAction: "manipulation" }}
      >
        <MoreIcon className="size-5" />
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
      className="pp-key pp-key--quiet min-h-11! min-w-11 gap-1 px-1.5 py-2 [&_svg]:size-4"
    >
      {icon}
      <span className="pp-legend">{label}</span>
    </button>
  );
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  // Dialog semantics for a modal that otherwise reads to assistive tech as
  // plain page content: move focus in on open, trap Tab within the panel,
  // close on Escape, and give focus back to whatever opened the sheet.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[oklch(0.22_0.01_260/0.55)] p-4"
      onClick={onClose}
    >
      {/* The panel is capped to the viewport and scrolls its own body, so long
          content (the match log) never pushes Cancel off the edge of a centred
          overlay. `dvh` accounts for mobile browser chrome; `min-h-0` lets the
          flex child shrink below its content so the body's overflow engages. */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="pp-frame flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col p-2.5"
      >
        <div className="flex shrink-0 items-center justify-between px-1.5 pt-0.5 pb-2">
          <h2 id={titleId} className="pp-plate text-sm text-white">
            {title}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="pp-legend pp-legend--onframe rounded px-2 py-1"
          >
            Close
          </button>
        </div>
        <div className="pp-panel grid min-h-0 gap-2 overflow-y-auto overscroll-contain p-2.5">
          {children}
        </div>
      </div>
    </div>
  );
}

const MARK_CLASS: Record<string, string> = {
  timeout: "pp-mark--timeout",
  alert: "pp-mark--alert",
  caution: "pp-mark--caution",
  structural: "pp-mark--structural",
};

export function SheetOption({
  label,
  hint,
  disabled,
  onClick,
  mark,
  markIcon,
}: {
  label: string;
  hint?: string;
  disabled?: boolean;
  onClick: () => void;
  /** The official mark this action carries — a fixed colour the ref recognises. */
  mark?: "timeout" | "alert" | "caution" | "structural";
  markIcon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex items-start gap-3 rounded-(--pp-radius) border border-pp-hairline bg-white px-3 py-3 text-left disabled:opacity-40"
      style={{ touchAction: "manipulation" }}
    >
      {mark && (
        <span className={cn("pp-mark mt-0.5 shrink-0 [&_svg]:size-3", MARK_CLASS[mark])}>
          {markIcon}
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-pp-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-pp-ink-dim">{hint}</span>}
      </span>
    </button>
  );
}
