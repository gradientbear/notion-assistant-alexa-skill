import {
  RequestInterceptor,
  HandlerInput,
  ResponseBuilder,
} from 'ask-sdk-core';
import { getUserByAmazonId, validateLicense } from '../utils/database';

export class LicenseValidationInterceptor implements RequestInterceptor {
  async process(handlerInput: HandlerInput): Promise<void> {
    // Bypass license validation if DISABLE_LICENSE_VALIDATION is set to 'true'
    if (process.env.DISABLE_LICENSE_VALIDATION === 'true') {
      // Still load user for session attributes, but skip license check
      const userId = handlerInput.requestEnvelope.session?.user?.userId;
      if (userId) {
        const user = await getUserByAmazonId(userId);
        if (user) {
          const attributes = handlerInput.attributesManager.getSessionAttributes();
          attributes.user = user;
          handlerInput.attributesManager.setSessionAttributes(attributes);
        }
      }
      return;
    }

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

