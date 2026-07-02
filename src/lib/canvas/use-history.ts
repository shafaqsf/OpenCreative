"use client";

import { useCallback, useRef, useState } from "react";

export type HistoryState<T> = {
  present: T;
  past: T[];
  future: T[];
};

export type HistoryActions<T> = {
  set: (updater: T | ((prev: T) => T)) => void;
  replace: (updater: T | ((prev: T) => T)) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  reset: (state: T) => void;
};

export function useHistory<T>(
  initial: T,
  options: { max?: number } = {}
): HistoryState<T> & HistoryActions<T> {
  const max = options.max ?? 100;
  const [past, setPast] = useState<T[]>([]);
  const [present, setPresent] = useState<T>(initial);
  const [future, setFuture] = useState<T[]>([]);

  const historyStateRef = useRef({ past, present, future });
  historyStateRef.current = { past, present, future };

  const set = useCallback(
    (updater: T | ((prev: T) => T)) => {
      const current = historyStateRef.current.present;
      const next = typeof updater === "function" ? (updater as (prev: T) => T)(current) : updater;
      if (next === current) return;
      historyStateRef.current = {
        ...historyStateRef.current,
        present: next,
        future: [],
      };
      setPast((prev) => {
        const nextPast = [...prev, current];
        if (nextPast.length > max) nextPast.shift();
        return nextPast;
      });
      setFuture([]);
      setPresent(next);
    },
    [max]
  );

  const replace = useCallback(
    (updater: T | ((prev: T) => T)) => {
      const current = historyStateRef.current.present;
      const next = typeof updater === "function" ? (updater as (prev: T) => T)(current) : updater;
      if (next === current) return;
      historyStateRef.current = {
        ...historyStateRef.current,
        present: next,
      };
      setPresent(next);
    },
    []
  );

  const undo = useCallback(() => {
    const currentState = historyStateRef.current;
    if (currentState.past.length === 0) return;
    const previous = currentState.past[currentState.past.length - 1];
    const nextPast = currentState.past.slice(0, -1);
    const nextFuture = [currentState.present, ...currentState.future];
    historyStateRef.current = {
      past: nextPast,
      present: previous,
      future: nextFuture,
    };
    setPast(nextPast);
    setFuture(nextFuture);
    setPresent(previous);
  }, []);

  const redo = useCallback(() => {
    const currentState = historyStateRef.current;
    if (currentState.future.length === 0) return;
    const [next, ...rest] = currentState.future;
    const nextPast = [...currentState.past, currentState.present];
    historyStateRef.current = {
      past: nextPast,
      present: next,
      future: rest,
    };
    setPast(nextPast);
    setFuture(rest);
    setPresent(next);
  }, []);

  const reset = useCallback((state: T) => {
    historyStateRef.current = { past: [], present: state, future: [] };
    setPast([]);
    setFuture([]);
    setPresent(state);
  }, []);

  return {
    present,
    past,
    future,
    set,
    replace,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    reset,
  };
}
