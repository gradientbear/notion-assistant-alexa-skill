import * as chrono from 'chrono-node';
// Note: chrono-node handles Italian dates through its default parser
// We use locale-specific keyword matching for better accuracy

export type Locale = 'en-US' | 'it-IT' | 'fr-FR' | 'es-ES' | 'es-MX';

export interface ParsedTask {
  taskName: string;
  parsedName: string;
  dueDateTime?: string | null;
  status?: 'TO DO' | 'DONE';
  category?: 'PERSONAL' | 'WORK';
  priority?: 'LOW' | 'NORMAL' | 'HIGH';
}

export interface QueryFilter {
  type: 'time' | 'status' | 'category' | 'priority' | 'keyword' | 'combination';
  filters: any; // Notion filter object
  keyword?: string;
}

const LOCALE_TIME_ZONES: Record<Locale, string> = {
  'it-IT': 'Europe/Rome',
  'fr-FR': 'Europe/Paris',
  'es-ES': 'Europe/Madrid',
  'es-MX': 'America/Mexico_City',
  'en-US': 'UTC',
};

function getCalendarDateInTz(date: Date, timezone: string): { y: number; m: number; d: number } {
  const dtf = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = dtf.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '0';
  return {
    y: Number(get('year')),
    m: Number(get('month')) - 1,
    d: Number(get('day')),
  };
}

/** Format date as YYYY-MM-DD in the given timezone (user's calendar date). */
function formatDateOnly(date: Date, timezone: string = 'UTC'): string {
  const { y, m, d } = getCalendarDateInTz(date, timezone);
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** When time is midnight in the given timezone, return date-only so Notion shows "February 10, 2026" without time. */
function formatDueDateTime(date: Date, timezone: string = 'UTC'): string {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const parts = dtf.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '0';
  const h = Number(get('hour'));
  const min = Number(get('minute'));
  const sec = Number(get('second'));
  if (h === 0 && min === 0 && sec === 0) {
    return formatDateOnly(date, timezone);
  }
  return date.toISOString();
}

/** Return UTC instant of midnight on the calendar date of dateToUse in the given timezone. */
function getMidnightInTimezone(dateToUse: Date, timezone: string): Date {
  const { y, m, d } = getCalendarDateInTz(dateToUse, timezone);
  const refUtc = Date.UTC(y, m, d, 0, 0, 0);
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const parts = dtf.formatToParts(new Date(refUtc));
  const get = (type: string) => parts.find(p => p.type === type)?.value || '0';
  const h = Number(get('hour'));
  const min = Number(get('minute'));
  const sec = Number(get('second'));
  const offsetMinutes = h * 60 + min + sec / 60;
  return new Date(refUtc - offsetMinutes * 60000);
}

/**
 * Clean task name by removing date/time references and command words
 */
function cleanTaskName(raw: string, locale: Locale = 'en-US'): string {
  if (!raw) return '';
  
  let text = raw.trim();
  
  // Remove common command prefixes (English, Italian, French, Spanish)
  const prefixPatterns = [
    /^add\s+/i,
    /^create\s+/i,
    /^remind me to\s+/i,
    /^set\s+/i,
    /^update\s+/i,
    /^change\s+/i,
    /^modify\s+/i,
    // Remove "the task:" / "the tasks:" prefixes (common in test sentences)
    /^the\s+task:\s+/i,
    /^the\s+tasks:\s+/i,
    /^task:\s+/i,
    /^tasks:\s+/i,
    // Delete/remove prefixes (English)
    /^delete\s+/i,
    /^remove\s+/i,
    /^trash\s+/i,
    /^get rid of\s+/i,
    /^cancel\s+/i,
    /^delete task\s+/i,
    /^remove task\s+/i,
    /^cancel task\s+/i,
    // Italian prefixes
    /^aggiungi\s+/i,
    /^crea\s+/i,
    /^crea un'attività\s+/i,
    /^ricordami di\s+/i,
    /^inserisci\s+/i,
    /^inserisci un'attività\s+/i,
    /^imposta\s+/i,
    /^aggiorna\s+/i,
    /^modifica\s+/i,
    /^cambia\s+/i,
    // French prefixes
    /^ajouter\s+/i,
    /^créer\s+/i,
    /^rappelle-moi de\s+/i,
    /^rappelle-moi\s+/i,
    /^définir\s+/i,
    /^mettre à jour\s+/i,
    /^modifier\s+/i,
    /^changer\s+/i,
    // Spanish prefixes
    /^agregar\s+/i,
    /^añadir\s+/i,
    /^crear\s+/i,
    /^recuérdame\s+/i,
    /^establecer\s+/i,
    /^actualizar\s+/i,
    /^modificar\s+/i,
    /^cambiar\s+/i,
  ];
  
  for (const pattern of prefixPatterns) {
    text = text.replace(pattern, '');
  }
  
  // Remove common suffixes (English, Italian, French, Spanish)
  const suffixPatterns = [
    /\s+to my tasks?$/i,
    /\s+to my to-do list$/i,
    /\s+as done$/i,
    /\s+as complete$/i,
    // Italian suffixes
    /\s+come fatto$/i,
    /\s+come completato$/i,
    /\s+a fatto$/i,
    /\s+fatto$/i,
    /\s+completato$/i,
    // French suffixes
    /\s+à mes tâches?$/i,
    /\s+comme terminé$/i,
    /\s+comme complété$/i,
    /\s+terminé$/i,
    /\s+complété$/i,
    // Spanish suffixes
    /\s+a mis tareas?$/i,
    /\s+como hecho$/i,
    /\s+como completado$/i,
    /\s+hecho$/i,
    /\s+completado$/i,
  ];
  
  for (const pattern of suffixPatterns) {
    text = text.replace(pattern, '');
  }
  
  // Remove priority keywords (English, Italian, French, Spanish)
  // Note: Patterns without $ anchor match anywhere in the string, patterns with $ match only at the end
  const priorityPatterns = [
    // English
    /\s+high\s+priority\s+/i,
    /\s+low\s+priority\s+/i,
    /\s+normal\s+priority\s+/i,
    /\s+medium\s+priority\s+/i,
    /\s+urgent\s+/i,
    /\s+important\s+/i,
    /\s+high\s+priority$/i,
    /\s+low\s+priority$/i,
    /\s+normal\s+priority$/i,
    /\s+medium\s+priority$/i,
    /\s+urgent$/i,
    /\s+important$/i,
    // Italian - handle both "priorità" (with accent) and "priorita" (without accent)
    // Patterns without $ anchor (match anywhere)
    /\s+alta\s+priorità\s+/i,
    /\s+priorità\s+alta\s+/i,
    /\s+alta\s+priorita\s+/i,
    /\s+priorita\s+alta\s+/i,
    /\s+bassa\s+priorità\s+/i,
    /\s+priorità\s+bassa\s+/i,
    /\s+bassa\s+priorita\s+/i,
    /\s+priorita\s+bassa\s+/i,
    /\s+priorità\s+normale\s+/i,
    /\s+media\s+priorità\s+/i,
    /\s+priorita\s+normale\s+/i,
    /\s+media\s+priorita\s+/i,
    /\s+urgente\s+/i,
    /\s+importante\s+/i,
    // Patterns with $ anchor (match at end)
    /\s+alta\s+priorità$/i,
    /\s+priorità\s+alta$/i,
    /\s+alta\s+priorita$/i,
    /\s+priorita\s+alta$/i,
    /\s+bassa\s+priorità$/i,
    /\s+priorità\s+bassa$/i,
    /\s+bassa\s+priorita$/i,
    /\s+priorita\s+bassa$/i,
    /\s+priorità\s+normale$/i,
    /\s+media\s+priorità$/i,
    /\s+priorita\s+normale$/i,
    /\s+media\s+priorita$/i,
    /\s+urgente$/i,
    /\s+importante$/i,
    // French
    /\s+haute\s+priorité\s+/i,
    /\s+priorité\s+haute\s+/i,
    /\s+basse\s+priorité\s+/i,
    /\s+priorité\s+basse\s+/i,
    /\s+priorité\s+normale\s+/i,
    /\s+moyenne\s+priorité\s+/i,
    /\s+urgent\s+/i,
    /\s+important\s+/i,
    /\s+haute\s+priorité$/i,
    /\s+priorité\s+haute$/i,
    /\s+basse\s+priorité$/i,
    /\s+priorité\s+basse$/i,
    /\s+priorité\s+normale$/i,
    /\s+moyenne\s+priorité$/i,
    /\s+urgent$/i,
    /\s+important$/i,
    // Spanish
    /\s+alta\s+prioridad\s+/i,
    /\s+prioridad\s+alta\s+/i,
    /\s+baja\s+prioridad\s+/i,
    /\s+prioridad\s+baja\s+/i,
    /\s+prioridad\s+normal\s+/i,
    /\s+media\s+prioridad\s+/i,
    /\s+urgente\s+/i,
    /\s+importante\s+/i,
    /\s+alta\s+prioridad$/i,
    /\s+prioridad\s+alta$/i,
    /\s+baja\s+prioridad$/i,
    /\s+prioridad\s+baja$/i,
    /\s+prioridad\s+normal$/i,
    /\s+media\s+prioridad$/i,
    /\s+urgente$/i,
    /\s+importante$/i,
  ];
  
  for (const pattern of priorityPatterns) {
    text = text.replace(pattern, '');
  }
  
  // Remove category keywords (English, Italian, French, Spanish)
  const categoryPatterns = [
    // English
    /\s+work$/i,
    /\s+office$/i,
    /\s+business$/i,
    /\s+personal$/i,
    /\s+home$/i,
    /\s+private$/i,
    // Italian
    /\s+lavoro$/i,
    /\s+ufficio$/i,
    /\s+personale$/i,
    /\s+casa$/i,
    /\s+privato$/i,
    // French
    /\s+travail$/i,
    /\s+bureau$/i,
    /\s+personnel$/i,
    /\s+maison$/i,
    /\s+privé$/i,
    // Spanish
    /\s+trabajo$/i,
    /\s+oficina$/i,
    /\s+negocio$/i,
    /\s+personal$/i,
    /\s+casa$/i,
    /\s+privado$/i,
  ];
  
  for (const pattern of categoryPatterns) {
    text = text.replace(pattern, '');
  }
  
  return text.trim();
}

/**
 * Extract status from natural language (English, Italian, French, Spanish)
 */
function extractStatus(text: string, locale: Locale = 'en-US'): 'TO DO' | 'DONE' | undefined {
  const lower = text.toLowerCase();
  
  // English keywords — use word boundaries so "finish report" doesn't match "finished"
  if (/\b(done|complete|finished|closed)\b/.test(lower)) {
    return 'DONE';
  }
  if (/\b(to do|todo|pending|open|incomplete)\b/.test(lower) || lower.includes('to do') || lower.includes('todo')) {
    return 'TO DO';
  }
  
  // Italian keywords
  if (lower.includes('fatto') || lower.includes('completato') || lower.includes('finito') || lower.includes('terminato')) {
    return 'DONE';
  }
  if (lower.includes('da fare') || lower.includes('todo') || lower.includes('in sospeso')) {
    return 'TO DO';
  }
  
  // French keywords
  if (lower.includes('terminé') || lower.includes('complété') || lower.includes('fini') || lower.includes('achevé')) {
    return 'DONE';
  }
  if (lower.includes('à faire') || lower.includes('todo') || lower.includes('en attente')) {
    return 'TO DO';
  }
  
  // Spanish keywords
  if (lower.includes('hecho') || lower.includes('completado') || lower.includes('terminado') || lower.includes('finalizado')) {
    return 'DONE';
  }
  if (lower.includes('por hacer') || lower.includes('a hacer') || lower.includes('pendiente')) {
    return 'TO DO';
  }
  
  return undefined;
}

/**
 * Extract category from natural language (English, Italian, French, Spanish)
 */
export function extractCategory(text: string, locale: Locale = 'en-US'): 'PERSONAL' | 'WORK' | undefined {
  const lower = text.toLowerCase();
  
  // English keywords
  if (lower.includes('work') || lower.includes('office') || lower.includes('business')) {
    return 'WORK';
  }
  if (lower.includes('personal') || lower.includes('home') || lower.includes('private')) {
    return 'PERSONAL';
  }
  
  // Italian keywords
  if (lower.includes('lavoro') || lower.includes('ufficio') || lower.includes('business')) {
    return 'WORK';
  }
  if (lower.includes('personale') || lower.includes('casa') || lower.includes('privato')) {
    return 'PERSONAL';
  }
  
  // French keywords
  if (lower.includes('travail') || lower.includes('bureau') || lower.includes('professionnel')) {
    return 'WORK';
  }
  if (lower.includes('personnel') || lower.includes('maison') || lower.includes('privé')) {
    return 'PERSONAL';
  }
  
  // Spanish keywords
  if (lower.includes('trabajo') || lower.includes('oficina') || lower.includes('negocio')) {
    return 'WORK';
  }
  if (lower.includes('personal') || lower.includes('casa') || lower.includes('privado')) {
    return 'PERSONAL';
  }
  
  return undefined;
}

/**
 * Extract priority from natural language (English, Italian, French, Spanish)
 */
function extractPriority(text: string, locale: Locale = 'en-US'): 'LOW' | 'NORMAL' | 'HIGH' | undefined {
  const lower = text.toLowerCase();
  
  // English keywords
  // Check for "high priority" phrase first, then standalone "high" (but not words containing "high" like "highlight")
  if (lower.includes('high priority') || lower.includes('urgent') || lower.includes('important')) {
    return 'HIGH';
  }
  // Check for standalone "high" (as whole word, not part of another word)
  if (/\bhigh\b/.test(lower) && !lower.includes('highlight') && !lower.includes('highway')) {
    return 'HIGH';
  }
  // Check for "low priority" phrase first, then standalone "low" (but not words containing "low" like "below", "follow", "yellow")
  if (lower.includes('low priority')) {
    return 'LOW';
  }
  // Check for standalone "low" (as whole word, not part of another word)
  if (/\blow\b/.test(lower) && !lower.includes('below') && !lower.includes('follow') && !lower.includes('yellow') && !lower.includes('allow')) {
    return 'LOW';
  }
  if (lower.includes('normal priority') || lower.includes('medium priority')) {
    return 'NORMAL';
  }
  
  // Italian keywords - handle both "priorità" (with accent) and "priorita" (without accent)
  if (lower.includes('alta priorità') || lower.includes('alta priorita') || 
      lower.includes('priorità alta') || lower.includes('priorita alta') || 
      lower.includes('urgente') || lower.includes('importante')) {
    return 'HIGH';
  }
  if (lower.includes('bassa priorità') || lower.includes('bassa priorita') || 
      lower.includes('priorità bassa') || lower.includes('priorita bassa') || 
      lower.includes('bassa')) {
    return 'LOW';
  }
  if (lower.includes('priorità normale') || lower.includes('priorita normale') || 
      lower.includes('media priorità') || lower.includes('media priorita') || 
      lower.includes('normale')) {
    return 'NORMAL';
  }
  
  // French keywords
  if (lower.includes('haute priorité') || lower.includes('priorité haute') || lower.includes('urgent') || lower.includes('important')) {
    return 'HIGH';
  }
  if (lower.includes('basse priorité') || lower.includes('priorité basse') || lower.includes('basse')) {
    return 'LOW';
  }
  if (lower.includes('priorité normale') || lower.includes('moyenne priorité') || lower.includes('normale')) {
    return 'NORMAL';
  }
  
  // Spanish keywords
  if (lower.includes('alta prioridad') || lower.includes('prioridad alta') || lower.includes('urgente') || lower.includes('importante')) {
    return 'HIGH';
  }
  if (lower.includes('baja prioridad') || lower.includes('prioridad baja') || lower.includes('baja')) {
    return 'LOW';
  }
  if (lower.includes('prioridad normal') || lower.includes('media prioridad') || lower.includes('normal')) {
    return 'NORMAL';
  }
  
  return undefined;
}

/**
 * Parse task from userRequest slot (AMAZON.SearchQuery)
 */
export function parseTaskFromUserRequest(userRequest: string, locale: Locale = 'en-US'): ParsedTask {
  if (!userRequest) {
    return {
      taskName: '',
      parsedName: '',
      status: 'TO DO',
      category: 'PERSONAL',
      priority: 'NORMAL',
    };
  }
  
  // Map Italian month names to numbers
  const italianMonths: { [key: string]: number } = {
    'gennaio': 0, 'febbraio': 1, 'marzo': 2, 'aprile': 3,
    'maggio': 4, 'giugno': 5, 'luglio': 6, 'agosto': 7,
    'settembre': 8, 'ottobre': 9, 'novembre': 10, 'dicembre': 11
  };
  
  // Check for Italian date pattern: "DD mese" or "mese DD" or "il DD mese" or "del DD mese YYYY" (e.g., "25 dicembre", "il 25 dicembre", "dicembre 25", "del 20 dicembre 2025")
  const italianDatePattern1 = /(?:il\s+|del\s+)?(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:\s+(\d{4}))?/i;
  const italianDatePattern2 = /(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{1,2})(?:\s+(\d{4}))?/i;
  const italianDateMatch1 = userRequest.match(italianDatePattern1);
  const italianDateMatch2 = userRequest.match(italianDatePattern2);
  const italianDateMatch = italianDateMatch1 || italianDateMatch2;
  
  let parsedDate: Date | null = null;
  let dueDateTime: string | null = null;
  let textWithoutDate = userRequest;
  const now = new Date();
  const tz = LOCALE_TIME_ZONES[locale] || 'UTC';

  // Normalize: collapse spaces so "tomorrow" is reliably detected
  const normalizedRequest = userRequest.replace(/\s+/g, ' ').trim();

  // Early check for "tomorrow" / "today" / "next week" so we never miss them (before Italian/chrono).
  // Build midnight in user's timezone so the saved date is "today" in their locale, not yesterday.
  const tomorrowKeyword = /\b(tomorrow|domani|demain|mañana)\b/i;
  const todayKeyword = /\b(today|oggi|aujourd['']hui|hoy)\b/i;
  const nextWeekKeyword = /\b(next week|prossima settimana|semaine prochaine|próxima semana)\b/i;
  if (tomorrowKeyword.test(normalizedRequest) && !parsedDate) {
    const tomorrowInTz = new Date(now.getTime() + 86400000);
    parsedDate = getMidnightInTimezone(tomorrowInTz, tz);
    textWithoutDate = normalizedRequest.replace(tomorrowKeyword, ' ').replace(/\s+/g, ' ').trim();
  } else if (todayKeyword.test(normalizedRequest) && !parsedDate) {
    parsedDate = getMidnightInTimezone(now, tz);
    textWithoutDate = normalizedRequest.replace(todayKeyword, ' ').replace(/\s+/g, ' ').trim();
  } else if (nextWeekKeyword.test(normalizedRequest) && !parsedDate) {
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() - now.getDay() + 7);
    parsedDate = getMidnightInTimezone(nextWeek, tz);
    textWithoutDate = normalizedRequest.replace(nextWeekKeyword, ' ').replace(/\s+/g, ' ').trim();
  }

  // Handle Italian specific dates before chrono parsing (only if we didn't already set date from tomorrow/today)
  if (italianDateMatch && !parsedDate) {
    let day: number;
    let monthName: string;
    let matchedText: string;
    let year: number | null = null;
    
    if (italianDateMatch1) {
      day = parseInt(italianDateMatch1[1], 10);
      monthName = italianDateMatch1[2].toLowerCase();
      year = italianDateMatch1[3] ? parseInt(italianDateMatch1[3], 10) : null;
      matchedText = italianDateMatch1[0]; // Full match including "il" or "del" if present
    } else if (italianDateMatch2) {
      day = parseInt(italianDateMatch2[2], 10);
      monthName = italianDateMatch2[1].toLowerCase();
      year = italianDateMatch2[3] ? parseInt(italianDateMatch2[3], 10) : null;
      matchedText = italianDateMatch2[0];
    } else {
      // This should never happen, but TypeScript requires it
      day = 1;
      monthName = 'gennaio';
      matchedText = '';
    }
    
    const month = italianMonths[monthName];
    const currentYear = new Date().getFullYear();
    const targetYear = year || currentYear;
    
    // Create date - if year not specified and month/day has passed this year, use next year
    if (!year) {
      parsedDate = new Date(currentYear, month, day, 0, 0, 0, 0);
      if (parsedDate < new Date()) {
        parsedDate.setFullYear(currentYear + 1);
      }
    } else {
      parsedDate = new Date(targetYear, month, day, 0, 0, 0, 0);
    }
    
    // Remove the date from the text to get the task name
    textWithoutDate = userRequest.replace(matchedText, '').trim();

    // If the request also contains Italian time (e.g. "alle 20"), parse and combine so we don't store midnight
    const italianTimePatternInBlock = /alle\s+(?:ore\s+)?(\d{1,2})(?::(\d{2}))?/i;
    const italianTimeMatchInBlock = userRequest.match(italianTimePatternInBlock);
    if (italianTimeMatchInBlock) {
      const hours = parseInt(italianTimeMatchInBlock[1], 10);
      const minutes = italianTimeMatchInBlock[2] ? parseInt(italianTimeMatchInBlock[2], 10) : 0;
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        const localeTimeZones: Record<string, string> = {
          'it-IT': 'Europe/Rome',
          'fr-FR': 'Europe/Paris',
          'es-ES': 'Europe/Madrid',
          'es-MX': 'America/Mexico_City',
          'en-US': 'UTC',
        };
        const targetTimeZone = localeTimeZones[locale] || 'Europe/Rome';
        // Build UTC time for (targetYear, month, day, hours, minutes) in target TZ (not server local TZ)
        const ref = Date.UTC(targetYear, month, day, hours, minutes, 0);
        const dtf = new Intl.DateTimeFormat('en-US', {
          timeZone: targetTimeZone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        });
        const parts = dtf.formatToParts(new Date(ref));
        const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00';
        const tzHour = Number(getPart('hour'));
        const tzMinute = Number(getPart('minute'));
        const offsetMinutes = (tzHour * 60 + tzMinute) - (hours * 60 + minutes);
        const actualUTC = new Date(ref - offsetMinutes * 60000);
        dueDateTime = actualUTC.toISOString();
        textWithoutDate = textWithoutDate.replace(italianTimePatternInBlock, '').trim();
      }
    } else {
      dueDateTime = formatDateOnly(parsedDate, tz);
    }
  } else {
  // Use chrono-node to parse dates/times (with locale support)
  // Note: chrono-node should handle Italian dates even with default parser
  // but we use locale-specific keyword matching for better accuracy
  
    // FIRST check for time expressions, as they might come before date keywords (e.g., "at 4 PM tomorrow")
    // Handle time expressions explicitly (Italian "alle", English "at", French "à", Spanish "a")
    let parsedTime: { hours: number; minutes: number } | null = null;

  // Check for Italian time pattern: "alle HH", "alle HH:MM", "alle ore HH", "alle ore HH:MM"
  const italianTimePattern = /alle\s+(?:ore\s+)?(\d{1,2})(?::(\d{2}))?/i;
  const italianTimeMatch = userRequest.match(italianTimePattern);
  
  // Check for English time pattern: "at HH", "at HH:MM", "at HH PM", "at HH AM", "at HH:MM PM", "at HH:MM AM"
  // Also handle "p.m." and "a.m." formats (with periods) that Alexa might send
  const englishTimePattern = /at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i;
  const englishTimeMatch = userRequest.match(englishTimePattern);
  
  // Check for French time pattern: "à HH", "à HH:MM", "à HHh", "à HHhMM"
  const frenchTimePattern = /à\s+(\d{1,2})(?:h(\d{2})?)?/i;
  const frenchTimeMatch = userRequest.match(frenchTimePattern);
  
  // Check for Spanish time pattern: "a las HH", "a las HH:MM", "a la HH", "a la HH:MM"
  const spanishTimePattern = /a\s+(?:las?|las)\s+(\d{1,2})(?::(\d{2}))?/i;
  const spanishTimeMatch = userRequest.match(spanishTimePattern);
  
  if (italianTimeMatch) {
    let hours = parseInt(italianTimeMatch[1], 10);
    const minutes = italianTimeMatch[2] ? parseInt(italianTimeMatch[2], 10) : 0;
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      parsedTime = { hours, minutes };
    }
  } else if (englishTimeMatch) {
    let hours = parseInt(englishTimeMatch[1], 10);
    const minutes = englishTimeMatch[2] ? parseInt(englishTimeMatch[2], 10) : 0;
    let ampm = englishTimeMatch[3] ? englishTimeMatch[3].toLowerCase() : null;
    
    // Normalize "p.m." and "a.m." to "pm" and "am" (Alexa sometimes sends with periods)
    if (ampm === 'p.m.' || ampm === 'p. m.') {
      ampm = 'pm';
    } else if (ampm === 'a.m.' || ampm === 'a. m.') {
      ampm = 'am';
    }
    
    // Convert to 24-hour format
    if (ampm === 'pm' && hours !== 12) {
      hours += 12;
    } else if (ampm === 'am' && hours === 12) {
      hours = 0;
    }
    
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      parsedTime = { hours, minutes };
    }
  } else if (frenchTimeMatch) {
    const hours = parseInt(frenchTimeMatch[1], 10);
    const minutes = frenchTimeMatch[2] ? parseInt(frenchTimeMatch[2], 10) : 0;
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      parsedTime = { hours, minutes };
    }
  } else if (spanishTimeMatch) {
    const hours = parseInt(spanishTimeMatch[1], 10);
    const minutes = spanishTimeMatch[2] ? parseInt(spanishTimeMatch[2], 10) : 0;
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      parsedTime = { hours, minutes };
    }
  }

  // If we found a time but no date, try to parse date again or check for today/tomorrow keywords
  // Also check if we have a time expression that comes with a date keyword (e.g., "at 4 PM tomorrow")
  if (parsedTime && !parsedDate) {
    // First, check the original userRequest for date keywords that might come after the time
    // (e.g., "at 4 PM tomorrow" or "at 4 PM December 25th")
    const tomorrowAfterTimePattern = /(?:^|\s)(tomorrow|domani|demain|mañana)(?:\s|$)/i;
    const todayAfterTimePattern = /(?:^|\s)(today|oggi|aujourd['']hui|hoy)(?:\s|$)/i;
    const tomorrowAfterTimeMatch = userRequest.match(tomorrowAfterTimePattern);
    const todayAfterTimeMatch = userRequest.match(todayAfterTimePattern);
    
    if (tomorrowAfterTimeMatch) {
      parsedDate = new Date(now);
      parsedDate.setDate(parsedDate.getDate() + 1);
      parsedDate.setHours(0, 0, 0, 0);
      // Remove tomorrow from userRequest first, then remove time
      let tempText = userRequest.replace(/(?:^|\s)(tomorrow|domani|demain|mañana)(?:\s|$)/gi, ' ').trim();
      // Now remove the time expression from the text
      if (italianTimeMatch) {
        textWithoutDate = tempText.replace(italianTimePattern, '').trim();
      } else if (englishTimeMatch) {
        textWithoutDate = tempText.replace(englishTimePattern, '').trim();
      } else if (frenchTimeMatch) {
        textWithoutDate = tempText.replace(frenchTimePattern, '').trim();
      } else if (spanishTimeMatch) {
        textWithoutDate = tempText.replace(spanishTimePattern, '').trim();
      } else {
        textWithoutDate = tempText;
      }
    } else if (todayAfterTimeMatch) {
      parsedDate = new Date(now);
      parsedDate.setHours(0, 0, 0, 0);
      // Remove today from userRequest first, then remove time
      let tempText = userRequest.replace(/(?:^|\s)(today|oggi|aujourd['']hui|hoy)(?:\s|$)/gi, ' ').trim();
      // Now remove the time expression from the text
      if (italianTimeMatch) {
        textWithoutDate = tempText.replace(italianTimePattern, '').trim();
      } else if (englishTimeMatch) {
        textWithoutDate = tempText.replace(englishTimePattern, '').trim();
      } else if (frenchTimeMatch) {
        textWithoutDate = tempText.replace(frenchTimePattern, '').trim();
      } else if (spanishTimeMatch) {
        textWithoutDate = tempText.replace(spanishTimePattern, '').trim();
      } else {
        textWithoutDate = tempText;
      }
    } else {
      // Remove time expression and try parsing again
      let withoutTime = textWithoutDate;
      if (italianTimeMatch) {
        withoutTime = withoutTime.replace(italianTimePattern, '').trim();
      } else if (englishTimeMatch) {
        withoutTime = withoutTime.replace(englishTimePattern, '').trim();
      } else if (frenchTimeMatch) {
        withoutTime = withoutTime.replace(frenchTimePattern, '').trim();
      } else if (spanishTimeMatch) {
        withoutTime = withoutTime.replace(spanishTimePattern, '').trim();
      }
      
      parsedDate = chrono.parseDate(withoutTime);
      
      // If still no date, check for today/tomorrow keywords in all languages
      if (!parsedDate) {
        if (/\btoday\b/i.test(withoutTime) || /\boggi\b/i.test(withoutTime) || 
            /\baujourd['']hui\b/i.test(withoutTime) || /\bhoy\b/i.test(withoutTime)) {
          parsedDate = new Date(now);
          parsedDate.setHours(0, 0, 0, 0);
        } else if (/\btomorrow\b/i.test(withoutTime) || /\bdomani\b/i.test(withoutTime) || 
                   /\bdemain\b/i.test(withoutTime) || /\bmañana\b/i.test(withoutTime)) {
          parsedDate = new Date(now);
          parsedDate.setDate(parsedDate.getDate() + 1);
          parsedDate.setHours(0, 0, 0, 0);
        } else {
          // Default to today if time pattern was found (e.g., "at 4 PM" without date)
          parsedDate = new Date(now);
          parsedDate.setHours(0, 0, 0, 0);
        }
      }
      
      if (parsedDate) {
        textWithoutDate = withoutTime;
      }
    }
  }
  
  // If we haven't found a date yet, check for date keywords (today/tomorrow)
  // This handles cases like "buy milk tomorrow" (no time, just date keyword)
  // IMPORTANT: Check keywords BEFORE chrono-node to ensure "tomorrow" is correctly parsed
  if (!parsedDate) {
    // Handle date keywords explicitly (today/tomorrow in all languages)
    // Check for "today" keywords in all languages (using word boundaries to avoid partial matches)
    const todayPattern = /\b(today|oggi|aujourd['']hui|hoy)\b/i;
    const tomorrowPattern = /\b(tomorrow|domani|demain|mañana)\b/i;
    
    const todayMatch = userRequest.match(todayPattern);
    const tomorrowMatch = userRequest.match(tomorrowPattern);
    
    if (todayMatch) {
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      parsedDate = today;
      
      console.log('[parseTaskFromUserRequest] Detected "today" keyword:', {
        userRequest,
        detectedKeyword: todayMatch[1],
        parsedDate: parsedDate.toISOString()
      });
      
      // Remove date keywords from task name
      textWithoutDate = userRequest.replace(/\b(today|oggi|aujourd['']hui|hoy)\b/gi, ' ').trim();
    } 
    // Check for "tomorrow" keywords in all languages
    else if (tomorrowMatch) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      parsedDate = tomorrow;
      
      console.log('[parseTaskFromUserRequest] Detected "tomorrow" keyword:', {
        userRequest,
        detectedKeyword: tomorrowMatch[1],
        parsedDate: parsedDate.toISOString()
      });
      
      // Remove date keywords from task name
      textWithoutDate = userRequest.replace(/\b(tomorrow|domani|demain|mañana)\b/gi, ' ').trim();
    } else {
      // Fallback to chrono-node for other date formats
      // But first, check if chrono-node parsed "tomorrow" incorrectly (returning today instead of tomorrow)
      const chronoResults = chrono.parse(userRequest);
      if (chronoResults.length > 0) {
        const firstResult = chronoResults[0];
        let chronoDate = firstResult.start.date();
        
        // Validate: if the parsed text contains "tomorrow" keyword, ensure the date is actually tomorrow
        const parsedText = firstResult.text?.toLowerCase() || '';
        if (/\b(tomorrow|domani|demain|mañana)\b/i.test(parsedText)) {
          // Force tomorrow's date if chrono parsed it incorrectly
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(0, 0, 0, 0);
          
          // Check if chrono returned today instead of tomorrow (within 24 hours of now)
          const todayStart = new Date(now);
          todayStart.setHours(0, 0, 0, 0);
          const todayEnd = new Date(now);
          todayEnd.setHours(23, 59, 59, 999);
          
          if (chronoDate >= todayStart && chronoDate <= todayEnd) {
            // Chrono incorrectly parsed "tomorrow" as today, fix it
            console.log('[parseTaskFromUserRequest] Chrono incorrectly parsed "tomorrow" as today, correcting to tomorrow');
            chronoDate = tomorrow;
          } else {
            // Use chrono's date but ensure it's at least tomorrow
            const tomorrowStart = new Date(now);
            tomorrowStart.setDate(tomorrowStart.getDate() + 1);
            tomorrowStart.setHours(0, 0, 0, 0);
            if (chronoDate < tomorrowStart) {
              chronoDate = tomorrow;
            }
          }
        }
        
        parsedDate = chronoDate;
        dueDateTime = formatDueDateTime(parsedDate, tz);
        
        if (firstResult.text) {
          // Remove the date text from the user request
          textWithoutDate = userRequest.replace(firstResult.text, '').trim();
          // Remove English prepositions that might appear before the date
          const dateIndex = userRequest.toLowerCase().indexOf(firstResult.text.toLowerCase());
          if (dateIndex > 0) {
            const beforeDate = userRequest.substring(0, dateIndex).trim();
            const prepositionMatch = beforeDate.match(/\b(on|for|at|by|the)\s*$/i);
            if (prepositionMatch) {
              textWithoutDate = textWithoutDate.replace(new RegExp(`\\b${prepositionMatch[1]}\\s*$`, 'i'), '').trim();
            }
          }
          textWithoutDate = textWithoutDate.replace(/\b(on|for|at|by|the)\s+/gi, ' ').trim();
          textWithoutDate = textWithoutDate.replace(/\s+(on|for|at|by|the)\b/gi, ' ').trim();
        }
      } else {
        // If chrono-node didn't find anything, try parseDate as fallback
        parsedDate = chrono.parseDate(userRequest);
        if (parsedDate) {
          // Validate: check if userRequest contains "tomorrow" keyword
          if (/\b(tomorrow|domani|demain|mañana)\b/i.test(userRequest)) {
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            
            // Check if chrono returned today instead of tomorrow
            const todayStart = new Date(now);
            todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date(now);
            todayEnd.setHours(23, 59, 59, 999);
            
            if (parsedDate >= todayStart && parsedDate <= todayEnd) {
              console.log('[parseTaskFromUserRequest] Chrono parseDate incorrectly parsed "tomorrow" as today, correcting to tomorrow');
              parsedDate = tomorrow;
            }
          }
          dueDateTime = formatDueDateTime(parsedDate, tz);
        }
      }
    }
  }
  
  // Also check if we have a date but time comes after it (e.g., "tomorrow at 4 PM")
  if (parsedDate && !parsedTime) {
    // Check if there's a time expression that comes after the date keyword
    const timeAfterDatePattern = /(?:^|\s)(tomorrow|domani|demain|mañana|today|oggi|aujourd['']hui|hoy)\s+(?:at|alle|à|a las?)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
    const timeAfterDateMatch = userRequest.match(timeAfterDatePattern);
    if (timeAfterDateMatch) {
      let hours = parseInt(timeAfterDateMatch[2], 10);
      const minutes = timeAfterDateMatch[3] ? parseInt(timeAfterDateMatch[3], 10) : 0;
      const ampm = timeAfterDateMatch[4] ? timeAfterDateMatch[4].toLowerCase() : null;
      
      // Convert to 24-hour format
      if (ampm === 'pm' && hours !== 12) {
        hours += 12;
      } else if (ampm === 'am' && hours === 12) {
        hours = 0;
      }
      
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        parsedTime = { hours, minutes };
      }
    }
  }

  // If we have both date and time, combine them
  if (parsedDate && parsedTime) {
    // Get the calendar date in the user's timezone from parsedDate
    // This is critical: parsedDate from getMidnightInTimezone is a UTC instant representing
    // midnight in the user's timezone. Using setHours() would set hours in Lambda's local time (UTC),
    // not in the user's timezone, causing the date to shift by one day.
    const { y: calYear, m: calMonth, d: calDay } = getCalendarDateInTz(parsedDate, tz);
    
    // Build UTC time for (calYear, calMonth, calDay, hours, minutes) in target timezone
    const ref = Date.UTC(calYear, calMonth, calDay, parsedTime.hours, parsedTime.minutes, 0);
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = dtf.formatToParts(new Date(ref));
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00';
    const refHour = Number(getPart('hour'));
    const refMinute = Number(getPart('minute'));
    const offsetMinutes = (refHour * 60 + refMinute) - (parsedTime.hours * 60 + parsedTime.minutes);
    const actualUTC = new Date(ref - offsetMinutes * 60000);
    dueDateTime = actualUTC.toISOString();
    
    console.log('[parseTaskFromUserRequest] Combined date+time:', {
      calendarDate: `${calYear}-${calMonth + 1}-${calDay}`,
      time: `${parsedTime.hours}:${parsedTime.minutes}`,
      timezone: tz,
      resultUTC: dueDateTime
    });

    // Remove time expression from task name
    if (italianTimeMatch) {
      textWithoutDate = textWithoutDate.replace(italianTimePattern, '').trim();
    } else if (englishTimeMatch) {
      textWithoutDate = textWithoutDate.replace(englishTimePattern, '').trim();
      // Also remove any leftover "PM", "AM", "p.m.", "a.m." that might remain
      textWithoutDate = textWithoutDate.replace(/\b(p\.?m\.?|a\.?m\.?)\b/gi, '').trim();
    } else if (frenchTimeMatch) {
      textWithoutDate = textWithoutDate.replace(frenchTimePattern, '').trim();
    } else if (spanishTimeMatch) {
      textWithoutDate = textWithoutDate.replace(spanishTimePattern, '').trim();
    }
    // Remove any remaining English prepositions after time removal
    textWithoutDate = textWithoutDate.replace(/\b(on|for|at|by|the)\s+/gi, ' ').trim();
  } else if (parsedDate && !dueDateTime) {
    // If we parsed a date but haven't set dueDateTime yet (from chrono-node or keyword detection)
    dueDateTime = formatDueDateTime(parsedDate, tz);
    // Remove any remaining English prepositions after date parsing
    // Check both at the beginning and end of the remaining text
    textWithoutDate = textWithoutDate.replace(/\b(on|for|at|by|the)\s+/gi, ' ').trim();
    textWithoutDate = textWithoutDate.replace(/\s+(on|for|at|by|the)\b/gi, ' ').trim();
  }
  } // End of else block for non-Italian date patterns
  
  // Extract status, category, priority
  const status = extractStatus(userRequest, locale) || 'TO DO';
  const category = extractCategory(userRequest, locale) || 'PERSONAL';
  const priority = extractPriority(userRequest, locale) || 'NORMAL';
  
  // Clean task name
  const taskName = textWithoutDate || userRequest;
  const parsedName = cleanTaskName(taskName, locale);
  
  const result = {
    taskName,
    parsedName: parsedName || taskName,
    dueDateTime,
    status,
    category,
    priority,
  };
  
  console.log('[parseTaskFromUserRequest] Returning:', {
    taskName: result.taskName,
    parsedName: result.parsedName,
    dueDateTime: result.dueDateTime,
    status: result.status,
    category: result.category,
    priority: result.priority,
  });
  
  return result;
}

/**
 * Parse query from userRequest slot to build Notion filter
 */
export function parseQueryFromUserRequest(userRequest: string, locale: Locale = 'en-US'): QueryFilter {
  if (!userRequest) {
    return {
      type: 'keyword',
      filters: {},
    };
  }
  
  // Remove common query prefixes like "show my tasks:" or "my tasks:"
  let cleanedRequest = userRequest.trim();
  cleanedRequest = cleanedRequest.replace(/^(show\s+)?my\s+tasks?:\s*/i, '');
  cleanedRequest = cleanedRequest.replace(/^tasks?:\s*/i, '');
  
  const lower = cleanedRequest.toLowerCase();
  const filters: any[] = [];
  let queryType: QueryFilter['type'] = 'keyword';
  let keyword: string | undefined;
  
  // Parse date/time queries using chrono-node
  // Note: chrono-node should handle Italian dates even with default parser
  // but we use locale-specific keyword matching for better accuracy
  
  // Map Italian month names to numbers
  const italianMonths: { [key: string]: number } = {
    'gennaio': 0, 'febbraio': 1, 'marzo': 2, 'aprile': 3,
    'maggio': 4, 'giugno': 5, 'luglio': 6, 'agosto': 7,
    'settembre': 8, 'ottobre': 9, 'novembre': 10, 'dicembre': 11
  };
  
  // Check for Italian date pattern: "DD mese" or "mese DD" (e.g., "25 dicembre", "dicembre 25")
  const italianDatePattern1 = /(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)/i;
  const italianDatePattern2 = /(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{1,2})/i;
  const italianDateMatch1 = cleanedRequest.match(italianDatePattern1);
  const italianDateMatch2 = cleanedRequest.match(italianDatePattern2);
  const italianDateMatch = italianDateMatch1 || italianDateMatch2;
  const now = new Date();
  let dateFilter: any = null;
  
  // Handle Italian specific dates before chrono parsing
  if (italianDateMatch) {
    let day: number;
    let monthName: string;
    if (italianDateMatch1) {
      day = parseInt(italianDateMatch1[1], 10);
      monthName = italianDateMatch1[2].toLowerCase();
    } else if (italianDateMatch2) {
      day = parseInt(italianDateMatch2[2], 10);
      monthName = italianDateMatch2[1].toLowerCase();
    } else {
      // This should never happen, but TypeScript requires it
      day = 1;
      monthName = 'gennaio';
    }
    const month = italianMonths[monthName];
    const year = now.getFullYear();
    
    // Create date - if month/day has passed this year, use next year
    const dateStart = new Date(year, month, day, 0, 0, 0, 0);
    if (dateStart < now) {
      dateStart.setFullYear(year + 1);
    }
    const dateEnd = new Date(dateStart);
    dateEnd.setHours(23, 59, 59, 999);
    
    dateFilter = {
      property: 'Due Date Time',
      date: {
        on_or_after: dateStart.toISOString(),
        on_or_before: dateEnd.toISOString(),
      },
    };
    queryType = 'time';
  }
  
  const chronoResults = chrono.parse(cleanedRequest);
  
  if (chronoResults.length > 0 && !dateFilter) {
    const result = chronoResults[0];
    const parsedDate = result.start.date();
    
    // Today (English, Italian, French, Spanish)
    if (lower.includes('today') || lower.includes('oggi') || lower.includes('aujourd\'hui') || lower.includes('hoy')) {
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);
      
      dateFilter = {
        property: 'Due Date Time',
        date: {
          on_or_after: todayStart.toISOString(),
          on_or_before: todayEnd.toISOString(),
        },
      };
      queryType = 'time';
    }
    // Tomorrow (English, Italian, French, Spanish)
    else if (lower.includes('tomorrow') || lower.includes('domani') || lower.includes('demain') || lower.includes('mañana')) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStart = new Date(tomorrow);
      tomorrowStart.setHours(0, 0, 0, 0);
      const tomorrowEnd = new Date(tomorrow);
      tomorrowEnd.setHours(23, 59, 59, 999);
      
      dateFilter = {
        property: 'Due Date Time',
        date: {
          on_or_after: tomorrowStart.toISOString(),
          on_or_before: tomorrowEnd.toISOString(),
        },
      };
      queryType = 'time';
    }
    // This week (English, Italian, French, Spanish)
    else if (lower.includes('this week') || lower.includes('questa settimana') || lower.includes('cette semaine') || lower.includes('esta semana')) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      
      dateFilter = {
        property: 'Due Date Time',
        date: {
          on_or_after: weekStart.toISOString(),
          on_or_before: weekEnd.toISOString(),
        },
      };
      queryType = 'time';
    }
    // Next week (English, Italian, French, Spanish)
    else if (lower.includes('next week') || lower.includes('prossima settimana') || lower.includes('semaine prochaine') || lower.includes('próxima semana')) {
      const nextWeekStart = new Date(now);
      nextWeekStart.setDate(now.getDate() - now.getDay() + 7);
      nextWeekStart.setHours(0, 0, 0, 0);
      const nextWeekEnd = new Date(nextWeekStart);
      nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
      nextWeekEnd.setHours(23, 59, 59, 999);
      
      dateFilter = {
        property: 'Due Date Time',
        date: {
          on_or_after: nextWeekStart.toISOString(),
          on_or_before: nextWeekEnd.toISOString(),
        },
      };
      queryType = 'time';
    }
    // Overdue (English, Italian, French, Spanish)
    else if (lower.includes('overdue') || lower.includes('scaduto') || lower.includes('in ritardo') || lower.includes('en retard') || lower.includes('vencido') || lower.includes('atrasado')) {
      dateFilter = {
        and: [
          {
            property: 'Due Date Time',
            date: {
              before: now.toISOString(),
            },
          },
          {
            property: 'Status',
            select: {
              does_not_equal: 'DONE',
            },
          },
        ],
      };
      queryType = 'time';
    }
    // Before/After time (English, Italian, French, Spanish)
    else if (lower.includes('before') || lower.includes('after') || lower.includes('prima') || lower.includes('dopo') || lower.includes('avant') || lower.includes('après') || lower.includes('antes') || lower.includes('después')) {
      const isBefore = lower.includes('before') || lower.includes('prima') || lower.includes('avant') || lower.includes('antes');
      const timeMatch = cleanedRequest.match(/(\d{1,2})\s*(pm|am|:?\d{2})?/i);
      
      if (timeMatch && parsedDate) {
        const timeDate = new Date(parsedDate);
        if (isBefore) {
          dateFilter = {
            property: 'Due Date Time',
            date: {
              before: timeDate.toISOString(),
            },
          };
        } else {
          dateFilter = {
            property: 'Due Date Time',
            date: {
              on_or_after: timeDate.toISOString(),
            },
          };
        }
        queryType = 'time';
      }
    }
    // Specific date
    else if (parsedDate) {
      const dateStart = new Date(parsedDate);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(parsedDate);
      dateEnd.setHours(23, 59, 59, 999);
      
      dateFilter = {
        property: 'Due Date Time',
        date: {
          on_or_after: dateStart.toISOString(),
          on_or_before: dateEnd.toISOString(),
        },
      };
      queryType = 'time';
    }
  }
  
  if (dateFilter) {
    filters.push(dateFilter);
  }
  
  // Status queries (English, Italian, French, Spanish)
  if (lower.includes('to do') || lower.includes('todo') || lower.includes('not done') || lower.includes('incomplete') || lower.includes('open') ||
      lower.includes('da fare') || lower.includes('in sospeso') ||
      lower.includes('à faire') || lower.includes('en attente') ||
      lower.includes('por hacer') || lower.includes('pendiente')) {
    filters.push({
      property: 'Status',
      select: {
        equals: 'TO DO',
      },
    });
    if (queryType === 'keyword') queryType = 'status';
  } else if (lower.includes('done') || lower.includes('complete') || lower.includes('finished') || lower.includes('closed') ||
             lower.includes('fatto') || lower.includes('completato') || lower.includes('finito') ||
             lower.includes('terminé') || lower.includes('complété') || lower.includes('fini') ||
             lower.includes('hecho') || lower.includes('completado') || lower.includes('terminado')) {
    filters.push({
      property: 'Status',
      select: {
        equals: 'DONE',
      },
    });
    if (queryType === 'keyword') queryType = 'status';
  }
  
  // Category queries (English, Italian, French, Spanish)
  if ((lower.includes('work') && !lower.includes('homework')) || lower.includes('lavoro') || lower.includes('ufficio') ||
      lower.includes('travail') || lower.includes('bureau') ||
      lower.includes('trabajo') || lower.includes('oficina')) {
    filters.push({
      property: 'Category',
      select: {
        equals: 'WORK',
      },
    });
    if (queryType === 'keyword') queryType = 'category';
  } else if (lower.includes('personal') || lower.includes('home') || 
             lower.includes('personale') || lower.includes('casa') ||
             lower.includes('personnel') || lower.includes('maison') ||
             lower.includes('personal') || lower.includes('casa')) {
    filters.push({
      property: 'Category',
      select: {
        equals: 'PERSONAL',
      },
    });
    if (queryType === 'keyword') queryType = 'category';
  }
  
  // Priority queries (English, Italian, French, Spanish)
  if (lower.includes('high priority') || lower.includes('urgent') || lower.includes('important') ||
      lower.includes('alta priorità') || lower.includes('priorità alta') || lower.includes('urgente') ||
      lower.includes('haute priorité') || lower.includes('priorité haute') || lower.includes('urgent') ||
      lower.includes('alta prioridad') || lower.includes('prioridad alta') || lower.includes('urgente')) {
    filters.push({
      property: 'Priority',
      select: {
        equals: 'HIGH',
      },
    });
    if (queryType === 'keyword') queryType = 'priority';
  } else if (lower.includes('low priority') || lower.includes('low') ||
             lower.includes('bassa priorità') || lower.includes('priorità bassa') ||
             lower.includes('basse priorité') || lower.includes('priorité basse') ||
             lower.includes('baja prioridad') || lower.includes('prioridad baja')) {
    filters.push({
      property: 'Priority',
      select: {
        equals: 'LOW',
      },
    });
    if (queryType === 'keyword') queryType = 'priority';
  } else if (lower.includes('normal priority') || lower.includes('medium priority') ||
             lower.includes('priorità normale') || lower.includes('media priorità') ||
             lower.includes('priorité normale') || lower.includes('moyenne priorité') ||
             lower.includes('prioridad normal') || lower.includes('media prioridad')) {
    filters.push({
      property: 'Priority',
      select: {
        equals: 'NORMAL',
      },
    });
    if (queryType === 'keyword') queryType = 'priority';
  }
  
  // Keyword search (extract remaining text after removing date/time references)
  let keywordText = cleanedRequest;
  if (chronoResults.length > 0) {
    chronoResults.forEach(result => {
      if (result.text) {
        keywordText = keywordText.replace(result.text, '').trim();
      }
    });
  }
  
  // Remove query words (English, Italian, French, Spanish)
  const queryWords = [
    // English
    'what', 'are', 'my', 'tasks', 'for', 'show', 'me', 'list', 'tell', 'check', 'read', 'do', 'i', 'have', 'about',
    // Italian
    'cosa', 'quali', 'mie', 'attività', 'per', 'mostrami', 'dimmi', 'elenca', 'controlla', 'leggi', 'fai', 'ho', 'di',
    // French
    'quelles', 'sont', 'mes', 'tâches', 'pour', 'montre', 'moi', 'liste', 'dis', 'vérifie', 'lis', 'fais', 'j\'ai', 'de',
    // Spanish
    'qué', 'cuáles', 'son', 'mis', 'tareas', 'para', 'muestra', 'dime', 'lista', 'revisa', 'lee', 'haz', 'tengo', 'de'
  ];
  const keywordWords = keywordText
    .toLowerCase()
    .split(/\s+/)
    .filter(word => !queryWords.includes(word) && word.length > 2);
  
  if (keywordWords.length > 0) {
    keyword = keywordWords.join(' ');
  }
  
  // Determine final query type
  if (filters.length > 1) {
    queryType = 'combination';
  } else if (filters.length === 0 && keyword) {
    queryType = 'keyword';
  }
  
  // Build final filter
  let finalFilter: any;
  if (filters.length === 0) {
    finalFilter = {};
  } else if (filters.length === 1) {
    finalFilter = filters[0];
  } else {
    finalFilter = {
      and: filters,
    };
  }
  
  return {
    type: queryType,
    filters: finalFilter,
    keyword,
  };
}

/**
 * Parse deletion condition from userRequest to determine what to delete
 * Returns deletion type and filter for querying matching tasks
 */
export interface DeletionCondition {
  type: 'all' | 'status' | 'time' | 'category' | 'name';
  filter?: any; // Notion filter object
  status?: 'TO DO' | 'DONE';
  category?: 'PERSONAL' | 'WORK';
}

export function parseDeletionCondition(userRequest: string, locale: Locale = 'en-US'): DeletionCondition {
  if (!userRequest) {
    return { type: 'name' };
  }
  
  const lower = userRequest.toLowerCase();
  
  // Remove common prefixes
  let cleanedRequest = userRequest.trim();
  cleanedRequest = cleanedRequest.replace(/^the\s+task:\s*/i, '');
  cleanedRequest = cleanedRequest.replace(/^the\s+tasks:\s*/i, '');
  cleanedRequest = cleanedRequest.replace(/^task:\s*/i, '');
  cleanedRequest = cleanedRequest.replace(/^tasks:\s*/i, '');
  const cleanedLower = cleanedRequest.toLowerCase();
  
  // Check for bulk delete all (English, Italian, French, Spanish)
  if (cleanedLower.includes('everything') || 
      cleanedLower.includes('all tasks') || 
      cleanedLower.includes('entire list') ||
      cleanedLower.includes('whole list') ||
      cleanedLower.includes('wipe out') ||
      cleanedLower.includes('clear all') ||
      cleanedLower === 'all' ||
      cleanedLower === 'everything' ||
      cleanedLower.includes('tutto') || cleanedLower.includes('tutte') ||
      cleanedLower.includes('tout') || cleanedLower.includes('toutes') ||
      cleanedLower.includes('todo') || cleanedLower.includes('todas')) {
    return { type: 'all' };
  }
  
  // Check for status-based deletion (English, Italian, French, Spanish)
  if (cleanedLower.includes('completed') || cleanedLower.includes('done') ||
      cleanedLower.includes('completate') || cleanedLower.includes('fatto') ||
      cleanedLower.includes('terminé') || cleanedLower.includes('complété') ||
      cleanedLower.includes('hecho') || cleanedLower.includes('completado')) {
    return {
      type: 'status',
      status: 'DONE',
      filter: {
        property: 'Status',
        select: { equals: 'DONE' },
      },
    };
  }
  
  if (cleanedLower.includes('to do') || cleanedLower.includes('todo') ||
      cleanedLower.includes('incomplete') || cleanedLower.includes('not done') ||
      cleanedLower.includes('da fare') || cleanedLower.includes('in sospeso') ||
      cleanedLower.includes('à faire') || cleanedLower.includes('en attente') ||
      cleanedLower.includes('por hacer') || cleanedLower.includes('pendiente')) {
    return {
      type: 'status',
      status: 'TO DO',
      filter: {
        property: 'Status',
        select: { equals: 'TO DO' },
      },
    };
  }
  
  // Check for category-based deletion (English, Italian, French, Spanish)
  if ((cleanedLower.includes('work') && !cleanedLower.includes('homework')) ||
      cleanedLower.includes('lavoro') || cleanedLower.includes('ufficio') ||
      cleanedLower.includes('travail') || cleanedLower.includes('bureau') ||
      cleanedLower.includes('trabajo') || cleanedLower.includes('oficina')) {
    return {
      type: 'category',
      category: 'WORK',
      filter: {
        property: 'Category',
        select: { equals: 'WORK' },
      },
    };
  }
  
  if (cleanedLower.includes('personal') || cleanedLower.includes('home') ||
      cleanedLower.includes('personale') || cleanedLower.includes('casa') ||
      cleanedLower.includes('personnel') || cleanedLower.includes('maison') ||
      cleanedLower.includes('personal') || cleanedLower.includes('casa')) {
    return {
      type: 'category',
      category: 'PERSONAL',
      filter: {
        property: 'Category',
        select: { equals: 'PERSONAL' },
      },
    };
  }
  
  // Check for time-based deletion using chrono-node
  const chronoResults = chrono.parse(cleanedRequest);
  const now = new Date();
  
  if (chronoResults.length > 0 || lower.includes('today') || lower.includes('tomorrow') ||
      lower.includes('overdue') || lower.includes('due') ||
      lower.includes('oggi') || lower.includes('domani') ||
      lower.includes('aujourd\'hui') || lower.includes('demain') ||
      lower.includes('hoy') || lower.includes('mañana') ||
      lower.includes('scaduto') || lower.includes('en retard') ||
      lower.includes('vencido') || lower.includes('atrasado')) {
    let dateFilter: any = null;
    
    // Today
    if (cleanedLower.includes('due today') || cleanedLower.includes('tasks due today')) {
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);
      
      dateFilter = {
        property: 'Due Date Time',
        date: {
          on_or_after: todayStart.toISOString(),
          on_or_before: todayEnd.toISOString(),
        },
      };
    }
    // Tomorrow
    else if (cleanedLower.includes('due tomorrow') || cleanedLower.includes('tasks due tomorrow')) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStart = new Date(tomorrow);
      tomorrowStart.setHours(0, 0, 0, 0);
      const tomorrowEnd = new Date(tomorrow);
      tomorrowEnd.setHours(23, 59, 59, 999);
      
      dateFilter = {
        property: 'Due Date Time',
        date: {
          on_or_after: tomorrowStart.toISOString(),
          on_or_before: tomorrowEnd.toISOString(),
        },
      };
    }
    // Overdue (English, Italian, French, Spanish)
    else if (cleanedLower.includes('overdue') || cleanedLower.includes('scaduto') ||
             cleanedLower.includes('in ritardo') ||
             cleanedLower.includes('en retard') ||
             cleanedLower.includes('vencido') || cleanedLower.includes('atrasado')) {
      dateFilter = {
        and: [
          {
            property: 'Due Date Time',
            date: {
              before: now.toISOString(),
            },
          },
          {
            property: 'Status',
            select: {
              does_not_equal: 'DONE',
            },
          },
        ],
      };
    }
    // Before/After time (English, Italian, French, Spanish)
    else if (cleanedLower.includes('before') || cleanedLower.includes('after') ||
             cleanedLower.includes('prima') || cleanedLower.includes('dopo') ||
             cleanedLower.includes('avant') || cleanedLower.includes('après') ||
             cleanedLower.includes('antes') || cleanedLower.includes('después')) {
      const isBefore = cleanedLower.includes('before') || cleanedLower.includes('prima') ||
                       cleanedLower.includes('avant') || cleanedLower.includes('antes');
      const timeMatch = cleanedRequest.match(/(\d{1,2})\s*(pm|am|:?\d{2})?/i);
      
      if (timeMatch && chronoResults.length > 0) {
        const parsedDate = chronoResults[0].start.date();
        const timeDate = new Date(parsedDate);
        if (isBefore) {
          dateFilter = {
            property: 'Due Date Time',
            date: {
              before: timeDate.toISOString(),
            },
          };
        } else {
          dateFilter = {
            property: 'Due Date Time',
            date: {
              on_or_after: timeDate.toISOString(),
            },
          };
        }
      }
    }
    // Specific date from chrono
    else if (chronoResults.length > 0) {
      const parsedDate = chronoResults[0].start.date();
      const dateStart = new Date(parsedDate);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(parsedDate);
      dateEnd.setHours(23, 59, 59, 999);
      
      dateFilter = {
        property: 'Due Date Time',
        date: {
          on_or_after: dateStart.toISOString(),
          on_or_before: dateEnd.toISOString(),
        },
      };
    }
    
    if (dateFilter) {
      return {
        type: 'time',
        filter: dateFilter,
      };
    }
  }
  
  // Default: treat as task name
  return { type: 'name' };
}

