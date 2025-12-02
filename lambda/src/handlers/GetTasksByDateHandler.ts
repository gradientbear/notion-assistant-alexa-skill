import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse } from '../utils/alexa';
import { findDatabaseByName, getTasksByDate, getOverdueTasks, getTasksDueTomorrow, getTasksDueThisWeek } from '../utils/notion';

export class GetTasksByDateHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest
      ? (handlerInput.requestEnvelope.request as any).intent?.name
      : null;
    
    const canHandle = isIntentRequest && intentName === 'GetTasksByDateIntent';
    
    if (isIntentRequest) {
      console.log('[GetTasksByDateHandler] canHandle check:', {
        isIntentRequest,
        intentName,
        canHandle
      });
    }
    
    return canHandle;
  }

  async handle(handlerInput: HandlerInput) {
    console.log('[GetTasksByDateHandler] Handler invoked');
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;
    
    console.log('[GetTasksByDateHandler] Session check:', {
      hasUser: !!user,
      hasNotionClient: !!notionClient,
      userId: user?.id
    });

    if (!user || !notionClient) {
      return buildResponse(
        handlerInput,
        'To view your tasks, you need to connect your Notion account. ' +
        'Open the Alexa app, go to Skills, find Notion Data, and click Link Account.',
        'What would you like to do?'
      );
    }

    try {
      const request = handlerInput.requestEnvelope.request as any;
      const slots = request.intent.slots || {};
      const dueDateSlot = slots.dueDate?.value;

      console.log('[GetTasksByDateHandler] Slots:', {
        dueDate: dueDateSlot
      });

      const tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
      if (!tasksDbId) {
        return buildResponse(
          handlerInput,
          'I couldn\'t find your Tasks database in Notion. Please make sure it exists and try again.',
          'What would you like to do?'
        );
      }

      let tasks: any[] = [];
      let speechText = '';

      // Parse date from slot or detect keywords
      const dateValue = dueDateSlot?.toLowerCase() || '';
      
      if (dateValue.includes('tomorrow')) {
        tasks = await getTasksDueTomorrow(notionClient, tasksDbId);
        if (tasks.length === 0) {
          speechText = 'You have nothing due tomorrow.';
        } else {
          const taskList = tasks.map(t => t.name).join(', ');
          speechText = `Tomorrow you have ${tasks.length} task${tasks.length > 1 ? 's' : ''}: ${taskList}.`;
        }
      } else if (dateValue.includes('this week') || dateValue.includes('week')) {
        tasks = await getTasksDueThisWeek(notionClient, tasksDbId);
        if (tasks.length === 0) {
          speechText = 'You have nothing due this week.';
        } else {
          const taskList = tasks.slice(0, 10).map(t => t.name).join(', ');
          const moreCount = tasks.length > 10 ? tasks.length - 10 : 0;
          speechText = `This week you have ${tasks.length} task${tasks.length > 1 ? 's' : ''} due: ${taskList}`;
          if (moreCount > 0) {
            speechText += `, and ${moreCount} more.`;
          }
        }
      } else if (dateValue.includes('overdue')) {
        tasks = await getOverdueTasks(notionClient, tasksDbId);
        if (tasks.length === 0) {
          speechText = 'You have no overdue tasks. Great job!';
        } else {
          const taskList = tasks.map(t => t.name).join(', ');
          speechText = `You have ${tasks.length} overdue task${tasks.length > 1 ? 's' : ''}: ${taskList}.`;
        }
      } else if (dueDateSlot) {
        // Try to parse as date
        try {
          const date = new Date(dueDateSlot);
          if (!isNaN(date.getTime())) {
            const dateStr = date.toISOString().split('T')[0];
            tasks = await getTasksByDate(notionClient, tasksDbId, dateStr);
            
            if (tasks.length === 0) {
              speechText = `You have no tasks due on ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.`;
            } else {
              const taskList = tasks.map(t => t.name).join(', ');
              speechText = `On ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}, you have ${tasks.length} task${tasks.length > 1 ? 's' : ''}: ${taskList}.`;
            }
          } else {
            // Fallback to today
            const today = new Date().toISOString().split('T')[0];
            tasks = await getTasksByDate(notionClient, tasksDbId, today);
            if (tasks.length === 0) {
              speechText = 'You have no tasks due today.';
            } else {
              const taskList = tasks.map(t => t.name).join(', ');
              speechText = `Today you have ${tasks.length} task${tasks.length > 1 ? 's' : ''}: ${taskList}.`;
            }
          }
        } catch (e) {
          // Fallback to today
          const today = new Date().toISOString().split('T')[0];
          tasks = await getTasksByDate(notionClient, tasksDbId, today);
          if (tasks.length === 0) {
            speechText = 'You have no tasks due today.';
          } else {
            const taskList = tasks.map(t => t.name).join(', ');
            speechText = `Today you have ${tasks.length} task${tasks.length > 1 ? 's' : ''}: ${taskList}.`;
          }
        }
      } else {
        // No date specified - default to today
        const today = new Date().toISOString().split('T')[0];
        tasks = await getTasksByDate(notionClient, tasksDbId, today);
        if (tasks.length === 0) {
          speechText = 'You have no tasks due today.';
        } else {
          const taskList = tasks.map(t => t.name).join(', ');
          speechText = `Today you have ${tasks.length} task${tasks.length > 1 ? 's' : ''}: ${taskList}.`;
        }
      }

      return buildResponse(handlerInput, speechText, 'What else would you like to do?');
    } catch (error: any) {
      console.error('[GetTasksByDateHandler] Error getting tasks:', error);
      return buildResponse(
        handlerInput,
        'I encountered an error retrieving your tasks. Please try again later.',
        'What would you like to do?'
      );
    }
  }
}

