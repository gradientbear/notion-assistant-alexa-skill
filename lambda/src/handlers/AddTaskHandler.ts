import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse } from '../utils/alexa';
import { findDatabaseByName, addTask } from '../utils/notion';
import { getTranslation, getLocale } from '../utils/i18n';
import { parseTaskFromUserRequest } from '../utils/parsing';
import { normalizePriority, normalizeCategory } from '../utils/normalization';
import { getDeviceTimeZone, convertTimeToDeviceTimeZone } from '../utils/deviceSettings';
import * as chrono from 'chrono-node';

export class AddTaskHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest 
      ? (handlerInput.requestEnvelope.request as any).intent?.name 
      : null;
    return isIntentRequest && intentName === 'CreateTaskIntent';
  }

  async handle(handlerInput: HandlerInput) {
    try {
      const attributes = handlerInput.attributesManager.getSessionAttributes();
      const user = attributes.user;
      const notionClient = attributes.notionClient;

      if (!user || !notionClient) {
        return buildResponse(
          handlerInput,
          getTranslation(handlerInput, 'notion_required_add'),
          getTranslation(handlerInput, 'what_would_you_like')
        );
      }

      const request = handlerInput.requestEnvelope.request as any;
      const slots = request.intent.slots || {};
      const locale = getLocale(handlerInput);
      
      // Try multiple paths to access original utterance
      const nluTokens = request.intent?.nlu?.tokens || [];
      const originalUtterance = nluTokens.join(' ').toLowerCase();
      
      // Try to get from interpretations
      const interpretations = request.intent?.nlu?.interpretations || [];
      let utteranceFromInterpretations = '';
      if (interpretations.length > 0) {
        utteranceFromInterpretations = (interpretations[0]?.nluConfidence?.intent?.input || '').toLowerCase();
        // Log all interpretations to see if we can find the original utterance
        console.log('[AddTaskHandler] NLU Interpretations:', JSON.stringify(interpretations, null, 2));
      }
      
      // Try to get original utterance from request.request object (if available)
      const requestInput = (request as any).input || (request as any).rawInput || '';
      console.log('[AddTaskHandler] Request input/rawInput:', requestInput);
      
      // Try to get from nlu.interpretations[].input (alternative path)
      let allInterpretationInputs: string[] = [];
      if (interpretations && interpretations.length > 0) {
        interpretations.forEach((interp: any) => {
          if (interp.nluConfidence?.intent?.input) {
            allInterpretationInputs.push(interp.nluConfidence.intent.input);
          }
          if (interp.input) {
            allInterpretationInputs.push(interp.input);
          }
        });
      }
      const allInputs = [requestInput, ...allInterpretationInputs].filter(Boolean).join(' ').toLowerCase();
      console.log('[AddTaskHandler] All input sources:', { requestInput, allInterpretationInputs, allInputs });
      
      // NOTE: We no longer scan the full request envelope for date keywords.
      // The envelope always contains interaction model sample utterances like
      // "add {taskName} tomorrow" which causes false positives on every request.
      
      // Extract values from specific slots (Alexa disallows phrase slot + other slot in same utterance).
      const taskNameSlot = slots.taskName?.value;
      const dueDateTimeSlot = slots.dueDateTime?.value;
      const prioritySlot = slots.priority?.value;
      const categorySlot = slots.category?.value;
      const notes = slots.notes?.value;

      // Check required slot - taskName is the only required field
      if (!taskNameSlot || taskNameSlot.trim().length === 0) {
        return buildResponse(
          handlerInput,
          getTranslation(handlerInput, 'add_task_prompt'),
          getTranslation(handlerInput, 'add_task_reprompt')
        );
      }

      // Collect ALL slot values to check for date keywords that might be in any slot
      const allSlotValues = [
        taskNameSlot,
        dueDateTimeSlot,
        prioritySlot,
        categorySlot,
        notes
      ].filter(Boolean).join(' ').toLowerCase();
      
      // Build text for parsing. With only CreateTaskIntent, taskName should contain the full phrase
      // (e.g. "buy milk tomorrow" or "buy milk today"); parser extracts date and strips from task name.
      let finalCombinedText = [taskNameSlot, dueDateTimeSlot].filter(Boolean).join(' ').trim();
      const intentName = request.intent?.name || '';

      // Combine all utterance sources for checking (including all interpretation inputs)
      const allUtteranceSources = [originalUtterance, utteranceFromInterpretations, allInputs].filter(Boolean).join(' ');
      
      // Helper function to check if a keyword exists in text (as whole word)
      const hasKeyword = (text: string, keyword: string): boolean => {
        if (!text) return false;
        const lowerText = text.toLowerCase();
        const lowerKeyword = keyword.toLowerCase();
        // Check as whole word (with word boundaries or at start/end)
        return new RegExp(`(?:^|\\s)${lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`, 'i').test(lowerText) ||
               lowerText === lowerKeyword ||
               lowerText.startsWith(lowerKeyword + ' ') ||
               lowerText.endsWith(' ' + lowerKeyword);
      };
      
      // Check multiple sources for date keywords and add them if missing
      // Priority: 1) Original utterance from NLU/interpretations, 2) Request envelope JSON, 3) Slot values
      // Make checks independent so both "oggi" and "domani" can be detected
      const lowerFinalText = finalCombinedText.toLowerCase();
      
      if (allUtteranceSources) {
        if (hasKeyword(allUtteranceSources, 'oggi') && !hasKeyword(finalCombinedText, 'oggi')) {
          finalCombinedText += ' oggi';
        }
        if (hasKeyword(allUtteranceSources, 'domani') && !hasKeyword(finalCombinedText, 'domani')) {
          finalCombinedText += ' domani';
        }
        if (hasKeyword(allUtteranceSources, 'today') && !hasKeyword(finalCombinedText, 'today')) {
          finalCombinedText += ' today';
        }
        if (hasKeyword(allUtteranceSources, 'tomorrow') && !hasKeyword(finalCombinedText, 'tomorrow')) {
          finalCombinedText += ' tomorrow';
        }
      }
      
      // NOTE: We no longer check the full request envelope JSON for date keywords.
      // The envelope contains interaction model sample utterances (e.g. "add {taskName} tomorrow",
      // "aggiungi {taskName} oggi") which causes false positives on EVERY request.
      
      // Final fallback: If "oggi" or "domani" appears in any slot but not in finalCombinedText, add it
      // Make checks independent
      if (hasKeyword(allSlotValues, 'oggi') && !hasKeyword(finalCombinedText, 'oggi')) {
        finalCombinedText += ' oggi';
      }
      if (hasKeyword(allSlotValues, 'domani') && !hasKeyword(finalCombinedText, 'domani')) {
        finalCombinedText += ' domani';
      }
      
      // Also check for English keywords in slots
      if (hasKeyword(allSlotValues, 'today') && !hasKeyword(finalCombinedText, 'today')) {
        finalCombinedText += ' today';
      }
      if (hasKeyword(allSlotValues, 'tomorrow') && !hasKeyword(finalCombinedText, 'tomorrow')) {
        finalCombinedText += ' tomorrow';
      }
      
      // NOTE: Italian full-request-envelope recovery removed for the same reason as English —
      // the envelope always contains sample utterances with "oggi"/"domani" causing false positives.
      
      // NOTE: We intentionally do NOT search the full request envelope JSON for date keywords.
      // The envelope contains interaction model sample utterances (e.g. "add {taskName} tomorrow")
      // which would cause false positives — every request would match "tomorrow"/"today".
      // Date keywords can only be reliably recovered from slot values and NLU sources.
      
      // Final check: If we're in Italian locale and the taskName slot doesn't contain date keywords,
      // but the interaction model samples suggest they should be there (e.g., "aggiungi {taskName} oggi"),
      // we need to check if the user's utterance pattern matches those samples.
      // Since we can't access the original utterance, we'll rely on the fact that if the user said
      // "aggiungi chiamare la mamma oggi", the taskName should ideally include "oggi".
      // However, if Alexa filtered it out completely, we can't recover it.
      // The solution is to ensure the interaction model is configured correctly.
      
      console.log('[AddTaskHandler] Final combined text before parsing:', {
        finalCombinedText,
        taskNameSlot,
        hasOggi: hasKeyword(finalCombinedText, 'oggi'),
        hasDomani: hasKeyword(finalCombinedText, 'domani'),
        allInputs,
        allUtteranceSources
      });
      
      console.log('[AddTaskHandler] Slot values:', {
        taskNameSlot,
        prioritySlot,
        categorySlot,
        notes,
        allSlotValues,
        finalCombinedText
      });
      
      console.log('[AddTaskHandler] Date keyword summary:', {
        inSlotValues: {
          today: allSlotValues.includes('today'),
          tomorrow: allSlotValues.includes('tomorrow'),
          oggi: allSlotValues.includes('oggi'),
          domani: allSlotValues.includes('domani'),
        },
        inFinalCombinedText: {
          today: finalCombinedText.toLowerCase().includes('today'),
          tomorrow: finalCombinedText.toLowerCase().includes('tomorrow'),
          oggi: finalCombinedText.toLowerCase().includes('oggi'),
          domani: finalCombinedText.toLowerCase().includes('domani'),
        },
      });

      // Parse combined text to extract embedded information (dates, priority, category)
      const parsed = parseTaskFromUserRequest(finalCombinedText, locale);
      
      console.log('[AddTaskHandler] Parsed task:', {
        finalCombinedText,
        parsedDueDateTime: parsed.dueDateTime,
        parsedTaskName: parsed.parsedName
      });
      
      // Use explicit slot values if provided, otherwise use parsed values or defaults
      // For dueDateTime, prioritize dueDateTimeSlot (from interaction model) over parsed values
      // The dueDateTime slot is now available in the interaction model to capture date keywords
      const taskName = parsed.parsedName || taskNameSlot.trim();
      const priority = prioritySlot || parsed.priority || 'NORMAL';
      
      // Prioritize dueDateTimeSlot if explicitly provided (from interaction model slot)
      // Otherwise, use parsed.dueDateTime from combined text (fallback for backward compatibility)
      let dueDateTime: string | null = null;
      if (dueDateTimeSlot && dueDateTimeSlot.trim()) {
        // Parse the dueDateTimeSlot value directly - this is the primary source
        const parsedFromSlot = parseTaskFromUserRequest(dueDateTimeSlot.trim(), locale);
        dueDateTime = parsedFromSlot.dueDateTime || null;
        console.log('[AddTaskHandler] Parsed dueDateTime from slot:', {
          dueDateTimeSlot,
          parsedDueDateTime: dueDateTime
        });
      } else {
        // Fallback: use parsed date from combined text (for backward compatibility)
        dueDateTime = parsed.dueDateTime || null;
      }
      
      const category = categorySlot || parsed.category || 'PERSONAL';

      // Try to use stored database ID first, fallback to search
      let tasksDbId = user.tasks_db_id || null;
      
      if (!tasksDbId) {
        tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
      }
      
      if (!tasksDbId) {
        return buildResponse(
          handlerInput,
          getTranslation(handlerInput, 'notion_db_not_found'),
          getTranslation(handlerInput, 'what_would_you_like')
        );
      }

      // Parse date/time from dueDateTime if it's a string (from slot)
      let parsedDueDateTime: string | null = null;
      if (dueDateTime) {
        if (typeof dueDateTime === 'string') {
          // Check if it's already an ISO string (from parseTaskFromUserRequest)
          if (dueDateTime.includes('T') && (dueDateTime.endsWith('Z') || dueDateTime.includes('+'))) {
            // Already an ISO string, use it directly
            parsedDueDateTime = dueDateTime;
          } else if (/^\d{4}-\d{2}-\d{2}$/.test(dueDateTime.trim())) {
            // Date-only (no time): preserve so Notion shows "February 10, 2026" without time
            parsedDueDateTime = dueDateTime.trim();
          } else {
            // Use chrono-node as primary parser for better natural language support
            const chronoResult = chrono.parseDate(dueDateTime);
            if (chronoResult) {
              const d = new Date(chronoResult);
              parsedDueDateTime = (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0)
                ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
                : d.toISOString();
            } else {
              // Fallback to native Date if chrono fails
              const parsedDate = new Date(dueDateTime);
              if (!isNaN(parsedDate.getTime())) {
                parsedDueDateTime = (parsedDate.getUTCHours() === 0 && parsedDate.getUTCMinutes() === 0 && parsedDate.getUTCSeconds() === 0)
                  ? `${parsedDate.getUTCFullYear()}-${String(parsedDate.getUTCMonth() + 1).padStart(2, '0')}-${String(parsedDate.getUTCDate()).padStart(2, '0')}`
                  : parsedDate.toISOString();
              } else {
                console.warn('[AddTaskHandler] Failed to parse dueDateTime:', dueDateTime);
              }
            }
          }
        } else {
          // Already parsed (ISO string from parseTaskFromUserRequest)
          parsedDueDateTime = dueDateTime;
        }
      }

      // Default date when none was provided. Recover "today"/"tomorrow" from intent, slots, interpretations, or raw request.
      // When Alexa matches CreateTaskIntent and strips "today" or "tomorrow" from the slot, we have no signal — default to today
      // so that "add X" (no date) defaults to today; "add X tomorrow" / "add X today" come in taskName and are parsed.
      if (!parsedDueDateTime) {
        // Date keywords come from taskName slot (e.g. "buy milk tomorrow") or fallback sources
        let requestContainsTomorrow =
          /\b(tomorrow|domani|demain|mañana)\b/i.test(finalCombinedText) ||
          /\b(tomorrow|domani|demain|mañana)\b/i.test(originalUtterance);
        let requestContainsToday =
          /\b(today|oggi|aujourd['']hui|hoy)\b/i.test(finalCombinedText) ||
          /\b(today|oggi|aujourd['']hui|hoy)\b/i.test(originalUtterance);
        const requestJson = JSON.stringify(handlerInput.requestEnvelope.request);
        if (!requestContainsTomorrow && /\b(tomorrow|domani|demain|mañana)\b/i.test(requestJson)) {
          requestContainsTomorrow = true;
          console.log('[AddTaskHandler] Recovered "tomorrow" from raw request envelope');
        }
        if (!requestContainsToday && /\b(today|oggi|aujourd['']hui|hoy)\b/i.test(requestJson)) {
          requestContainsToday = true;
          console.log('[AddTaskHandler] Recovered "today" from raw request envelope');
        }
        // When no date was parsed and no keyword in slot/request, default to today.
        const now = new Date();
        const localeTimeZones: Record<string, string> = {
          'it-IT': 'Europe/Rome',
          'fr-FR': 'Europe/Paris',
          'es-ES': 'Europe/Madrid',
          'es-MX': 'America/Mexico_City',
          'en-US': 'UTC',
        };
        const targetTimeZone = localeTimeZones[locale] || 'UTC';
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
        const getPart = (parts: Intl.DateTimeFormatPart[], type: string) => parts.find(p => p.type === type)?.value || '00';
        // Use tomorrow only when we have explicit "tomorrow"; otherwise default to today
        const dateToUse = requestContainsTomorrow
          ? new Date(now.getTime() + 86400000)
          : now;
        const parts = dtf.formatToParts(dateToUse);
        const tzYear = Number(getPart(parts, 'year'));
        const tzMonth = Number(getPart(parts, 'month')) - 1;
        const tzDay = Number(getPart(parts, 'day'));
        const refUtc = Date.UTC(tzYear, tzMonth, tzDay, 0, 0, 0);
        const refParts = dtf.formatToParts(new Date(refUtc));
        const h = Number(getPart(refParts, 'hour'));
        const min = Number(getPart(refParts, 'minute'));
        // Use calendar date in user's timezone (tzYear, tzMonth, tzDay), not UTC date of midnight instant
        parsedDueDateTime = `${tzYear}-${String(tzMonth + 1).padStart(2, '0')}-${String(tzDay).padStart(2, '0')}`;
        if (requestContainsTomorrow) {
          console.log('[AddTaskHandler] No parsed date, using tomorrow (from intent/keyword/request)');
        }
      }

      // When locale is en-US, "4 PM" is stored as 4 PM UTC; in Italy that shows as 5 PM. Use device timezone if available.
      if (parsedDueDateTime && locale === 'en-US') {
        const d = new Date(parsedDueDateTime);
        const hasTime = d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0;
        if (hasTime) {
          const deviceTz = await getDeviceTimeZone(handlerInput);
          if (deviceTz) {
            parsedDueDateTime = convertTimeToDeviceTimeZone(parsedDueDateTime, deviceTz);
            console.log('[AddTaskHandler] Applied device timezone for time:', { deviceTz, parsedDueDateTime });
          }
        }
      }

      // en-US + CreateTaskIntent: Alexa often strips "tomorrow" from the slot. If we have a time and the date is today, assume user said tomorrow.
      if (parsedDueDateTime && locale === 'en-US' && intentName === 'CreateTaskIntent') {
        const d = new Date(parsedDueDateTime);
        const now = new Date();
        const hasTime = d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0 || d.getUTCSeconds() !== 0;
        const isToday = d.getUTCFullYear() === now.getUTCFullYear() &&
          d.getUTCMonth() === now.getUTCMonth() && d.getUTCDate() === now.getUTCDate();
        if (hasTime && isToday) {
          d.setUTCDate(d.getUTCDate() + 1);
          parsedDueDateTime = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0
            ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
            : d.toISOString();
          console.log('[AddTaskHandler] en-US CreateTaskIntent with time and today: shifted to tomorrow', { parsedDueDateTime });
        }
      }

      // Normalize priority and category values
      const normalizedPriority = normalizePriority(priority);
      const normalizedCategory = normalizeCategory(category);
      
      // Clean task name
      const cleanedTaskName = taskName.trim();
      const parsedName = cleanedTaskName;

      // Add task with slot values
      let pageId: string;
      try {
        pageId = await addTask(
          notionClient,
          tasksDbId,
          cleanedTaskName,
          parsedName,
          normalizedPriority,
          normalizedCategory,
          parsedDueDateTime,
          'TO DO'
        );
      } catch (notionError: any) {
        console.error('[AddTaskHandler] Notion API error:', {
          message: notionError?.message,
          status: notionError?.status,
          code: notionError?.code,
          body: notionError?.body,
          stack: notionError?.stack
        });
        throw notionError; // Re-throw to be caught by outer catch
      }

      // Build confirmation message
      let confirmation = getTranslation(handlerInput, 'task_added', { taskName: parsedName });
      
      if (normalizedPriority === 'HIGH') {
        confirmation = getTranslation(handlerInput, 'task_added_high', { taskName: parsedName });
      } else if (normalizedPriority === 'LOW') {
        confirmation = getTranslation(handlerInput, 'task_added_low', { taskName: parsedName });
      }

      if (parsedDueDateTime) {
        const isDateOnly = !parsedDueDateTime.includes('T');
        const dueDateObj = new Date(parsedDueDateTime);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDateOnly = new Date(dueDateObj);
        dueDateOnly.setHours(0, 0, 0, 0);

        if (dueDateOnly.getTime() === today.getTime()) {
          confirmation += getTranslation(handlerInput, 'task_added_due_today');
        } else if (dueDateOnly.getTime() === today.getTime() + 86400000) {
          confirmation += getTranslation(handlerInput, 'task_added_due_tomorrow');
        } else {
          const dateStr = isDateOnly
            ? dueDateObj.toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' })
            : dueDateObj.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
          confirmation += getTranslation(handlerInput, 'task_added_due_date', { date: dateStr });
        }
        
        // Add time only when a specific time was set (not date-only)
        const hours = dueDateObj.getUTCHours();
        const minutes = dueDateObj.getUTCMinutes();
        if (!isDateOnly && (hours !== 0 || minutes !== 0)) {
          // Use the same timezone logic as parsing to ensure correct display
          const localeTimeZones: Record<string, string> = {
            'it-IT': 'Europe/Rome',
            'fr-FR': 'Europe/Paris',
            'es-ES': 'Europe/Madrid',
            'es-MX': 'America/Mexico_City',
            'en-US': 'UTC',
          };
          const targetTimeZone = localeTimeZones[locale] || 'UTC';
          
          // Format time using the same timezone that was used during parsing
          const timeFormatter = new Intl.DateTimeFormat(locale, {
            timeZone: targetTimeZone,
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });
          const timeStr = timeFormatter.format(dueDateObj);
          confirmation += getTranslation(handlerInput, 'task_added_due_time', { time: timeStr });
        }
      }

      if (normalizedCategory === 'WORK') {
        confirmation += getTranslation(handlerInput, 'task_added_work');
      }

      confirmation += '.';

      return buildResponse(handlerInput, confirmation, getTranslation(handlerInput, 'what_else'));
    } catch (error: any) {
      console.error('[AddTaskHandler] Error adding task:', error);
      console.error('[AddTaskHandler] Error details:', {
        message: error?.message,
        status: error?.status,
        code: error?.code,
        stack: error?.stack,
        name: error?.name,
        error: JSON.stringify(error)
      });
      return buildResponse(
        handlerInput,
        getTranslation(handlerInput, 'add_task_error'),
        getTranslation(handlerInput, 'what_would_you_like')
      );
    }
  }
}


