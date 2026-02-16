import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse, cleanTaskName, findMatchingTask } from '../utils/alexa';
import { findDatabaseByName, getAllTasks, updateTask } from '../utils/notion';
import { parseTaskFromUserRequest } from '../utils/parsing';
import { getTranslation, getLocale } from '../utils/i18n';

export class UpdateTaskHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest 
      ? (handlerInput.requestEnvelope.request as any).intent?.name 
      : null;
    
    const canHandle = isIntentRequest && intentName === 'UpdateTaskIntent';
    
    return canHandle;
  }

  async handle(handlerInput: HandlerInput) {
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;

    if (!user || !notionClient) {
      return buildResponse(
        handlerInput,
        getTranslation(handlerInput, 'notion_required_update'),
        getTranslation(handlerInput, 'what_would_you_like')
      );
    }

    try {
      const request = handlerInput.requestEnvelope.request as any;
      const slots = request.intent.slots || {};
      
      // Extract userRequest from AMAZON.SearchQuery slot
      const userRequest = slots.userRequest?.value;

      if (!userRequest || userRequest.trim().length === 0) {
        return buildResponse(
          handlerInput,
          getTranslation(handlerInput, 'update_task_prompt'),
          getTranslation(handlerInput, 'update_task_reprompt')
        );
      }

      // Try to use stored database ID first, fallback to search
      let tasksDbId = user.tasks_db_id || null;
      
      if (!tasksDbId) {
        tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
      }
      
      if (!tasksDbId) {
        return buildResponse(
          handlerInput,
          getTranslation(handlerInput, 'notion_db_not_found_simple'),
          getTranslation(handlerInput, 'what_would_you_like')
        );
      }

      // Parse the update request to extract task name and updates
      const locale = getLocale(handlerInput);
      const parsed = parseTaskFromUserRequest(userRequest, locale);
      const lowerRequest = userRequest.toLowerCase();
      
      // Extract task name (remove update keywords - English, Italian, French, Spanish)
      let taskNameText = userRequest;
      const updateKeywords = [
        // English
        'update', 'change', 'modify', 'set', 'move', 'reschedule', 'rename',
        // Italian
        'aggiorna', 'modifica', 'cambia', 'imposta', 'sposta', 'ripianifica', 'rinomina',
        // French
        'mettre à jour', 'modifier', 'changer', 'définir', 'déplacer', 'reprogrammer', 'renommer',
        // Spanish
        'actualizar', 'modificar', 'cambiar', 'establecer', 'mover', 'reprogramar', 'renombrar'
      ];
      for (const keyword of updateKeywords) {
        taskNameText = taskNameText.replace(new RegExp(`^${keyword}\\s+`, 'i'), '');
      }
      
      // Remove "the task:" / "the tasks:" prefix (common in test sentences)
      taskNameText = taskNameText.replace(/^the\s+task:\s*/i, '');
      taskNameText = taskNameText.replace(/^the\s+tasks:\s*/i, '');
      taskNameText = taskNameText.replace(/^task:\s*/i, '');
      taskNameText = taskNameText.replace(/^tasks:\s*/i, '');
      
      // Clean task name
      const cleanedTaskName = cleanTaskName(taskNameText, locale);

      // Get all tasks to find matching task
      const allTasks = await getAllTasks(notionClient, tasksDbId);
      const matchingTask = findMatchingTask(cleanedTaskName, allTasks);
      
      if (!matchingTask) {
        return buildResponse(
          handlerInput,
          getTranslation(handlerInput, 'task_not_found', { taskName: cleanedTaskName }),
          getTranslation(handlerInput, 'what_else')
        );
      }

      // Build update object
      const updates: {
        status?: 'TO DO' | 'DONE';
        priority?: 'LOW' | 'NORMAL' | 'HIGH';
        dueDateTime?: string | null;
      } = {};

      // Determine what to update based on parsed values and request text
      if (parsed.status && parsed.status !== matchingTask.status) {
        updates.status = parsed.status;
      }
      
      if (parsed.priority && parsed.priority !== matchingTask.priority) {
        updates.priority = parsed.priority;
      }
      
      if (parsed.dueDateTime !== undefined && parsed.dueDateTime !== matchingTask.dueDateTime) {
        updates.dueDateTime = parsed.dueDateTime;
      }

      // If no updates detected, try to infer from keywords (English, Italian, French, Spanish)
      if (Object.keys(updates).length === 0) {
        if (lowerRequest.includes('done') || lowerRequest.includes('complete') || lowerRequest.includes('finish') ||
            lowerRequest.includes('fatto') || lowerRequest.includes('completato') || lowerRequest.includes('finito') ||
            lowerRequest.includes('terminé') || lowerRequest.includes('complété') || lowerRequest.includes('fini') ||
            lowerRequest.includes('hecho') || lowerRequest.includes('completado') || lowerRequest.includes('terminado')) {
          updates.status = 'DONE';
        } else if (lowerRequest.includes('to do') || lowerRequest.includes('todo') ||
                   lowerRequest.includes('da fare') ||
                   lowerRequest.includes('à faire') ||
                   lowerRequest.includes('por hacer')) {
          updates.status = 'TO DO';
        }
        
        if (lowerRequest.includes('high priority') || lowerRequest.includes('urgent') ||
            lowerRequest.includes('alta priorità') || lowerRequest.includes('urgente') ||
            lowerRequest.includes('haute priorité') || lowerRequest.includes('urgent') ||
            lowerRequest.includes('alta prioridad') || lowerRequest.includes('urgente')) {
          updates.priority = 'HIGH';
        } else if (lowerRequest.includes('low priority') || lowerRequest.includes('low') ||
                   lowerRequest.includes('bassa priorità') ||
                   lowerRequest.includes('basse priorité') ||
                   lowerRequest.includes('baja prioridad')) {
          updates.priority = 'LOW';
        } else if (lowerRequest.includes('normal priority') || lowerRequest.includes('medium priority') ||
                   lowerRequest.includes('priorità normale') ||
                   lowerRequest.includes('priorité normale') ||
                   lowerRequest.includes('prioridad normal')) {
          updates.priority = 'NORMAL';
        }
      }

      if (Object.keys(updates).length === 0) {
        return buildResponse(
          handlerInput,
          getTranslation(handlerInput, 'update_unsure', { taskName: matchingTask.name }),
          getTranslation(handlerInput, 'what_would_you_like')
        );
      }

      // Update the task
      await updateTask(notionClient, matchingTask.id, updates);

      // Build confirmation message
      const updateParts: string[] = [];
      if (updates.status) {
        const statusKey = updates.status === 'DONE' ? 'status_done' : 'status_to_do';
        const statusText = getTranslation(handlerInput, statusKey);
        updateParts.push(getTranslation(handlerInput, 'status_to', { status: statusText }));
      }
      if (updates.priority) {
        const priorityKey = updates.priority === 'HIGH' ? 'priority_high' :
                           updates.priority === 'LOW' ? 'priority_low' : 'priority_normal';
        const priorityText = getTranslation(handlerInput, priorityKey);
        updateParts.push(getTranslation(handlerInput, 'priority_to', { priority: priorityText }));
      }
      if (updates.dueDateTime) {
        const isDateOnly = typeof updates.dueDateTime === 'string' && !updates.dueDateTime.includes('T');
        const dueDate = new Date(updates.dueDateTime);
        const dateStr = isDateOnly
          ? dueDate.toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' })
          : dueDate.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
        const hours = dueDate.getUTCHours();
        const minutes = dueDate.getUTCMinutes();
        if (!isDateOnly && (hours !== 0 || minutes !== 0)) {
          const timeStr = dueDate.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', hour12: true });
          updateParts.push(getTranslation(handlerInput, 'due_date_to_time', { date: dateStr, time: timeStr }));
        } else {
          updateParts.push(getTranslation(handlerInput, 'due_date_to', { date: dateStr }));
        }
      }

      const confirmation = getTranslation(handlerInput, 'task_updated', { 
        taskName: matchingTask.name, 
        updates: updateParts.join(', ') 
      });

      return buildResponse(handlerInput, confirmation, getTranslation(handlerInput, 'what_else'));
    } catch (error: any) {
      console.error('[UpdateTaskHandler] Error updating task:', error);
      console.error('[UpdateTaskHandler] Error details:', {
        message: error?.message,
        status: error?.status,
        code: error?.code,
        stack: error?.stack
      });
      return buildResponse(
        handlerInput,
        getTranslation(handlerInput, 'update_task_error'),
        getTranslation(handlerInput, 'what_would_you_like')
      );
    }
  }
}

