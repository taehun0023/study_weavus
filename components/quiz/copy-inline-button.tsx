"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function CopyInlineButton({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const [label, setLabel] = useState("복사");

  async function onCopy() {
    const value = text ?? "";
    try {
      await navigator.clipboard.writeText(value);
      setLabel("복사됨");
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = value;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setLabel("복사됨");
      } catch {
        setLabel("실패");
      }
    } finally {
      setTimeout(() => setLabel("복사"), 900);
    }
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className={className}
      onClick={onCopy}
    >
      {label}
    </Button>
  );
}
