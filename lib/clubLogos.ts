/** Normalized slug for static logo paths under `/public/clubs/`. */
export function clubSlug(club: string): string {
  return club
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function clubLogoSrc(club: string): string {
  return `/clubs/${clubSlug(club)}.png`;
}

export function clubInitials(club: string): string {
  const words = club.replace(/\s+U20$/i, "").split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
