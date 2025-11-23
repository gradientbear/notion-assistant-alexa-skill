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
    
    if (!userId) {
      return buildSimpleResponse(
        'Welcome to Notion Assistant. Please enable the skill in your Alexa app.'
      );
    }

    // Check if user exists and has valid license
    const user = await getUserByAmazonId(userId);
    
    if (!user) {
      return buildSimpleResponse(
        'Welcome to Notion Assistant. Please link your account using the Alexa app. ' +
        'You will need your email and license key to complete setup.'
      );
    }

    const isValidLicense = await validateLicense(user.license_key);
    if (!isValidLicense) {
      return buildSimpleResponse(
        'Your license key is invalid or has been deactivated. Please contact support.'
      );
    }

    // Check if Notion is connected
    if (!user.notion_token) {
      return buildLinkAccountResponse();
    }

    // Store user in session
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    attributes.user = user;
    handlerInput.attributesManager.setSessionAttributes(attributes);

    return buildSimpleResponse(
      'Welcome to Notion Assistant. You can ask me to dump your brain, ' +
      'check your priorities, start a focus timer, log your energy, ' +
      'view your schedule, or manage your shopping list. What would you like to do?'
    );
  }
}

