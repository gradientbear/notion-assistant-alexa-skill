import { ResponseInterceptor, HandlerInput } from 'ask-sdk-core';
import { Response } from 'ask-sdk-model';

/**
 * Session Cleanup Interceptor
 * Clears session attributes when session ends or when authentication fails
 * to prevent stale data from being used in subsequent requests
 */
export class SessionCleanupInterceptor implements ResponseInterceptor {
  async process(handlerInput: HandlerInput, response: Response): Promise<void> {
    const requestType = handlerInput.requestEnvelope.request.type;
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    
    // Check if there was an auth error that requires session cleanup
    const authError = attributes.authError;
    const shouldClearSession = 
      authError === 'TOKEN_INVALID' || 
      authError === 'TOKEN_EXPIRED' || 
      authError === 'AUTH_REQUIRED' ||
      authError === 'USER_NOT_FOUND';
    
    // Clear session attributes when session ends
    if (requestType === 'SessionEndedRequest') {
      console.log('[SessionCleanupInterceptor] Clearing session attributes on session end');
      this.clearSessionAttributes(handlerInput);
      return;
    }
    
    // Clear session attributes if authentication failed (token expired/invalid)
    // This prevents stale user data from being used in subsequent requests
    if (shouldClearSession) {
      console.log('[SessionCleanupInterceptor] Clearing session attributes due to auth error:', authError);
      this.clearSessionAttributes(handlerInput);
      
      // Remove the authError flag after cleanup
      const updatedAttributes = handlerInput.attributesManager.getSessionAttributes();
      delete updatedAttributes.authError;
      handlerInput.attributesManager.setSessionAttributes(updatedAttributes);
    }
    
    // Clear session attributes if user data is stale (older than 1 hour)
    // This helps prevent issues with long-running sessions
    if (attributes.user && attributes.sessionTimestamp) {
      const sessionAge = Date.now() - attributes.sessionTimestamp;
      const MAX_SESSION_AGE = 60 * 60 * 1000; // 1 hour
      
      if (sessionAge > MAX_SESSION_AGE) {
        console.log('[SessionCleanupInterceptor] Clearing stale session data:', {
          sessionAgeMinutes: Math.floor(sessionAge / 60000),
          maxAgeMinutes: MAX_SESSION_AGE / 60000
        });
        this.clearSessionAttributes(handlerInput);
      }
    }
  }
  
  private clearSessionAttributes(handlerInput: HandlerInput): void {
    // Clear all session attributes except system flags
    const systemAttributes = {
      // Keep any system-level flags if needed
    };
    handlerInput.attributesManager.setSessionAttributes(systemAttributes);
    
    // Note: We don't clear persistent attributes as they may contain
    // user preferences that should persist across sessions
  }
}

