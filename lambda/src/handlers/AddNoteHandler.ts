import { RequestHandler, HandlerInput } from 'ask-sdk-core';
import { buildResponse } from '../utils/alexa';
import { findDatabaseByName, addNote } from '../utils/notion';

export class AddNoteHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    const isIntentRequest = handlerInput.requestEnvelope.request.type === 'IntentRequest';
    const intentName = isIntentRequest
      ? (handlerInput.requestEnvelope.request as any).intent?.name
      : null;
    
    const canHandle = isIntentRequest && intentName === 'AddNoteIntent';
    
    if (isIntentRequest) {
      console.log('[AddNoteHandler] canHandle check:', {
        isIntentRequest,
        intentName,
        canHandle
      });
    }
    
    return canHandle;
  }

  async handle(handlerInput: HandlerInput) {
    console.log('[AddNoteHandler] Handler invoked');
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    const user = attributes.user;
    const notionClient = attributes.notionClient;
    
    if (!user || !notionClient) {
      return buildResponse(
        handlerInput,
        'To add notes, you need to connect your Notion account. ' +
        'Open the Alexa app, go to Skills, find Notion Data, and click Link Account.',
        'What would you like to do?'
      );
    }

    try {
      const request = handlerInput.requestEnvelope.request as any;
      const slots = request.intent.slots || {};
      const noteTitleSlot = slots.noteTitle?.value;
      const noteBodySlot = slots.noteBody?.value;
      const noteDateSlot = slots.noteDate?.value;

      console.log('[AddNoteHandler] Slots:', {
        noteTitle: noteTitleSlot,
        noteBody: noteBodySlot,
        noteDate: noteDateSlot
      });

      if (!noteTitleSlot) {
        return buildResponse(
          handlerInput,
          'What\'s the title of the note?',
          'Tell me the note title.'
        );
      }

      const notesDbId = await findDatabaseByName(notionClient, 'Notes');
      if (!notesDbId) {
        return buildResponse(
          handlerInput,
          'I couldn\'t find your Notes database in Notion. Please make sure it exists and try again.',
          'What would you like to do?'
        );
      }

      // Parse values
      const title = noteTitleSlot.trim();
      const content = noteBodySlot?.trim() || '';
      
      let noteDate: string | undefined = undefined;
      if (noteDateSlot) {
        try {
          const date = new Date(noteDateSlot);
          if (!isNaN(date.getTime())) {
            noteDate = date.toISOString().split('T')[0];
          }
        } catch (e) {
          console.warn('[AddNoteHandler] Could not parse note date:', noteDateSlot);
        }
      }

      await addNote(notionClient, notesDbId, title, content, noteDate);

      let confirmation = `Saved note: ${title}`;
      if (content) {
        confirmation += `. ${content}`;
      }
      confirmation += '.';

      return buildResponse(handlerInput, confirmation, 'What else would you like to do?');
    } catch (error: any) {
      console.error('[AddNoteHandler] Error adding note:', error);
      return buildResponse(
        handlerInput,
        'I encountered an error saving your note. Please try again.',
        'What would you like to do?'
      );
    }
  }
}

