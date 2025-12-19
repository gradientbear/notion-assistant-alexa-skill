# Comprehensive Alexa Skill Test Plan

## Overview
This document outlines the comprehensive test plan for the Voice Planner Alexa Skill Lambda backend, covering all intents, slots, utterances, and edge cases defined in the interaction model.

## Interaction Model Analysis

### Invocation Name
- **Primary**: "voice planner"
- **Variations to test**: "voice planner", "Voice Planner", "VOICE PLANNER", "hey voice planner"

### Intents and Coverage

#### 1. LaunchRequest
- **Test Cases**:
  - Standard launch request
  - Launch with valid access token
  - Launch without access token (requires account linking)
  - Launch with invalid token
  - Launch with user but no Notion connection
  - Launch with user and Notion connected
  - Launch with legacy user lookup (if enabled)

#### 2. CreateTaskIntent
- **Slots**:
  - `taskName` (AMAZON.SearchQuery, required)
  - `priority` (PRIORITY, required)
  - `dueDateTime` (AMAZON.SearchQuery, required)
  - `category` (CATEGORY, required)
  - `notes` (AMAZON.SearchQuery, optional)

- **Sample Utterances**:
  1. "add {taskName}"
  2. "create a task {taskName}"
  3. "remind me to {taskName}"
  4. "add {taskName} tomorrow"
  5. "add {taskName} next week"
  6. "add {taskName} today"

- **Slot Combinations to Test**:
  - All required slots present
  - Missing taskName
  - Missing priority
  - Missing dueDateTime
  - Missing category
  - With notes, without notes
  - All priority values: LOW, NORMAL, HIGH
  - All category values: PERSONAL, WORK
  - Various date formats: "today", "tomorrow", "next week", "in 3 days", "2024-12-25", "December 25th"
  - Edge cases: empty strings, whitespace-only, invalid dates, unknown priority/category values

#### 3. ReadTasksIntent
- **Slots** (all optional):
  - `status` (STATUS)
  - `priority` (PRIORITY)
  - `category` (CATEGORY)
  - `dueDateTime` (AMAZON.SearchQuery)

- **Sample Utterances**:
  1. "show my tasks"
  2. "read my tasks"
  3. "show my {status} tasks"
  4. "show tasks due {dueDateTime}"
  5. "show my {priority} priority tasks"
  6. "read my {category} tasks"

- **Slot Combinations to Test**:
  - No slots (all tasks)
  - Single slot: status only, priority only, category only, dueDateTime only
  - Two slots: status+priority, status+category, priority+category, status+dueDateTime, etc.
  - Three slots: status+priority+category, status+priority+dueDateTime, etc.
  - All four slots
  - Invalid slot values
  - Date parsing variations

#### 4. UpdateTaskStatusIntent
- **Slots**:
  - `taskName` (AMAZON.SearchQuery, required)
  - `status` (STATUS, required)

- **Sample Utterances**:
  1. "mark a task as {status}"
  2. "update a task status to {status}"
  3. "set status to {status}"
  4. "complete a task"

- **Slot Combinations to Test**:
  - All status values: TO DO, IN PROCESS, DONE
  - Missing taskName
  - Missing status
  - Invalid status values
  - Task name matching variations (exact, partial, fuzzy)

#### 5. UpdateTaskPriorityIntent
- **Slots**:
  - `taskName` (AMAZON.SearchQuery, required)
  - `priority` (PRIORITY, required)

- **Sample Utterances**:
  1. "set task priority to {priority}"
  2. "change priority to {priority}"
  3. "make priority {priority}"
  4. "update task priority"

- **Slot Combinations to Test**:
  - All priority values: LOW, NORMAL, HIGH
  - Missing taskName
  - Missing priority
  - Invalid priority values
  - Task name matching variations

#### 6. UpdateDueDateIntent
- **Slots**:
  - `taskName` (AMAZON.SearchQuery, required)
  - `dueDateTime` (AMAZON.SearchQuery, required)

- **Sample Utterances**:
  1. "change the due date"
  2. "set due date"
  3. "update due date"
  4. "reschedule task"

- **Slot Combinations to Test**:
  - Missing taskName
  - Missing dueDateTime
  - Various date formats
  - Invalid date formats
  - Task name matching variations

#### 7. UpdateTaskCategoryIntent
- **Slots**:
  - `taskName` (AMAZON.SearchQuery, required)
  - `category` (CATEGORY, required)

- **Sample Utterances**:
  1. "set task category"
  2. "move task to a category"
  3. "make a task a category"
  4. "change task category"

- **Slot Combinations to Test**:
  - All category values: PERSONAL, WORK
  - Missing taskName
  - Missing category
  - Invalid category values
  - Task name matching variations

#### 8. DeleteTaskIntent
- **Slots**:
  - `taskName` (AMAZON.SearchQuery, required)

- **Sample Utterances**:
  1. "delete {taskName}"
  2. "remove {taskName}"
  3. "trash {taskName}"
  4. "get rid of {taskName}"

- **Slot Combinations to Test**:
  - Missing taskName
  - Task name matching variations
  - Task not found scenarios

#### 9. ReorderTaskIntent
- **Slots**:
  - `taskName` (AMAZON.SearchQuery, required)
  - `position` (POSITION, required)

- **Sample Utterances**:
  1. "move a task"
  2. "reorder task"
  3. "put task at a position"
  4. "move task {position}"

- **Slot Combinations to Test**:
  - All position values: first, second, third, top, bottom, before, after
  - Missing taskName
  - Missing position
  - Invalid position values
  - Task name matching variations

#### 10. Built-in Intents
- **AMAZON.CancelIntent**: Test cancellation flow
- **AMAZON.StopIntent**: Test stop flow
- **AMAZON.HelpIntent**: Test help response
- **AMAZON.FallbackIntent**: Test fallback handling

#### 11. SessionEndedRequest
- **Test Cases**:
  - User-initiated session end
  - Error-initiated session end
  - Exceeded max reprompts

## State-Based Test Scenarios

### User Authentication States
1. **No Access Token**
   - Should return LinkAccountCard response
   - Should not process intents

2. **Valid Access Token**
   - Should process requests normally
   - Should attach user to session

3. **Invalid Access Token**
   - Should return LinkAccountCard response
   - Should handle gracefully

4. **Legacy Token Support** (if enabled)
   - Should fallback to Amazon ID lookup
   - Should work with legacy users

### Notion Connection States
1. **Notion Connected**
   - All CRUD operations should work
   - Database queries should succeed

2. **Notion Not Connected**
   - Should return appropriate error message
   - Should prompt user to connect Notion

3. **Database Not Found**
   - Should return database not found error
   - Should handle gracefully

### License States (if enabled)
1. **License Active**
   - Should process requests normally

2. **License Inactive**
   - Should return license error message
   - Should prevent operations

## Edge Cases

### Slot Value Edge Cases
- Empty strings
- Whitespace-only strings
- Very long strings (>1000 chars)
- Special characters
- Unicode characters
- Numbers as strings
- Null/undefined values

### Task Matching Edge Cases
- Exact match
- Partial match
- Fuzzy match
- No match found
- Multiple potential matches
- Case sensitivity
- Punctuation variations

### Date Parsing Edge Cases
- Natural language: "today", "tomorrow", "next week"
- ISO format: "2024-12-25"
- Relative: "in 3 days", "next Monday"
- Invalid dates: "not a date", "32nd of January"
- Past dates
- Far future dates

### Error Scenarios
- Notion API errors (429, 500, etc.)
- Database connection errors
- Network timeouts
- Invalid responses
- Missing required fields

### Dialog Management
- Slot elicitation prompts
- Confirmation handling
- Dialog state transitions

## Test Coverage Goals

- ✅ 100% intent coverage
- ✅ 100% sample utterance coverage
- ✅ 100% slot combination coverage
- ✅ 100% slot value coverage
- ✅ All edge cases
- ✅ All error paths
- ✅ All state combinations
- ✅ Response structure validation
- ✅ Session attribute validation
- ✅ Error handling validation

## Test Structure

### Test Files Organization
1. `test-utils/alexa-request-builder.ts` - Utility to build Alexa requests
2. `test-utils/mocks.ts` - Mock implementations for external services
3. `comprehensive-intent-tests.test.ts` - All intent tests
4. `edge-cases.test.ts` - Edge case tests
5. `state-based-tests.test.ts` - State-based scenario tests
6. `dialog-management.test.ts` - Dialog flow tests

### Test Execution
- Run all tests: `npm test`
- Run specific suite: `npm test -- comprehensive-intent-tests`
- Coverage report: `npm test -- --coverage`





