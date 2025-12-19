# Comprehensive Test Sentences for All CRUD Operations

This document provides comprehensive test sentences for all task management operations: Create (Add), Read, Update, and Delete.

## Table of Contents
1. [Create Task (Add)](#create-task-add)
2. [Read Tasks (Query)](#read-tasks-query)
3. [Update Tasks](#update-tasks)
4. [Delete Tasks](#delete-tasks)

---

## Create Task (Add)

### Intent: `CreateTaskIntent`
**Handler:** `AddTaskHandler`

### Simple Task Addition (Only taskName Required)

**Basic Commands:**
1. "add buy milk"
2. "add call mom"
3. "add finish project report"
4. "add schedule dentist appointment"
5. "add water the plants"
6. "add pick up groceries"
7. "create a task buy milk"
8. "remind me to buy milk"
9. "add review quarterly report"
10. "add send email to John"

**Expected Behavior:**
- taskName: Extracted from utterance
- priority: "NORMAL" (default)
- category: "PERSONAL" (default)
- dueDateTime: null (default)
- **Should NOT prompt for additional information**

### Task with Embedded Date/Time

**Examples:**
1. "add buy milk tomorrow"
2. "add buy milk today"
3. "add buy milk next week"
4. "add call mom on Friday"
5. "add finish report by December 25th"
6. "add schedule meeting for next Monday"
7. "add buy groceries in 3 days"
8. "add complete project by end of week"
9. "add call dentist next month"
10. "add submit report on Friday at 5 PM"

**Expected Behavior:**
- taskName: Extracted and cleaned
- priority: "NORMAL" (default)
- category: "PERSONAL" (default)
- dueDateTime: Parsed from taskName

### Task with Embedded Priority

**Examples:**
1. "add buy milk high priority"
2. "add finish report low priority"
3. "add urgent task high priority"
4. "add call mom normal priority"
5. "add buy milk high"
6. "add important task high priority"
7. "add low priority task buy groceries"
8. "add high priority finish presentation"

**Expected Behavior:**
- taskName: Extracted and cleaned
- priority: Parsed from taskName (HIGH, LOW, NORMAL)
- category: "PERSONAL" (default)
- dueDateTime: null (default)

### Task with Embedded Category

**Examples:**
1. "add buy milk personal"
2. "add finish report work"
3. "add call client work task"
4. "add personal task buy groceries"
5. "add work task review documents"
6. "add personal buy milk"
7. "add work finish presentation"

**Expected Behavior:**
- taskName: Extracted and cleaned
- priority: "NORMAL" (default)
- category: Parsed from taskName (PERSONAL, WORK)
- dueDateTime: null (default)

### Complete Task (All Information Embedded)

**Examples:**
1. "add buy milk high priority tomorrow personal"
2. "add finish report normal priority next week work"
3. "add call mom low priority today personal"
4. "add schedule meeting high priority Friday work"
5. "add buy milk high priority tomorrow for personal"
6. "add finish quarterly report by next Friday with high priority for work"
7. "add urgent work task review documents tomorrow high priority"
8. "add personal task buy groceries low priority next week"

**Expected Behavior:**
- All information parsed from taskName
- Priority, category, and dueDateTime extracted correctly

### With Explicit Slots

**Examples:**
1. "add buy milk" (with priority="HIGH", category="WORK", dueDateTime="tomorrow" in slots)
2. "add finish report" (with all slots provided)

**Expected Behavior:**
- Explicit slot values override parsed/default values

---

## Read Tasks (Query)

### Intent: `ReadTasksIntent`
**Handler:** `QueryTasksHandler`

### Read All Tasks

**Examples:**
1. "show my tasks"
2. "read my tasks"
3. "list my tasks"
4. "what are my tasks"
5. "get my tasks"
6. "display my tasks"

**Expected Behavior:**
- Returns all tasks (excluding deleted)
- Sorted by due date (ascending) and priority (descending)

### Read Tasks by Status

**Examples:**
1. "show my TO DO tasks"
2. "show my IN PROCESS tasks"
3. "show my DONE tasks"
4. "read my completed tasks"
5. "show tasks that are done"
6. "list my in progress tasks"
7. "what tasks are to do"
8. "show my pending tasks"

**Expected Behavior:**
- Filters tasks by status (TO DO, IN PROCESS, DONE)

### Read Tasks by Priority

**Examples:**
1. "show my HIGH priority tasks"
2. "show my LOW priority tasks"
3. "show my NORMAL priority tasks"
4. "read my high priority tasks"
5. "list urgent tasks"
6. "show important tasks"
7. "what are my low priority tasks"

**Expected Behavior:**
- Filters tasks by priority (HIGH, NORMAL, LOW)

### Read Tasks by Category

**Examples:**
1. "read my PERSONAL tasks"
2. "read my WORK tasks"
3. "show my personal tasks"
4. "show my work tasks"
5. "list personal tasks"
6. "what work tasks do I have"
7. "show tasks for work"
8. "display personal tasks"

**Expected Behavior:**
- Filters tasks by category (PERSONAL, WORK)

### Read Tasks by Due Date

**Examples:**
1. "show tasks due today"
2. "show tasks due tomorrow"
3. "show tasks due next week"
4. "read tasks due Friday"
5. "list tasks due December 25th"
6. "show tasks due in 3 days"
7. "what tasks are due today"
8. "show tasks due this week"

**Expected Behavior:**
- Filters tasks by due date
- Uses chrono-node for natural language date parsing

### Combined Filters

**Examples:**
1. "show my HIGH priority WORK tasks"
2. "read my DONE PERSONAL tasks"
3. "show TO DO tasks due tomorrow"
4. "list HIGH priority tasks due today"
5. "show WORK tasks that are IN PROCESS"
6. "read PERSONAL tasks due next week"
7. "show DONE WORK tasks"
8. "list HIGH priority tasks due tomorrow"

**Expected Behavior:**
- Combines multiple filters (AND logic)
- Returns tasks matching all specified criteria

---

## Update Tasks

### Update Task Status

### Intent: `UpdateTaskStatusIntent`
**Handler:** `UpdateTaskStatusHandler`

**Examples:**
1. "mark buy milk as DONE"
2. "mark buy milk as done"
3. "update buy milk status to DONE"
4. "set buy milk status to IN PROCESS"
5. "complete buy milk"
6. "mark task buy milk as complete"
7. "set buy milk to done"
8. "change buy milk to in process"
9. "mark the task buy milk as done"
10. "update the status of buy milk to done"

**Expected Behavior:**
- Finds task by name (fuzzy matching)
- Updates status to specified value (TO DO, IN PROCESS, DONE)
- Confirms update

### Update Task Priority

### Intent: `UpdateTaskPriorityIntent`
**Handler:** `UpdateTaskPriorityHandler`

**Examples:**
1. "set buy milk priority to HIGH"
2. "set buy milk priority to high"
3. "change buy milk priority to LOW"
4. "make buy milk priority NORMAL"
5. "update buy milk priority to high"
6. "set priority of buy milk to high"
7. "change the priority of buy milk to low"
8. "make buy milk high priority"
9. "set buy milk to high priority"
10. "update task buy milk priority"

**Expected Behavior:**
- Finds task by name
- Updates priority (HIGH, NORMAL, LOW)
- Confirms update

### Update Due Date

### Intent: `UpdateDueDateIntent`
**Handler:** `UpdateDueDateHandler`

**Examples:**
1. "change buy milk due date to tomorrow"
2. "set buy milk due date to Friday"
3. "update buy milk due date to next week"
4. "reschedule buy milk to December 25th"
5. "change the due date of buy milk to tomorrow"
6. "set buy milk due date"
7. "update due date for buy milk"
8. "reschedule buy milk"
9. "change buy milk to tomorrow"
10. "set buy milk deadline to next Friday"

**Expected Behavior:**
- Finds task by name
- Parses new due date using chrono-node
- Updates due date
- Confirms update

### Update Task Category

### Intent: `UpdateTaskCategoryIntent`
**Handler:** `UpdateTaskCategoryHandler`

**Examples:**
1. "set buy milk category to WORK"
2. "set buy milk category to work"
3. "move buy milk to PERSONAL category"
4. "change buy milk category to work"
5. "make buy milk a work task"
6. "set category of buy milk to personal"
7. "change the category of buy milk to work"
8. "move buy milk to work category"
9. "update buy milk category"
10. "set task buy milk category"

**Expected Behavior:**
- Finds task by name
- Updates category (PERSONAL, WORK)
- Confirms update

---

## Delete Tasks

### Intent: `DeleteTaskIntent`
**Handler:** `DeleteTaskHandler`

**Examples:**
1. "delete buy milk"
2. "remove buy milk"
3. "trash buy milk"
4. "get rid of buy milk"
5. "delete the task buy milk"
6. "remove the task buy milk"
7. "delete task buy milk"
8. "remove task buy milk"
9. "delete buy milk task"
10. "remove buy milk from my tasks"

**Expected Behavior:**
- Finds task by name (fuzzy matching)
- Deletes task (marks as deleted in Notion)
- Confirms deletion

### Edge Cases

**Examples:**
1. "delete" (missing taskName - should prompt)
2. "delete " (empty taskName - should prompt)
3. "delete non-existent task" (should return "task not found")
4. "delete buy" (partial match - should find "buy milk" if exists)

**Expected Behavior:**
- Prompts for task name if missing
- Returns error if task not found
- Uses fuzzy matching for task names

---

## Test Scenarios Summary

### Scenario 1: Complete CRUD Workflow
1. **Create:** "add buy milk"
2. **Read:** "show my tasks"
3. **Update Status:** "mark buy milk as done"
4. **Read:** "show my done tasks"
5. **Delete:** "delete buy milk"

### Scenario 2: Complex Task Creation
1. **Create:** "add finish quarterly report high priority tomorrow work"
2. **Read:** "show my high priority work tasks"
3. **Update:** "change finish quarterly report due date to next Friday"
4. **Update:** "set finish quarterly report priority to normal"
5. **Read:** "show tasks due next Friday"

### Scenario 3: Task Management
1. **Create:** "add call dentist"
2. **Create:** "add review documents work"
3. **Read:** "show my work tasks"
4. **Update:** "mark call dentist as done"
5. **Update:** "set review documents priority to high"
6. **Read:** "show my high priority tasks"
7. **Delete:** "delete call dentist"

---

## Verification Checklist

- [x] Create Task - Simple (only taskName)
- [x] Create Task - With date
- [x] Create Task - With priority
- [x] Create Task - With category
- [x] Create Task - Complete (all info)
- [x] Read Tasks - All tasks
- [x] Read Tasks - By status
- [x] Read Tasks - By priority
- [x] Read Tasks - By category
- [x] Read Tasks - By due date
- [x] Read Tasks - Combined filters
- [x] Update Task - Status
- [x] Update Task - Priority
- [x] Update Task - Due date
- [x] Update Task - Category
- [x] Delete Task - Basic
- [x] Delete Task - Edge cases


