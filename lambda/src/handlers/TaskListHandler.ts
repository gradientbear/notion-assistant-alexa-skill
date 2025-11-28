import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse } from '../utils/alexa';
import {
  findDatabaseByName,
  getAllTasks,
  getTasksByPriority,
  getTasksByStatus,
  getTasksByCategory,
  getPendingTasks,
  getOverdueTasks,
  getTasksDueTomorrow,
  getTasksDueThisWeek,
  getCompletedTasks,
  getTodayTasks,
} from '../utils/notion';

export class TaskListHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest
      ? (handlerInput.requestEnvelope.request as any).intent?.name
      : null;

    const supportedIntents = [
      'TaskListIntent',
      'HighPriorityTasksIntent',
      'ToDoListIntent',
      'PendingTasksIntent',
      'WorkTasksIntent',
      'PersonalRemindersIntent',
      'WorkoutPlanIntent',
      'OverdueTasksIntent',
      'TasksDueTomorrowIntent',
      'TasksDueThisWeekIntent',
      'InProgressTasksIntent',
      'CompletedTasksIntent',
    ];
    
    const canHandle = intentName !== null && supportedIntents.includes(intentName);
    
    if (isIntentRequest) {
      console.log('[TaskListHandler] canHandle check:', {
        isIntentRequest,
        intentName,
        canHandle,
        isSupported: intentName ? supportedIntents.includes(intentName) : false
      });
    }
    
    return canHandle;
  }

  async handle(handlerInput: HandlerInput) {
    console.log('[TaskListHandler] Handler invoked');
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;
    
    console.log('[TaskListHandler] Session check:', {
      hasUser: !!user,
      hasNotionClient: !!notionClient,
      userId: user?.id
    });

    if (!user || !notionClient) {
      return buildResponse(
        handlerInput,
        'To view your tasks, you need to connect your Notion account. ' +
        'Open the Alexa app, go to Skills, find Notion Data, and click Link Account. ' +
        'Once connected, I can show you your tasks from Notion.',
        'What would you like to do?'
      );
    }

    const intentName = (handlerInput.requestEnvelope.request as any).intent.name;

    try {
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

      switch (intentName) {
        case 'TaskListIntent':
          tasks = await getAllTasks(notionClient, tasksDbId);
          if (tasks.length === 0) {
            speechText = 'You have no tasks right now.';
          } else {
            speechText = `You have ${tasks.length} task${tasks.length > 1 ? 's' : ''}: `;
            speechText += tasks.slice(0, 10).map(t => t.name).join(', ');
            if (tasks.length > 10) {
              speechText += `, and ${tasks.length - 10} more.`;
            }
          }
          break;

        case 'HighPriorityTasksIntent':
          tasks = await getTasksByPriority(notionClient, tasksDbId, 'High');
          if (tasks.length === 0) {
            speechText = 'You have no high priority tasks right now.';
          } else {
            speechText = `Your high priority tasks are: ${tasks.map(t => t.name).join(', ')}.`;
          }
          break;

        case 'ToDoListIntent':
          tasks = await getTasksByStatus(notionClient, tasksDbId, 'To Do');
          if (tasks.length === 0) {
            speechText = 'Your to-do list is empty.';
          } else {
            speechText = `Your to-do items are: ${tasks.map(t => t.name).join(', ')}.`;
          }
          break;

        case 'PendingTasksIntent':
          tasks = await getPendingTasks(notionClient, tasksDbId);
          if (tasks.length === 0) {
            speechText = 'You have no pending tasks.';
          } else {
            speechText = `You have ${tasks.length} pending task${tasks.length > 1 ? 's' : ''}: ${tasks.map(t => t.name).join(', ')}.`;
          }
          break;

        case 'WorkTasksIntent':
          tasks = await getTasksByCategory(notionClient, tasksDbId, 'Work');
          if (tasks.length === 0) {
            speechText = 'You have no work tasks.';
          } else {
            speechText = `Your work tasks are: ${tasks.map(t => t.name).join(', ')}.`;
          }
          break;

        case 'PersonalRemindersIntent':
          tasks = await getTasksByCategory(notionClient, tasksDbId, 'Personal');
          if (tasks.length === 0) {
            speechText = 'You have no personal reminders.';
          } else {
            speechText = `Your reminders: ${tasks.map(t => t.name).join(', ')}.`;
          }
          break;

        case 'WorkoutPlanIntent':
          tasks = await getTasksByCategory(notionClient, tasksDbId, 'Fitness');
          if (tasks.length === 0) {
            speechText = 'You have no workout plan items.';
          } else {
            speechText = `Your workout plan: ${tasks.map(t => t.name).join(', ')}.`;
          }
          break;

        case 'OverdueTasksIntent':
          tasks = await getOverdueTasks(notionClient, tasksDbId);
          if (tasks.length === 0) {
            speechText = 'You have no overdue tasks. Great job!';
          } else {
            speechText = `You have ${tasks.length} overdue task${tasks.length > 1 ? 's' : ''}: ${tasks.map(t => t.name).join(', ')}.`;
          }
          break;

        case 'TasksDueTomorrowIntent':
          tasks = await getTasksDueTomorrow(notionClient, tasksDbId);
          if (tasks.length === 0) {
            speechText = 'You have nothing due tomorrow.';
          } else {
            speechText = `Tomorrow you have: ${tasks.map(t => t.name).join(', ')}.`;
          }
          break;

        case 'TasksDueThisWeekIntent':
          tasks = await getTasksDueThisWeek(notionClient, tasksDbId);
          if (tasks.length === 0) {
            speechText = 'You have nothing due this week.';
          } else {
            speechText = `This week: ${tasks.length} task${tasks.length > 1 ? 's' : ''} due. ${tasks.map(t => t.name).join(', ')}.`;
          }
          break;

        case 'InProgressTasksIntent':
          tasks = await getTasksByStatus(notionClient, tasksDbId, 'In Progress');
          if (tasks.length === 0) {
            speechText = 'You\'re not currently working on any tasks.';
          } else {
            speechText = `You're currently working on: ${tasks.map(t => t.name).join(', ')}.`;
          }
          break;

        case 'CompletedTasksIntent':
          tasks = await getCompletedTasks(notionClient, tasksDbId);
          if (tasks.length === 0) {
            speechText = 'You haven\'t completed any tasks yet.';
          } else {
            const recentTasks = tasks.slice(0, 10);
            speechText = `You've completed ${tasks.length} task${tasks.length > 1 ? 's' : ''}. ${recentTasks.map(t => t.name).join(', ')}.`;
          }
          break;

        default:
          speechText = 'I didn\'t understand that request.';
      }

      return buildResponse(handlerInput, speechText, 'What else would you like to do?');
    } catch (error) {
      console.error('Error getting tasks:', error);
      return buildResponse(
        handlerInput,
        'I encountered an error retrieving your tasks. Please try again later.',
        'What would you like to do?'
      );
    }
  }
}

