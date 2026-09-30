export function isDict(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Accepts 12, "12", "12px", "1.5rem". */
export function cssLength(value: unknown, fallback: string): string {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number') return `${value}px`;
  const text = String(value).trim();
  return /^[\d.]+$/.test(text) ? `${text}px` : text;
}

export function fireEvent(node: EventTarget, type: string, detail: unknown = {}): Event {
  const event = new Event(type, { bubbles: true, cancelable: false, composed: true });
  (event as Event & { detail: unknown }).detail = detail;
  node.dispatchEvent(event);
  return event;
}
