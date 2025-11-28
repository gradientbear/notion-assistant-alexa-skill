# Alexa Skill Test Sentences

This document contains comprehensive test sentences for testing the Notion Data Alexa Skill. Use these sentences to verify all CRUD operations and features work correctly.

## Table of Contents
- [CREATE (Add Tasks)](#create-add-tasks)
- [READ (List/Query Tasks)](#read-listquery-tasks)
- [UPDATE (Mark Complete / Update Status)](#update-mark-complete--update-status)
- [DELETE (Remove Tasks)](#delete-remove-tasks)
- [Brain Dump (Multiple Tasks)](#brain-dump-multiple-tasks)
- [Edge Cases & Error Handling](#edge-cases--error-handling)

---

## CREATE (Add Tasks)

### Basic Task Addition
- "Alexa, add finish the report"
- "Alexa, add call mom"
- "Alexa, add buy groceries"
- "Alexa, add schedule dentist appointment"
- "Alexa, add prepare presentation for meeting"
- "Alexa, add review project proposal"

### With Reminder Phrase
- "Alexa, remind me to finish the report"
- "Alexa, remind me call the dentist"
- "Alexa, remind me buy milk"
- "Alexa, remind me schedule team meeting"

### Task with Context
- "Alexa, add finish the quarterly report"
- "Alexa, add call mom about weekend plans"
- "Alexa, add buy groceries for dinner party"
- "Alexa, add review code changes for pull request"

---

## READ (List/Query Tasks)

### List All Tasks
- "Alexa, what are my tasks"
- "Alexa, list my tasks"
- "Alexa, read my tasks"
- "Alexa, show my tasks"
- "Alexa, what tasks do I have"

### Filtered Queries

#### High Priority
- "Alexa, what are my high priority tasks"
- "Alexa, show high priority tasks"
- "Alexa, what's high priority"

#### To-Do List
- "Alexa, what's on my to-do list"
- "Alexa, read my to-do list"
- "Alexa, my to-do list"

#### Pending Tasks
- "Alexa, what are my pending tasks"
- "Alexa, show pending tasks"
- "Alexa, what's pending"

#### Work Tasks
- "Alexa, what are my work tasks"
- "Alexa, read work tasks"
- "Alexa, work tasks"

#### Personal Reminders
- "Alexa, tell me my personal reminders"
- "Alexa, personal tasks"
- "Alexa, what are my personal reminders"

#### Overdue Tasks
- "Alexa, what's overdue"
- "Alexa, show overdue tasks"
- "Alexa, what tasks are overdue"

#### Tasks Due Tomorrow
- "Alexa, what's due tomorrow"
- "Alexa, tomorrow's tasks"
- "Alexa, what do I have tomorrow"
- "Alexa, tasks due tomorrow"

#### Tasks Due This Week
- "Alexa, what's due this week"
- "Alexa, this week's tasks"
- "Alexa, tasks due this week"
- "Alexa, what do I have this week"

#### In Progress Tasks
- "Alexa, what am I working on"
- "Alexa, in progress tasks"
- "Alexa, what's in progress"
- "Alexa, what tasks are in progress"

#### Completed Tasks
- "Alexa, what have I completed"
- "Alexa, completed tasks"
- "Alexa, what's done"
- "Alexa, what tasks have I completed"

---

## UPDATE (Mark Complete / Update Status)

### Mark as Complete

#### Simple Phrases
- "Alexa, mark finish report as done"
- "Alexa, mark finish the report as complete"
- "Alexa, complete finish report"
- "Alexa, finish report is done"
- "Alexa, done with finish report"
- "Alexa, finish report done"

#### Variations
- "Alexa, mark the report as done"
- "Alexa, mark my report task as complete"
- "Alexa, mark finish report as finished"
- "Alexa, mark finish report as completed"

#### Partial Task Names (Fuzzy Matching)
- "Alexa, mark report as done" (should match "finish the report")
- "Alexa, mark finish as done" (should match "finish the report")
- "Alexa, complete report" (should match "finish the report")

### Batch Complete
- "Alexa, mark all today's tasks as done"
- "Alexa, complete all today's tasks"
- "Alexa, mark all today tasks as complete"

### Update Status to In Progress
- "Alexa, set finish report to in progress"
- "Alexa, move finish report to in progress"
- "Alexa, start finish report"
- "Alexa, begin finish report"
- "Alexa, set the report to in progress"
- "Alexa, move the report to in progress"

#### Partial Task Names
- "Alexa, set report to in progress" (should match "finish the report")
- "Alexa, start report" (should match "finish the report")

---

## DELETE (Remove Tasks)

### Single Task Deletion
- "Alexa, delete finish report"
- "Alexa, remove finish report"
- "Alexa, delete the report task"
- "Alexa, remove the report"
- "Alexa, delete my report task"

#### Partial Task Names
- "Alexa, delete report" (should match "finish the report")
- "Alexa, remove finish" (should match "finish the report")

### Batch Delete
- "Alexa, delete completed tasks"
- "Alexa, remove completed tasks"
- "Alexa, delete all completed tasks"
- "Alexa, remove all completed tasks"
- "Alexa, delete done tasks"

---

## Brain Dump (Multiple Tasks)

### Starting Brain Dump
- "Alexa, dump my brain"
- "Alexa, brain dump"
- "Alexa, capture my thoughts"
- "Alexa, I need to remember"
- "Alexa, add tasks"

### During Brain Dump Session
After starting, say tasks one by one:
- "buy groceries"
- "call mom"
- "finish report"
- "schedule meeting"
- "review code"

### Ending Brain Dump
- "done"
- "finished"
- "that's all"
- "complete"
- "nothing"

### Complete Brain Dump Flow Example
1. User: "Alexa, dump my brain"
2. Alexa: "I'm ready to capture your thoughts. What tasks would you like to add?"
3. User: "buy groceries"
4. Alexa: "Got it. Added 'buy groceries' to your Notion database. What else?"
5. User: "call mom"
6. Alexa: "Got it. Added 'call mom' to your Notion database. What else?"
7. User: "finish report"
8. Alexa: "Got it. Added 'finish report' to your Notion database. What else?"
9. User: "done"
10. Alexa: "Great! I've saved all your tasks. You had 3 tasks in total."

---

## Edge Cases & Error Handling

### Empty/No Tasks
- "Alexa, what are my tasks" (when no tasks exist)
- "Alexa, list my tasks" (when no tasks exist)

### Task Not Found
- "Alexa, mark nonexistent task as done"
- "Alexa, delete task that doesn't exist"
- "Alexa, set fake task to in progress"

### Ambiguous Task Names
- "Alexa, mark report as done" (when multiple tasks contain "report")
- "Alexa, delete meeting" (when multiple tasks contain "meeting")

### Very Long Task Names
- "Alexa, add prepare comprehensive quarterly business review presentation for the board meeting next Friday"

### Special Characters in Task Names
- "Alexa, add review PR #123"
- "Alexa, add call John (urgent)"
- "Alexa, add meeting @ 3pm"

### Multiple Tasks in One Sentence
- "Alexa, add buy milk and bread"
- "Alexa, add call mom and schedule dentist"

### Commands with Extra Words
- "Alexa, mark finish the report as done" (should clean to "finish the report")
- "Alexa, mark my finish report task as complete" (should clean to "finish report")
- "Alexa, delete the finish report task" (should clean to "finish report")

---

## Test Scenarios

### Scenario 1: Complete CRUD Workflow
1. **Create**: "Alexa, add finish quarterly report"
2. **Read**: "Alexa, what are my tasks" (verify task appears)
3. **Update**: "Alexa, set finish quarterly report to in progress"
4. **Read**: "Alexa, what am I working on" (verify status changed)
5. **Update**: "Alexa, mark finish quarterly report as done"
6. **Read**: "Alexa, what have I completed" (verify completion)
7. **Delete**: "Alexa, delete finish quarterly report"
8. **Read**: "Alexa, what are my tasks" (verify task removed)

### Scenario 2: Fuzzy Matching Test
1. **Create**: "Alexa, add finish the comprehensive quarterly business review report"
2. **Update**: "Alexa, mark report as done" (should match the long task name)
3. **Delete**: "Alexa, remove finish" (should match the task)

### Scenario 3: Brain Dump Workflow
1. **Start**: "Alexa, dump my brain"
2. **Add Multiple**: Say 5-10 tasks one by one
3. **End**: "done"
4. **Verify**: "Alexa, list my tasks" (verify all tasks were added)

### Scenario 4: Batch Operations
1. **Create Multiple**: Add several tasks
2. **Batch Complete**: "Alexa, mark all today's tasks as done"
3. **Batch Delete**: "Alexa, delete completed tasks"
4. **Verify**: "Alexa, what are my tasks" (should be empty or have remaining tasks)

### Scenario 5: Error Recovery
1. **Invalid Command**: "Alexa, mark nonexistent task as done"
2. **Verify Error Message**: Should get helpful error message
3. **Retry with Valid**: "Alexa, mark finish report as done" (if task exists)
4. **Verify Success**: Should work correctly

---

## Testing Checklist

### ✅ CREATE Operations
- [ ] Basic task addition works
- [ ] Reminder phrase works
- [ ] Long task names work
- [ ] Tasks with special characters work
- [ ] Multiple tasks in one sentence work
- [ ] "Add" prefix is removed from brain dump tasks

### ✅ READ Operations
- [ ] List all tasks works
- [ ] High priority filter works
- [ ] To-do list filter works
- [ ] Pending tasks filter works
- [ ] Work tasks filter works
- [ ] Personal reminders filter works
- [ ] Overdue tasks filter works
- [ ] Tomorrow's tasks filter works
- [ ] This week's tasks filter works
- [ ] In progress tasks filter works
- [ ] Completed tasks filter works
- [ ] Empty list handling works

### ✅ UPDATE Operations
- [ ] Mark single task as done works
- [ ] Mark with partial name works (fuzzy matching)
- [ ] Command word cleaning works ("mark ... as done" → task name)
- [ ] Batch mark all today's tasks works
- [ ] Set task to in progress works
- [ ] Update with partial name works

### ✅ DELETE Operations
- [ ] Delete single task works
- [ ] Delete with partial name works (fuzzy matching)
- [ ] Command word cleaning works ("delete ..." → task name)
- [ ] Batch delete completed tasks works
- [ ] Delete non-existent task shows error

### ✅ Brain Dump
- [ ] Starting brain dump works
- [ ] Adding multiple tasks works
- [ ] Each task is saved immediately
- [ ] Ending with "done" works
- [ ] Session persists across multiple turns
- [ ] Tasks are saved even if session ends early

### ✅ Error Handling
- [ ] Missing Notion connection shows helpful message
- [ ] Task not found shows helpful message
- [ ] Invalid commands show helpful message
- [ ] Empty responses are handled gracefully

---

## Notes

- **Fuzzy Matching**: The skill uses fuzzy matching, so partial task names should work (e.g., "report" matches "finish the report")
- **Command Word Cleaning**: Command words like "mark", "delete", "as done" are automatically removed from task names
- **Session Persistence**: Brain dump sessions persist across multiple turns until "done" is said
- **Immediate Saving**: Tasks in brain dump are saved immediately to prevent data loss if session ends

---

## Quick Test Commands

For quick testing, use these minimal commands:

```bash
# Create
"Alexa, add test task"

# Read
"Alexa, list my tasks"

# Update
"Alexa, mark test task as done"

# Delete
"Alexa, delete test task"
```

---

*Last Updated: 2025-11-27*

