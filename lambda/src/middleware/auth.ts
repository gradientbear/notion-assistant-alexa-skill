import { RequestInterceptor, HandlerInput } from 'ask-sdk-core';
import { Response } from 'ask-sdk-model';
import { buildLinkAccountResponse } from '../utils/alexa';
import { verifyAccessToken, isLegacyToken, parseLegacyToken } from '../utils/jwt';
import { getUserByAmazonId, getUserByAuthUserId } from '../utils/database';
import { createNotionClient } from '../utils/notion';

const INTROSPECT_URL = process.env.INTROSPECT_URL || 'https://voice-planner.com/api/auth/introspect';
const JWT_SECRET = process.env.JWT_SECRET || '';
const LEGACY_TOKEN_SUPPORT_ENABLED = process.env.LEGACY_TOKEN_SUPPORT === 'true';

interface IntrospectResponse {
  active: boolean;
  user_id?: string;
  email?: string;
  license_active?: boolean;
  notion_db_id?: string;
  amazon_account_id?: string;
  token_type?: string;
  exp?: number; // Token expiration timestamp
  iat?: number; // Token issued at timestamp
}

/**
 * Auth Middleware Interceptor
 * Validates access tokens (opaque tokens or JWTs) from Alexa requests via introspection endpoint
 * and attaches user info to handlerInput
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

      // Check if token is opaque (not JWT format)
      // Opaque tokens are random strings, not JWTs (which have 3 parts separated by dots)
      const isOpaqueToken = !accessToken.includes('.') || accessToken.split('.').length !== 3;

      // Try local JWT verification first (only for JWT tokens, not opaque)
      // Opaque tokens must always go through introspection since they're stored in DB
      if (JWT_SECRET && !isLegacyToken(accessToken) && !isOpaqueToken) {
        const payload = verifyAccessToken(accessToken);
        if (payload) {
          // Token is valid JWT, but we need to check revocation and get user info
          // For now, we'll use introspection for full validation
          // In production, you could cache user info or verify locally
        }
      }

      // Use introspection endpoint (supports opaque tokens, JWT tokens, and legacy tokens)
      try {
        console.log('[AuthInterceptor] Calling introspection endpoint:', {
          url: INTROSPECT_URL,
          tokenPreview: accessToken.substring(0, 20) + '...',
          tokenLength: accessToken.length,
        });
        
        const introspectResponse = await fetch(INTROSPECT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token: accessToken,
          }),
        });

        console.log('[AuthInterceptor] Introspection response status:', introspectResponse.status);

        if (!introspectResponse.ok) {
          const errorText = await introspectResponse.text();
          const statusCode = introspectResponse.status;
          
          console.warn('[AuthInterceptor] Introspection failed:', {
            status: statusCode,
            statusText: introspectResponse.statusText,
            errorBody: errorText,
            tokenPreview: accessToken.substring(0, 20) + '...',
          });
          
          // Provide more specific error messages
          if (statusCode === 401) {
            throw new Error('TOKEN_INVALID');
          } else if (statusCode === 500) {
            console.error('[AuthInterceptor] Introspection endpoint server error - may be temporary');
            throw new Error('TOKEN_INVALID'); // Treat as invalid for now
          } else {
            throw new Error('TOKEN_INVALID');
          }
        }

        userInfo = await introspectResponse.json() as IntrospectResponse;

        if (!userInfo.active) {
          console.warn('[AuthInterceptor] Token is not active (expired or revoked)');
          throw new Error('TOKEN_INVALID');
        }

        // Check token expiration if exp is provided
        if (userInfo.exp) {
          const now = Math.floor(Date.now() / 1000);
          const timeUntilExpiry = userInfo.exp - now;
          
          // Log if token is close to expiring (within 5 minutes)
          if (timeUntilExpiry > 0 && timeUntilExpiry < 300) {
            console.warn('[AuthInterceptor] Token expiring soon:', {
              expires_in_seconds: timeUntilExpiry,
              expires_at: new Date(userInfo.exp * 1000).toISOString()
            });
          }
          
          // Token is expired (shouldn't happen if introspection is working correctly)
          if (timeUntilExpiry <= 0) {
            console.error('[AuthInterceptor] Token has expired:', {
              expired_at: new Date(userInfo.exp * 1000).toISOString(),
              now: new Date().toISOString(),
              seconds_expired: Math.abs(timeUntilExpiry)
            });
            throw new Error('TOKEN_EXPIRED');
          }
        }

        // Log token type for debugging
        if (isOpaqueToken) {
          console.log('[AuthInterceptor] Validated opaque token via introspection');
        } else {
          console.log('[AuthInterceptor] Validated JWT token via introspection');
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
      // if (userInfo.license_active === false) {
      //   console.warn('[AuthInterceptor] License is not active');
      //   throw new Error('LICENSE_INACTIVE');
      // }

      // Get full user record from database using user_id (OAuth2 flow)
      // user_id now matches users.id which matches Supabase Auth user id
      const userId = userInfo.user_id;
      
      if (!userId) {
        console.error('[AuthInterceptor] No user_id in token');
        throw new Error('USER_NOT_FOUND');
      }

      console.log('[AuthInterceptor] Looking up user by id:', userId);
      let user = await getUserByAuthUserId(userId);

      // Fallback: If user not found by Auth ID (e.g., timeout, replication lag), try Amazon ID
      if (!user) {
        console.warn('[AuthInterceptor] User not found by auth ID, trying Amazon ID fallback...');
        const amazonUserId = handlerInput.requestEnvelope.session?.user?.userId;
        if (amazonUserId) {
          try {
            user = await getUserByAmazonId(amazonUserId);
            if (user) {
              console.log('[AuthInterceptor] User found via Amazon ID fallback:', {
                user_id: user.id,
                amazon_account_id: user.amazon_account_id,
                email: user.email,
              });
              
              // Update amazon_account_id if missing (async, don't wait)
              if (!user.amazon_account_id && amazonUserId) {
                const { updateUserAmazonAccountId } = await import('../utils/database');
                updateUserAmazonAccountId(user.id, amazonUserId).catch((err: any) => 
                  console.error('[AuthInterceptor] Failed to update amazon_account_id:', err?.message)
                );
              }
            } else {
              console.warn('[AuthInterceptor] User not found via Amazon ID fallback either');
            }
          } catch (fallbackError: any) {
            console.error('[AuthInterceptor] Error in Amazon ID fallback lookup:', {
              error: fallbackError?.message,
              amazon_user_id: amazonUserId,
            });
          }
        } else {
          console.warn('[AuthInterceptor] No Amazon user ID available for fallback');
        }
      }

      if (!user) {
        console.error('[AuthInterceptor] User not found with id:', {
          user_id: userId,
          amazon_account_id: handlerInput.requestEnvelope.session?.user?.userId,
          email: userInfo.email,
          token_type: userInfo.token_type,
        });
        throw new Error('USER_NOT_FOUND');
      }

      // Attach user info to session attributes
      attributes.user = user;
      attributes.userId = userInfo.user_id;
      attributes.email = userInfo.email;
      attributes.licenseActive = userInfo.license_active;
      attributes.notionDbId = userInfo.notion_db_id || user.tasks_db_id;
      attributes.sessionTimestamp = Date.now(); // Track when session data was loaded

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

      console.log('[AuthInterceptor] Token validated successfully:', {
        user_id: userInfo.user_id,
        email: userInfo.email,
        token_type: userInfo.token_type,
        expires_at: userInfo.exp ? new Date(userInfo.exp * 1000).toISOString() : 'unknown',
        has_notion_token: !!user.notion_token,
        notion_setup_complete: user.notion_setup_complete,
      });
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
          error.message === 'TOKEN_EXPIRED' ||
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
    console.log('[handleAuthError] Authentication required - prompting for account linking');
    return buildLinkAccountResponse(handlerInput);
  }

  if (error?.message === 'TOKEN_EXPIRED') {
    console.log('[handleAuthError] Token expired - prompting for account re-linking');
    // Token expired - user needs to re-link their account
    return buildLinkAccountResponse(handlerInput);
  }

  if (error?.message === 'LICENSE_INACTIVE') {
    console.log('[handleAuthError] License inactive');
    return handlerInput.responseBuilder
      .speak('Your license is not active. Please visit the app to purchase or activate your license.')
      .withShouldEndSession(true)
      .getResponse();
  }

  return null;
}

