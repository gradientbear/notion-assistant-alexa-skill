import {
  RequestInterceptor,
  HandlerInput,
  ResponseBuilder,
} from 'ask-sdk-core';
import { getUserByAmazonId, validateLicense } from '../utils/database';

export class LicenseValidationInterceptor implements RequestInterceptor {
  async process(handlerInput: HandlerInput): Promise<void> {
    try {
      // Bypass license validation if DISABLE_LICENSE_VALIDATION is set to 'true'
      if (process.env.DISABLE_LICENSE_VALIDATION === 'true') {
        // Still load user for session attributes, but skip license check
        const userId = handlerInput.requestEnvelope.session?.user?.userId;
        if (userId) {
          try {
            const user = await getUserByAmazonId(userId);
            if (user) {
              const attributes = handlerInput.attributesManager.getSessionAttributes();
              attributes.user = user;
              handlerInput.attributesManager.setSessionAttributes(attributes);
              console.log('[LicenseValidationInterceptor] User loaded (validation disabled)');
            } else {
              console.warn('[LicenseValidationInterceptor] User not found (validation disabled)');
            }
          } catch (error: any) {
            console.error('[LicenseValidationInterceptor] Error loading user (validation disabled):', error?.message);
            // Don't throw - continue without user in session
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
        console.error('[LicenseValidationInterceptor] Missing user ID');
        throw new Error('Missing user ID');
      }

      const user = await getUserByAmazonId(userId);
      if (!user) {
        console.error('[LicenseValidationInterceptor] User not found for ID:', userId);
        throw new Error('User not found');
      }

      const isValid = await validateLicense(user.license_key);
      if (!isValid) {
        console.error('[LicenseValidationInterceptor] Invalid license for user:', userId);
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
      console.log('[LicenseValidationInterceptor] License validated successfully');
    } catch (error: any) {
      console.error('[LicenseValidationInterceptor] Error in interceptor:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name
      });
      throw error; // Re-throw to be handled by ErrorHandler
    }
  }
}

