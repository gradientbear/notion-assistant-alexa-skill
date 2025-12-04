import { RequestInterceptor, HandlerInput } from 'ask-sdk-core';
import { Response } from 'ask-sdk-model';
import { buildLinkAccountResponse } from '../utils/alexa';
import { verifyAccessToken, isLegacyToken, parseLegacyToken } from '../utils/jwt';
import { getUserByAmazonId, getUserByAuthUserId } from '../utils/database';
import { createNotionClient } from '../utils/notion';

const INTROSPECT_URL = process.env.INTROSPECT_URL || 'https://voice-planner-murex.vercel.app/api/auth/introspect';
const JWT_SECRET = process.env.JWT_SECRET || '';
const LEGACY_TOKEN_SUPPORT_ENABLED = process.env.LEGACY_TOKEN_SUPPORT === 'true';

interface IntrospectResponse {
  active: boolean;
  user_id?: string;
  auth_user_id?: string;
  email?: string;
  license_active?: boolean;
  notion_db_id?: string;
  amazon_account_id?: string;
  token_type?: string;
}

/**
 * Auth Middleware Interceptor
 * Validates JWT tokens from Alexa requests and attaches user info to handlerInput
 */
export class AuthInterceptor implements RequestInterceptor {
  async process(handlerInput: HandlerInput): Promise<void> {
    const attributes = handlerInput.attributesManager.getSessionAttributes();
    
    try {
      const request = handlerInput.requestEnvelope.request;
      const requestType = request.type;

      // Only skip SessionEndedRequest - we need to validate tokens for LaunchRequest too
      if (requestType === 'SessionEndedRequest') {
        return;
      }

      // Get access token from Alexa request
      const accessToken = (handlerInput.requestEnvelope.context?.System?.user as any)?.accessToken;

      // If no token, require proper account linking (OAuth2)
      // Legacy lookup is disabled by default - only enable if explicitly set
      const allowLegacyLookup = process.env.ALLOW_LEGACY_LOOKUP === 'true';
      
      if (!accessToken) {
        console.log('[AuthInterceptor] No access token found');
        const userId = handlerInput.requestEnvelope.session?.user?.userId;
        
        // For LaunchRequest, skip the async lookup here - let LaunchRequestHandler do it
        // This prevents the handler from completing before the async operation finishes
        if (requestType === 'LaunchRequest') {
          console.log('[AuthInterceptor] LaunchRequest with no token - letting handler deal with it');
          return; // Let LaunchRequestHandler handle the lookup and LinkAccount response
        }
        
        // Legacy lookup only if explicitly enabled (for migration/testing)
        if (allowLegacyLookup && userId) {
          console.log('[AuthInterceptor] Legacy lookup enabled, attempting lookup for userId:', userId);
          try {
            const user = await getUserByAmazonId(userId);
            if (user) {
              attributes.user = user;
              if (user.notion_token) {
                attributes.notionClient = createNotionClient(user.notion_token);
              }
              handlerInput.attributesManager.setSessionAttributes(attributes);
              console.log('[AuthInterceptor] Legacy lookup successful');
              return;
            } else {
              console.log('[AuthInterceptor] Legacy lookup found no user');
            }
          } catch (lookupError: any) {
            console.error('[AuthInterceptor] Legacy lookup error:', lookupError);
            // Continue to require account linking
          }
        }

        // No token and no user found - require account linking
        console.log('[AuthInterceptor] No token and no user found, requiring account linking');
        throw new Error('LINK_ACCOUNT_REQUIRED');
      }

      // Validate token
      let userInfo: IntrospectResponse | null = null;

      // Try local JWT verification first (faster)
      if (JWT_SECRET && !isLegacyToken(accessToken)) {
        const payload = verifyAccessToken(accessToken);
        if (payload) {
          // Token is valid, but we need to check revocation and get user info
          // For now, we'll use introspection for full validation
          // In production, you could cache user info or verify locally
        }
      }

      // Use introspection endpoint (supports both JWT and legacy tokens)
      try {
        const introspectResponse = await fetch(INTROSPECT_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!introspectResponse.ok) {
          console.warn('[AuthInterceptor] Introspection failed:', introspectResponse.status);
          throw new Error('TOKEN_INVALID');
        }

        userInfo = await introspectResponse.json() as IntrospectResponse;

        if (!userInfo.active) {
          console.warn('[AuthInterceptor] Token is not active');
          throw new Error('TOKEN_INVALID');
        }
      } catch (fetchError: any) {
        console.error('[AuthInterceptor] Introspection error:', fetchError);
        
        // Fallback to legacy token handling if enabled
        if (LEGACY_TOKEN_SUPPORT_ENABLED && isLegacyToken(accessToken)) {
          console.log('[AuthInterceptor] Processing legacy token as fallback');
          const legacyData = parseLegacyToken(accessToken);
          
          if (legacyData?.amazon_account_id) {
            const user = await getUserByAmazonId(legacyData.amazon_account_id);
            if (user) {
              attributes.user = user;
              if (user.notion_token) {
                attributes.notionClient = createNotionClient(user.notion_token);
              }
              handlerInput.attributesManager.setSessionAttributes(attributes);
              return;
            }
          }
        }

        throw new Error('TOKEN_INVALID');
      }

      // Check license status
      if (userInfo.license_active === false) {
        console.warn('[AuthInterceptor] License is not active');
        throw new Error('LICENSE_INACTIVE');
      }

      // Get full user record from database using auth_user_id (OAuth2 flow)
      // Priority: Use auth_user_id from token, fallback to user_id
      const authUserId = userInfo.auth_user_id || userInfo.user_id;
      
      if (!authUserId) {
        console.error('[AuthInterceptor] No auth_user_id or user_id in token');
        throw new Error('USER_NOT_FOUND');
      }

      console.log('[AuthInterceptor] Looking up user by auth_user_id:', authUserId);
      const user = await getUserByAuthUserId(authUserId);

      if (!user) {
        console.error('[AuthInterceptor] User not found with auth_user_id:', authUserId);
        throw new Error('USER_NOT_FOUND');
      }

      // Attach user info to session attributes
      attributes.user = user;
      attributes.userId = userInfo.user_id;
      attributes.authUserId = userInfo.auth_user_id;
      attributes.email = userInfo.email;
      attributes.licenseActive = userInfo.license_active;
      attributes.notionDbId = userInfo.notion_db_id || user.tasks_db_id;

      // Create Notion client if token exists
      if (user.notion_token) {
        attributes.notionClient = createNotionClient(user.notion_token);
      }

      // Update amazon_account_id if missing (first request after account linking)
      const amazonUserId = handlerInput.requestEnvelope.session?.user?.userId;
      if (amazonUserId && !user.amazon_account_id) {
        console.log('[AuthInterceptor] Updating missing amazon_account_id for user:', user.id);
        try {
          const { updateUserAmazonAccountId } = await import('../utils/database');
          await updateUserAmazonAccountId(user.id, amazonUserId);
          // Update local user object
          user.amazon_account_id = amazonUserId;
          attributes.user = user;
          console.log('[AuthInterceptor] Successfully updated amazon_account_id');
        } catch (updateError: any) {
          console.error('[AuthInterceptor] Failed to update amazon_account_id:', updateError);
          // Don't throw - continue with request even if update fails
        }
      }

      handlerInput.attributesManager.setSessionAttributes(attributes);

      console.log('[AuthInterceptor] Token validated successfully for user:', userInfo.email);
    } catch (error: any) {
      console.error('[AuthInterceptor] Error:', error);
      console.error('[AuthInterceptor] Error stack:', error?.stack);

      // Handle specific error types by storing error in attributes
      // The error handler will catch these
      attributes.authError = error.message;
      handlerInput.attributesManager.setSessionAttributes(attributes);

      // For LaunchRequest, don't throw - let the handler deal with it
      const requestType = handlerInput.requestEnvelope.request.type;
      if (requestType === 'LaunchRequest') {
        console.log('[AuthInterceptor] LaunchRequest - not throwing error, letting handler deal with it');
        return; // Don't throw, let LaunchRequestHandler handle it
      }

      // Re-throw to be caught by error handler (for non-LaunchRequest)
      if (error.message === 'LINK_ACCOUNT_REQUIRED' || 
          error.message === 'TOKEN_INVALID' || 
          error.message === 'USER_NOT_FOUND') {
        throw new Error('AUTH_REQUIRED');
      }

      if (error.message === 'LICENSE_INACTIVE') {
        throw new Error('LICENSE_INACTIVE');
      }

      // For other errors, let handlers deal with it
      // Don't throw - just log and continue
    }
  }
}

/**
 * Wrapper to handle auth errors in the skill builder
 */
export function handleAuthError(error: any, handlerInput: HandlerInput): Response | null {
  if (error?.message === 'AUTH_REQUIRED') {
    return buildLinkAccountResponse(handlerInput);
  }

  if (error?.message === 'LICENSE_INACTIVE') {
    return handlerInput.responseBuilder
      .speak('Your license is not active. Please visit the app to purchase or activate your license.')
      .withShouldEndSession(true)
      .getResponse();
  }

  return null;
}

