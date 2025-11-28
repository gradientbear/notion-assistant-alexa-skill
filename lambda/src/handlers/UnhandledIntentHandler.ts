import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse, findMatchingTask } from '../utils/alexa';
import { findDatabaseByName, addTask, getAllTasks, markTaskComplete } from '../utils/notion';

/**
 * Handles intents that don't match any specific handler.
 * Provides helpful guidance to users about available commands.
 * Also handles follow-up tasks during brain dump sessions.
 */
export class UnhandledIntentHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    // This handler should be added last, so it only handles intents that no other handler can handle
    // The SDK will call this if no other handler's canHandle returns true
    return handlerInput.requestEnvelope.request.type === 'IntentRequest';
  }

  async handle(handlerInput: HandlerInput) {
    const request = handlerInput.requestEnvelope.request as any;
    const intentName = request.intent?.name;
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const conversationState = attributes.brainDumpState || 'initial';
    
    console.log('[UnhandledIntentHandler] Unhandled intent:', intentName);
    console.log('[UnhandledIntentHandler] Conversation state:', conversationState);
    
    // Check if we're in a brain dump collecting state
    // If so, treat any utterance as a potential task
    if (conversationState === 'collecting') {
      const user = attributes.user;
      const notionClient = attributes.notionClient;
      
      if (user && notionClient) {
        // Try to extract task from the intent slots or utterance
        let taskValue = request.intent?.slots?.task?.value;
        
        // If no task slot, try to get it from other sources
        if (!taskValue || taskValue.trim().length === 0) {
          // Check for raw input or other slot values
          const allSlots = request.intent?.slots || {};
          for (const slotName in allSlots) {
            const slot = allSlots[slotName];
            if (slot?.value && slot.value.trim().length > 0) {
              taskValue = slot.value;
              break;
            }
          }
        }
        
        // If still no task value, check if "done" was said
        const donePhrases = ['done', 'finished', 'that\'s all', 'complete', 'nothing'];
        if (taskValue && donePhrases.some(phrase => taskValue.toLowerCase().includes(phrase))) {
          // User said done - save all collected tasks
          const tasks = attributes.brainDumpTasks || [];
          if (tasks.length > 0) {
            try {
              const tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
              if (tasksDbId) {
                // Tasks should already be saved (we save immediately now)
                // Just confirm
                attributes.brainDumpState = 'initial';
                attributes.brainDumpTasks = [];
                handlerInput.attributesManager.setSessionAttributes(attributes);
                
                return buildResponse(
                  handlerInput,
                  `Great! I've saved all your tasks. You had ${tasks.length} task${tasks.length > 1 ? 's' : ''} in total.`,
                  'What else would you like to do?'
                );
              }
            } catch (error: any) {
              console.error('[UnhandledIntentHandler] Error processing done:', error);
            }
          }
          
          attributes.brainDumpState = 'initial';
          attributes.brainDumpTasks = [];
          handlerInput.attributesManager.setSessionAttributes(attributes);
          return buildResponse(
            handlerInput,
            'Brain dump session ended.',
            'What would you like to do?'
          );
        }
        
        // If we have a task value, treat it as a task and add it
        if (taskValue && taskValue.trim().length > 0) {
          console.log('[UnhandledIntentHandler] Treating unhandled intent as task during brain dump:', taskValue);
          
          try {
            const tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
            if (tasksDbId) {
              // Add task to collection
              const tasks = attributes.brainDumpTasks || [];
              tasks.push(taskValue.trim());
              attributes.brainDumpTasks = tasks;
              
              // Save immediately to Notion
              await addTask(notionClient, tasksDbId, taskValue.trim());
              console.log('[UnhandledIntentHandler] Task added to Notion:', taskValue);
              
              handlerInput.attributesManager.setSessionAttributes(attributes);
              
              return buildResponse(
                handlerInput,
                `Got it. Added "${taskValue}" to your Notion database. What else?`,
                'Tell me another task, or say done when finished.'
              );
            }
          } catch (error: any) {
            console.error('[UnhandledIntentHandler] Error adding task:', error);
            // Fall through to normal unhandled response
          }
        } else {
          // No task value but we're collecting - ask for clarification
          return buildResponse(
            handlerInput,
            'I didn\'t catch that task. Could you repeat it?',
            'Tell me the task again, or say done when finished.'
          );
        }
      }
    }
    
    // Check if this is a built-in Amazon intent
    if (intentName?.startsWith('AMAZON.')) {
      // Handle common Amazon intents
      if (intentName === 'AMAZON.HelpIntent') {
        return buildResponse(
          handlerInput,
          'I can help you manage your tasks in Notion. ' +
          'You can add tasks, list your tasks, mark them complete, update their status, or delete them. ' +
          'You can also check your connection status. What would you like to do?',
          'What would you like to do?'
        );
      }
      
      if (intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent') {
        return handlerInput.responseBuilder
          .speak('Goodbye!')
          .withShouldEndSession(true)
          .getResponse();
      }
    }
    
    // Check if this might be a "mark as done" request that wasn't recognized
    // Look for patterns like "mark", "done", "complete" in the intent name or slots
    const user = attributes.user;
    const notionClient = attributes.notionClient;
    const taskSlot = request.intent?.slots?.task?.value;
    
    if (user && notionClient && taskSlot) {
      const taskSlotLower = taskSlot.toLowerCase();
      const intentNameLower = (intentName || '').toLowerCase();
      
      // Check if this looks like a "mark as done" request
      const looksLikeMarkDone = intentNameLower.includes('mark') || 
                                intentNameLower.includes('complete') ||
                                intentNameLower.includes('done') ||
                                taskSlotLower.includes('mark') ||
                                taskSlotLower.includes('done') ||
                                taskSlotLower.includes('complete');
      
      if (looksLikeMarkDone) {
        console.log('[UnhandledIntentHandler] Detected potential "mark as done" request, attempting to handle');
        try {
          const tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
          if (tasksDbId) {
            const allTasks = await getAllTasks(notionClient, tasksDbId);
            const matchingTask = findMatchingTask(taskSlot, allTasks);
            
            if (matchingTask) {
              console.log('[UnhandledIntentHandler] Found matching task, marking as complete:', matchingTask.name);
              await markTaskComplete(notionClient, matchingTask.id);
              return buildResponse(
                handlerInput,
                `Marked: ${matchingTask.name} as complete.`,
                'What else would you like to do?'
              );
            }
          }
        } catch (error: any) {
          console.error('[UnhandledIntentHandler] Error handling mark as done:', error);
        }
      }
    }
    
    // For other unhandled intents, provide helpful guidance
    const availableCommands = [
      'add a task',
      'list my tasks',
      'mark a task as complete',
      'update a task',
      'delete a task',
      'check connection status'
    ];
    
    return buildResponse(
      handlerInput,
      `I'm not sure how to help with that. In this MVP version, I can help you with task management. ` +
      `You can ${availableCommands.join(', ')}, or say "help" to learn more. ` +
      `What would you like to do?`,
      'What would you like to do?'
    );
  }
}

