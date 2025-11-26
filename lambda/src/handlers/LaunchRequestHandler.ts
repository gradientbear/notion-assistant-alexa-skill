import {
  RequestHandler,
  HandlerInput,
  RequestInterceptor,
} from 'ask-sdk-core';
import { Request } from 'ask-sdk-model';
import { getUserByAmazonId, validateLicense } from '../utils/database';
import { buildSimpleResponse, buildLinkAccountResponse } from '../utils/alexa';

export class LaunchRequestHandler implements RequestHandler {
  canHandle(handlerInput: HandlerInput): boolean {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  }

  async handle(handlerInput: HandlerInput) {
    const userId = handlerInput.requestEnvelope.session?.user?.userId;
    
    console.log('[LaunchRequestHandler] userId:', userId);
    
    if (!userId) {
      console.log('[LaunchRequestHandler] No userId found');
      return buildSimpleResponse(
        handlerInput,
        'Welcome to Notion Data. Please enable the skill in your Alexa app.'
      );
    }

    // Check if user exists
    const user = await getUserByAmazonId(userId);
    
    console.log('[LaunchRequestHandler] User lookup result:', {
      found: !!user,
      hasNotionToken: !!user?.notion_token,
      notionTokenLength: user?.notion_token?.length || 0,
      notionTokenPreview: user?.notion_token ? user.notion_token.substring(0, 10) + '...' : 'null/empty',
      email: user?.email
    });
    
    if (!user) {
      console.log('[LaunchRequestHandler] User not found in database');
      return buildSimpleResponse(
        handlerInput,
        'Welcome to Notion Data. Please link your account using the Alexa app. ' +
        'You will need your email and license key to complete setup.'
      );
    }

    // Skip license validation if DISABLE_LICENSE_VALIDATION is set to 'true'
    if (process.env.DISABLE_LICENSE_VALIDATION !== 'true') {
      const isValidLicense = await validateLicense(user.license_key);
      if (!isValidLicense) {
        console.log('[LaunchRequestHandler] Invalid license');
        return buildSimpleResponse(
          handlerInput,
          'Your license key is invalid or has been deactivated. Please contact support.'
        );
      }
    }

    // Check if Notion is connected
    if (!user.notion_token) {
      console.log('[LaunchRequestHandler] No notion_token found - returning link account response');
      return buildLinkAccountResponse(handlerInput);
    }
    
    console.log('[LaunchRequestHandler] User has notion_token - proceeding with welcome message');

    // Store user in session
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    attributes.user = user;
    handlerInput.attributesManager.setSessionAttributes(attributes);

    return buildSimpleResponse(
      handlerInput,
      'Welcome to Notion Data. You can ask me to dump your brain, ' +
      'check your priorities, start a focus timer, log your energy, ' +
      'view your schedule, or manage your shopping list. What would you like to do?'
    );
  }
}

