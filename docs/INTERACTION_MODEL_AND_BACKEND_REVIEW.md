# Interaction Model and Backend Review

This document summarizes the step-by-step review of the Alexa interaction model and Lambda handlers, including intent mapping, slot alignment, overlapping utterances, and fixes applied.

---

## 1. Intent-to-Handler Mapping

| Interaction Model Intent       | Backend Handler           | canHandle condition              | Status   |
|-------------------------------|---------------------------|----------------------------------|----------|
| CreateTaskIntent              | AddTaskHandler            | `intentName === 'CreateTaskIntent'` | ✅ Match |
| ReadTasksIntent               | QueryTasksHandler         | `intentName === 'ReadTasksIntent'`  | ✅ Match |
| UpdateTaskStatusIntent        | UpdateTaskStatusHandler   | `intentName === 'UpdateTaskStatusIntent'` | ✅ Match |
| UpdateTaskPriorityIntent      | UpdateTaskPriorityHandler | `intentName === 'UpdateTaskPriorityIntent'` | ✅ Match |
| UpdateDueDateIntent           | UpdateDueDateHandler      | `intentName === 'UpdateDueDateIntent'` | ✅ Match |
| UpdateTaskCategoryIntent      | UpdateTaskCategoryHandler | `intentName === 'UpdateTaskCategoryIntent'` | ✅ Match |
| DeleteTaskIntent              | DeleteTaskHandler         | `intentName === 'DeleteTaskIntent'` | ✅ Match |
| ReorderTaskIntent             | ReorderTaskHandler        | `intentName === 'ReorderTaskIntent'` | ✅ Match |
| AMAZON.HelpIntent / Stop / Cancel | UnhandledIntentHandler | Handled inside `handle()`        | ✅ Match |
| AMAZON.FallbackIntent         | UnhandledIntentHandler    | Caught as IntentRequest          | ✅ Match |

**Note:** `UpdateTaskHandler.ts` exists and handles `UpdateTaskIntent`, but that intent is **not** in the interaction model and the handler is **not** registered in `index.ts`. It is dead code and does not affect routing.

---

## 2. Slot Alignment (Model vs Backend)

| Intent                   | Model slots              | Handler reads                    | Notes |
|--------------------------|--------------------------|----------------------------------|------|
| CreateTaskIntent         | taskName, priority, category, notes | taskName, dueDateTime, priority, category, notes | No `dueDateTime` slot in model; backend expects date inside `taskName` (e.g. "buy milk tomorrow") and parses it. ✅ |
| ReadTasksIntent          | status, priority, category, dueDateTime | status, priority, category, dueDateTime | ✅ Match |
| UpdateTaskStatusIntent   | taskName, status         | taskName, status                 | ✅ Match |
| UpdateTaskPriorityIntent | taskName, priority       | taskName, priority               | ✅ Match |
| UpdateDueDateIntent      | taskName, dueDateTime    | taskName, dueDateTime            | ✅ Match |
| UpdateTaskCategoryIntent | taskName, category       | taskName, category               | ✅ Match |
| DeleteTaskIntent         | taskName                 | taskName                         | ✅ Match |
| ReorderTaskIntent        | taskName, position       | taskName, position               | ✅ Match |

---

## 3. Overlapping Utterances and Conflicts

- **CreateTaskIntent** vs **DeleteTaskIntent**: "remind me to {taskName}" vs "remove {taskName}" — different verbs; no overlap.
- **CreateTaskIntent** vs **ReadTasksIntent**: No shared samples; "add"/"create" vs "show"/"read"/"list".
- **UpdateTaskStatusIntent**: "complete a task" (no taskName) and "complete {taskName}" both map to same intent; handler infers status when only taskName is provided. ✅
- **Update* intents**: Samples like "update task priority", "change the due date", "set task category" have no slot values in the phrase; dialog elicits missing slots. ✅

No conflicting samples were found that would route the same utterance to different intents.

---

## 4. Issues Found and Fixes Applied

### 4.1 QueryTasksHandler NLU path (fixed)

- **Issue:** Fallback parsing used `(request as any).nlu?.tokens` and `(request as any).interpretations`. In the Alexa request envelope, NLU data lives under `request.intent.nlu` (tokens, interpretations), consistent with AddTaskHandler.
- **Fix:** Use `request.intent?.nlu?.tokens` and `request.intent?.nlu?.interpretations` first, with the previous paths as fallback for compatibility.

### 4.2 Update intents: samples without slots (improved)

- **Issue:** Utterances like "reschedule task", "update task priority", "change task category", "move a task" provide no slot values, so both taskName and the other slot are empty and the user must answer two prompts.
- **Fix:** Added samples that include `{taskName}` so the task can be captured in one phrase when possible:
  - **UpdateDueDateIntent:** "reschedule {taskName}", "change due date for {taskName}", "set due date for {taskName}"
  - **UpdateTaskCategoryIntent:** "set category for {taskName}", "change category for {taskName}"
  - **UpdateTaskPriorityIntent:** "set priority for {taskName}", "change priority for {taskName}"
  - **ReorderTaskIntent:** "move {taskName} {position}", "reorder {taskName}", "move {taskName} to {position}"

---

## 5. Handler Registration Order (index.ts)

Order is correct for intent resolution:

1. LaunchRequestHandler  
2. QueryTasksHandler (ReadTasksIntent)  
3. AddTaskHandler (CreateTaskIntent)  
4. UpdateTaskStatusHandler  
5. UpdateTaskPriorityHandler  
6. UpdateDueDateHandler  
7. UpdateTaskCategoryHandler  
8. ReorderTaskHandler  
9. DeleteTaskHandler  
10. UnhandledIntentHandler (catches remaining IntentRequests, including FallbackIntent)  
11. SessionEndedHandler  

The first handler whose `canHandle()` returns true receives the request. UnhandledIntentHandler is last and correctly handles Help, Stop, Cancel and unhandled intents.

---

## 6. Dialog and Elicitation

- All update intents and CreateTaskIntent that need slots are in `dialog.intents`.
- Prompts exist for: Elicit.Slot.TaskName, Priority, Status, DueDateTime, Category, Position.
- When a sample has no slot (e.g. "update task priority"), the dialog will elicit the first required/elicitation slot (taskName), then the second (e.g. priority). ✅

---

## 7. CreateTaskIntent and Date Handling

- **Model:** CreateTaskIntent has no `dueDateTime` slot; only `taskName` (and optional priority, category, notes).
- **Design:** "Tomorrow" and "today" are part of the phrase in `taskName` (e.g. "buy milk tomorrow"). The backend parses this with `parseTaskFromUserRequest()`, which extracts date keywords and sets `dueDateTime` and strips them from the task name. No separate CreateTaskTomorrowIntent/CreateTaskTodayIntent. ✅

---

## 8. Summary

- All interaction model intents that should be handled have a matching handler and correct slot usage.
- One backend bug was fixed (QueryTasksHandler NLU path).
- The interaction model was improved with extra samples for update intents so taskName (and, for ReorderTaskIntent, position) can be filled in one utterance where possible.
- No intent name mismatches, missing handlers, or conflicting samples were left in place.
