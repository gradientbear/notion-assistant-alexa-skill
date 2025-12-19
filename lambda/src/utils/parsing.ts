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
  
  return text.trim();
}

/**
 * Extract status from natural language (English, Italian, French, Spanish)
 */
function extractStatus(text: string, locale: Locale = 'en-US'): 'TO DO' | 'DONE' | undefined {
  const lower = text.toLowerCase();
  
  // English keywords
  if (lower.includes('done') || lower.includes('complete') || lower.includes('finished')) {
    return 'DONE';
  }
  if (lower.includes('to do') || lower.includes('todo') || lower.includes('pending')) {
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
function extractCategory(text: string, locale: Locale = 'en-US'): 'PERSONAL' | 'WORK' | undefined {
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
  if (lower.includes('high priority') || lower.includes('urgent') || lower.includes('important')) {
    return 'HIGH';
  }
  if (lower.includes('low priority') || lower.includes('low')) {
    return 'LOW';
  }
  if (lower.includes('normal priority') || lower.includes('medium priority')) {
    return 'NORMAL';
  }
  
  // Italian keywords
  if (lower.includes('alta priorità') || lower.includes('priorità alta') || lower.includes('urgente') || lower.includes('importante')) {
    return 'HIGH';
  }
  if (lower.includes('bassa priorità') || lower.includes('priorità bassa') || lower.includes('bassa')) {
    return 'LOW';
  }
  if (lower.includes('priorità normale') || lower.includes('media priorità') || lower.includes('normale')) {
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
  
  // Handle Italian specific dates before chrono parsing
  if (italianDateMatch) {
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
    
    dueDateTime = parsedDate.toISOString();
    
    // Remove the date from the text to get the task name
    textWithoutDate = userRequest.replace(matchedText, '').trim();
  } else {
    // Use chrono-node to parse dates/times (with locale support)
    // Note: chrono-node should handle Italian dates even with default parser
    // but we use locale-specific keyword matching for better accuracy
    parsedDate = chrono.parseDate(userRequest);
    
    if (parsedDate) {
      dueDateTime = parsedDate.toISOString();
      // Try to remove date references from text
      const chronoResults = chrono.parse(userRequest);
      if (chronoResults.length > 0) {
        const firstResult = chronoResults[0];
        if (firstResult.text) {
          textWithoutDate = userRequest.replace(firstResult.text, '').trim();
        }
      }
    }
  }
  
  // Handle Italian time expressions explicitly (e.g., "oggi alle 18", "domani alle 16")
  let parsedTime: { hours: number; minutes: number } | null = null;

  // Check for Italian time pattern: "alle HH", "alle HH:MM", "alle ore HH", "alle ore HH:MM"
  const italianTimePattern = /alle\s+(?:ore\s+)?(\d{1,2})(?::(\d{2}))?/i;
  const timeMatch = userRequest.match(italianTimePattern);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      parsedTime = { hours, minutes };
    }
  }

  // If we found a time but no date, try to parse date again or use today
  if (parsedTime && !parsedDate) {
    // Remove time expression and try parsing again
    const withoutTime = textWithoutDate.replace(italianTimePattern, '').trim();
    parsedDate = chrono.parseDate(withoutTime);
    
    // If still no date, default to today for "alle HH" patterns
    if (!parsedDate && userRequest.toLowerCase().includes('alle')) {
      parsedDate = new Date();
      parsedDate.setHours(0, 0, 0, 0);
    }
    
    if (parsedDate) {
      textWithoutDate = withoutTime;
    }
  }

  // If we have both date and time, combine them
  if (parsedDate && parsedTime) {
    const combinedDate = new Date(parsedDate);
    combinedDate.setHours(parsedTime.hours, parsedTime.minutes, 0, 0);
    dueDateTime = combinedDate.toISOString();
    // Remove time expression from task name
    textWithoutDate = textWithoutDate.replace(italianTimePattern, '').trim();
  } else if (parsedDate && !dueDateTime) {
    // If we parsed a date but haven't set dueDateTime yet (from chrono-node)
    dueDateTime = parsedDate.toISOString();
  }
  
  // Extract status, category, priority
  const status = extractStatus(userRequest, locale) || 'TO DO';
  const category = extractCategory(userRequest, locale) || 'PERSONAL';
  const priority = extractPriority(userRequest, locale) || 'NORMAL';
  
  // Clean task name
  const taskName = textWithoutDate || userRequest;
  const parsedName = cleanTaskName(taskName, locale);
  
  return {
    taskName,
    parsedName: parsedName || taskName,
    dueDateTime,
    status,
    category,
    priority,
  };
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
  if (lower.includes('to do') || lower.includes('todo') || lower.includes('not done') || lower.includes('incomplete') ||
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
  } else if (lower.includes('done') || lower.includes('complete') || lower.includes('finished') ||
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

