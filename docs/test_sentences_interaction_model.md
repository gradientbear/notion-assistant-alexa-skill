# Test Sentences for Alexa Interaction Model

This document provides test sentences organized by intent, directly mapped to the interaction model defined in `alexa-interaction-model.json`.

**Invocation Name**: "voice planner"

---

## 🚀 Launch Request

### Test Sentences
- "Alexa, open voice planner"
- "Alexa, launch voice planner"
- "Alexa, start voice planner"
- "Alexa, talk to voice planner"

---

## ➕ CreateTaskIntent

### Basic Test Sentences
- "add buy milk"
- "add pick up dry cleaning"
- "create a task call Sarah"
- "remind me to water the plants"
- "add schedule dentist appointment"
- "add take out the trash"

### With Date/Time
- "add buy milk tomorrow"
- "add pay rent next week"
- "add finish report today"
- "create a task call mom tomorrow"
- "remind me to check email today"
- "add prepare presentation next week"

### With Priority
- "add high priority task submit report"
- "add low priority task organize files"
- "create a task normal priority call bank"
- "remind me to high priority finish taxes"

### With Category
- "add work task prepare presentation"
- "add personal task buy groceries"
- "create a task work finish report"
- "remind me to personal call mom"

### With Multiple Attributes
- "add high priority work task finish report tomorrow"
- "add low priority personal task buy groceries today"
- "create a task normal priority work call client next week"

### Natural Language Variations
- "uh add buy milk"
- "hey remind me to call Sarah"
- "I need to add finish the project"

---

## 📖 ReadTasksIntent

### Basic Test Sentences
- "show my tasks"
- "read my tasks"
- "show my tasks"
- "read my tasks"

### With Status Filter
- "show my TO DO tasks"
- "show my IN PROCESS tasks"
- "show my DONE tasks"
- "read my TO DO tasks"
- "read my IN PROCESS tasks"
- "read my DONE tasks"

### With Priority Filter
- "show my HIGH priority tasks"
- "show my NORMAL priority tasks"
- "show my LOW priority tasks"
- "read my HIGH priority tasks"
- "read my NORMAL priority tasks"
- "read my LOW priority tasks"

### With Category Filter
- "show my WORK tasks"
- "show my PERSONAL tasks"
- "read my WORK tasks"
- "read my PERSONAL tasks"

### With Due Date Filter
- "show tasks due today"
- "show tasks due tomorrow"
- "show tasks due next week"
- "read tasks due today"
- "read tasks due tomorrow"
- "read tasks due next week"

### Combined Filters
- "show my TO DO WORK tasks"
- "show my HIGH priority tasks due today"
- "read my PERSONAL tasks due tomorrow"

---

## ✅ UpdateTaskStatusIntent

### Test Sentences
- "mark a task as DONE"
- "mark a task as IN PROCESS"
- "mark a task as TO DO"
- "update a task status to DONE"
- "update a task status to IN PROCESS"
- "update a task status to TO DO"
- "set status to DONE"
- "set status to IN PROCESS"
- "set status to TO DO"
- "complete a task"

### With Task Name (Dialog Flow)
- "mark buy milk as DONE"
- "set call Sarah status to IN PROCESS"
- "update finish report status to TO DO"

---

## ⚡ UpdateTaskPriorityIntent

### Test Sentences
- "set task priority to HIGH"
- "set task priority to NORMAL"
- "set task priority to LOW"
- "change priority to HIGH"
- "change priority to NORMAL"
- "change priority to LOW"
- "make priority HIGH"
- "make priority NORMAL"
- "make priority LOW"
- "update task priority"

### With Task Name (Dialog Flow)
- "set finish report priority to HIGH"
- "change buy groceries priority to LOW"
- "make call mom priority NORMAL"

---

## 📅 UpdateDueDateIntent

### Test Sentences
- "change the due date"
- "set due date"
- "update due date"
- "reschedule task"

### With Task Name and Date (Dialog Flow)
- "change buy milk due date to tomorrow"
- "set finish report due date to next week"
- "update call Sarah due date to today"
- "reschedule dentist appointment to Friday"

---

## 📁 UpdateTaskCategoryIntent

### Test Sentences
- "set task category"
- "move task to a category"
- "make a task a category"
- "change task category"

### With Task Name and Category (Dialog Flow)
- "set finish report category to WORK"
- "move buy groceries to PERSONAL category"
- "change call mom category to PERSONAL"
- "make prepare presentation a WORK category"

---

## 🗑️ DeleteTaskIntent

### Test Sentences
- "delete buy milk"
- "delete finish report"
- "delete call Sarah"
- "remove buy groceries"
- "remove finish presentation"
- "trash dentist appointment"
- "trash organize files"
- "get rid of buy milk"
- "get rid of finish report"

### Natural Language Variations
- "delete the task buy milk"
- "remove the task finish report"
- "delete that task about calling Sarah"

---

## 🔄 ReorderTaskIntent

### Test Sentences
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

### With Task Name (Dialog Flow)
- "move buy milk first"
- "reorder finish report to second"
- "put call Sarah at top"
- "move prepare presentation to bottom"

---

## ❓ AMAZON.HelpIntent

### Test Sentences
- "help"
- "what can you do"
- "how do I use this"
- "what commands are available"

---

## 🛑 AMAZON.StopIntent / AMAZON.CancelIntent

### Test Sentences
- "stop"
- "cancel"
- "exit"
- "never mind"
- "that's all"

---

## 🔀 AMAZON.FallbackIntent

### Test Sentences (Should trigger fallback)
- "what's the weather"
- "play music"
- "tell me a joke"
- "what time is it"
- Any utterance that doesn't match other intents

---

## 📋 Test Scenarios by Intent

### CreateTaskIntent - Dialog Flow Test
1. User: "add task"
   - Alexa: "Which task do you mean?"
2. User: "buy milk"
   - Alexa: "What priority should I set? Low, normal, or high?"
3. User: "normal"
   - Alexa: "When is this task due?"
4. User: "tomorrow"
   - Alexa: "Is this a personal or work task?"
5. User: "personal"
   - Task created successfully

### UpdateTaskStatusIntent - Dialog Flow Test
1. User: "mark a task as done"
   - Alexa: "Which task do you mean?"
2. User: "buy milk"
   - Alexa: "What status should I set?"
3. User: "done"
   - Task status updated

### UpdateTaskPriorityIntent - Dialog Flow Test
1. User: "update task priority"
   - Alexa: "Which task do you mean?"
2. User: "finish report"
   - Alexa: "What priority should I set? Low, normal, or high?"
3. User: "high"
   - Task priority updated

### UpdateDueDateIntent - Dialog Flow Test
1. User: "change the due date"
   - Alexa: "Which task do you mean?"
2. User: "buy milk"
   - Alexa: "When is this task due?"
3. User: "next week"
   - Due date updated

### UpdateTaskCategoryIntent - Dialog Flow Test
1. User: "change task category"
   - Alexa: "Which task do you mean?"
2. User: "finish report"
   - Alexa: "Is this a personal or work task?"
3. User: "work"
   - Category updated

### DeleteTaskIntent - Dialog Flow Test
1. User: "delete task"
   - Alexa: "Which task do you mean?"
2. User: "buy milk"
   - Task deleted

### ReorderTaskIntent - Dialog Flow Test
1. User: "move a task"
   - Alexa: "Which task do you mean?"
2. User: "finish report"
   - Alexa: "Where should I move the task in the list?"
3. User: "first"
   - Task reordered

---

## 🎯 Quick Test Checklist

### CreateTaskIntent
- [ ] Basic: "add buy milk"
- [ ] With date: "add buy milk tomorrow"
- [ ] With priority: "add high priority task finish report"
- [ ] With category: "add work task prepare presentation"
- [ ] Dialog flow (all slots elicited)

### ReadTasksIntent
- [ ] Basic: "show my tasks"
- [ ] With status: "show my TO DO tasks"
- [ ] With priority: "show my HIGH priority tasks"
- [ ] With category: "show my WORK tasks"
- [ ] With due date: "show tasks due tomorrow"

### UpdateTaskStatusIntent
- [ ] Basic: "mark a task as DONE"
- [ ] Dialog flow: Task name + status elicited

### UpdateTaskPriorityIntent
- [ ] Basic: "set task priority to HIGH"
- [ ] Dialog flow: Task name + priority elicited

### UpdateDueDateIntent
- [ ] Basic: "change the due date"
- [ ] Dialog flow: Task name + due date elicited

### UpdateTaskCategoryIntent
- [ ] Basic: "change task category"
- [ ] Dialog flow: Task name + category elicited

### DeleteTaskIntent
- [ ] Basic: "delete buy milk"
- [ ] Variations: "remove", "trash", "get rid of"
- [ ] Dialog flow: Task name elicited

### ReorderTaskIntent
- [ ] Basic: "move a task"
- [ ] With position: "move task first"
- [ ] Dialog flow: Task name + position elicited

### Amazon Built-in Intents
- [ ] Help: "help"
- [ ] Stop: "stop"
- [ ] Cancel: "cancel"
- [ ] Fallback: Unmatched utterance

---

## 📝 Notes

1. **Dialog Flow**: All update/delete/reorder intents use dialog management, so incomplete utterances will trigger slot elicitation prompts.

2. **Slot Values**:
   - PRIORITY: LOW, NORMAL, HIGH
   - STATUS: TO DO, IN PROCESS, DONE
   - CATEGORY: PERSONAL, WORK
   - POSITION: first, second, third, top, bottom, before, after

3. **SearchQuery Slots**: `taskName`, `dueDateTime`, and `notes` use `AMAZON.SearchQuery` type, allowing flexible natural language input.

4. **Required vs Optional**: 
   - Most slots are `elicitationRequired: true` except `notes` in CreateTaskIntent
   - All slots have `confirmationRequired: false`

5. **Testing Tips**:
   - Test both complete utterances (all slots filled) and dialog flows (slots elicited)
   - Test with various natural language phrasings
   - Test edge cases like empty task lists, non-existent tasks, etc.

