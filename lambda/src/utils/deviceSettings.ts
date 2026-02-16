import { HandlerInput } from 'ask-sdk-core';
import axios from 'axios';

/**
 * Get the device timezone from the Alexa Settings API (e.g. "Europe/Rome").
 * Requires the skill to have permission to read device settings (enable in Alexa Developer Console).
 * Returns null if context is missing or the API call fails.
 */
export async function getDeviceTimeZone(handlerInput: HandlerInput): Promise<string | null> {
  const ctx = handlerInput.requestEnvelope.context;
  const apiEndpoint = (ctx as any)?.System?.apiEndpoint;
  const apiAccessToken = (ctx as any)?.System?.apiAccessToken;
  const deviceId = (ctx as any)?.System?.device?.deviceId;

  if (!apiEndpoint || !apiAccessToken || !deviceId) {
    return null;
  }

  const url = `${apiEndpoint}/v2/devices/${deviceId}/settings/System.timeZone`;
  try {
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${apiAccessToken}` },
      timeout: 2000,
    });
    const tz = res.data?.timeZoneId ?? (typeof res.data === 'string' ? res.data : null);
    return tz && typeof tz === 'string' ? tz : null;
  } catch (err) {
    console.warn('[deviceSettings] getDeviceTimeZone failed:', (err as Error)?.message);
    return null;
  }
}

/**
 * Convert an ISO date-time (stored as UTC) so that the same wall-clock time is interpreted
 * in the device timezone and returned as UTC. Use when the user said e.g. "4 PM" and we
 * stored 4 PM UTC, but they meant 4 PM in their device timezone (e.g. Europe/Rome).
 * Returns the new ISO string.
 */
export function convertTimeToDeviceTimeZone(isoString: string, deviceTimeZone: string): string {
  const d = new Date(isoString);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const utcH = d.getUTCHours();
  const utcMin = d.getUTCMinutes();

  const ref = Date.UTC(y, m, day, utcH, utcMin, 0);
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: deviceTimeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = dtf.formatToParts(new Date(ref));
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  const localH = Number(getPart('hour'));
  const localMin = Number(getPart('minute'));

  const offsetMs = ((localH - utcH) * 60 + (localMin - utcMin)) * 60000;
  const result = new Date(ref - offsetMs);
  return result.toISOString();
}
