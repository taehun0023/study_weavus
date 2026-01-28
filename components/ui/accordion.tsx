"use client";

import * as React from "react";

type AccordionType = "single" | "multiple";

type AccordionContextValue = {
  type: AccordionType;
  openValues: string[];
  setOpenValues: (next: string[]) => void;
};

const AccordionContext = React.createContext<AccordionContextValue | null>(
  null,
);

function useAccordionCtx() {
  const ctx = React.useContext(AccordionContext);
  if (!ctx) {
    throw new Error("Accordion components must be used within <Accordion />");
  }
  return ctx;
}

export function Accordion({
  type = "single",
  value,
  defaultValue,
  onValueChange,
  className,
  children,
}: {
  type?: AccordionType;
  value?: string | string[];
  defaultValue?: string | string[];
  onValueChange?: (v: string | string[]) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const isControlled = value !== undefined;

  const init = React.useMemo(() => {
    const v = isControlled ? value : defaultValue;
    if (type === "multiple") {
      if (Array.isArray(v)) return v.filter(Boolean);
      return v ? [String(v)] : [];
    } else {
      if (Array.isArray(v)) return v.length ? [String(v[0])] : [];
      return v ? [String(v)] : [];
    }
  }, [type, value, defaultValue, isControlled]);

  const [uncontrolled, setUncontrolled] = React.useState<string[]>(init);

  const openValues = (
    isControlled
      ? (() => {
          if (type === "multiple") {
            if (Array.isArray(value)) return value.map(String);
            return value ? [String(value)] : [];
          }
          if (Array.isArray(value))
            return value.length ? [String(value[0])] : [];
          return value ? [String(value)] : [];
        })()
      : uncontrolled
  ) as string[];

  const setOpenValues = (next: string[]) => {
    if (!isControlled) setUncontrolled(next);
    if (onValueChange) {
      if (type === "multiple") onValueChange(next);
      else onValueChange(next[0] ?? "");
    }
  };

  return (
    <AccordionContext.Provider value={{ type, openValues, setOpenValues }}>
      <div className={className}>{children}</div>
    </AccordionContext.Provider>
  );
}

type ItemContextValue = { value: string; isOpen: boolean; toggle: () => void };
const ItemContext = React.createContext<ItemContextValue | null>(null);
function useItemCtx() {
  const ctx = React.useContext(ItemContext);
  if (!ctx) throw new Error("AccordionItem must be used within Accordion");
  return ctx;
}

export function AccordionItem({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { type, openValues, setOpenValues } = useAccordionCtx();

  const isOpen = openValues.includes(value);

  const toggle = () => {
    if (type === "multiple") {
      const next = isOpen
        ? openValues.filter((v) => v !== value)
        : [...openValues, value];
      setOpenValues(next);
    } else {
      const next = isOpen ? [] : [value];
      setOpenValues(next);
    }
  };

  return (
    <ItemContext.Provider value={{ value, isOpen, toggle }}>
      <div className={className}>{children}</div>
    </ItemContext.Provider>
  );
}

export function AccordionTrigger({
  className,
  children,
  onClick,
}: {
  className?: string;
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}) {
  const { isOpen, toggle } = useItemCtx();

  return (
    <button
      type="button"
      className={
        className ?? "flex w-full items-center justify-between py-3 text-left"
      }
      aria-expanded={isOpen}
      onClick={(e) => {
        toggle();
        onClick?.(e);
      }}
    >
      <span>{children}</span>
      <span className="ml-1 text-xs opacity-70">{isOpen ? "▲" : "▼"}</span>
    </button>
  );
}

export function AccordionContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const { isOpen } = useItemCtx();

  if (!isOpen) return null;

  return <div className={className ?? "pb-3"}>{children}</div>;
}
