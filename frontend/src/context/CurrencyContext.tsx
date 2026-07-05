import { ReactNode, createContext, useContext, useState } from "react";

import { Currency } from "../api/client";

const STORAGE_KEY = "currency";

interface CurrencyContextValue {
  currency: Currency;
  toggleCurrency: () => void;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

function getInitialCurrency(): Currency {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "brl" ? "brl" : "usd";
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<Currency>(getInitialCurrency);

  function toggleCurrency() {
    setCurrency((current) => {
      const next = current === "usd" ? "brl" : "usd";
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }

  return <CurrencyContext.Provider value={{ currency, toggleCurrency }}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error("useCurrency must be used within CurrencyProvider");
  }
  return ctx;
}
