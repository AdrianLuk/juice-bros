"use client";

import {
  useMutation,
  useMutationState,
  type MutationKey,
  type UseMutationOptions,
} from "@tanstack/react-query";

import type { FloorCommand } from "@/lib/on-deck/floor-commands";

/**
 * A board's one floor-command mutation (issue #612), plus the kind of every
 * command still in flight. `mutationKey` is required so `useMutationState`
 * sees every pending command, not just the latest one this hook fired.
 */
export function useFloorCommand<T>(
  options: UseMutationOptions<T, Error, FloorCommand> & {
    mutationKey: MutationKey;
  },
) {
  const command = useMutation(options);
  const inFlight = useMutationState({
    filters: { mutationKey: options.mutationKey, status: "pending" },
    select: (mutation) => (mutation.state.variables as FloorCommand).kind,
  });
  return { command, inFlight };
}
