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
    const canHandle = handlerInput.requestEnvelope.request.type === 'LaunchRequest';
    console.log('[LaunchRequestHandler] canHandle:', canHandle);
    return canHandle;
  }

  async handle(handlerInput: HandlerInput) {
    console.log('[LaunchRequestHandler] ========== HANDLER INVOKED ==========');
    try {
      const userId = handlerInput.requestEnvelope.session?.user?.userId;
      const accessToken = (handlerInput.requestEnvelope.context?.System?.user as any)?.accessToken;
      
      console.log('[LaunchRequestHandler] userId:', userId);
      console.log('[LaunchRequestHandler] has accessToken:', !!accessToken);
      
      // PRIORITY 1: Check if AuthInterceptor already validated token and attached user
      // (AuthInterceptor runs before handlers, so user should be in session attributes if token is valid)
      let attributes = handlerInput.attributesManager.getSessionAttributes();
      let user = attributes.user;
      
      if (user) {
        console.log('[LaunchRequestHandler] User found in session attributes (OAuth2 flow)');
      } else if (accessToken) {
        // Token exists but user not in session - AuthInterceptor may have failed
        // This shouldn't happen, but if it does, require re-linking
        console.log('[LaunchRequestHandler] Access token exists but user not in session - requiring account linking');
        return buildLinkAccountResponse(handlerInput);
      } else {
        // PRIORITY 2: No token - check for legacy user lookup (backward compatibility)
        console.log('[LaunchRequestHandler] No access token - trying legacy lookup');
        
        if (!userId) {
          console.log('[LaunchRequestHandler] No userId found');
          return buildLinkAccountResponse(handlerInput);
        }

        // Legacy fallback: Look up by amazon_account_id
        try {
          console.log('[LaunchRequestHandler] Starting legacy user lookup...');
          console.log('[LaunchRequestHandler] Calling getUserByAmazonId with userId:', userId);
          const lookupStartTime = Date.now();
          user = await getUserByAmazonId(userId);
          const lookupElapsed = Date.now() - lookupStartTime;
          console.log('[LaunchRequestHandler] Legacy lookup completed in', lookupElapsed, 'ms, user found:', !!user);
          
          if (user) {
            // Store user in session for backward compatibility
            attributes.user = user;
            if (user.notion_token) {
              const { createNotionClient } = await import('../utils/notion');
              attributes.notionClient = createNotionClient(user.notion_token);
            }
            handlerInput.attributesManager.setSessionAttributes(attributes);
            console.log('[LaunchRequestHandler] User stored in session attributes');
          } else {
            console.log('[LaunchRequestHandler] No user found from legacy lookup');
          }
        } catch (dbError: any) {
          console.error('[LaunchRequestHandler] Database error when looking up user:', {
            message: dbError?.message,
            stack: dbError?.stack,
            name: dbError?.name
          });
          user = null;
          console.log('[LaunchRequestHandler] Set user to null after error');
        }
      }
      
      console.log('[LaunchRequestHandler] User lookup result:', {
        found: !!user,
        hasNotionToken: !!user?.notion_token,
        notionTokenLength: user?.notion_token?.length || 0,
        email: user?.email
      });
      
      // PRIORITY 3: No user found - require account linking
      if (!user) {
        console.log('[LaunchRequestHandler] User not found - requiring account linking');
        const linkResponse = buildLinkAccountResponse(handlerInput);
        console.log('[LaunchRequestHandler] LinkAccount response built:', {
          hasResponse: !!linkResponse,
          type: typeof linkResponse
        });
        console.log('[LaunchRequestHandler] Returning LinkAccount response');
        return linkResponse;
      }

      // License validation disabled for MVP - focus on CRUD operations only

      // Check if Notion is connected
      if (!user.notion_token) {
        console.log('[LaunchRequestHandler] No notion_token found - returning link account response');
        try {
          const response = buildResponse(
            handlerInput,
            'To use Voice Planner, you need to connect your Notion account. ' +
            'Open the Alexa app, go to Skills, find Voice Planner, and click Link Account. ' +
            'Once connected, I can help you manage your tasks in Notion. ' +
            'Would you like help connecting your account?',
            'Would you like help connecting your account?'
          );
          console.log('[LaunchRequestHandler] Returning Notion connection required response');
          return response;
        } catch (buildError: any) {
          console.error('[LaunchRequestHandler] Error building Notion response:', buildError);
          return handlerInput.responseBuilder
            .speak('Please connect your Notion account in the Alexa app.')
            .withShouldEndSession(true)
            .getResponse();
        }
      }
      
      console.log('[LaunchRequestHandler] User has notion_token - proceeding with welcome message');

      // Store user in session (attributes already declared above)
      attributes.user = user;
      handlerInput.attributesManager.setSessionAttributes(attributes);

      const response = buildResponse(
        handlerInput,
        'Welcome to Voice Planner! I can help you manage your tasks. ' +
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
          'Welcome to Voice Planner! I encountered an issue connecting to your account. ' +
          'Please try again in a moment, or open the Alexa app to check your account settings.',
          'What would you like to do?'
        );
        console.log('[LaunchRequestHandler] Returning error response');
        return errorResponse;
      } catch (responseError: any) {
        console.error('[LaunchRequestHandler] Failed to build error response:', responseError);
        // Last resort - return a simple response
        return handlerInput.responseBuilder
          .speak('Welcome to Voice Planner. Please try again later.')
          .withShouldEndSession(true)
          .getResponse();
      }
    }
  }
}

