import type { LovelaceCardConfig } from '../types';
import { isDict } from '../utils';

/**
 * The card clipboard Home Assistant's own editors use: JSON in sessionStorage
 * under this key, written by the stack and grid card editors and by the
 * dashboard's copy and cut commands.
 *
 * Reading it here always sees what Home Assistant copied. The reverse is
 * weaker: Home Assistant reads the key once per page load and keeps the value
 * in memory, so a card copied here shows up in its card picker only after a
 * reload. This editor therefore offers its own paste, which sees both.
 */
const KEY = 'dashboardCardClipboard';

export function readClipboard(): LovelaceCardConfig | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    return isDict(value) && typeof value.type === 'string' ? (value as LovelaceCardConfig) : null;
  } catch {
    return null;
  }
}

export function writeClipboard(card: LovelaceCardConfig): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(card));
  } catch {
    // Storage can be unavailable (private mode); copying then does nothing.
  }
}
