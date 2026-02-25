# English Test Sentences (en-US)

This document contains comprehensive test sentences for the English language interaction model. These sentences are designed to test all backend logic and handlers.

## 📝 CREATE TASKS (CreateTaskIntent)

### Simple Task Creation
- "add buy milk"
- "add call mom"
- "add finish the report"
- "add schedule dentist appointment"
- "create a task review the budget"
- "remind me to water the plants"
- "add pick up groceries"
- "add send email to John"

### Task with Date/Time
- "add buy milk tomorrow"
- "add call mom today"
- "add finish the report next week"
- "add schedule appointment this week"
- "add buy groceries next Friday"
- "add call mom today"
- "add finish report tomorrow"

### Task with Specific Dates
- "add call dentist December 25th"
- "add call dentist on December 25th"
- "add call dentist for December 25th"
- "create call dentist December 25th"
- "create call dentist on December 25th"
- "remind me to call dentist December 25th"
- "add buy gifts December 23rd"
- "add buy gifts on December 23rd"
- "create meeting January 15th"
- "add party December 31st"
- "add call dentist on December 25th at 6 PM"
- "add call grandma at 4 PM tomorrow"
- "add call dentist at 9 PM on December 20th 2025"
- "add call aunt at 7 PM on December 18th 2025"

### Task with Priority
- "add buy milk high priority"
- "add finish report low priority"
- "add urgent task high priority"
- "add call mom normal priority"
- "add buy milk urgent"
- "add important task high priority"

### Task with Category
- "add finish report work"
- "add buy milk personal"
- "add call client work"
- "add water plants personal"

### Task with Combined Attributes
- "add finish report high priority tomorrow work"
- "add buy milk low priority today personal"
- "add call dentist urgent December 25th work"

---

## 📖 READ TASKS (ReadTasksIntent)

### Show All Tasks
- "show my tasks"
- "read my tasks"
- "list my tasks"
- "what do I have for today"
- "what are my tasks"
- "show me tasks"

### Filter by Status
- "show my to do tasks"
- "show my done tasks"
- "show my completed tasks"
- "show my closed tasks"
- "show my finished tasks"
- "read my to do tasks"
- "read my done tasks"
- "read my completed tasks"
- "read my closed tasks"
- "read my finished tasks"
- "show my pending tasks"
- "show my open tasks"
- "show my incomplete tasks"
- "show my closed tasks"
- "read my closed tasks"

### Filter by Priority
- "show my high priority tasks"
- "show my low priority tasks"
- "show my normal priority tasks"
- "show my urgent priority tasks"
- "show tasks high"
- "show tasks low"
- "show tasks normal"
- "read my high priority tasks"
- "read my low priority tasks"
- "read tasks high"
- "read tasks low"
- "read high priority tasks"
- "read urgent priority tasks"

### Filter by Category
- "read my work tasks"
- "read my personal tasks"
- "show my work tasks"
- "show my personal tasks"
- "show tasks work"
- "show tasks personal"
- "read tasks work"
- "read tasks personal"
- "read work tasks"
- "read personal tasks"
- "show my office tasks"
- "show my business tasks"
- "show my home tasks"

### Filter by Due Date
- "show tasks due today"
- "show tasks due tomorrow"
- "show my tasks due today"
- "show my tasks due tomorrow"
- "read my tasks today"
- "read my tasks tomorrow"
- "read my tasks next week"
- "show my tasks December 25th"
- "show my tasks on December 25th"
- "read my tasks December 25th"
- "read my tasks on December 25th"
- "what do I have for today"
- "what do I have for December 25th"
- "what do I have to do"
- "what do I have to do today"
- "what do I have to do December 25th"
- "show what I have to do"
- "show what I have to do today"
- "show what I have to do December 25th"
- "read what I have to do"
- "read what I have to do today"
- "read what I have to do December 25th"

### Filter by Overdue
- "show overdue tasks"
- "show done overdue tasks"
- "show to do overdue tasks"

### Combined Filters
- "show my high priority work tasks"
- "show my done tasks today"
- "read my personal tasks tomorrow"
- "show my closed tasks December 25th"

---

## ✏️ UPDATE TASK STATUS (UpdateTaskStatusIntent)

### Single Utterance (with task name)
- "complete buy milk"
- "mark as done buy milk"
- "mark as completed call mom"
- "complete finish the report"
- "mark as finished schedule appointment"

### Dialog Flow (Alexa will ask for task name)
- "mark a task as done"
- "update a task status to done"
- "set status to done"
- "complete a task"
- "mark a task as completed"
- "update a task status to completed"
- "set status to completed"

### Status Values
- "mark a task as to do"
- "mark a task as done"
- "mark a task as completed"
- "mark a task as finished"
- "mark a task as closed"
- "mark a task as pending"
- "mark a task as open"

---

## ⚡ UPDATE TASK PRIORITY (UpdateTaskPriorityIntent)

### Single Utterance (with priority only)
- "set task priority to high"
- "set task priority to low"
- "set task priority to normal"
- "change priority to high"
- "change priority to low"
- "make priority high"
- "make priority low"
- "set priority high"
- "set priority low"
- "set priority urgent"
- "set priority normal"

### Dialog Flow (Alexa will ask for task name and priority)
- "set task priority"
- "change priority"
- "update task priority"
- "make priority"
- "set priority"

**Expected Flow:**
1. User: "update task priority"
2. Alexa: "Which task do you mean?"
3. User: "buy milk"
4. Alexa: "What priority should I set? Low, normal, or high?"
5. User: "high"

### Priority Values
- "set task priority to high" → HIGH
- "set task priority to urgent" → HIGH
- "set task priority to important" → HIGH
- "set task priority to low" → LOW
- "set task priority to normal" → NORMAL
- "set task priority to medium" → NORMAL

---

## 📅 UPDATE DUE DATE (UpdateDueDateIntent)

### Dialog Flow (Alexa will ask for task name and date)
- "change the due date"
- "set due date"
- "update due date"
- "reschedule task"
- "change due date"
- "set task due date"
- "update task due date"

**Expected Flow:**
1. User: "change the due date"
2. Alexa: "Which task do you mean?"
3. User: "buy milk"
4. Alexa: "When is this task due?"
5. User: "December 23rd"

### Date Formats
- "December 25th"
- "December 25"
- "on December 25th"
- "for December 25th"
- "tomorrow"
- "today"
- "next week"
- "next Friday"
- "in 3 days"

---

## 🏷️ UPDATE TASK CATEGORY (UpdateTaskCategoryIntent)

### Single Utterance (with category only)
- "set task category to work"
- "set task category to personal"
- "move task to work"
- "move task to personal"

### Dialog Flow (Alexa will ask for task name and category)
- "set task category"
- "move task to a category"
- "make a task a category"
- "change task category"
- "update task category"

**Expected Flow:**
1. User: "set task category"
2. Alexa: "Which task do you mean?"
3. User: "buy milk"
4. Alexa: "Is this a personal or work task?"
5. User: "work"

### Category Values
- "set task category to work" → WORK
- "set task category to office" → WORK
- "set task category to business" → WORK
- "set task category to personal" → PERSONAL
- "set task category to home" → PERSONAL
- "set task category to private" → PERSONAL

---

## 🗑️ DELETE TASKS (DeleteTaskIntent)

### Single Utterance
- "delete buy milk"
- "remove call mom"
- "trash finish the report"
- "get rid of schedule appointment"
- "delete task buy milk"
- "remove task call mom"
- "cancel task finish the report"
- "delete the task buy milk"
- "remove the task call mom"

---

## 🔄 REORDER TASKS (ReorderTaskIntent)

### Dialog Flow (Alexa will ask for task name and position)
- "move a task"
- "reorder task"
- "put task at a position"
- "move task first"
- "move task second"
- "move task third"
- "move task top"
- "move task bottom"
- "move task before"
- "move task after"

**Expected Flow:**
1. User: "move a task"
2. Alexa: "Which task do you mean?"
3. User: "buy milk"
4. Alexa: "Where should I move the task in the list?"
5. User: "first"

### Position Values
- "first" → Move to first position
- "second" → Move to second position
- "third" → Move to third position
- "top" → Move to top
- "bottom" → Move to bottom
- "before" → Move before another task
- "after" → Move after another task

---

## 🧪 COMPREHENSIVE TEST SCENARIOS

### Scenario 1: Create and Query Work Tasks
1. "add finish work report"
2. "add call client work"
3. "show my work tasks"

### Scenario 2: Create and Query Personal Tasks
1. "add buy milk personal"
2. "add call mom personal"
3. "show my personal tasks"

### Scenario 3: Create Tasks with Due Dates and Query
1. "add buy milk tomorrow"
2. "add call mom today"
3. "show my tasks due today"
4. "show my tasks due tomorrow"
5. "what do I have for today"
6. "what do I have for tomorrow"

### Scenario 4: Create Tasks with Specific Dates
1. "add call dentist December 25th"
2. "add call dentist on December 25th"
3. "add call dentist for December 25th"
4. "show my tasks December 25th"
5. "show my tasks on December 25th"
6. "read my tasks December 25th"

### Scenario 5: Update Priority Flow
1. "add buy milk"
2. "set task priority"
3. Alexa: "Which task do you mean?"
4. "buy milk"
5. Alexa: "What priority should I set? Low, normal, or high?"
6. "high"

### Scenario 6: Update Due Date Flow
1. "add buy milk"
2. "change the due date"
3. Alexa: "Which task do you mean?"
4. "buy milk"
5. Alexa: "When is this task due?"
6. "December 23rd"

### Scenario 7: Update Category Flow
1. "add buy milk"
2. "set task category"
3. Alexa: "Which task do you mean?"
4. "buy milk"
5. Alexa: "Is this a personal or work task?"
6. "work"

### Scenario 8: Complete Task Flow
1. "add buy milk"
2. "complete buy milk"
3. "show my done tasks"
4. "show my completed tasks"
5. "show my closed tasks"

### Scenario 9: Filter by Status Variations
1. "add buy milk"
2. "add call mom"
3. "complete buy milk"
4. "show my to do tasks" → Should show "call mom"
5. "show my done tasks" → Should show "buy milk"
6. "show my completed tasks" → Should show "buy milk"
7. "show my closed tasks" → Should show "buy milk"
8. "show my finished tasks" → Should show "buy milk"

### Scenario 10: Filter by Priority Variations
1. "add buy milk high priority"
2. "add call mom low priority"
3. "add finish report normal priority"
4. "show my high priority tasks" → Should show "buy milk"
5. "show my urgent priority tasks" → Should show "buy milk"
6. "show my low priority tasks" → Should show "call mom"
7. "show my normal priority tasks" → Should show "finish report"

### Scenario 11: Filter by Category Variations
1. "add finish report work"
2. "add buy milk personal"
3. "add call client office"
4. "add water plants home"
5. "show my work tasks" → Should show "finish report", "call client"
6. "show my office tasks" → Should show "finish report", "call client"
7. "show my business tasks" → Should show "finish report", "call client"
8. "show my personal tasks" → Should show "buy milk", "water plants"
9. "show my home tasks" → Should show "buy milk", "water plants"

### Scenario 12: Date Filtering with Specific Dates
1. "add call dentist December 18th 2025"
2. "add call aunt December 20th 2025"
3. "add buy gifts December 25th"
4. "show my tasks December 18th" → Should show only "call dentist"
5. "show my tasks on December 18th 2025" → Should show only "call dentist"
6. "read my tasks December 20th" → Should show only "call aunt"
7. "read my tasks December 25th" → Should show only "buy gifts"

### Scenario 13: Combined Filters
1. "add finish report high priority work"
2. "add buy milk low priority personal"
3. "add call client urgent work"
4. "show my high priority work tasks" → Should show "finish report", "call client"
5. "show my done work tasks" → Should show only done work tasks
6. "read my personal tasks today" → Should show personal tasks due today

### Scenario 14: Overdue Tasks
1. "add overdue task yesterday"
2. "show overdue tasks" → Should show overdue tasks
3. "show done overdue tasks" → Should show done overdue tasks
4. "show to do overdue tasks" → Should show to do overdue tasks

---

## ⚠️ IMPORTANT NOTES

### Dialog Flow Behavior
When using commands without all required slots, Alexa will use dialog flow to elicit missing information:
- **UpdateTaskPriorityIntent**: Requires both `taskName` and `priority`
- **UpdateDueDateIntent**: Requires both `taskName` and `dueDateTime`
- **UpdateTaskCategoryIntent**: Requires both `taskName` and `category`
- **ReorderTaskIntent**: Requires both `taskName` and `position`

### Status Values
The following synonyms are recognized for status:
- **DONE**: "done", "completed", "complete", "finished", "closed", "closed tasks", "completed tasks", "done tasks"
- **TO DO**: "to do", "todo", "pending", "open", "incomplete", "tasks to do"

### Priority Values
The following synonyms are recognized for priority:
- **HIGH**: "high", "urgent", "important"
- **LOW**: "low", "lower"
- **NORMAL**: "normal", "medium", "med"

### Category Values
The following synonyms are recognized for categories:
- **WORK**: "work", "office", "business"
- **PERSONAL**: "personal", "home", "private"

### Date Parsing
The system recognizes English date expressions:
- "today"
- "tomorrow"
- "this week"
- "next week"
- "next Friday"
- "in 3 days"
- Specific dates like "December 25th", "December 25", "on December 25th", etc.
- Dates with times: "at 6 PM", "at 4 PM tomorrow", "at 9 PM on December 20th 2025"

### Adding Tasks with Specific Dates
**Examples:**
- "add call dentist December 25th"
- "add call dentist on December 25th"
- "add call dentist for December 25th"
- "create call dentist December 25th"
- "remind me to call dentist December 25th"
- "add buy gifts December 23rd"
- "add call dentist at 6 PM on December 25th"
- "add call grandma at 4 PM tomorrow"
- "add call dentist at 9 PM on December 20th 2025"

### Querying Tasks with Specific Dates
**Examples:**
- "show my tasks December 25th"
- "show my tasks on December 25th"
- "read my tasks December 25th"
- "read my tasks on December 25th"
- "what do I have for December 25th"
- "what do I have to do December 25th"
- "show what I have to do December 25th"
- "read what I have to do December 25th"

---

## ✅ VALIDATION CHECKLIST

Before testing, ensure:
- [ ] All intents are properly configured in Alexa Developer Console
- [ ] Dialog flow is enabled for update intents
- [ ] Status synonyms are properly set up (done, completed, finished, closed, to do, todo, pending)
- [ ] Priority synonyms are properly set up (high, urgent, low, normal, medium)
- [ ] Category synonyms are properly set up (work, office, business, personal, home, private)
- [ ] Date parsing handles English keywords correctly
- [ ] Task name extraction works with English phrases
- [ ] Status normalization handles "closed" and "finished" correctly
- [ ] Priority normalization handles "urgent" and "medium" correctly
- [ ] Category normalization handles "office", "business", "home", "private" correctly

---

## 📊 EXPECTED RESULTS

### Query Results
- "show my work tasks" → Should return only WORK category tasks
- "show my personal tasks" → Should return only PERSONAL category tasks
- "show my tasks due today" → Should return only tasks due today
- "show my tasks due tomorrow" → Should return only tasks due tomorrow
- "show my tasks December 25th" → Should return only tasks due on December 25th
- "show my closed tasks" → Should return only DONE status tasks
- "show my done tasks" → Should return only DONE status tasks
- "show my completed tasks" → Should return only DONE status tasks
- "show my finished tasks" → Should return only DONE status tasks
- "show my to do tasks" → Should return only TO DO status tasks
- "show my pending tasks" → Should return only TO DO status tasks
- "show my open tasks" → Should return only TO DO status tasks
- "show my high priority tasks" → Should return only HIGH priority tasks
- "show my urgent priority tasks" → Should return only HIGH priority tasks
- "show my low priority tasks" → Should return only LOW priority tasks
- "show my normal priority tasks" → Should return only NORMAL priority tasks
- "show my medium priority tasks" → Should return only NORMAL priority tasks

### Update Results
- Priority updates should confirm with: "I've updated [task name] with priority [priority]"
- Due date updates should confirm with: "I've updated [task name] with due date [date]"
- Category updates should confirm with: "I've updated [task name] with category [category]"
- Status updates should confirm with: "I've marked [task name] as [status]"

### Date Filtering Results
- "show my tasks December 18th" → Should return only tasks with due date exactly December 18th
- "show my tasks on December 18th 2025" → Should return only tasks with due date exactly December 18th 2025
- "what do I have for today" → Should return only tasks due today
- "what do I have for December 25th" → Should return only tasks due on December 25th

---

## 🔍 EDGE CASES TO TEST

### Date Edge Cases
- "show my tasks December 31st" (end of year)
- "show my tasks January 1st" (beginning of year)
- "show my tasks February 29th" (leap year)
- "add task December 32nd" (invalid date - should handle gracefully)
- "show my tasks yesterday" (past date)
- "show my tasks in 100 days" (far future)

### Status Edge Cases
- "show my closed tasks" → Should map to DONE
- "show my finished tasks" → Should map to DONE
- "show my completed tasks" → Should map to DONE
- "show my done tasks" → Should map to DONE
- "show my pending tasks" → Should map to TO DO
- "show my open tasks" → Should map to TO DO
- "show my incomplete tasks" → Should map to TO DO

### Priority Edge Cases
- "show my urgent priority tasks" → Should map to HIGH
- "show my important priority tasks" → Should map to HIGH
- "show my medium priority tasks" → Should map to NORMAL
- "show my med priority tasks" → Should map to NORMAL

### Category Edge Cases
- "show my office tasks" → Should map to WORK
- "show my business tasks" → Should map to WORK
- "show my home tasks" → Should map to PERSONAL
- "show my private tasks" → Should map to PERSONAL

### Combined Edge Cases
- "show my closed work tasks" → Should show DONE + WORK tasks
- "show my urgent personal tasks" → Should show HIGH + PERSONAL tasks
- "show my done tasks today" → Should show DONE + today's date tasks
- "read my high priority tasks December 25th" → Should show HIGH + December 25th tasks

---

## 📝 TESTING INSTRUCTIONS

1. **Test each intent individually** - Start with simple utterances and progress to complex ones
2. **Test dialog flows** - Verify that Alexa correctly elicits missing information
3. **Test synonyms** - Verify that all synonyms are recognized correctly
4. **Test date parsing** - Verify that various date formats are parsed correctly
5. **Test filters** - Verify that filters work correctly individually and in combination
6. **Test edge cases** - Verify that edge cases are handled gracefully
7. **Test error handling** - Verify that errors are handled appropriately

---

## 🎯 PRIORITY TEST CASES

These are the most critical test cases that should be tested first:

1. ✅ "add buy milk" → Should create task with default values
2. ✅ "show my tasks" → Should return all tasks
3. ✅ "show my done tasks" → Should return only DONE tasks
4. ✅ "show my closed tasks" → Should return only DONE tasks (synonym test)
5. ✅ "show my work tasks" → Should return only WORK tasks
6. ✅ "show my tasks December 25th" → Should return only tasks due on December 25th
7. ✅ "complete buy milk" → Should mark task as DONE
8. ✅ "set task priority to high" → Should update priority to HIGH
9. ✅ "set task category to work" → Should update category to WORK
10. ✅ "delete buy milk" → Should delete the task

---
