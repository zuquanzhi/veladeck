import { z } from 'zod';
import type { Store } from '../db/client.js';
import { audit } from '../lib/security.js';
export const preferences = z.object({
  notifications: z.boolean().default(true),
  projects: z.record(z.string(), z.boolean()).default({}),
  dnd_start: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .default('23:00'),
  dnd_end: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .default('08:00'),
  lockscreen_hide: z.boolean().default(true),
  theme: z.enum(['system', 'dark', 'light']).default('system'),
  retain_days: z.number().int().min(1).max(36500).default(90),
});
export type Preferences = z.infer<typeof preferences>;
export class Settings {
  constructor(public store: Store) {}
  get() {
    const row = this.store.get<{ value: string }>(
      'SELECT value FROM settings WHERE key=?',
      'preferences',
    );
    return preferences.parse(row ? JSON.parse(row.value) : {});
  }
  set(value: unknown, device: string) {
    const parsed = preferences.parse(value);
    this.store.run(
      'INSERT OR REPLACE INTO settings VALUES(?,?)',
      'preferences',
      JSON.stringify(parsed),
    );
    audit(this.store, 'settings', 'preferences', device);
    return parsed;
  }
}
