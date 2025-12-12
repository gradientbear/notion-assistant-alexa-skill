# Comprehensive Test Sentences & User Guide Templates

## Overview
This document provides comprehensive test sentences for all skill functions and reusable sentence templates for the user guide.

**Invocation Name**: "voice planner"

---

## 🚀 LAUNCH REQUEST

### Test Sentences
- "Alexa, open voice planner"
- "Alexa, launch voice planner"
- "Alexa, start voice planner"
- "Alexa, talk to voice planner"

### Expected Behavior
- Returns welcome message
- Prompts for Notion connection if not connected
- Prompts for account linking if not linked

---

## ➕ ADD TASK

### Test Sentences

#### Basic Add
- "add buy milk"
- "add pick up dry cleaning"
- "create a task to call Sarah"
- "add take out the trash"
- "add schedule dentist appointment"
- "remind me to water the plants"
- "set a reminder to check the oven"

#### Add with Date/Time
- "add pay rent next Tuesday"
- "add pick up dry cleaning tomorrow"
- "create a task to send the invoice at 4 pm"
- "add book flight in two weeks"
- "schedule gym session for tomorrow morning"
- "add prepare report due Friday afternoon"
- "create call mom Sunday evening"
- "add revise homework before next Monday"
- "add finish the code review after lunch"
- "set a reminder to check the oven in 20 minutes"

#### Add with Category
- "add finish presentation to my work list"
- "add buy groceries to my personal list"
- "create work task prepare quarterly report"
- "add personal task organize garage"

#### Add with Priority
- "add urgent task submit tax forms today"
- "add high priority update project timeline"
- "add low priority task organize files"

#### Add with Multiple Attributes
- "add high priority work task finish report tomorrow at 3 pm"
- "add urgent personal task call doctor next Monday morning"
- "create task buy groceries tomorrow afternoon low priority"

#### Natural Language
- "hey remind me to get a birthday gift for John"
- "uh add feed the dog at 7"
- "I need to remember to email the bank tomorrow morning"

### Sentence Templates for User Guide

**Basic Format:**
```
[Command] [task description]
```

**With Date/Time:**
```
[Command] [task description] [date/time]
```

**With Category:**
```
[Command] [task description] to my [work/personal] list
[Command] [work/personal] task [task description]
```

**With Priority:**
```
[Command] [urgent/high priority/low priority] [task description]
[Command] [task description] [priority level]
```

**Commands:**
- `add`
- `add task`
- `add a task`
- `create`
- `create a task`
- `remind me to`
- `set a reminder to`
- `schedule`

**Date/Time Examples:**
- `today`, `tomorrow`, `next week`, `next Monday`
- `at 3 pm`, `at 4:30 pm`, `in the morning`, `in the afternoon`, `in the evening`
- `before noon`, `after lunch`, `by Friday`

**Category Keywords:**
- `work`, `personal`

**Priority Keywords:**
- `urgent`, `high priority`, `low priority`, `normal priority`

---

## ✏️ UPDATE TASK

### Test Sentences

#### Rename Task
- "rename buy milk to buy almond milk"
- "change task call mom to call mom and dad"
- "change fix sink to repair kitchen sink"
- "update the task: rename buy gift to buy birthday gift for Sarah"
- "update the task: change fix sink to fix bathroom sink"
- "update the task: rename clean garage to organize garage"

#### Reschedule (Date/Time)
- "move dentist appointment to next Friday"
- "reschedule pay rent to tomorrow morning"
- "change meeting with Steve to 4 pm"
- "set house cleaning for Saturday at 2 pm"
- "move morning workout to next Monday at 6 am"
- "update the task: move the dentist appointment to later in the afternoon"
- "update the task: reschedule pay rent to Monday instead of Tuesday"
- "update the task: shift the project meeting to next week"
- "update the task: move call with mom to tomorrow evening"
- "update the task: change planning meeting to Friday at 3 PM"
- "update the task: shift doctor checkup from next Friday to the following Monday"

#### Change Status
- "mark buy milk as in process"
- "set email bank to done"
- "set laundry task to to do"
- "update the task: mark clean the kitchen as done"
- "update the task: set call the bank to in process"
- "update the task: mark laundry as to do again"

#### Change Category
- "move presentation draft to work category"
- "set grocery shopping to personal category"
- "update the task: move prepare presentation to work category"
- "update the task: put buy groceries in personal category"

#### Complex Multi-Part Updates
- "update finish taxes move it to Tuesday afternoon and mark it as in process"
- "change call with doctor move it to tomorrow at noon"
- "reschedule submit report from Friday to Monday morning"
- "update the task: move finish taxes to Tuesday afternoon and mark it as in process"

#### Natural Language
- "update the task: move my— uh— move my car maintenance to next Wednesday morning"
- "update the task: reschedule the appointment, actually put it on Thursday instead"

### Sentence Templates for User Guide

**Rename:**
```
rename [task name] to [new task name]
change [task name] to [new task name]
update the task: rename [task name] to [new task name]
```

**Reschedule:**
```
move [task name] to [new date/time]
reschedule [task name] to [new date/time]
change [task name] to [new date/time]
update the task: move [task name] to [new date/time]
```

**Change Status:**
```
mark [task name] as [done/in process/to do]
set [task name] to [done/in process/to do]
update the task: mark [task name] as [done/in process/to do]
```

**Change Category:**
```
move [task name] to [work/personal] category
set [task name] to [work/personal] category
update the task: move [task name] to [work/personal] category
```

**Commands:**
- `update`
- `update the task`
- `change`
- `modify`
- `move`
- `set`
- `reschedule`
- `rename`

**Status Values:**
- `done`, `complete`, `finished`
- `in process`, `in progress`, `working on`
- `to do`, `todo`, `incomplete`

**Category Values:**
- `work`, `personal`

---

## 🗑️ DELETE TASK

### Test Sentences

#### Delete by Name
- "delete buy milk"
- "remove dentist appointment"
- "erase task call John"
- "delete the task: return the library books"
- "delete the task: call Chris about the job"
- "delete the task: update insurance details"
- "delete the tasks: get rid of that reminder about the leaky faucet"
- "delete the tasks: remove that task about cleaning the fridge"

#### Delete by Status
- "delete all completed tasks"
- "clear all done tasks"
- "remove in process tasks"
- "delete the tasks: everything I completed today"
- "clear to do tasks"

#### Delete by Time
- "delete tasks due today"
- "remove overdue tasks"
- "clear tasks due tomorrow"
- "delete the tasks: all overdue tasks"
- "delete the tasks: all tasks scheduled before noon"

#### Delete by Category
- "delete work tasks"
- "remove personal tasks"
- "delete the tasks: all tasks in personal category"
- "clear all work tasks"

#### Bulk Delete All
- "delete everything"
- "clear entire list"
- "remove all tasks"
- "delete the tasks: clear my whole list"
- "delete the tasks: wipe out all tasks"
- "delete the tasks: remove everything on my to-do list"

### Sentence Templates for User Guide

**Delete by Name:**
```
delete [task name]
remove [task name]
erase [task name]
delete the task: [task name]
```

**Delete by Status:**
```
delete all [completed/done/in process/to do] tasks
clear all [completed/done/in process/to do] tasks
remove [completed/done/in process/to do] tasks
delete the tasks: all [completed/done/in process/to do] tasks
```

**Delete by Time:**
```
delete tasks due [today/tomorrow/date]
remove overdue tasks
clear tasks due [today/tomorrow/date]
delete the tasks: all tasks [due today/scheduled before noon/overdue]
```

**Delete by Category:**
```
delete [work/personal] tasks
remove [work/personal] tasks
delete the tasks: all tasks in [work/personal] category
```

**Delete All:**
```
delete everything
clear entire list
remove all tasks
delete the tasks: clear my whole list
delete the tasks: wipe out all tasks
```

**Commands:**
- `delete`
- `delete the task`
- `delete the tasks`
- `remove`
- `clear`
- `erase`
- `trash`

**Status Keywords:**
- `completed`, `done`, `finished`
- `in process`, `in progress`
- `to do`, `todo`, `incomplete`

**Time Keywords:**
- `due today`, `due tomorrow`, `overdue`
- `scheduled before [time]`, `scheduled after [time]`

**Category Keywords:**
- `work`, `personal`

---

## 🔍 QUERY TASKS

### Test Sentences

#### General Queries
- "what's on my todo list"
- "read my tasks"
- "what do I need to do"
- "show all tasks"
- "list my tasks"
- "what are my tasks"
- "show my tasks: what's left on my list right now"

#### Time-Based Queries
- "what do I need to do today"
- "what are my tasks for tomorrow"
- "what tasks are due next week"
- "show tasks due after 5 pm"
- "what's scheduled for Sunday morning"
- "what's overdue"
- "what do I have this afternoon"
- "show my tasks: what do I have coming up this morning"
- "show my tasks: what's on my list for the weekend"
- "show my tasks: what do I need to do later today"
- "show my tasks: anything due before tomorrow afternoon"
- "show my tasks: what's scheduled after 8 PM"
- "show my tasks: what's on my calendar for next week"
- "show my tasks: anything overdue from yesterday"

#### Status-Based Queries
- "what tasks are incomplete"
- "show done tasks"
- "what did I finish today"
- "what is in process"
- "show my tasks: what's not done yet"
- "show my tasks: everything marked in process"
- "show my tasks: what I already completed today"

#### Category-Based Queries
- "show my work tasks"
- "read my personal reminders"
- "show my tasks: all personal tasks for today"
- "show my tasks: all work tasks due this week"

#### Priority-Based Queries
- "what are my high priority tasks"
- "show urgent tasks"
- "what low priority tasks do I have"

#### Keyword Search
- "do I have anything about groceries"
- "show tasks related to the bank"
- "is there anything about cleaning"
- "what tasks mention birthday"
- "show my tasks: anything related to groceries"
- "show my tasks: tasks about bills or payments"
- "show my tasks: reminders that mention travel"
- "show my tasks: anything with the word cleaning"

#### Mixed Queries
- "what incomplete tasks do I have for tomorrow"
- "show personal tasks due today"
- "what work tasks are overdue"
- "list my tasks after noon that are not done"
- "show my tasks: incomplete tasks for tomorrow morning"
- "show my tasks: personal tasks that are overdue"
- "show my tasks: tasks for today that are not done"
- "show my tasks: work tasks scheduled after lunch"
- "show my tasks: tasks due this evening that are still incomplete"

#### Natural, Vague Queries
- "what do I need to focus on today"
- "what have I already taken care of"
- "what's left on my list right now"
- "show my tasks: what do I need to focus on today"
- "show my tasks: what have I already taken care of"

#### Long, Realistic Phrases
- "remind me what's coming up right after lunch"
- "what do I have scheduled before I leave the house today"
- "what's the first thing I need to finish this week"
- "show my tasks: remind me what's coming up right after lunch"
- "show my tasks: what do I have scheduled before I leave the house today"
- "show my tasks: what's the first thing I need to finish this week"

### Sentence Templates for User Guide

**General:**
```
what's on my todo list
read my tasks
what do I need to do
show all tasks
list my tasks
show my tasks: [query]
```

**Time-Based:**
```
what do I need to do [today/tomorrow/this week/next week]
what are my tasks for [date/time]
what tasks are due [date/time]
show tasks due [after/before] [time]
what's scheduled for [date/time]
what's overdue
show my tasks: [time-based query]
```

**Status-Based:**
```
what tasks are [incomplete/done/in process]
show [done/incomplete/in process] tasks
what did I finish [today]
show my tasks: what's [not done yet/marked in process/completed]
```

**Category-Based:**
```
show my [work/personal] tasks
read my [work/personal] reminders
show my tasks: all [work/personal] tasks [for today/due this week]
```

**Priority-Based:**
```
what are my [high/low] priority tasks
show [urgent/high priority] tasks
```

**Keyword Search:**
```
do I have anything about [keyword]
show tasks related to [keyword]
is there anything about [keyword]
what tasks mention [keyword]
show my tasks: anything related to [keyword]
```

**Mixed Queries:**
```
[status] tasks for [date/time]
[category] tasks [due today/that are overdue]
tasks for [date/time] that are [not done]
[category] tasks scheduled [after/before] [time]
show my tasks: [mixed query]
```

**Commands:**
- `what do I have`
- `what are my tasks`
- `show me`
- `show my tasks`
- `read my`
- `list`
- `tell me`
- `check`

**Time Keywords:**
- `today`, `tomorrow`, `this week`, `next week`, `this morning`, `this afternoon`, `this evening`
- `overdue`, `due today`, `due tomorrow`
- `after [time]`, `before [time]`, `scheduled for [date/time]`

**Status Keywords:**
- `incomplete`, `not done`, `done`, `completed`, `finished`
- `in process`, `in progress`

**Category Keywords:**
- `work`, `personal`

**Priority Keywords:**
- `high priority`, `urgent`, `low priority`

---

## ❓ HELP & NAVIGATION

### Test Sentences
- "help"
- "what can you do"
- "how do I use this skill"
- "what commands are available"
- "stop"
- "cancel"
- "exit"

### Expected Behavior
- Help: Returns list of available commands and examples
- Stop/Cancel: Ends session with goodbye message

---

## 📋 Quick Reference Card

### Add Task
```
add [task] [date/time] [priority] [category]
```

### Update Task
```
update [task name] [new value]
change [task name] to [new value]
move [task name] to [new date/time]
mark [task name] as [status]
```

### Delete Task
```
delete [task name]
delete all [status/category/time] tasks
delete everything
```

### Query Tasks
```
what are my tasks [for today/by status/by category]
show my [work/personal] tasks
do I have anything about [keyword]
```

---

## 🎯 Testing Checklist

### ✅ Add Task
- [ ] Basic add without attributes
- [ ] Add with date/time
- [ ] Add with category
- [ ] Add with priority
- [ ] Add with multiple attributes
- [ ] Natural language phrasing

### ✅ Update Task
- [ ] Rename task
- [ ] Reschedule (date only)
- [ ] Reschedule (time only)
- [ ] Reschedule (date + time)
- [ ] Change status
- [ ] Change category
- [ ] Complex multi-part update

### ✅ Delete Task
- [ ] Delete by name
- [ ] Delete by status (completed, in process, to do)
- [ ] Delete by time (due today, overdue, before/after time)
- [ ] Delete by category (work, personal)
- [ ] Bulk delete all
- [ ] Natural language phrasing

### ✅ Query Tasks
- [ ] General query (all tasks)
- [ ] Time-based (today, tomorrow, this week, overdue)
- [ ] Status-based (done, incomplete, in process)
- [ ] Category-based (work, personal)
- [ ] Priority-based (high, low)
- [ ] Keyword search
- [ ] Mixed queries (status + time, category + time, etc.)
- [ ] Natural language queries

### ✅ Navigation
- [ ] Launch request
- [ ] Help intent
- [ ] Stop/Cancel intent
- [ ] Unhandled intent fallback

---

## 📝 Notes for User Guide

### Best Practices
1. **Be Specific**: Use full task names when updating or deleting
2. **Use Natural Language**: The skill understands conversational phrases
3. **Combine Attributes**: You can combine date, time, priority, and category in one command
4. **Query First**: Use queries to find tasks before updating or deleting
5. **Use Prefixes**: "update the task:", "delete the tasks:", "show my tasks:" work well for clarity

### Common Patterns
- **Adding**: "add [task] [when] [priority] [category]"
- **Updating**: "update [task] [what to change]"
- **Deleting**: "delete [task or condition]"
- **Querying**: "show my tasks [filter]"

### Tips
- You can use filler words ("uh", "actually") - the skill handles them
- Task names don't need to be exact - partial matches work
- Date/time parsing is flexible - "next Tuesday", "tomorrow morning", "at 3 pm" all work
- You can update multiple attributes in one command





