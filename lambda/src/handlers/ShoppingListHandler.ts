import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { IntentRequest } from 'ask-sdk-model';
import { buildResponse, buildSimpleResponse } from '../utils/alexa';
import { findDatabaseByName, getShoppingItems, addShoppingItem, markShoppingItemBought } from '../utils/notion';

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
      const shoppingDbId = await findDatabaseByName(notionClient, 'Shopping');
      if (!shoppingDbId) {
        return buildSimpleResponse(
          handlerInput,
          'I couldn\'t find your Shopping database in Notion. ' +
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

        // Add each item to Shopping database
        for (const item of items) {
          await addShoppingItem(notionClient, shoppingDbId, item);
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
        const items = await getShoppingItems(notionClient, shoppingDbId, 'needed');

        if (items.length === 0) {
          return buildSimpleResponse(handlerInput, 'Your shopping list is empty.');
        }

        let speechText = `Your shopping list has ${items.length} item${items.length > 1 ? 's' : ''}: `;
        items.forEach((item, index) => {
          speechText += item.name;
          if (index < items.length - 1) {
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
            'Which item would you like to mark as bought?',
            'Tell me the item name.'
          );
        }

        const itemName = itemSlot.value.toLowerCase();
        const items = await getShoppingItems(notionClient, shoppingDbId, 'needed');
        
        const matchingItem = items.find(
          item => item.name.toLowerCase().includes(itemName) || 
                  itemName.includes(item.name.toLowerCase())
        );

        if (!matchingItem) {
          return buildSimpleResponse(
            handlerInput,
            `I couldn't find "${itemSlot.value}" on your shopping list.`
          );
        }

        await markShoppingItemBought(notionClient, matchingItem.id);

        return buildSimpleResponse(
          handlerInput,
          `Marked ${matchingItem.name} as bought.`
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

