# Italian Test Sentences (it-IT)

This document contains test sentences for the Italian language interaction model. These sentences are designed to work with the current Alexa interaction model constraints.

## 📝 CREATE TASKS (CreateTaskIntent)

### Simple Task Creation
- "aggiungi comprare il latte"
- "aggiungi chiamare mamma"
- "aggiungi finire il rapporto"
- "aggiungi fissare appuntamento dal dentista"
- "crea un'attività per rivedere il budget"
- "ricordami di annaffiare le piante"
- "inserisci comprare la spesa"
- "inserisci chiamare mamma"
- "inserisci un'attività finire il rapporto"

### Task with Date/Time
- "aggiungi comprare il latte domani"
- "aggiungi chiamare mamma oggi"
- "aggiungi finire il rapporto la prossima settimana"
- "aggiungi fissare appuntamento questa settimana"
- "aggiungi comprare la spesa il prossimo venerdì"
- "inserisci comprare il latte domani"
- "inserisci chiamare mamma oggi"

### Task with Specific Dates
- "aggiungi chiamare il dentista il 25 dicembre"
- "aggiungi chiamare il dentista 25 dicembre"
- "aggiungi chiamare il dentista per il 25 dicembre"
- "crea chiamare il dentista il 25 dicembre"
- "crea chiamare il dentista 25 dicembre"
- "inserisci chiamare il dentista il 25 dicembre"
- "inserisci chiamare il dentista 25 dicembre"
- "aggiungi comprare regali il 23 dicembre"
- "aggiungi comprare regali 23 dicembre"
- "crea riunione il 15 gennaio"
- "aggiungi festa il 31 dicembre"

---

## 📖 READ TASKS (ReadTasksIntent)

### Show All Tasks
- "mostra le mie attività"
- "leggi le mie attività"
- "elenca le mie attività"
- "cosa ho per oggi"
- "quali sono le mie attività"
- "mostrami le attività"

### Filter by Status
- "mostra le mie attività da fare"
- "mostra le mie attività in corso"
- "mostra le mie attività fatte"
- "mostra le mie attività completate"

### Filter by Priority
- "mostra le mie attività priorità alta"
- "mostra le mie attività priorità bassa"
- "mostra le mie attività priorità normale"
- "mostra attività alta"
- "mostra attività bassa"
- "mostra attività normale"
- "leggi le mie attività priorità alta"
- "leggi le mie attività priorità bassa"
- "leggi attività alta"
- "leggi attività bassa"
- "leggi le attività priorità alta"

### Filter by Category
- "leggi le mie attività lavoro"
- "leggi le mie attività personali"
- "mostra le mie attività lavoro"
- "mostra le mie attività personali"
- "mostra attività lavoro"
- "mostra attività personali"
- "leggi attività lavoro"
- "leggi attività personali"
- "leggi le attività lavoro"
- "leggi le attività personali"

### Filter by Due Date
- "mostra attività scadenza oggi"
- "mostra attività scadenza domani"
- "mostra le mie attività scadenza oggi"
- "mostra le mie attività scadenza domani"
- "leggi le mie attività oggi"
- "leggi le mie attività domani"
- "leggi le mie attività la prossima settimana"

### Filter by Overdue
- "mostra attività scadute"

---

## ✏️ UPDATE TASK STATUS (UpdateTaskStatusIntent)

### Single Utterance (with task name)
- "completa comprare il latte"
- "segna come fatto comprare il latte"
- "segna come completato chiamare mamma"

### Dialog Flow (Alexa will ask for task name)
- "segna un'attività come fatto"
- "aggiorna lo stato di un'attività a fatto"
- "imposta stato a fatto"
- "completa un'attività"

---

## ⚡ UPDATE TASK PRIORITY (UpdateTaskPriorityIntent)

### Single Utterance (with priority only)
- "imposta priorità attività a alta"
- "imposta priorità attività a bassa"
- "imposta priorità attività a normale"
- "cambia priorità a alta"
- "cambia priorità a bassa"
- "rendi priorità alta"
- "rendi priorità bassa"
- "imposta priorità alta"
- "imposta priorità bassa"

### Dialog Flow (Alexa will ask for task name and priority)
- "aggiorna priorità attività"

**Expected Flow:**
1. User: "aggiorna priorità attività"
2. Alexa: "Quale attività intendi?"
3. User: "comprare il latte"
4. Alexa: "Che priorità devo impostare? Bassa, normale o alta?"
5. User: "alta"

---

## 📅 UPDATE DUE DATE (UpdateDueDateIntent)

### Dialog Flow (Alexa will ask for task name and date)
- "cambia la data di scadenza"
- "imposta data di scadenza"
- "aggiorna data di scadenza"
- "riprogramma attività"

**Expected Flow:**
1. User: "cambia la data di scadenza"
2. Alexa: "Quale attività intendi?"
3. User: "comprare il latte"
4. Alexa: "Quando scade questa attività?"
5. User: "23 dicembre"

---

## 🏷️ UPDATE TASK CATEGORY (UpdateTaskCategoryIntent)

### Single Utterance (with category only)
- "imposta categoria attività a lavoro"
- "imposta categoria attività a personale"

### Dialog Flow (Alexa will ask for task name and category)
- "imposta categoria attività"
- "sposta attività in una categoria"
- "rendi attività una categoria"
- "cambia categoria attività"

**Expected Flow:**
1. User: "imposta categoria attività"
2. Alexa: "Quale attività intendi?"
3. User: "comprare il latte"
4. Alexa: "È un'attività personale o di lavoro?"
5. User: "lavoro"

---

## 🗑️ DELETE TASKS (DeleteTaskIntent)

### Single Utterance
- "elimina comprare il latte"
- "rimuovi chiamare mamma"
- "cancella finire il rapporto"
- "elimina attività comprare il latte"
- "rimuovi attività chiamare mamma"
- "cancella attività finire il rapporto"
- "elimina l'attività comprare il latte"
- "rimuovi l'attività chiamare mamma"

---

## 🔄 REORDER TASKS (ReorderTaskIntent)

### Dialog Flow (Alexa will ask for task name and position)
- "sposta un'attività"
- "riordina attività"
- "metti attività in una posizione"
- "sposta attività prima"

**Expected Flow:**
1. User: "sposta un'attività"
2. Alexa: "Quale attività intendi?"
3. User: "comprare il latte"
4. Alexa: "Dove devo spostare l'attività nell'elenco?"
5. User: "prima"

---

## 🧪 COMPREHENSIVE TEST SCENARIOS

### Scenario 1: Create and Query Work Tasks
1. "aggiungi finire rapporto lavoro"
2. "aggiungi chiamare cliente lavoro"
3. "mostra le mie attività lavoro"

### Scenario 2: Create and Query Personal Tasks
1. "aggiungi comprare il latte personale"
2. "aggiungi chiamare mamma personale"
3. "mostra le mie attività personali"

### Scenario 3: Create Tasks with Due Dates and Query
1. "aggiungi comprare il latte domani"
2. "aggiungi chiamare mamma oggi"
3. "mostra le mie attività scadenza oggi"
4. "mostra le mie attività scadenza domani"

### Scenario 4: Update Priority Flow
1. "aggiungi comprare il latte"
2. "imposta priorità alta"
3. Alexa: "Quale attività intendi?"
4. "comprare il latte"
5. Alexa: "Che priorità devo impostare? Bassa, normale o alta?"
6. "alta"

### Scenario 5: Update Due Date Flow
1. "aggiungi comprare il latte"
2. "cambia la data di scadenza"
3. Alexa: "Quale attività intendi?"
4. "comprare il latte"
5. Alexa: "Quando scade questa attività?"
6. "23 dicembre"

### Scenario 6: Update Category Flow
1. "aggiungi comprare il latte"
2. "imposta categoria attività"
3. Alexa: "Quale attività intendi?"
4. "comprare il latte"
5. Alexa: "È un'attività personale o di lavoro?"
6. "lavoro"

### Scenario 7: Complete Task Flow
1. "aggiungi comprare il latte"
2. "completa comprare il latte"
3. "mostra le mie attività fatte"

---

## ⚠️ IMPORTANT NOTES

### Dialog Flow Behavior
When using commands without all required slots, Alexa will use dialog flow to elicit missing information:
- **UpdateTaskPriorityIntent**: Requires both `taskName` and `priority`
- **UpdateDueDateIntent**: Requires both `taskName` and `dueDateTime`
- **UpdateTaskCategoryIntent**: Requires both `taskName` and `category`

### Category Values
The following synonyms are recognized for categories:
- **WORK**: "lavoro", "ufficio", "business"
- **PERSONAL**: "personale", "personali", "casa", "privato"

### Date Parsing
The system recognizes Italian date expressions:
- "oggi" (today)
- "domani" (tomorrow)
- "questa settimana" (this week)
- "la prossima settimana" (next week)
- Specific dates like "23 dicembre", "25 dicembre", etc.

### Adding Tasks with Specific Dates
**Examples:**
- "aggiungi chiamare il dentista il 25 dicembre"
- "aggiungi chiamare il dentista 25 dicembre"
- "aggiungi chiamare il dentista per il 25 dicembre"
- "crea chiamare il dentista il 25 dicembre"
- "crea chiamare il dentista 25 dicembre"
- "inserisci chiamare il dentista il 25 dicembre"
- "inserisci chiamare il dentista 25 dicembre"
- "aggiungi comprare regali il 23 dicembre"
- "aggiungi comprare regali 23 dicembre"
- "crea riunione il 15 gennaio"
- "aggiungi festa il 31 dicembre"

### Priority Values
- "alta" or "high" → HIGH
- "bassa" or "low" → LOW
- "normale" or "normal" → NORMAL

---

## ✅ VALIDATION CHECKLIST

Before testing, ensure:
- [ ] All intents are properly configured in Alexa Developer Console
- [ ] Dialog flow is enabled for update intents
- [ ] Category synonyms are properly set up
- [ ] Date parsing handles Italian keywords correctly
- [ ] Task name extraction works with Italian phrases

---

## 📊 EXPECTED RESULTS

### Query Results
- "mostra le mie attività lavoro" → Should return only WORK category tasks
- "mostra le mie attività personali" → Should return only PERSONAL category tasks
- "mostra le mie attività scadenza oggi" → Should return only tasks due today
- "mostra le mie attività scadenza domani" → Should return only tasks due tomorrow

### Update Results
- Priority updates should confirm with: "Ho aggiornato [task name] con priorità [priority]"
- Due date updates should confirm with: "Ho aggiornato [task name] con data di scadenza [date]"
- Category updates should confirm with: "Ho aggiornato [task name] con categoria [category]"

