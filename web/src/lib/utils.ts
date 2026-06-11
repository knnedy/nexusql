import { parseISO, formatDistanceToNowStrict } from "date-fns";

export function formatRelativeTime(iso: string): string {
  if (!iso || typeof iso !== "string") {
    return "Unknown date";
  }

  try {
    const date = parseISO(iso);

    if (isNaN(date.getTime())) {
      return "Unknown date";
    }

    const distance = formatDistanceToNowStrict(date, { addSuffix: true });

    return distance
      .replace(" seconds ago", "s ago")
      .replace(" second ago", "s ago")
      .replace(" minutes ago", "m ago")
      .replace(" minute ago", "m ago")
      .replace(" hours ago", "h ago")
      .replace(" hour ago", "h ago")
      .replace(" days ago", "d ago")
      .replace(" day ago", "d ago")
      .replace(" months ago", "mo ago")
      .replace(" month ago", "mo ago")
      .replace("in 0 seconds", "Just now")
      .replace("0 seconds ago", "Just now");
  } catch (error) {
    console.error("Error formatting relative time:", error);
    return "Unknown date";
  }
}
