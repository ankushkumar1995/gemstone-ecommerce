"use client";

/**
 * Multi-currency support.
 *
 * All product prices are stored in INR (the base currency). This context lets
 * a shopper pick a display currency; every price shown on the site is then
 * converted and formatted accordingly. The choice persists in localStorage.
 *
 * NOTE: the rates below are approximate static values (1 INR → X). In
 * production, fetch live rates from an FX API on mount and feed them here —
 * no component code needs to change.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface Currency {
  code: string; // ISO code, e.g. "USD"
  symbol: string; // display symbol, e.g. "$"
  label: string; // human label
  flag: string; // emoji flag
  rate: number; // 1 INR = `rate` units of this currency
  /** number of decimal places to show */
  decimals: number;
}

export const CURRENCIES: Currency[] = [
  { code: "INR", symbol: "₹", label: "Indian Rupee", flag: "🇮🇳", rate: 1, decimals: 0 },
  { code: "USD", symbol: "$", label: "US Dollar", flag: "🇺🇸", rate: 0.012, decimals: 2 },
  { code: "EUR", symbol: "€", label: "Euro", flag: "🇪🇺", rate: 0.011, decimals: 2 },
  { code: "GBP", symbol: "£", label: "British Pound", flag: "🇬🇧", rate: 0.0095, decimals: 2 },
  { code: "AED", symbol: "د.إ", label: "UAE Dirham", flag: "🇦🇪", rate: 0.044, decimals: 2 },
  { code: "SGD", symbol: "S$", label: "Singapore Dollar", flag: "🇸🇬", rate: 0.016, decimals: 2 },
  { code: "AUD", symbol: "A$", label: "Australian Dollar", flag: "🇦🇺", rate: 0.018, decimals: 2 },
  { code: "CAD", symbol: "C$", label: "Canadian Dollar", flag: "🇨🇦", rate: 0.016, decimals: 2 },
];

const STORAGE_KEY = "astrounkle-currency";

interface CurrencyContextValue {
  currency: Currency;
  currencies: Currency[];
  setCurrency: (code: string) => void;
  /** convert an INR amount and format it with the active currency */
  format: (inr: number) => string;
  /** convert an INR amount to the active currency as a number */
  convert: (inr: number) => number;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [code, setCode] = useState("INR");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && CURRENCIES.some((c) => c.code === saved)) setCode(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const setCurrency = useCallback((next: string) => {
    setCode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<CurrencyContextValue>(() => {
    const currency = CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
    const convert = (inr: number) => inr * currency.rate;
    const format = (inr: number) => {
      const amount = convert(inr);
      const formatted = new Intl.NumberFormat("en-IN", {
        minimumFractionDigits: currency.decimals,
        maximumFractionDigits: currency.decimals,
      }).format(amount);
      // keep the Rupee sign tight; add a space for word-ish symbols
      const space = currency.symbol.length > 1 ? " " : "";
      return `${currency.symbol}${space}${formatted}`;
    };
    return { currency, currencies: CURRENCIES, setCurrency, format, convert };
  }, [code, setCurrency]);

  return (
    <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return ctx;
}
