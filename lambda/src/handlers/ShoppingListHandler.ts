import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { IntentRequest } from 'ask-sdk-model';
import { buildResponse, buildSimpleResponse } from '../utils/alexa';
import { findDatabaseByName, getShoppingListTasks, addTask, markTaskComplete } from '../utils/notion';

export class ShoppingListHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    return (
      handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      (handlerInput.requestEnvelope.request.intent.name === 'AddShoppingIntent' ||
       handlerInput.requestEnvelope.request.intent.name === 'ReadShoppingIntent' ||
       handlerInput.requestEnvelope.request.intent.name === 'MarkShoppingCompleteIntent')
    );
  }

  async handle(handlerInput: HandlerInput) {
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;

    if (!user || !notionClient) {
      return buildSimpleResponse(
        handlerInput,
        'Please link your Notion account in the Alexa app to use this feature.'
      );
    }

    const request = handlerInput.requestEnvelope.request as IntentRequest;
    const intentName = request.intent.name;

    try {
      const tasksDbId = await findDatabaseByName(notionClient, 'Tasks');
      if (!tasksDbId) {
        return buildSimpleResponse(
          handlerInput,
          'I couldn\'t find your Tasks database in Notion. ' +
          'Please make sure it exists and try again.'
        );
      }

      if (intentName === 'AddShoppingIntent') {
        const itemsSlot = request.intent.slots?.items;
        
        if (!itemsSlot || !itemsSlot.value) {
          return buildResponse(
            handlerInput,
            'What items would you like to add to your shopping list?',
            'Tell me the items you want to add.'
          );
        }

        const itemsText = itemsSlot.value;
        // Split by comma or "and"
        const items = itemsText
          .split(/,|and/)
          .map(item => item.trim())
          .filter(item => item.length > 0);

        if (items.length === 0) {
          return buildResponse(
            handlerInput,
            'I didn\'t catch the items. What would you like to add?',
            'Tell me the items for your shopping list.'
          );
        }

        // Add each item as a task with Shopping category
        for (const item of items) {
          await addTask(notionClient, tasksDbId, item, 'Medium', 'Shopping');
        }

        const itemsList = items.length === 1 
          ? items[0] 
          : items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];

        return buildSimpleResponse(
          handlerInput,
          `Added to shopping list: ${itemsList}.`
        );
      }

      if (intentName === 'ReadShoppingIntent') {
        const tasks = await getShoppingListTasks(notionClient, tasksDbId);

        if (tasks.length === 0) {
          return buildSimpleResponse(handlerInput, 'Your shopping list is empty.');
        }

        let speechText = `Your shopping list has ${tasks.length} item${tasks.length > 1 ? 's' : ''}: `;
        tasks.forEach((task, index) => {
          speechText += task.name;
          if (index < tasks.length - 1) {
            speechText += ', ';
          }
        });
        speechText += '.';

        return buildSimpleResponse(handlerInput, speechText);
      }

      if (intentName === 'MarkShoppingCompleteIntent') {
        const itemSlot = request.intent.slots?.item;
        
        if (!itemSlot || !itemSlot.value) {
          return buildResponse(
            handlerInput,
            'Which item would you like to mark as complete?',
            'Tell me the item name.'
          );
        }

        const itemName = itemSlot.value.toLowerCase();
        const tasks = await getShoppingListTasks(notionClient, tasksDbId);
        
        const matchingTask = tasks.find(
          task => task.name.toLowerCase().includes(itemName) || 
                  itemName.includes(task.name.toLowerCase())
        );

        if (!matchingTask) {
          return buildSimpleResponse(
            handlerInput,
            `I couldn't find "${itemSlot.value}" on your shopping list.`
          );
        }

        await markTaskComplete(notionClient, matchingTask.id);

        return buildSimpleResponse(
          handlerInput,
          `Marked ${matchingTask.name} as complete.`
        );
      }

      return buildSimpleResponse(handlerInput, 'I\'m not sure what you want to do with your shopping list.');
    } catch (error) {
      console.error('Error handling shopping list:', error);
      return buildSimpleResponse(
        handlerInput,
        'I encountered an error with your shopping list. Please try again later.'
      );
    }
  }
}

