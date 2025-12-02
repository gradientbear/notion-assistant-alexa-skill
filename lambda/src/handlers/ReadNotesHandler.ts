import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse } from '../utils/alexa';
import { findDatabaseByName, getNotes } from '../utils/notion';

export class ReadNotesHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest
      ? (handlerInput.requestEnvelope.request as any).intent?.name
      : null;
    
    const canHandle = isIntentRequest && intentName === 'ReadNotesIntent';
    
    if (isIntentRequest) {
      console.log('[ReadNotesHandler] canHandle check:', {
        isIntentRequest,
        intentName,
        canHandle
      });
    }
    
    return canHandle;
  }

  async handle(handlerInput: HandlerInput) {
    console.log('[ReadNotesHandler] Handler invoked');
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;
    
    if (!user || !notionClient) {
      return buildResponse(
        handlerInput,
        'To read your notes, you need to connect your Notion account. ' +
        'Open the Alexa app, go to Skills, find Notion Data, and click Link Account.',
        'What would you like to do?'
      );
    }

    try {
      const request = handlerInput.requestEnvelope.request as any;
      const slots = request.intent.slots || {};
      const noteDateSlot = slots.noteDate?.value;

      console.log('[ReadNotesHandler] Slots:', {
        noteDate: noteDateSlot
      });

      const notesDbId = await findDatabaseByName(notionClient, 'Notes');
      if (!notesDbId) {
        return buildResponse(
          handlerInput,
          'I couldn\'t find your Notes database in Notion. Please make sure it exists and try again.',
          'What would you like to do?'
        );
      }

      let notes: any[] = [];
      let speechText = '';

      // Parse date if provided
      let dateFilter: string | undefined = undefined;
      if (noteDateSlot) {
        try {
          const date = new Date(noteDateSlot);
          if (!isNaN(date.getTime())) {
            dateFilter = date.toISOString().split('T')[0];
          }
        } catch (e) {
          console.warn('[ReadNotesHandler] Could not parse note date:', noteDateSlot);
        }
      }

      notes = await getNotes(notionClient, notesDbId, dateFilter);

      if (notes.length === 0) {
        if (dateFilter) {
          speechText = `You have no notes from ${new Date(dateFilter).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.`;
        } else {
          speechText = 'You have no notes.';
        }
      } else {
        const noteList = notes.slice(0, 5).map(note => {
          if (note.content) {
            return `${note.title}: ${note.content}`;
          }
          return note.title;
        }).join('. ');
        
        const moreCount = notes.length > 5 ? notes.length - 5 : 0;
        
        if (dateFilter) {
          speechText = `Your notes from ${new Date(dateFilter).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}: ${noteList}`;
        } else {
          speechText = `Your notes: ${noteList}`;
        }
        
        if (moreCount > 0) {
          speechText += `. And ${moreCount} more note${moreCount > 1 ? 's' : ''}.`;
        }
      }

      return buildResponse(handlerInput, speechText, 'What else would you like to do?');
    } catch (error: any) {
      console.error('[ReadNotesHandler] Error reading notes:', error);
      return buildResponse(
        handlerInput,
        'I encountered an error reading your notes. Please try again.',
        'What would you like to do?'
      );
    }
  }
}

