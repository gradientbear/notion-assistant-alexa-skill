import {
  RequestInterceptor,
  HandlerInput,
  ResponseBuilder,
} from 'ask-sdk-core';
import { getUserByAmazonId, validateLicense } from '../utils/database';

export class LicenseValidationInterceptor implements RequestInterceptor {
  async process(handlerInput: HandlerInput): Promise<void> {
    const requestType = handlerInput.requestEnvelope.request.type;

    // Skip validation for LaunchRequest (handled in LaunchRequestHandler)
    if (requestType === 'LaunchRequest') {
      return;
    }

    const userId = handlerInput.requestEnvelope.session?.user?.userId;
    if (!userId) {
      throw new Error('Missing user ID');
    }

    const user = await getUserByAmazonId(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const isValid = await validateLicense(user.license_key);
    if (!isValid) {
      const responseBuilder = handlerInput.responseBuilder;
      responseBuilder
        .speak('Your license key is invalid or has been deactivated. Please contact support.')
        .withShouldEndSession(true);
      
      throw new Error('Invalid license');
    }

    // Store user in session attributes for easy access
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    attributes.user = user;
    handlerInput.attributesManager.setSessionAttributes(attributes);
  }
}

