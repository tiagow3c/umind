import avatar1 from "@/assets/avatars/avatar-1.png";
import avatar2 from "@/assets/avatars/avatar-2.png";
import avatar3 from "@/assets/avatars/avatar-3.png";
import avatar4 from "@/assets/avatars/avatar-4.png";
import avatar5 from "@/assets/avatars/avatar-5.png";
import { avatarSrc } from "@/lib/people-rules";

/** Ilustrações padrão na paleta do app, usadas quando a pessoa não tem foto. */
export const DEFAULT_AVATARS = [avatar1, avatar2, avatar3, avatar4, avatar5];

/** Escolhe um avatar padrão de forma estável a partir do id da pessoa. */
export function defaultAvatarFor(id: string | null | undefined): string {
  let h = 0;
  const key = id ?? "";
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return DEFAULT_AVATARS[h % DEFAULT_AVATARS.length];
}

/** Foto enviada ou do Instagram; se não houver, uma ilustração padrão. */
export function personAvatarSrc(p: { id?: string | null; photo_url?: string | null; instagram?: string | null } | null | undefined): string {
  return avatarSrc(p) ?? defaultAvatarFor(p?.id);
}
