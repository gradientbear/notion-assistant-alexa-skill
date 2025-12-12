/**
 * Alexa Request Builder Utility
 * 
 * Provides utilities to build synthetic Alexa requests for testing
 */

import { RequestEnvelope, IntentRequest, LaunchRequest, SessionEndedRequest, SessionEndedError, SessionEndedErrorType } from 'ask-sdk-model';

export interface SlotValue {
  value: string;
  confirmationStatus?: 'NONE' | 'CONFIRMED' | 'DENIED';
  resolutions?: any;
}

export interface IntentRequestOptions {
  intentName: string;
  slots?: Record<string, SlotValue | string>;
  dialogState?: 'STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  locale?: string;
  userId?: string;
  accessToken?: string;
  sessionAttributes?: Record<string, any>;
  sessionNew?: boolean;
}

export interface LaunchRequestOptions {
  locale?: string;
  userId?: string;
  accessToken?: string;
  sessionAttributes?: Record<string, any>;
  sessionNew?: boolean;
}

export interface SessionEndedRequestOptions {
  reason: 'USER_INITIATED' | 'ERROR' | 'EXCEEDED_MAX_REPROMPTS';
  error?: SessionEndedError;
  locale?: string;
  userId?: string;
  accessToken?: string;
}

/**
 * Creates a base request envelope with common structure
 */
function createBaseRequestEnvelope(
  userId: string = 'test-user-id',
  accessToken?: string,
  sessionAttributes?: Record<string, any>,
  sessionNew: boolean = true
): Partial<RequestEnvelope> {
  return {
    version: '1.0',
    session: {
      new: sessionNew,
      sessionId: `test-session-${Date.now()}`,
      application: {
        applicationId: 'test-app-id',
      },
      user: {
        userId,
      },
      attributes: sessionAttributes || {},
    },
    context: {
      System: {
        application: {
          applicationId: 'test-app-id',
        },
        user: {
          userId,
          ...(accessToken && { accessToken }),
        },
        device: {
          deviceId: 'test-device-id',
          supportedInterfaces: {},
        },
        apiEndpoint: 'https://api.amazonalexa.com',
        apiAccessToken: 'test-api-token',
      },
    },
  };
}

/**
 * Builds an IntentRequest for testing
 */
export function buildIntentRequest(options: IntentRequestOptions): RequestEnvelope {
  const {
    intentName,
    slots = {},
    dialogState = 'COMPLETED',
    locale = 'en-US',
    userId = 'test-user-id',
    accessToken,
    sessionAttributes,
    sessionNew = true,
  } = options;

  // Convert slot values to proper format
  const formattedSlots: Record<string, any> = {};
  for (const [slotName, slotValue] of Object.entries(slots)) {
    if (typeof slotValue === 'string') {
      formattedSlots[slotName] = {
        name: slotName,
        value: slotValue,
        confirmationStatus: 'NONE',
      };
    } else {
      formattedSlots[slotName] = {
        name: slotName,
        value: slotValue.value,
        confirmationStatus: slotValue.confirmationStatus || 'NONE',
        ...(slotValue.resolutions && { resolutions: slotValue.resolutions }),
      };
    }
  }

  const intent: any = {
    name: intentName,
    confirmationStatus: 'NONE',
    ...(Object.keys(formattedSlots).length > 0 && { slots: formattedSlots }),
  };

  const request: IntentRequest = {
    type: 'IntentRequest',
    requestId: `test-intent-request-${Date.now()}`,
    timestamp: new Date().toISOString(),
    locale,
    dialogState,
    intent,
  };

  return {
    ...createBaseRequestEnvelope(userId, accessToken, sessionAttributes, sessionNew),
    request,
  } as RequestEnvelope;
}

/**
 * Builds a LaunchRequest for testing
 */
export function buildLaunchRequest(options: LaunchRequestOptions = {}): RequestEnvelope {
  const {
    locale = 'en-US',
    userId = 'test-user-id',
    accessToken,
    sessionAttributes,
    sessionNew = true,
  } = options;

  const request: LaunchRequest = {
    type: 'LaunchRequest',
    requestId: `test-launch-request-${Date.now()}`,
    timestamp: new Date().toISOString(),
    locale,
  };

  return {
    ...createBaseRequestEnvelope(userId, accessToken, sessionAttributes, sessionNew),
    request,
  } as RequestEnvelope;
}

/**
 * Builds a SessionEndedRequest for testing
 */
export function buildSessionEndedRequest(options: SessionEndedRequestOptions): RequestEnvelope {
  const {
    reason,
    error,
    locale = 'en-US',
    userId = 'test-user-id',
    accessToken,
  } = options;

  const request: SessionEndedRequest = {
    type: 'SessionEndedRequest',
    requestId: `test-session-ended-${Date.now()}`,
    timestamp: new Date().toISOString(),
    locale,
    reason,
    ...(error && { error: error as SessionEndedError }),
  };

  return {
    ...createBaseRequestEnvelope(userId, accessToken, undefined, false),
    request,
  } as RequestEnvelope;
}

/**
 * Helper to create slot value with confirmation
 */
export function slotValue(
  value: string,
  confirmationStatus: 'NONE' | 'CONFIRMED' | 'DENIED' = 'NONE'
): SlotValue {
  return { value, confirmationStatus };
}

/**
 * Helper to create empty/missing slot
 */
export function emptySlot(): SlotValue {
  return { value: '', confirmationStatus: 'NONE' };
}

