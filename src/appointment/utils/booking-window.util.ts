/**
 * Day 19 — Booking Window Utility
 *
 * Rules:
 *   Booking opens  = doctor's consultationStartTime − WINDOW_OPEN_HOURS_BEFORE  (2 h)
 *   Booking closes = doctor's consultationEndTime   − WINDOW_CLOSE_HOURS_BEFORE (1 h)
 *
 * All time comparisons happen in the doctor's configured timezone (IANA string).
 * Falls back to UTC when timezone is null/undefined.
 *
 * This module is intentionally framework-free so it can be unit-tested without
 * spinning up a NestJS application context.
 */

export const WINDOW_OPEN_HOURS_BEFORE  = 2;  // hours before consultation start
export const WINDOW_CLOSE_HOURS_BEFORE = 1;  // hours before consultation end

export interface BookingWindow {
  opensAt:  string;   // HH:MM local time
  closesAt: string;   // HH:MM local time
  timezone: string;
}

export interface WindowCheckResult {
  allowed:   boolean;
  window:    BookingWindow;
  reason?:   string;  // present only when allowed = false
  nowLocal?: string;  // current HH:MM in doctor's timezone (for error messages)
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Parse "HH:MM" into total minutes from midnight. */
function toMinutes(hhmm: string): number {
  const [hh, mm] = hhmm.split(':').map(Number);
  return hh * 60 + mm;
}

/** Format total minutes from midnight back to "HH:MM". */
function fromMinutes(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Get the current wall-clock time (HH:MM) in a given IANA timezone.
 * Uses Intl.DateTimeFormat which is available in Node 12+ without extra deps.
 */
function nowInTimezone(timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
  }).formatToParts(new Date());

  const hour   = parts.find(p => p.type === 'hour')?.value   ?? '00';
  const minute = parts.find(p => p.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

/**
 * Validate the HH:MM format and that hours 0–23, minutes 0–59.
 * Throws BadRequestException-style error string (caller wraps it).
 */
export function validateTimeFormat(value: string, fieldName: string): void {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    throw new Error(`${fieldName} must be in HH:MM format (e.g. "09:00").`);
  }
  const [hh, mm] = value.split(':').map(Number);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    throw new Error(`${fieldName} has an invalid time value.`);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute the booking window for a doctor given their consultation times.
 *
 * @param consultationStartTime  "HH:MM"
 * @param consultationEndTime    "HH:MM"
 * @returns BookingWindow with opensAt and closesAt in the same local frame
 */
export function computeBookingWindow(
  consultationStartTime: string,
  consultationEndTime:   string,
): BookingWindow {
  validateTimeFormat(consultationStartTime, 'consultationStartTime');
  validateTimeFormat(consultationEndTime,   'consultationEndTime');

  const startMins = toMinutes(consultationStartTime);
  const endMins   = toMinutes(consultationEndTime);

  if (startMins >= endMins) {
    throw new Error(
      'consultationStartTime must be before consultationEndTime.',
    );
  }

  const openMins  = startMins - WINDOW_OPEN_HOURS_BEFORE  * 60;
  const closeMins = endMins   - WINDOW_CLOSE_HOURS_BEFORE * 60;

  if (openMins < 0) {
    throw new Error(
      `Booking window opens before midnight (consultationStartTime − ${WINDOW_OPEN_HOURS_BEFORE}h < 00:00). ` +
      `Please set consultationStartTime to at least ${fromMinutes(WINDOW_OPEN_HOURS_BEFORE * 60)} or later.`,
    );
  }

  if (openMins >= closeMins) {
    throw new Error(
      `Booking window would open at or after it closes ` +
      `(opens ${fromMinutes(openMins)}, closes ${fromMinutes(closeMins)}). ` +
      `Consultation duration must be longer than ${WINDOW_OPEN_HOURS_BEFORE + WINDOW_CLOSE_HOURS_BEFORE} hours.`,
    );
  }

  return {
    opensAt:  fromMinutes(openMins),
    closesAt: fromMinutes(closeMins),
    timezone: 'UTC', // caller injects the real timezone into the result
  };
}

/**
 * Check whether a booking is allowed RIGHT NOW for a given doctor's
 * consultation schedule.
 *
 * Pass `nowOverride` (HH:MM) in tests to pin the clock.
 *
 * Returns `{ allowed: true }` when the window is open.
 * Returns `{ allowed: false, reason: '...' }` with a human-readable message.
 *
 * If the doctor has no consultationStartTime/EndTime configured, booking is
 * ALWAYS allowed (no window enforcement).
 */
export function checkBookingWindow(
  consultationStartTime: string | null | undefined,
  consultationEndTime:   string | null | undefined,
  timezone:              string | null | undefined,
  nowOverride?:          string,   // HH:MM — for unit tests only
): WindowCheckResult {
  // No consultation times configured → no window restriction
  if (!consultationStartTime || !consultationEndTime) {
    return {
      allowed: true,
      window:  { opensAt: '00:00', closesAt: '23:59', timezone: 'UTC' },
    };
  }

  const tz = timezone || 'UTC';
  let window: BookingWindow;

  try {
    window = computeBookingWindow(consultationStartTime, consultationEndTime);
    window.timezone = tz;
  } catch (err: any) {
    // Invalid configuration on the doctor record — surface as not-allowed
    return {
      allowed: false,
      window:  { opensAt: '??:??', closesAt: '??:??', timezone: tz },
      reason:  `Invalid doctor consultation configuration: ${err.message}`,
    };
  }

  const nowLocal  = nowOverride ?? nowInTimezone(tz);
  const nowMins   = toMinutes(nowLocal);
  const openMins  = toMinutes(window.opensAt);
  const closeMins = toMinutes(window.closesAt);

  if (nowMins < openMins) {
    return {
      allowed:  false,
      window,
      nowLocal,
      reason:
        `Booking window has not opened yet. It opens at ${window.opensAt} ` +
        `(${WINDOW_OPEN_HOURS_BEFORE} hours before consultation starts at ` +
        `${consultationStartTime}). Current time: ${nowLocal} ${tz}.`,
    };
  }

  if (nowMins >= closeMins) {
    return {
      allowed:  false,
      window,
      nowLocal,
      reason:
        `Booking window is closed. It closed at ${window.closesAt} ` +
        `(${WINDOW_CLOSE_HOURS_BEFORE} hour before consultation ends at ` +
        `${consultationEndTime}). Current time: ${nowLocal} ${tz}.`,
    };
  }

  return { allowed: true, window, nowLocal };
}