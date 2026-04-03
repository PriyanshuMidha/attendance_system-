import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

const STORAGE_KEY = 'attendance-view-month-year';

export type ViewMonthState = { month: number; year: number };

interface ViewMonthContextType extends ViewMonthState {
  setViewMonthYear: (month: number, year: number) => void;
}

const ViewMonthContext = createContext<ViewMonthContextType | undefined>(undefined);

function readStored(): ViewMonthState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as { month?: number; year?: number };
    if (
      typeof o.month === 'number' &&
      o.month >= 1 &&
      o.month <= 12 &&
      typeof o.year === 'number' &&
      o.year >= 2000 &&
      o.year <= 2100
    ) {
      return { month: o.month, year: o.year };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export const ViewMonthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ViewMonthState>(() => {
    const now = new Date();
    return readStored() ?? { month: now.getMonth() + 1, year: now.getFullYear() };
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const setViewMonthYear = useCallback((month: number, year: number) => {
    const m = Math.min(12, Math.max(1, Math.floor(month)));
    const y = Math.floor(year);
    setState({ month: m, year: y });
  }, []);

  return (
    <ViewMonthContext.Provider value={{ ...state, setViewMonthYear }}>{children}</ViewMonthContext.Provider>
  );
};

export const useViewMonth = () => {
  const ctx = useContext(ViewMonthContext);
  if (!ctx) {
    throw new Error('useViewMonth must be used within ViewMonthProvider');
  }
  return ctx;
};

/** First calendar day of the given month/year as YYYY-MM-DD */
export function firstDayOfMonthIso(year: number, month: number): string {
  const y = String(year);
  const m = String(month).padStart(2, '0');
  return `${y}-${m}-01`;
}
