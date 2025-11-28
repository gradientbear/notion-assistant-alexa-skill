# Status Update Test Scenarios

This document lists all test scenarios for the UpdateTaskStatusHandler to ensure correct behavior.

## Test Scenarios

### Scenario 1: To Do → In Progress (Explicit)
- **Task Status**: To Do
- **User Says**: "set finish quarterly report to in progress"
- **Expected**: Status changes to "In Progress"
- **Expected Log**: `Detected EXPLICIT "In Progress" from "to in progress" pattern`

### Scenario 2: To Do → In Progress (Implicit)
- **Task Status**: To Do
- **User Says**: "set finish quarterly report" (no status mentioned)
- **Expected**: Status changes to "In Progress" (smart default)
- **Expected Log**: `No explicit status detected, using smart defaults`

### Scenario 3: In Progress → Done (Explicit)
- **Task Status**: In Progress
- **User Says**: "set finish quarterly report to done"
- **Expected**: Status changes to "Done"
- **Expected Log**: `Detected EXPLICIT "Done" from "to done" pattern`

### Scenario 4: In Progress → Done (Implicit)
- **Task Status**: In Progress
- **User Says**: "set finish quarterly report" (no status mentioned)
- **Expected**: Status changes to "Done" (smart default)
- **Expected Log**: `No explicit status detected, using smart defaults`

### Scenario 5: In Progress → In Progress (Explicit) ⚠️ CRITICAL
- **Task Status**: In Progress
- **User Says**: "set finish quarterly report to in progress"
- **Expected**: Status STAYS "In Progress" (no change, or updates to same status)
- **Expected Log**: `Detected EXPLICIT "In Progress"` + `Explicit status matches current status`
- **Should NOT**: Use smart default to set to "Done"

### Scenario 6: Done → To Do (Explicit)
- **Task Status**: Done
- **User Says**: "set finish quarterly report to to do"
- **Expected**: Status changes to "To Do"
- **Expected Log**: `Detected EXPLICIT "To Do" from "to to do" pattern`

### Scenario 7: Done → To Do (Implicit)
- **Task Status**: Done
- **User Says**: "set finish quarterly report" (no status mentioned)
- **Expected**: Status changes to "To Do" (smart default)
- **Expected Log**: `No explicit status detected, using smart defaults`

### Scenario 8: To Do → Done (Explicit)
- **Task Status**: To Do
- **User Says**: "set finish quarterly report to done"
- **Expected**: Status changes to "Done"
- **Expected Log**: `Detected EXPLICIT "Done" from "to done" pattern`

### Scenario 9: Done → In Progress (Explicit)
- **Task Status**: Done
- **User Says**: "set finish quarterly report to in progress"
- **Expected**: Status changes to "In Progress"
- **Expected Log**: `Detected EXPLICIT "In Progress" from "to in progress" pattern`

### Scenario 10: In Progress → To Do (Explicit)
- **Task Status**: In Progress
- **User Says**: "set finish quarterly report to to do"
- **Expected**: Status changes to "To Do"
- **Expected Log**: `Detected EXPLICIT "To Do" from "to to do" pattern`

## Key Test Cases for Bug Fix

The critical bug is **Scenario 5**: When a task is already "In Progress" and user explicitly says "to in progress", it should stay "In Progress", not change to "Done".

### Verification Steps:
1. Create a task with status "In Progress"
2. Say: "alexa set [task name] to in progress"
3. Check CloudWatch logs for:
   - `Detected EXPLICIT "In Progress"` (should appear)
   - `Explicit status detected` (should appear)
   - `usingSmartDefaults: false` (should be false)
4. Verify task status in Notion is still "In Progress"

## Expected Behavior Summary

| Current Status | User Says | Expected Result | Uses Smart Default? |
|---------------|-----------|-----------------|---------------------|
| To Do | "to in progress" | In Progress | No (explicit) |
| To Do | (no status) | In Progress | Yes |
| In Progress | "to in progress" | In Progress | No (explicit) ⚠️ |
| In Progress | "to done" | Done | No (explicit) |
| In Progress | (no status) | Done | Yes |
| Done | "to to do" | To Do | No (explicit) |
| Done | (no status) | To Do | Yes |

## CloudWatch Log Indicators

### Explicit Status Detected (Good):
- `Detected EXPLICIT "In Progress" from "to in progress" pattern`
- `Explicit status detected`
- `usingSmartDefaults: false`

### Smart Default Used (Good, when no explicit status):
- `No explicit status detected, using smart defaults`
- `usingSmartDefaults: true`

### Bug Indicator (Bad):
- Task is "In Progress"
- User says "to in progress"
- Logs show: `usingSmartDefaults: true` OR `willUpdateTo: Done`
- This means explicit status was NOT detected properly

