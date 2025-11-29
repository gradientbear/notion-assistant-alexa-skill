import {
  RequestHandler,
  HandlerInput,
  RequestInterceptor,
} from 'ask-sdk-core';
import { Request } from 'ask-sdk-model';
import { getUserByAmazonId } from '../utils/database';
// import { validateLicense } from '../utils/database'; // Disabled for MVP
import { buildSimpleResponse, buildResponse, buildLinkAccountResponse } from '../utils/alexa';

export class LaunchRequestHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  }

  async handle(handlerInput: HandlerInput) {
    try {
      const userId = handlerInput.requestEnvelope.session?.user?.userId;
      
      console.log('[LaunchRequestHandler] userId:', userId);
      
      if (!userId) {
        console.log('[LaunchRequestHandler] No userId found');
        return buildSimpleResponse(
          handlerInput,
          'Welcome to Notion Data. Please enable the skill in your Alexa app to get started.'
        );
      }

      // Check if user exists - with timeout to prevent hanging
      let user = null;
      try {
        console.log('[LaunchRequestHandler] Starting user lookup...');
        
        // Use Promise.race with proper timeout handling
        const userLookupPromise = getUserByAmazonId(userId).catch((err) => {
          console.error('[LaunchRequestHandler] getUserByAmazonId promise rejected:', err);
          return null;
        });
        
        const timeoutPromise = new Promise<null>((resolve) => 
          setTimeout(() => {
            console.warn('[LaunchRequestHandler] Database query timeout after 2 seconds');
            resolve(null);
          }, 2000)
        );
        
        user = await Promise.race([userLookupPromise, timeoutPromise]);
        console.log('[LaunchRequestHandler] User lookup completed, user found:', !!user);
      } catch (dbError: any) {
        console.error('[LaunchRequestHandler] Database error when looking up user:', {
          message: dbError?.message,
          stack: dbError?.stack,
          name: dbError?.name
        });
        // Continue with user = null - will show setup message
        user = null;
      }
      
      console.log('[LaunchRequestHandler] User lookup result:', {
        found: !!user,
        hasNotionToken: !!user?.notion_token,
        notionTokenLength: user?.notion_token?.length || 0,
        notionTokenPreview: user?.notion_token ? user.notion_token.substring(0, 10) + '...' : 'null/empty',
        email: user?.email
      });
      
      if (!user) {
        console.log('[LaunchRequestHandler] User not found in database');
        return buildResponse(
          handlerInput,
          'Welcome to Notion Data! To get started, you need to link your account. ' +
          'Open the Alexa app on your phone, go to Skills, find Notion Data, and click Link Account. ' +
          'You\'ll need to sign in to your web account first. ' +
          'Would you like help setting up your account?',
          'Would you like help setting up your account?'
        );
      }

      // License validation disabled for MVP - focus on CRUD operations only

      // Check if Notion is connected
      if (!user.notion_token) {
        console.log('[LaunchRequestHandler] No notion_token found - returning link account response');
        return buildResponse(
          handlerInput,
          'To use Notion Data, you need to connect your Notion account. ' +
          'Open the Alexa app, go to Skills, find Notion Data, and click Link Account. ' +
          'Once connected, I can help you manage your tasks in Notion. ' +
          'Would you like help connecting your account?',
          'Would you like help connecting your account?'
        );
      }
      
      console.log('[LaunchRequestHandler] User has notion_token - proceeding with welcome message');

      // Store user in session
      const attributes = handlerInput.attributesManager.getSessionAttributes();
      attributes.user = user;
      handlerInput.attributesManager.setSessionAttributes(attributes);

      const response = buildResponse(
        handlerInput,
        'Welcome to Notion Data! I can help you manage your tasks. ' +
        'You can add tasks, list your tasks, mark them complete, update their status, or delete them. ' +
        'You can also check your connection status. What would you like to do?',
        'What would you like to do?'
      );
      
      console.log('[LaunchRequestHandler] Returning welcome response');
      return response;
    } catch (error: any) {
      console.error('[LaunchRequestHandler] Unexpected error:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name
      });
      
      // ALWAYS return a response, even on error
      try {
        const errorResponse = buildResponse(
          handlerInput,
          'Welcome to Notion Data! I encountered an issue connecting to your account. ' +
          'Please try again in a moment, or open the Alexa app to check your account settings.',
          'What would you like to do?'
        );
        console.log('[LaunchRequestHandler] Returning error response');
        return errorResponse;
      } catch (responseError: any) {
        console.error('[LaunchRequestHandler] Failed to build error response:', responseError);
        // Last resort - return a simple response
        return handlerInput.responseBuilder
          .speak('Welcome to Notion Data. Please try again later.')
          .withShouldEndSession(true)
          .getResponse();
      }
    }
  }
}

