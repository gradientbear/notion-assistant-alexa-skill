import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { IntentRequest } from 'ask-sdk-model';
import { buildResponse, buildSimpleResponse } from '../utils/alexa';
import { findDatabaseByName, addTask } from '../utils/notion';

export class BrainDumpHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest 
      ? (handlerInput.requestEnvelope.request as any).intent?.name 
      : null;
    
    const canHandle = isIntentRequest && intentName === 'BrainDumpIntent';
    
    if (isIntentRequest) {
      console.log('[BrainDumpHandler] canHandle check:', {
        isIntentRequest,
        intentName,
        canHandle
      });
    }
    
    return canHandle;
  }

  async handle(handlerInput: HandlerInput) {
    try {
      console.log('[BrainDumpHandler] Handler invoked');
      
      const attributes = handlerInput.attributesManager.getSessionAttributes();
      const user = attributes.user;
      const notionClient = attributes.notionClient;

    console.log('[BrainDumpHandler] User and client check:', {
      hasUser: !!user,
      hasNotionClient: !!notionClient,
      hasNotionToken: !!user?.notion_token
    });

    if (!user || !notionClient) {
      console.log('[BrainDumpHandler] Missing user or Notion client');
      return buildSimpleResponse(
        handlerInput,
        'Please link your Notion account in the Alexa app to use this feature.'
      );
    }

    const request = handlerInput.requestEnvelope.request as IntentRequest;
    const taskSlot = request.intent.slots?.task;

    console.log('[BrainDumpHandler] Task slot:', {
      hasSlot: !!taskSlot,
      slotValue: taskSlot?.value,
      slotConfidence: taskSlot?.confirmationStatus
    });

    // Check if we're in a multi-turn conversation
    const conversationState = attributes.brainDumpState || 'initial';
    
    console.log('[BrainDumpHandler] Conversation state:', conversationState);
    console.log('[BrainDumpHandler] Session attributes:', JSON.stringify(attributes));

    // If we have a task slot value even in 'initial' state, treat it as collecting
    const userUtterance = request.intent.slots?.task?.value;
    const hasTaskSlot = !!userUtterance && userUtterance.trim().length > 0;

    if (conversationState === 'initial') {
      // If user provided tasks in the same turn, process them immediately
      if (hasTaskSlot) {
        console.log('[BrainDumpHandler] Tasks provided in initial turn, processing immediately');
        attributes.brainDumpState = 'collecting';
        attributes.brainDumpTasks = [];
        // Fall through to processing logic
      } else {
        // Start the brain dump conversation
        attributes.brainDumpState = 'collecting';
        attributes.brainDumpTasks = [];
        handlerInput.attributesManager.setSessionAttributes(attributes);

        console.log('[BrainDumpHandler] Starting brain dump, waiting for tasks');
        return buildResponse(
          handlerInput,
          'I\'m ready to capture your thoughts. What tasks would you like to add?',
          'Tell me the tasks you want to add, or say done when finished.'
        );
      }
    }

    if (conversationState === 'collecting' || (conversationState === 'initial' && hasTaskSlot)) {
      // Ensure we're in collecting state
      if (conversationState === 'initial') {
        attributes.brainDumpState = 'collecting';
        attributes.brainDumpTasks = [];
      }

      // Use the task slot value if available
      const taskValue = userUtterance || request.intent.slots?.task?.value;

      console.log('[BrainDumpHandler] User utterance/task value:', taskValue);

      if (!taskValue || taskValue.trim().length === 0) {
        console.log('[BrainDumpHandler] No task value found');
        return buildResponse(
          handlerInput,
          'I didn\'t catch that. What tasks would you like to add?',
          'Tell me the tasks, or say done when finished.'
        );
      }

      // Parse multiple tasks from a single utterance (split by "and", comma, etc.)
      const taskSeparators = /\s+(and|,|, and)\s+/i;
      const tasksFromUtterance = taskValue.split(taskSeparators).filter(
        (part, index) => index % 2 === 0 && part.trim().length > 0
      ).map(task => task.trim());
      
      // If splitting didn't work, use the whole value as a single task
      if (tasksFromUtterance.length === 0) {
        tasksFromUtterance.push(taskValue.trim());
      }

      console.log('[BrainDumpHandler] Parsed tasks:', tasksFromUtterance);

      // Check if user said "done" or similar
      const donePhrases = ['done', 'finished', 'that\'s all', 'complete', 'nothing'];
      if (donePhrases.some(phrase => taskValue.toLowerCase().includes(phrase))) {
        // Save all collected tasks
        const tasks = attributes.brainDumpTasks || [];
        
        if (tasks.length === 0) {
          attributes.brainDumpState = 'initial';
          handlerInput.attributesManager.setSessionAttributes(attributes);
          return buildSimpleResponse(handlerInput, 'No tasks were added.');
        }

        // Find tasks database
        console.log('[BrainDumpHandler] Looking for Tasks database...');
        const tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
        console.log('[BrainDumpHandler] Tasks database ID:', tasksDbId);
        
        if (!tasksDbId) {
          attributes.brainDumpState = 'initial';
          handlerInput.attributesManager.setSessionAttributes(attributes);
          return buildSimpleResponse(
            handlerInput,
            'I couldn\'t find your Tasks database in Notion. ' +
            'Please make sure it exists and try again.'
          );
        }

        // Add all tasks
        try {
          console.log('[BrainDumpHandler] Adding tasks to Notion:', tasks);
          for (const taskName of tasks) {
            console.log('[BrainDumpHandler] Adding task:', taskName);
            await addTask(notionClient, tasksDbId, taskName);
            console.log('[BrainDumpHandler] Successfully added task:', taskName);
          }

          attributes.brainDumpState = 'initial';
          handlerInput.attributesManager.setSessionAttributes(attributes);

          console.log('[BrainDumpHandler] All tasks added successfully');
          return buildSimpleResponse(
            handlerInput,
            `Great! I've added ${tasks.length} task${tasks.length > 1 ? 's' : ''} to your Notion database.`
          );
        } catch (error: any) {
          console.error('[BrainDumpHandler] Error adding tasks:', error);
          console.error('[BrainDumpHandler] Error details:', {
            message: error?.message,
            status: error?.status,
            code: error?.code,
            stack: error?.stack
          });
          attributes.brainDumpState = 'initial';
          handlerInput.attributesManager.setSessionAttributes(attributes);
          return buildSimpleResponse(
            handlerInput,
            'I encountered an error adding your tasks. Please try again later.'
          );
        }
      }

      // If multiple tasks were provided, add them all and auto-save
      if (tasksFromUtterance.length > 1) {
        console.log('[BrainDumpHandler] Multiple tasks detected, auto-saving...');
        const existingTasks = attributes.brainDumpTasks || [];
        const allTasks = [...existingTasks, ...tasksFromUtterance];
        
        // Find tasks database
        console.log('[BrainDumpHandler] Looking for Tasks database...');
        const tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
        console.log('[BrainDumpHandler] Tasks database ID:', tasksDbId);
        
        if (!tasksDbId) {
          attributes.brainDumpState = 'initial';
          handlerInput.attributesManager.setSessionAttributes(attributes);
          return buildSimpleResponse(
            handlerInput,
            'I couldn\'t find your Tasks database in Notion. ' +
            'Please make sure it exists and try again.'
          );
        }

        // Add all tasks
        try {
          console.log('[BrainDumpHandler] Adding all tasks to Notion:', allTasks);
          for (const taskName of allTasks) {
            console.log('[BrainDumpHandler] Adding task:', taskName);
            await addTask(notionClient, tasksDbId, taskName);
            console.log('[BrainDumpHandler] Successfully added task:', taskName);
          }

          attributes.brainDumpState = 'initial';
          attributes.brainDumpTasks = [];
          handlerInput.attributesManager.setSessionAttributes(attributes);

          console.log('[BrainDumpHandler] All tasks added successfully');
          return buildSimpleResponse(
            handlerInput,
            `Great! I've added ${allTasks.length} task${allTasks.length > 1 ? 's' : ''} to your Notion database.`
          );
        } catch (error: any) {
          console.error('[BrainDumpHandler] Error adding tasks:', error);
          console.error('[BrainDumpHandler] Error details:', {
            message: error?.message,
            status: error?.status,
            code: error?.code
          });
          attributes.brainDumpState = 'initial';
          handlerInput.attributesManager.setSessionAttributes(attributes);
          return buildSimpleResponse(
            handlerInput,
            'I encountered an error adding your tasks. Please try again later.'
          );
        }
      }

      // Single task - add to collection
      const tasks = attributes.brainDumpTasks || [];
      const taskToAdd = tasksFromUtterance[0] || taskValue;
      tasks.push(taskToAdd);
      attributes.brainDumpTasks = tasks;
      attributes.brainDumpState = 'collecting'; // Ensure state is set
      handlerInput.attributesManager.setSessionAttributes(attributes);

      console.log('[BrainDumpHandler] Task added to collection, total tasks:', tasks.length);
      return buildResponse(
        handlerInput,
        `Got it. Added "${taskToAdd}". What else?`,
        'Tell me another task, or say done when finished.'
      );
    }

    return buildSimpleResponse(handlerInput, 'I\'m not sure what you want to do. Please try again.');
    } catch (error: any) {
      console.error('[BrainDumpHandler] Unexpected error:', error);
      console.error('[BrainDumpHandler] Error stack:', error?.stack);
      return buildSimpleResponse(
        handlerInput,
        'I encountered an error. Please try again.'
      );
    }
  }
}

