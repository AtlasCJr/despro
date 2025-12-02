// LastUpdatedLabel.tsx
import { useState, useEffect } from "react";

export function formatTime(x: number): string {
  const d = Math.floor(x / 86400);
  const h = Math.floor((x % 86400) / 3600);
  const m = Math.floor((x % 3600) / 60);
  const s = x % 60;

  if (x < 60) return `${s}s`;
  if (x < 3600) return `${m}m ${s}s`;
  if (x < 86400) return `${h}h ${m}m ${s}s`;
  return `${d}d ${h}h ${m}m ${s}s`;
}

export function LastUpdatedLabel({ latestTs }: { latestTs: number }) {
    const [label, setLabel] = useState("");

    useEffect(() => {
        const timer = setInterval(() => {
            if (latestTs) {
                const diffSec = Math.floor((Date.now() - latestTs) / 1000);
                setLabel(formatTime(diffSec));
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [latestTs]);

    return <h1>{label}</h1>;
}
