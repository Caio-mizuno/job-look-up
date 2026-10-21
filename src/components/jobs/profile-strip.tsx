"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { JOBS_COPY as C } from "./copy";

export type ProfileSummary = { name: string; headline: string; skills: string[] };

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";

export function ProfileStrip({
  profile,
  searching,
  onSearch,
}: {
  profile: ProfileSummary;
  searching: boolean;
  onSearch: () => void;
}) {
  return (
    <Card className="flex-row flex-wrap items-center gap-3 px-4 py-3">
      <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold">
        {initials(profile.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {profile.name}
          {profile.headline && <span className="text-muted-foreground font-normal"> · {profile.headline}</span>}
        </p>
        {profile.skills.length > 0 && <p className="text-muted-foreground truncate text-xs">{profile.skills.join(" · ")}</p>}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/perfil">{C.editProfile}</Link>
        </Button>
        <Button size="sm" disabled={searching} onClick={onSearch}>
          <Search />
          {searching ? C.searching : C.searchNow}
        </Button>
      </div>
    </Card>
  );
}
