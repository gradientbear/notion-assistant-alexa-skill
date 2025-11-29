import { RequestInterceptor, HandlerInput } from 'ask-sdk-core';
import { Response } from 'ask-sdk-model';
import { buildLinkAccountResponse } from '../utils/alexa';
import { verifyAccessToken, isLegacyToken, parseLegacyToken } from '../utils/jwt';
import { getUserByAmazonId } from '../utils/database';
import { createNotionClient } from '../utils/notion';

const INTROSPECT_URL = process.env.INTROSPECT_URL || 'https://notion-data-user.vercel.app/api/auth/introspect';
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

      // Skip for LaunchRequest and SessionEndedRequest (handled separately)
      if (requestType === 'LaunchRequest' || requestType === 'SessionEndedRequest') {
        return;
      }

      // Get access token from Alexa request
      const accessToken = (handlerInput.requestEnvelope.context?.System?.user as any)?.accessToken;

      // If no token, try legacy lookup by userId
      if (!accessToken) {
        console.log('[AuthInterceptor] No access token, falling back to legacy lookup');
        const userId = handlerInput.requestEnvelope.session?.user?.userId;
        
        if (userId) {
          const user = await getUserByAmazonId(userId);
          if (user) {
            attributes.user = user;
            if (user.notion_token) {
              attributes.notionClient = createNotionClient(user.notion_token);
            }
            handlerInput.attributesManager.setSessionAttributes(attributes);
            console.log('[AuthInterceptor] Legacy lookup successful');
            return;
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

      // Get full user record from database
      const dbModule = await import('../utils/database');
      const supabase = dbModule.supabase;
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userInfo.user_id || userInfo.auth_user_id)
        .single();

      if (userError || !user) {
        console.error('[AuthInterceptor] User not found:', userError);
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

      handlerInput.attributesManager.setSessionAttributes(attributes);

      console.log('[AuthInterceptor] Token validated successfully for user:', userInfo.email);
    } catch (error: any) {
      console.error('[AuthInterceptor] Error:', error);

      // Handle specific error types by storing error in attributes
      // The error handler will catch these
      attributes.authError = error.message;
      handlerInput.attributesManager.setSessionAttributes(attributes);

      // Re-throw to be caught by error handler
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

