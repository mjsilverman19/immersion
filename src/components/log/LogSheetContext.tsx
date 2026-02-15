"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface LogSheetContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const LogSheetContext = createContext<LogSheetContextType>({
  isOpen: false,
  open: () => {},
  close: () => {},
});

export function LogSheetProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <LogSheetContext.Provider value={{ isOpen, open, close }}>
      {children}
    </LogSheetContext.Provider>
  );
}

export function useLogSheet() {
  return useContext(LogSheetContext);
}
