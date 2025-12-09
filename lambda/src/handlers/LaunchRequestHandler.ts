import {
  RequestHandler,
  HandlerInput,
  RequestInterceptor,
} from 'ask-sdk-core';
import { Request } from 'ask-sdk-model';
import { getUserByAmazonId } from '../utils/database';
// import { validateLicense } from '../utils/database'; // Disabled for MVP
import { buildSimpleResponse, buildResponse, buildLinkAccountResponse } from '../utils/alexa';
import { getTranslation } from '../utils/i18n';

export class LaunchRequestHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  }

  async handle(handlerInput: HandlerInput) {
    try {
      const userId = handlerInput.requestEnvelope.session?.user?.userId;
      const accessToken = (handlerInput.requestEnvelope.context?.System?.user as any)?.accessToken;
      
      // PRIORITY 1: Check if AuthInterceptor already validated token and attached user
      // (AuthInterceptor runs before handlers, so user should be in session attributes if token is valid)
      let attributes = handlerInput.attributesManager.getSessionAttributes();
      let user = attributes.user;
      
      if (!user && accessToken) {
        // Token exists but user not in session - AuthInterceptor may have failed
        // This shouldn't happen, but if it does, require re-linking
        return buildLinkAccountResponse(handlerInput);
      } else if (!user && !accessToken) {
        // PRIORITY 2: No token - check for legacy user lookup (backward compatibility)
        if (!userId) {
          return buildLinkAccountResponse(handlerInput);
        }

        // Legacy fallback: Look up by amazon_account_id
        try {
          user = await getUserByAmazonId(userId);
          
          if (user) {
            // Store user in session for backward compatibility
            attributes.user = user;
            if (user.notion_token) {
              const { createNotionClient } = await import('../utils/notion');
              attributes.notionClient = createNotionClient(user.notion_token);
            }
            handlerInput.attributesManager.setSessionAttributes(attributes);
          }
        } catch (dbError: any) {
          console.error('[LaunchRequestHandler] Database error when looking up user:', {
            message: dbError?.message,
            stack: dbError?.stack,
            name: dbError?.name
          });
          user = null;
        }
      }
      
      // PRIORITY 3: No user found OR no access token - require account linking
      // IMPORTANT: Only allow legacy lookup if explicitly enabled via environment variable
      // Otherwise, require proper OAuth token for account linking
      const allowLegacyLookup = process.env.ALLOW_LEGACY_LOOKUP === 'true';
      
      if (!user) {
        return buildLinkAccountResponse(handlerInput);
      }
      
      // If user found via legacy lookup but no access token, still require proper linking
      const hasAccessToken = !!(handlerInput.requestEnvelope.context?.System?.user as any)?.accessToken;
      if (!hasAccessToken && !allowLegacyLookup) {
        return buildLinkAccountResponse(handlerInput);
      }

      // License validation disabled for MVP - focus on CRUD operations only

      // Check if Notion is connected
      if (!user.notion_token) {
        try {
          return buildResponse(
            handlerInput,
            getTranslation(handlerInput, 'notion_required'),
            getTranslation(handlerInput, 'notion_required_reprompt')
          );
        } catch (buildError: any) {
          console.error('[LaunchRequestHandler] Error building Notion response:', buildError);
          return handlerInput.responseBuilder
            .speak(getTranslation(handlerInput, 'notion_required_simple'))
            .withShouldEndSession(true)
            .getResponse();
        }
      }

      // Store user in session (attributes already declared above)
      attributes.user = user;
      handlerInput.attributesManager.setSessionAttributes(attributes);

      return buildResponse(
        handlerInput,
        getTranslation(handlerInput, 'welcome'),
        getTranslation(handlerInput, 'welcome_reprompt')
      );
    } catch (error: any) {
      console.error('[LaunchRequestHandler] Unexpected error:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name
      });
      
      // ALWAYS return a response, even on error
      try {
        return buildResponse(
          handlerInput,
          getTranslation(handlerInput, 'welcome_error'),
          getTranslation(handlerInput, 'what_would_you_like')
        );
      } catch (responseError: any) {
        console.error('[LaunchRequestHandler] Failed to build error response:', responseError);
        // Last resort - return a simple response
        return handlerInput.responseBuilder
          .speak(getTranslation(handlerInput, 'welcome_error_simple'))
          .withShouldEndSession(true)
          .getResponse();
      }
    }
  }
}

