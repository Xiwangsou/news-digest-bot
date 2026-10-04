import { Router } from 'express';
import { queryAll, queryOne, run } from '../db.js';

export const settingsRouter = Router();

// Lets the server react to changes (e.g. re-arm the digest cron) without
// this route needing to know about cron.
let onChange = null;
export function onSettingsChange(fn) { onChange = fn; }
settingsRouter.setOnChange = (fn) => { onChange = fn; };

export const DEFAULTS = {
  theme: 'dark',
  digestHour: '8',
  articlesPerDigest: '50',
  autoFetchOnGenerate: 'true',
  retentionDays: '90',
  maxSharePerSource: '0.34'
};

// Whitelist + coercion: arbitrary keys and junk values are rejected outright.
const SCHEMA = {
  theme: { type: 'enum', values: ['dark', 'light'] },
  digestHour: { type: 'int', min: 0, max: 23 },
  articlesPerDigest: { type: 'int', min: 10, max: 200 },
  autoFetchOnGenerate: { type: 'bool' },
  retentionDays: { type: 'int', min: 1, max: 3650 },
  maxSharePerSource: { type: 'float', min: 0.1, max: 1 }
};

function coerce(key, value) {
  const rule = SCHEMA[key];
  if (!rule) return { ok: false, error: `Unknown setting "${key}"` };

  if (rule.type === 'bool') {
    if (value === true || value === 'true' || value === 1 || value === '1') return { ok: true, value: 'true' };
    if (value === false || value === 'false' || value === 0 || value === '0') return { ok: true, value: 'false' };
    return { ok: false, error: `${key} must be true or false` };
  }

  // Enum first: Number('dark') is NaN, so a numeric check placed above this
  // would reject every string setting before the enum branch is reached.
  if (rule.type === 'enum') {
    if (!rule.values.includes(String(value))) {
      return { ok: false, error: `${key} must be one of ${rule.values.join(', ')}` };
    }
    return { ok: true, value: String(value) };
  }

  const n = Number(value);
  if (Number.isNaN(n)) return { ok: false, error: `${key} must be a number` };

  if (rule.type === 'int') {
    if (!Number.isInteger(n)) return { ok: false, error: `${key} must be a whole number` };
    if (n < rule.min || n > rule.max) return { ok: false, error: `${key} must be between ${rule.min} and ${rule.max}` };
    return { ok: true, value: String(n) };
  }

  if (rule.type === 'float') {
    if (n < rule.min || n > rule.max) return { ok: false, error: `${key} must be between ${rule.min} and ${rule.max}` };
    return { ok: true, value: String(n) };
  }

  return { ok: false, error: `Unsupported type for ${key}` };
}

settingsRouter.get('/', (req, res) => {
  const rows = queryAll('SELECT * FROM settings');
  const settings = { ...DEFAULTS };
  for (const r of rows) settings[r.key] = r.value;
  res.json(settings);
});

settingsRouter.put('/', (req, res) => {
  const body = req.body || {};
  const entries = Object.entries(body);
  if (!entries.length) return res.status(400).json({ error: 'No settings provided' });

  // Validate everything before writing anything.
  const accepted = [];
  const errors = {};
  for (const [key, value] of entries) {
    const result = coerce(key, value);
    if (result.ok) accepted.push([key, result.value]);
    else errors[key] = result.error;
  }
  if (!accepted.length) {
    return res.status(400).json({ error: 'No valid settings provided', details: errors });
  }

  let updated = 0;
  for (const [key, value] of accepted) {
    const existing = queryOne('SELECT key FROM settings WHERE key = ?', [key]);
    if (existing) run('UPDATE settings SET value = ? WHERE key = ?', [value, key]);
    else run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value]);
    updated++;
  }

  const res2 = { success: true, updated, settings: {} };
  for (const [k, v] of accepted) res2.settings[k] = v;
  if (Object.keys(errors).length) res2.rejected = errors;

  // Notify the server so time-based jobs can re-arm immediately.
  if (onChange) {
    try { onChange(Object.fromEntries(accepted)); } catch (e) { console.error('[Settings] onChange failed:', e); }
  }

  res.json(res2);
});
