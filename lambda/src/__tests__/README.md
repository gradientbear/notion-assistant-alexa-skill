# Comprehensive Alexa Skill Test Suite

## Overview

This test suite provides comprehensive coverage for the Voice Planner Alexa Skill Lambda backend, testing every intent, sample utterance, slot combination, and edge case defined in the interaction model.

## Test Structure

### Test Files

1. **`comprehensive-intent-tests.test.ts`**
   - Tests all intents from the interaction model
   - Tests all sample utterances
   - Tests all slot combinations
   - Tests missing slot scenarios
   - Tests built-in intents (Cancel, Stop, Help, Fallback)
   - Tests SessionEndedRequest

2. **`edge-cases.test.ts`**
   - Tests empty and whitespace slot values
   - Tests special characters and Unicode
   - Tests invalid slot values
   - Tests case variations
   - Tests task matching edge cases
   - Tests date parsing edge cases
   - Tests error scenarios (API errors, timeouts, etc.)
   - Tests dialog state variations
   - Tests session edge cases
   - Validates response structure

3. **`state-based-tests.test.ts`**
   - Tests authentication states (no token, valid token, invalid token)
   - Tests Notion connection states (connected, not connected)
   - Tests database availability states
   - Tests license states (if enabled)
   - Tests combined state scenarios
   - Tests session state management
   - Tests error recovery states

### Test Utilities

1. **`test-utils/alexa-request-builder.ts`**
   - `buildIntentRequest()` - Creates IntentRequest envelopes
   - `buildLaunchRequest()` - Creates LaunchRequest envelopes
   - `buildSessionEndedRequest()` - Creates SessionEndedRequest envelopes
   - Helper functions for slot values

2. **`test-utils/mocks.ts`**
   - Mock user data (with/without Notion, with/without license)
   - Mock Notion task data
   - Mock Notion client factory
   - Setup functions for database and Notion mocks
   - Environment variable setup
   - Introspection endpoint mocking

## Test Coverage

### Intents Covered

✅ **LaunchRequest** - All scenarios
✅ **CreateTaskIntent** - All sample utterances, all slot combinations
✅ **ReadTasksIntent** - All sample utterances, all slot combinations
✅ **UpdateTaskStatusIntent** - All sample utterances, all status values
✅ **UpdateTaskPriorityIntent** - All sample utterances, all priority values
✅ **UpdateDueDateIntent** - All sample utterances, various date formats
✅ **UpdateTaskCategoryIntent** - All sample utterances, all category values
✅ **DeleteTaskIntent** - All sample utterances
✅ **ReorderTaskIntent** - All sample utterances, all position values
✅ **AMAZON.CancelIntent** - Built-in intent
✅ **AMAZON.StopIntent** - Built-in intent
✅ **AMAZON.HelpIntent** - Built-in intent
✅ **AMAZON.FallbackIntent** - Built-in intent
✅ **SessionEndedRequest** - All termination reasons

### Slot Combinations Tested

- All required slots present
- Missing required slots (elicitation prompts)
- Optional slots present/absent
- All valid slot values
- Invalid slot values
- Edge case slot values (empty, whitespace, special chars, Unicode)

### State Scenarios Tested

- **Authentication**: No token, valid token, invalid token, legacy token
- **Notion Connection**: Connected, not connected, database not found
- **License**: Active, inactive (if enabled)
- **Session**: New session, existing session, session attributes
- **Error States**: API errors, timeouts, invalid responses

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test File
```bash
npm test -- comprehensive-intent-tests
npm test -- edge-cases
npm test -- state-based-tests
```

### Run with Coverage
```bash
npm test -- --coverage
```

### Watch Mode
```bash
npm test -- --watch
```

## Test Plan

See `TEST_PLAN.md` for detailed test plan documentation.

## Key Features

1. **Comprehensive Coverage**: Every utterance and slot combination is tested
2. **Edge Case Handling**: Invalid inputs, error conditions, boundary scenarios
3. **State Management**: Tests different user and system states
4. **Response Validation**: Ensures all responses have correct structure
5. **Mock Infrastructure**: Reusable mocks for external services
6. **Request Builder**: Easy-to-use utilities for creating test requests

## Test Utilities Usage

### Building Intent Requests

```typescript
import { buildIntentRequest } from './test-utils/alexa-request-builder';

const request = buildIntentRequest({
  intentName: 'CreateTaskIntent',
  accessToken: 'valid-token',
  sessionAttributes: { user: mockUser },
  slots: {
    taskName: 'Test task',
    priority: 'HIGH',
    dueDateTime: 'tomorrow',
    category: 'WORK',
  },
});
```

### Setting Up Mocks

```typescript
import { setupDatabaseMocks, setupNotionMocks, createMockNotionClient } from './test-utils/mocks';

const mockNotionClient = createMockNotionClient();
setupDatabaseMocks();
setupNotionMocks(mockNotionClient);
```

## Notes

- All tests use mocked external dependencies (Supabase, Notion API)
- Tests validate response structure but not specific response text (i18n dependent)
- License validation tests are prepared but currently disabled in codebase
- Legacy token support tests are included but disabled by default

## Maintenance

When adding new intents or slots to the interaction model:

1. Update `TEST_PLAN.md` with new intent/slot information
2. Add tests to `comprehensive-intent-tests.test.ts`
3. Add edge cases to `edge-cases.test.ts` if applicable
4. Add state-based scenarios to `state-based-tests.test.ts` if applicable
5. Update this README with new coverage information

