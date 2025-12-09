import * as chrono from 'chrono-node';
// Note: chrono-node handles Italian dates through its default parser
// We use locale-specific keyword matching for better accuracy

export type Locale = 'en-US' | 'it-IT';

export interface ParsedTask {
  taskName: string;
  parsedName: string;
  dueDateTime?: string | null;
  status?: 'TO DO' | 'IN_PROCESS' | 'DONE';
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
  
  // Remove common command prefixes (English and Italian)
  const prefixPatterns = [
    /^add\s+/i,
    /^create\s+/i,
    /^remind me to\s+/i,
    /^set\s+/i,
    /^update\s+/i,
    /^change\s+/i,
    /^modify\s+/i,
    // Italian prefixes
    /^aggiungi\s+/i,
    /^crea\s+/i,
    /^ricordami di\s+/i,
    /^imposta\s+/i,
    /^aggiorna\s+/i,
    /^modifica\s+/i,
    /^cambia\s+/i,
  ];
  
  for (const pattern of prefixPatterns) {
    text = text.replace(pattern, '');
  }
  
  // Remove common suffixes (English and Italian)
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
  ];
  
  for (const pattern of suffixPatterns) {
    text = text.replace(pattern, '');
  }
  
  return text.trim();
}

/**
 * Extract status from natural language (English and Italian)
 */
function extractStatus(text: string, locale: Locale = 'en-US'): 'TO DO' | 'IN_PROCESS' | 'DONE' | undefined {
  const lower = text.toLowerCase();
  
  // English keywords
  if (lower.includes('done') || lower.includes('complete') || lower.includes('finished')) {
    return 'DONE';
  }
  if (lower.includes('in progress') || lower.includes('working on') || lower.includes('doing')) {
    return 'IN_PROCESS';
  }
  if (lower.includes('to do') || lower.includes('todo') || lower.includes('pending')) {
    return 'TO DO';
  }
  
  // Italian keywords
  if (lower.includes('fatto') || lower.includes('completato') || lower.includes('finito') || lower.includes('terminato')) {
    return 'DONE';
  }
  if (lower.includes('in corso') || lower.includes('in lavorazione') || lower.includes('stai facendo')) {
    return 'IN_PROCESS';
  }
  if (lower.includes('da fare') || lower.includes('todo') || lower.includes('in sospeso')) {
    return 'TO DO';
  }
  
  return undefined;
}

/**
 * Extract category from natural language (English and Italian)
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
  
  return undefined;
}

/**
 * Extract priority from natural language (English and Italian)
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
  
  // Use chrono-node to parse dates/times (with locale support)
  // Note: chrono-node should handle Italian dates even with default parser
  // but we use locale-specific keyword matching for better accuracy
  const parsedDate = chrono.parseDate(userRequest);
  let dueDateTime: string | null = null;
  let textWithoutDate = userRequest;
  
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
  
  const lower = userRequest.toLowerCase();
  const filters: any[] = [];
  let queryType: QueryFilter['type'] = 'keyword';
  let keyword: string | undefined;
  
  // Parse date/time queries using chrono-node
  // Note: chrono-node should handle Italian dates even with default parser
  // but we use locale-specific keyword matching for better accuracy
  const chronoResults = chrono.parse(userRequest);
  let dateFilter: any = null;
  
  if (chronoResults.length > 0) {
    const result = chronoResults[0];
    const parsedDate = result.start.date();
    const now = new Date();
    
    // Today (English and Italian)
    if (lower.includes('today') || lower.includes('oggi')) {
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
    // Tomorrow (English and Italian)
    else if (lower.includes('tomorrow') || lower.includes('domani')) {
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
    // This week (English and Italian)
    else if (lower.includes('this week') || lower.includes('questa settimana')) {
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
    // Next week (English and Italian)
    else if (lower.includes('next week') || lower.includes('prossima settimana')) {
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
    // Overdue (English and Italian)
    else if (lower.includes('overdue') || lower.includes('scaduto') || lower.includes('in ritardo')) {
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
    // Before/After time (English and Italian)
    else if (lower.includes('before') || lower.includes('after') || lower.includes('prima') || lower.includes('dopo')) {
      const isBefore = lower.includes('before') || lower.includes('prima');
      const timeMatch = userRequest.match(/(\d{1,2})\s*(pm|am|:?\d{2})?/i);
      
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
  
  // Status queries (English and Italian)
  if (lower.includes('to do') || lower.includes('todo') || lower.includes('not done') || lower.includes('incomplete') ||
      lower.includes('da fare') || lower.includes('in sospeso')) {
    filters.push({
      property: 'Status',
      select: {
        equals: 'TO DO',
      },
    });
    if (queryType === 'keyword') queryType = 'status';
  } else if (lower.includes('in progress') || lower.includes('working on') || lower.includes('ongoing') ||
             lower.includes('in corso') || lower.includes('in lavorazione')) {
    filters.push({
      property: 'Status',
      select: {
        equals: 'IN_PROCESS',
      },
    });
    if (queryType === 'keyword') queryType = 'status';
  } else if (lower.includes('done') || lower.includes('complete') || lower.includes('finished') ||
             lower.includes('fatto') || lower.includes('completato') || lower.includes('finito')) {
    filters.push({
      property: 'Status',
      select: {
        equals: 'DONE',
      },
    });
    if (queryType === 'keyword') queryType = 'status';
  }
  
  // Category queries (English and Italian)
  if ((lower.includes('work') && !lower.includes('homework')) || lower.includes('lavoro') || lower.includes('ufficio')) {
    filters.push({
      property: 'Category',
      select: {
        equals: 'WORK',
      },
    });
    if (queryType === 'keyword') queryType = 'category';
  } else if (lower.includes('personal') || lower.includes('home') || 
             lower.includes('personale') || lower.includes('casa')) {
    filters.push({
      property: 'Category',
      select: {
        equals: 'PERSONAL',
      },
    });
    if (queryType === 'keyword') queryType = 'category';
  }
  
  // Priority queries (English and Italian)
  if (lower.includes('high priority') || lower.includes('urgent') || lower.includes('important') ||
      lower.includes('alta priorità') || lower.includes('priorità alta') || lower.includes('urgente')) {
    filters.push({
      property: 'Priority',
      select: {
        equals: 'HIGH',
      },
    });
    if (queryType === 'keyword') queryType = 'priority';
  } else if (lower.includes('low priority') || lower.includes('low') ||
             lower.includes('bassa priorità') || lower.includes('priorità bassa')) {
    filters.push({
      property: 'Priority',
      select: {
        equals: 'LOW',
      },
    });
    if (queryType === 'keyword') queryType = 'priority';
  } else if (lower.includes('normal priority') || lower.includes('medium priority') ||
             lower.includes('priorità normale') || lower.includes('media priorità')) {
    filters.push({
      property: 'Priority',
      select: {
        equals: 'NORMAL',
      },
    });
    if (queryType === 'keyword') queryType = 'priority';
  }
  
  // Keyword search (extract remaining text after removing date/time references)
  let keywordText = userRequest;
  if (chronoResults.length > 0) {
    chronoResults.forEach(result => {
      if (result.text) {
        keywordText = keywordText.replace(result.text, '').trim();
      }
    });
  }
  
  // Remove query words (English and Italian)
  const queryWords = [
    // English
    'what', 'are', 'my', 'tasks', 'for', 'show', 'me', 'list', 'tell', 'check', 'read', 'do', 'i', 'have', 'about',
    // Italian
    'cosa', 'quali', 'mie', 'attività', 'per', 'mostrami', 'dimmi', 'elenca', 'controlla', 'leggi', 'fai', 'ho', 'di'
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

