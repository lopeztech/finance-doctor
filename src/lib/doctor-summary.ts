export interface DoctorSummaryItem {
  title: string;
  detail: string;
}

// Parse the "Action Plan" <ol> from an HTML doctor response and return up to 2 items.
export function extractDoctorActions(html: string): DoctorSummaryItem[] {
  const actionPlanIdx = html.search(/<h4[^>]*>[^<]*(?:action plan|next steps)[^<]*<\/h4>/i);
  const searchFrom = actionPlanIdx >= 0 ? actionPlanIdx : 0;

  const listMatch = html.slice(searchFrom).match(/<(?:ol|ul)[^>]*>([\s\S]*?)<\/(?:ol|ul)>/i);
  if (!listMatch) return [];

  const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  const items: DoctorSummaryItem[] = [];
  let m;

  while ((m = liPattern.exec(listMatch[1])) !== null && items.length < 2) {
    const text = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (text.length < 3) continue;

    const dashIdx = text.search(/\s[—–]\s/);
    const colonIdx = text.indexOf(':');

    let title: string;
    let detail: string;

    if (dashIdx > 0) {
      title = text.slice(0, dashIdx).trim();
      detail = text.slice(dashIdx + 3).trim();
    } else if (colonIdx > 0 && colonIdx < 60) {
      title = text.slice(0, colonIdx).trim();
      detail = text.slice(colonIdx + 1).trim();
    } else {
      title = text.trim();
      detail = '';
    }

    items.push({ title: title.slice(0, 80), detail: detail.slice(0, 150) });
  }

  return items;
}
