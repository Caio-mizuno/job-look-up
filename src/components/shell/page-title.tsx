"use client";

import { usePathname } from "next/navigation";
import { PAGE_TITLES, SHELL_COPY } from "./copy";

export function PageTitle() {
  const pathname = usePathname();
  const title = Object.entries(PAGE_TITLES).find(([href]) => pathname.startsWith(href))?.[1] ?? SHELL_COPY.brand;
  return <h1 className="text-sm font-semibold">{title}</h1>;
}
