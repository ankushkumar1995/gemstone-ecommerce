"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { shopApi } from "@/lib/shop-api";

const inputClass =
  "w-full rounded-xl border border-foreground/15 bg-void px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted/70 focus:border-gold-400/70 focus:ring-2 focus:ring-gold-400/20";

/**
 * Birth-place autocomplete backed by the built-in city list. Writes the chosen
 * city name into a hidden-free controlled value the parent form reads by `name`.
 */
export function CityInput({
  name,
  placeholder = "City of birth",
  defaultValue = "",
}: {
  name: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<Array<{ label: string; value: string }>>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value.trim().length < 2) return;
    let active = true;
    const t = setTimeout(async () => {
      const res = await shopApi.astrology.cities(value);
      if (active && res.ok) setSuggestions(res.data);
    }, 180);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [value]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <MapPin size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          name={name}
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            const v = e.target.value;
            setValue(v);
            setOpen(true);
            if (v.trim().length < 2) setSuggestions([]);
          }}
          onFocus={() => value.trim().length >= 2 && setOpen(true)}
          className={`${inputClass} pl-9`}
        />
      </div>
      {open && suggestions.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-foreground/10 bg-nebula py-1 shadow-xl">
          {suggestions.map((s) => (
            <li key={s.label}>
              <button
                type="button"
                onClick={() => {
                  setValue(s.value);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-gold-400/10"
              >
                <MapPin size={13} className="text-gold-500" />
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
