import { useEffect, useState } from "react";
import { avatarSrc } from "@/lib/people-rules";
import { cn } from "@/lib/utils";

/** Photo (uploaded or Instagram), a default illustration, or the initial as fallback. */
export function PersonAvatar({ person, className }: { person: { id?: string | null; display_name: string; photo_url?: string | null; instagram?: string | null }; className?: string }) {
  const src = avatarSrc(person);
  const [ok, setOk] = useState(true);
  useEffect(() => setOk(true), [src]);
  return (
    <span className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary font-serif", className)}>
      {src && ok ? <img src={src} alt="" onError={() => setOk(false)} className="size-full object-cover" /> : person.display_name.slice(0, 1).toUpperCase()}
    </span>
  );
}
