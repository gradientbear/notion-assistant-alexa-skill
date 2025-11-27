# Phase 1 Implementation Plan: Task Management Features

## Overview
Implement complete Phase 1 task management: enhanced reading, simple task addition, mark complete, and delete functionality based on `docs/intents.md` requirements.

## 1. Update Reading Tasks (Expand Query Capabilities)

### 1.1 Add Utility Functions in `lambda/src/utils/notion.ts`
- Add `getAllTasks(client, databaseId, filters?)` - Get all tasks with optional filters
- Add `getTasksByPriority(client, databaseId, priority)` - Filter by priority (High/Medium/Low)
- Add `getTasksByStatus(client, databaseId, status)` - Filter by status (To Do/In Progress/Done)
- Add `getTasksByCategory(client, databaseId, category)` - Filter by category
- Add `getPendingTasks(client, databaseId)` - Get tasks with status "To Do" or "In Progress"
- Add `getOverdueTasks(client, databaseId)` - Get tasks past due date
- Add `getTasksDueTomorrow(client, databaseId)` - Get tasks due tomorrow
- Add `getTasksDueThisWeek(client, databaseId)` - Get tasks due within 7 days
- Add `getCompletedTasks(client, databaseId, timeRange?)` - Get completed tasks (optionally filtered by time)

### 1.2 Create New Handler: `lambda/src/handlers/TaskListHandler.ts`
- Handle multiple query intents:
  - `TaskListIntent` - "what are my tasks?" (all tasks)
  - `HighPriorityTasksIntent` - "what are my high priority tasks?"
  - `ToDoListIntent` - "what's on my to-do list?"
  - `PendingTasksIntent` - "what are my pending tasks?"
  - `WorkTasksIntent` - "what are my work tasks?"
  - `PersonalRemindersIntent` - "tell me my personal reminders"
  - `WorkoutPlanIntent` - "what's my workout plan?"
  - `OverdueTasksIntent` - "what's overdue?"
  - `TasksDueTomorrowIntent` - "what's due tomorrow?"
  - `TasksDueThisWeekIntent` - "what's due this week?"
  - `InProgressTasksIntent` - "what am I working on?"
  - `CompletedTasksIntent` - "what have I completed?"
- Format responses according to examples in `intents.md`
- Handle empty results gracefully

### 1.3 Update Existing Handlers
- Update `PriorityListHandler.ts` to use new utility functions
- Update `ScheduleHandler.ts` to use new utility functions and improve date filtering

## 2. Update Adding Tasks (Simple Single-Command Addition)

### 2.1 Add Utility Functions in `lambda/src/utils/notion.ts`
- Add `parseTaskFromUtterance(utterance: string)` - Parse task name, priority, due date, category from natural language
  - Detect priority keywords: "high priority", "urgent", "low priority"
  - Parse dates: "today", "tomorrow", "Monday", "in 3 days", etc.
  - Detect categories: "work", "fitness", "shopping", "personal"
  - Extract task name from utterance

### 2.2 Create New Handler: `lambda/src/handlers/AddTaskHandler.ts`
- Handle `AddTaskIntent` with variations:
  - "add buy milk to my to-do list"
  - "add call mom"
  - "add high priority: finish project"
  - "add finish report due tomorrow"
  - "add workout: chest day"
  - "add to work: finish presentation"
  - "add urgent: client call today"
  - "add high priority work task: finish client report, due Monday"
- Use `parseTaskFromUtterance()` to extract properties
- Call `addTask()` with parsed properties
- Return confirmation messages matching `intents.md` examples
- Keep `BrainDumpHandler` for multi-turn flow (both can coexist)

## 3. Implement Mark Complete

### 3.1 Add Utility Functions in `lambda/src/utils/notion.ts`
- `markTaskComplete()` already exists - verify it works correctly
- Add `markTasksCompleteBatch(client, databaseId, taskIds)` - Batch mark multiple tasks
- Add `getTasksByDateRange(client, databaseId, date)` - Get tasks for specific date (for "mark all today's tasks")
- Add `getCompletedTasksForDeletion(client, databaseId)` - Get all completed tasks (for batch operations)

### 3.2 Create Handler: `lambda/src/handlers/MarkTaskCompleteHandler.ts`
- Handle `MarkTaskCompleteIntent` with variations:
  - "mark finish report as done"
  - "complete gym session"
  - "mark all today's tasks as done" (batch)
- Use fuzzy matching to find task by name (similar to `ShoppingListHandler`)
- Support both single and batch operations
- Return confirmation messages: "Marked: {task} as complete" or "Marked {count} tasks as complete"

## 4. Implement Delete Task

### 4.1 Update Database Structure
- Add `Deleted` field to Tasks database:
  - Type: Checkbox (Boolean)
  - Default: false (unchecked)
  - Used to mark tasks as deleted (soft delete)
  - Update `docs/NOTION_DATABASE_TEMPLATES.md` to include this field
  - Update `lambda/src/utils/notion.ts` `createTasksDatabase()` function to include Deleted field

### 4.2 Add Utility Functions in `lambda/src/utils/notion.ts`
- Add `deleteTask(client, pageId)` - Set Deleted field to true (soft delete)
- Add `deleteTasksBatch(client, databaseId, taskIds)` - Batch set Deleted=true for multiple tasks
- Add `deleteCompletedTasks(client, databaseId)` - Set Deleted=true for all completed tasks
- Update all query functions to exclude tasks where Deleted=true (filter out deleted tasks)

### 4.2 Create Handler: `lambda/src/handlers/DeleteTaskHandler.ts`
- Handle `DeleteTaskIntent` with variations:
  - "delete buy milk"
  - "remove dentist appointment"
  - "delete completed tasks" (batch)
- Use fuzzy matching to find task by name
- Support both single and batch operations
- Return confirmation messages: "Deleted: {task} from your list" or "Deleted all completed tasks"

## 5. Update Interaction Model

### 5.1 Update `docs/alexa-interaction-model.json`
- Add new intents:
  - `TaskListIntent` - samples: "what are my tasks", "read my tasks", "list my tasks"
  - `HighPriorityTasksIntent` - samples: "what are my high priority tasks", "show high priority"
  - `ToDoListIntent` - samples: "what's on my to-do list", "read my to-do list"
  - `PendingTasksIntent` - samples: "what are my pending tasks", "show pending"
  - `WorkTasksIntent` - samples: "what are my work tasks", "read work tasks"
  - `PersonalRemindersIntent` - samples: "tell me my personal reminders", "personal tasks"
  - `WorkoutPlanIntent` - samples: "what's my workout plan", "fitness tasks"
  - `OverdueTasksIntent` - samples: "what's overdue", "show overdue tasks"
  - `TasksDueTomorrowIntent` - samples: "what's due tomorrow", "tomorrow's tasks"
  - `TasksDueThisWeekIntent` - samples: "what's due this week", "this week's tasks"
  - `InProgressTasksIntent` - samples: "what am I working on", "in progress tasks"
  - `CompletedTasksIntent` - samples: "what have I completed", "completed tasks"
  - `AddTaskIntent` - samples: "add {task}", "add {task} to my to-do list", "add high priority: {task}"
  - `MarkTaskCompleteIntent` - samples: "mark {task} as done", "complete {task}", "mark all today's tasks as done"
  - `DeleteTaskIntent` - samples: "delete {task}", "remove {task}", "delete completed tasks"
- Add slots for task names (use `AMAZON.SearchQuery`)
- Add dialog configuration for slot elicitation
- Add prompts for slot elicitation

## 6. Register New Handlers

### 6.1 Update `lambda/src/index.ts`
- Import new handlers:
  - `TaskListHandler`
  - `AddTaskHandler`
  - `MarkTaskCompleteHandler`
  - `DeleteTaskHandler`
- Add to `addRequestHandlers()` in correct order (more specific intents first)

## 7. Testing Considerations

- Test all new query variations return correct filtered results
- Test simple task addition with various property combinations
- Test mark complete for single and batch operations
- Test delete for single and batch operations
- Test fuzzy matching for task names
- Test error handling for missing tasks
- Test empty result handling

## 8. Database Structure Updates

### 8.1 Add Deleted Field to Tasks Database
- Add `Deleted` (Checkbox) property to Tasks database
- Update `docs/NOTION_DATABASE_TEMPLATES.md` to document the new field
- Update `lambda/src/utils/notion.ts` `createTasksDatabase()` to include Deleted field in schema
- Update all query functions to filter out tasks where Deleted=true

### 8.2 Future Planning: Custom Fields
- Note: Custom fields (calories, duration, etc.) mentioned in `intents.md` will be planned for future phases
- Current structure is sufficient for Phase 1 requirements

## Files to Create/Modify

**New Files:**
- `lambda/src/handlers/TaskListHandler.ts`
- `lambda/src/handlers/AddTaskHandler.ts`
- `lambda/src/handlers/MarkTaskCompleteHandler.ts`
- `lambda/src/handlers/DeleteTaskHandler.ts`

**Files to Modify:**
- `lambda/src/utils/notion.ts` - Add query and utility functions, update createTasksDatabase(), add Deleted field filtering
- `lambda/src/index.ts` - Register new handlers
- `docs/alexa-interaction-model.json` - Add new intents and samples
- `docs/NOTION_DATABASE_TEMPLATES.md` - Add Deleted field documentation
- `lambda/src/handlers/PriorityListHandler.ts` - Update to use new utilities and filter deleted tasks (optional)
- `lambda/src/handlers/ScheduleHandler.ts` - Update to use new utilities and filter deleted tasks (optional)

