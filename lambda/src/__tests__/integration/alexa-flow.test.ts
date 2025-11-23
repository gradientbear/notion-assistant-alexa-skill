import { handler } from '../../index';
import { RequestEnvelope } from 'ask-sdk-model';

// Integration test for full Alexa request flow
describe('Alexa Skill Integration', () => {
  const createLaunchRequest = (): RequestEnvelope => ({
    version: '1.0',
    session: {
      new: true,
      sessionId: 'test-session',
      application: {
        applicationId: 'test-app-id',
      },
      user: {
        userId: 'test-user-id',
      },
    },
    context: {
      System: {
        application: {
          applicationId: 'test-app-id',
        },
        user: {
          userId: 'test-user-id',
        },
        device: {
          deviceId: 'test-device',
        },
      },
    },
    request: {
      type: 'LaunchRequest',
      requestId: 'test-request',
      timestamp: new Date().toISOString(),
      locale: 'en-US',
    },
  });

  it('should handle LaunchRequest', async () => {
    const request = createLaunchRequest();
    const response = await handler(request, {} as any, () => {});
    
    expect(response).toBeDefined();
    expect(response.version).toBe('1.0');
  });

  it('should handle IntentRequest', async () => {
    const request: RequestEnvelope = {
      ...createLaunchRequest(),
      request: {
        type: 'IntentRequest',
        requestId: 'test-intent-request',
        timestamp: new Date().toISOString(),
        locale: 'en-US',
        intent: {
          name: 'PriorityListIntent',
        },
      },
    };

    const response = await handler(request, {} as any, () => {});
    expect(response).toBeDefined();
  });
});

