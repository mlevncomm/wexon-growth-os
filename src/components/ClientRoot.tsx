"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { RuntimeShell } from "./RuntimeShell";
import { ToastProvider } from "./Toast";

export function ClientRoot({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (pathname.startsWith("/giris")) {
    return <ToastProvider>{children}</ToastProvider>;
  }
  if (!ready) {
    return <div className="os" suppressHydrationWarning aria-busy="true" />;
  }
  return <RuntimeShell>{children}</RuntimeShell>;
}
