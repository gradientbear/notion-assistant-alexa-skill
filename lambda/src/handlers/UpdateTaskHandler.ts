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
      
      // Extract task name (remove update keywords - English and Italian)
      let taskNameText = userRequest;
      const updateKeywords = [
        // English
        'update', 'change', 'modify', 'set', 'move', 'reschedule', 'rename',
        // Italian
        'aggiorna', 'modifica', 'cambia', 'imposta', 'sposta', 'ripianifica', 'rinomina'
      ];
      for (const keyword of updateKeywords) {
        taskNameText = taskNameText.replace(new RegExp(`^${keyword}\\s+`, 'i'), '');
      }
      
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
        status?: 'TO DO' | 'IN_PROCESS' | 'DONE';
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

      // If no updates detected, try to infer from keywords (English and Italian)
      if (Object.keys(updates).length === 0) {
        if (lowerRequest.includes('done') || lowerRequest.includes('complete') || lowerRequest.includes('finish') ||
            lowerRequest.includes('fatto') || lowerRequest.includes('completato') || lowerRequest.includes('finito')) {
          updates.status = 'DONE';
        } else if (lowerRequest.includes('in progress') || lowerRequest.includes('working on') ||
                   lowerRequest.includes('in corso') || lowerRequest.includes('in lavorazione')) {
          updates.status = 'IN_PROCESS';
        } else if (lowerRequest.includes('to do') || lowerRequest.includes('todo') ||
                   lowerRequest.includes('da fare')) {
          updates.status = 'TO DO';
        }
        
        if (lowerRequest.includes('high priority') || lowerRequest.includes('urgent') ||
            lowerRequest.includes('alta priorità') || lowerRequest.includes('urgente')) {
          updates.priority = 'HIGH';
        } else if (lowerRequest.includes('low priority') || lowerRequest.includes('low') ||
                   lowerRequest.includes('bassa priorità')) {
          updates.priority = 'LOW';
        } else if (lowerRequest.includes('normal priority') || lowerRequest.includes('medium priority') ||
                   lowerRequest.includes('priorità normale')) {
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
        const statusKey = updates.status === 'DONE' ? 'status_done' : 
                         updates.status === 'IN_PROCESS' ? 'status_in_progress' : 'status_to_do';
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
        const dueDate = new Date(updates.dueDateTime);
        const dateStr = dueDate.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
        const hours = dueDate.getHours();
        const minutes = dueDate.getMinutes();
        if (hours !== 0 || minutes !== 0) {
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

