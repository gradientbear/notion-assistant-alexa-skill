# Sample Sentences for Voice Planner Alexa Skill

This document contains comprehensive sample sentences for testing the Voice Planner Alexa skill across all supported languages. Each sentence is mapped to its corresponding backend handler.

## Supported Languages

- **English (en-US)**
- **Italian (it-IT)**
- **French (fr-FR)**
- **Spanish (es-ES)**

## Handler Mapping

| Intent | Handler | Operation |
|--------|---------|-----------|
| `CreateTaskIntent` | `AddTaskHandler` | Create |
| `ReadTasksIntent` | `QueryTasksHandler` | Read |
| `UpdateTaskStatusIntent` | `UpdateTaskStatusHandler` | Update |
| `UpdateTaskPriorityIntent` | `UpdateTaskPriorityHandler` | Update |
| `UpdateDueDateIntent` | `UpdateDueDateHandler` | Update |
| `UpdateTaskCategoryIntent` | `UpdateTaskCategoryHandler` | Update |
| `ReorderTaskIntent` | `ReorderTaskHandler` | Update |
| `DeleteTaskIntent` | `DeleteTaskHandler` | Delete |

---

## Best Template Sentences by Language

This section provides the best, most user-friendly template sentences for each language. These templates are optimized for natural conversation and ease of use.

### English (en-US) Templates

#### 🎯 CREATE TASKS

**Simplest (Recommended):**
- `"add [task name]"`
- Example: "add buy milk"

**With Date:**
- `"add [task name] [date]"`
- Examples: "add buy milk tomorrow", "add call dentist Friday"

**With Priority:**
- `"add [task name] [priority] priority"`
- Examples: "add buy milk high priority", "add call dentist low priority"

**Complete:**
- `"add [task name] [priority] priority [date] [category]"`
- Example: "add finish report high priority tomorrow work"

#### 📖 READ TASKS

**All Tasks:**
- `"show my tasks"` | `"read my tasks"` | `"list my tasks"`

**By Status:**
- `"show my [status] tasks"`
- Examples: "show my done tasks", "show my to do tasks"

**By Priority:**
- `"show my [priority] priority tasks"`
- Examples: "show my high priority tasks", "show my low priority tasks"

**By Category:**
- `"show my [category] tasks"`
- Examples: "show my work tasks", "show my personal tasks"

**By Date:**
- `"show tasks due [date]"`
- Examples: "show tasks due today", "show tasks due tomorrow"

#### ✏️ UPDATE TASKS

**Update Status:**
- `"mark [task name] as [status]"`
- Examples: "mark buy milk as done", "complete buy milk"

**Update Priority:**
- `"set [task name] priority to [priority]"`
- Examples: "set buy milk priority to high"

**Update Due Date:**
- `"change [task name] due date to [date]"`
- Examples: "change buy milk due date to tomorrow"

**Update Category:**
- `"set [task name] category to [category]"`
- Examples: "set buy milk category to work"

#### 🗑️ DELETE TASKS

**Simple:**
- `"delete [task name]"` | `"remove [task name]"`
- Examples: "delete buy milk", "remove finish report"

---

### Italian (it-IT) Templates

#### 🎯 CREARE ATTIVITÀ

**Più Semplice (Consigliato):**
- `"aggiungi [nome attività]"`
- Esempio: "aggiungi comprare il latte"

**Alternative Forms:**
- `"inserisci [nome attività]"`
- `"crea un'attività [nome attività]"`
- `"ricordami di [nome attività]"`

**Con Data:**
- `"aggiungi [nome attività] [data]"`
- `"inserisci [nome attività] [data]"`
- Esempi: "aggiungi comprare il latte domani", "inserisci chiamare dentista domani"

**Con Priorità:**
- `"aggiungi [nome attività] priorità [priorità]"`
- Esempi: "aggiungi comprare il latte priorità alta", "aggiungi chiamare dentista priorità bassa"

**Completo:**
- `"aggiungi [nome attività] priorità [priorità] [data] [categoria]"`
- Esempio: "aggiungi finire rapporto priorità alta domani lavoro"

#### 📖 LEGGERE ATTIVITÀ

**Tutte le Attività:**
- `"mostra le mie attività"` | `"leggi le mie attività"` | `"elenca le mie attività"`

**Per Stato:**
- `"mostra le mie attività [stato]"`
- Esempi: "mostra le mie attività fatte", "mostra le mie attività da fare"

**Per Priorità:**
- `"mostra le mie attività priorità [priorità]"`
- Esempi: "mostra le mie attività priorità alta", "mostra le mie attività priorità bassa"

**Per Categoria:**
- `"mostra le mie attività [categoria]"`
- Esempi: "mostra le mie attività lavoro", "mostra le mie attività personali"

**Per Data:**
- `"mostra attività scadenza [data]"`
- Esempi: "mostra attività scadenza oggi", "mostra attività scadenza domani"

#### ✏️ AGGIORNARE ATTIVITÀ

**Aggiornare Stato:**
- `"segna [nome attività] come [stato]"`
- Esempi: "segna comprare il latte come fatto", "completa comprare il latte"

**Aggiornare Priorità:**
- `"imposta priorità [nome attività] a [priorità]"`
- Esempi: "imposta priorità comprare il latte a alta"

**Aggiornare Data di Scadenza:**
- `"cambia data di scadenza [nome attività] a [data]"`
- Esempi: "cambia data di scadenza comprare il latte a domani"

**Aggiornare Categoria:**
- `"imposta categoria [nome attività] a [categoria]"`
- Esempi: "imposta categoria comprare il latte a lavoro"

#### 🗑️ ELIMINARE ATTIVITÀ

**Semplice:**
- `"elimina [nome attività]"` | `"rimuovi [nome attività]"`
- Esempi: "elimina comprare il latte", "rimuovi finire rapporto"

---

### French (fr-FR) Templates

#### 🎯 CRÉER DES TÂCHES

**Le Plus Simple (Recommandé):**
- `"ajouter [nom de la tâche]"`
- Exemple: "ajouter acheter du lait"

**Avec Date:**
- `"ajouter [nom de la tâche] [date]"`
- Exemples: "ajouter acheter du lait demain", "ajouter appeler dentiste vendredi"

**Avec Priorité:**
- `"ajouter [nom de la tâche] priorité [priorité]"`
- Exemples: "ajouter acheter du lait priorité élevée", "ajouter appeler dentiste priorité basse"

**Complet:**
- `"ajouter [nom de la tâche] priorité [priorité] [date] [catégorie]"`
- Exemple: "ajouter terminer rapport priorité élevée demain travail"

#### 📖 LIRE LES TÂCHES

**Toutes les Tâches:**
- `"montre mes tâches"` | `"lis mes tâches"` | `"liste mes tâches"`

**Par Statut:**
- `"montre mes tâches [statut]"`
- Exemples: "montre mes tâches terminées", "montre mes tâches à faire"

**Par Priorité:**
- `"montre mes tâches priorité [priorité]"`
- Exemples: "montre mes tâches priorité élevée", "montre mes tâches priorité basse"

**Par Catégorie:**
- `"montre mes tâches [catégorie]"`
- Exemples: "montre mes tâches travail", "montre mes tâches personnelles"

**Par Date:**
- `"montre tâches échéance [date]"`
- Exemples: "montre tâches échéance aujourd'hui", "montre tâches échéance demain"

#### ✏️ METTRE À JOUR LES TÂCHES

**Mettre à Jour le Statut:**
- `"marque [nom de la tâche] comme [statut]"`
- Exemples: "marque acheter du lait comme terminé", "complète acheter du lait"

**Mettre à Jour la Priorité:**
- `"définis priorité [nom de la tâche] à [priorité]"`
- Exemples: "définis priorité acheter du lait à élevée"

**Mettre à Jour la Date d'Échéance:**
- `"change date d'échéance [nom de la tâche] à [date]"`
- Exemples: "change date d'échéance acheter du lait à demain"

**Mettre à Jour la Catégorie:**
- `"définis catégorie [nom de la tâche] à [catégorie]"`
- Exemples: "définis catégorie acheter du lait à travail"

#### 🗑️ SUPPRIMER LES TÂCHES

**Simple:**
- `"supprime [nom de la tâche]"` | `"enlève [nom de la tâche]"`
- Exemples: "supprime acheter du lait", "enlève terminer rapport"

---

### Spanish (es-ES) Templates

#### 🎯 CREAR TAREAS

**Más Simple (Recomendado):**
- `"agregar [nombre de tarea]"`
- Ejemplo: "agregar comprar leche"

**Con Fecha:**
- `"agregar [nombre de tarea] [fecha]"`
- Ejemplos: "agregar comprar leche mañana", "agregar llamar dentista viernes"

**Con Prioridad:**
- `"agregar [nombre de tarea] prioridad [prioridad]"`
- Ejemplos: "agregar comprar leche prioridad alta", "agregar llamar dentista prioridad baja"

**Completo:**
- `"agregar [nombre de tarea] prioridad [prioridad] [fecha] [categoría]"`
- Ejemplo: "agregar terminar informe prioridad alta mañana trabajo"

#### 📖 LEER TAREAS

**Todas las Tareas:**
- `"muestra mis tareas"` | `"lee mis tareas"` | `"lista mis tareas"`

**Por Estado:**
- `"muestra mis tareas [estado]"`
- Ejemplos: "muestra mis tareas hechas", "muestra mis tareas por hacer"

**Por Prioridad:**
- `"muestra mis tareas prioridad [prioridad]"`
- Ejemplos: "muestra mis tareas prioridad alta", "muestra mis tareas prioridad baja"

**Por Categoría:**
- `"muestra mis tareas [categoría]"`
- Ejemplos: "muestra mis tareas trabajo", "muestra mis tareas personales"

**Por Fecha:**
- `"muestra tareas vencimiento [fecha]"`
- Ejemplos: "muestra tareas vencimiento hoy", "muestra tareas vencimiento mañana"

#### ✏️ ACTUALIZAR TAREAS

**Actualizar Estado:**
- `"marca [nombre de tarea] como [estado]"`
- Ejemplos: "marca comprar leche como hecho", "completa comprar leche"

**Actualizar Prioridad:**
- `"establece prioridad [nombre de tarea] a [prioridad]"`
- Ejemplos: "establece prioridad comprar leche a alta"

**Actualizar Fecha de Vencimiento:**
- `"cambia fecha de vencimiento [nombre de tarea] a [fecha]"`
- Ejemplos: "cambia fecha de vencimiento comprar leche a mañana"

**Actualizar Categoría:**
- `"establece categoría [nombre de tarea] a [categoría]"`
- Ejemplos: "establece categoría comprar leche a trabajo"

#### 🗑️ ELIMINAR TAREAS

**Simple:**
- `"elimina [nombre de tarea]"` | `"quita [nombre de tarea]"`
- Ejemplos: "elimina comprar leche", "quita terminar informe"

---

## English (en-US)

### CREATE Operations
**Handler:** `AddTaskHandler` | **Intent:** `CreateTaskIntent`

#### Simple Task Creation
- "add buy milk"
- "add call mom"
- "add finish the report"
- "add schedule dentist appointment"
- "create a task to review the budget"
- "remind me to water the plants"
- "add pick up groceries"

#### Task with Date/Time
- "add buy milk tomorrow"
- "add finish report today"
- "add call client next week"
- "add submit application by Friday"
- "add prepare presentation for Monday"
- "add schedule meeting next month"
- "add complete project by December 15th"
- "add review documents in 3 days"

#### Task with Priority
- "add urgent task fix the bug"
- "add high priority call emergency contact"
- "add low priority organize desk"
- "add normal priority update website"
- "add buy milk high priority"
- "add finish report low priority"

#### Task with Category
- "add work task prepare presentation"
- "add personal task buy groceries"
- "add work schedule team meeting"
- "add personal call grandma"

#### Task with Multiple Attributes
- "add high priority work task finish report by Friday"
- "add personal task buy milk tomorrow"
- "add urgent work task call client today"
- "add low priority personal task organize closet next week"

#### Embedded Information in Task Name
- "add buy milk high priority tomorrow"
- "add finish report work task by Friday"
- "add urgent call client today"
- "add personal buy groceries low priority"

### READ Operations
**Handler:** `QueryTasksHandler` | **Intent:** `ReadTasksIntent`

#### List All Tasks
- "show my tasks"
- "read my tasks"
- "list all tasks"
- "what are my tasks"
- "tell me my tasks"
- "what do I have to do"
- "show me everything"

#### Filter by Status
- "show my to do tasks"
- "read my in process tasks"
- "list completed tasks"
- "show done tasks"
- "what tasks are in process"
- "show tasks that are done"

#### Filter by Priority
- "show my high priority tasks"
- "read low priority tasks"
- "list normal priority tasks"
- "what are my urgent tasks"
- "show high priority items"
- "tell me low priority tasks"

#### Filter by Category
- "show my work tasks"
- "read personal tasks"
- "list work items"
- "what are my personal tasks"
- "show work related tasks"
- "tell me personal items"

#### Filter by Date
- "show tasks due today"
- "read tasks due tomorrow"
- "list tasks due next week"
- "what's due this week"
- "show overdue tasks"
- "what tasks are due soon"

#### Combined Filters
- "show high priority work tasks"
- "read done personal tasks"
- "list in process tasks due today"
- "show urgent work items due tomorrow"

### UPDATE Operations - Status
**Handler:** `UpdateTaskStatusHandler` | **Intent:** `UpdateTaskStatusIntent`

#### Mark as Complete
- "mark buy milk as done"
- "complete finish the report"
- "set buy groceries to done"
- "mark call client as completed"
- "complete the presentation task"
- "mark as done finish report"
- "set status to done for buy milk"

#### Mark as In Process
- "mark finish report as in process"
- "set buy groceries to in process"
- "update call client status to in process"
- "mark the presentation as in process"
- "set status to in process for finish report"

#### Mark as To Do
- "mark buy milk as to do"
- "set finish report to to do"
- "update call client status to to do"
- "mark the presentation as to do"

#### General Status Updates
- "mark a task as done"
- "update a task status to in process"
- "set status to to do"
- "complete a task"
- "change task status"

### UPDATE Operations - Priority
**Handler:** `UpdateTaskPriorityHandler` | **Intent:** `UpdateTaskPriorityIntent`

#### Set Priority
- "set task priority to high"
- "change priority to low"
- "make priority normal"
- "update task priority to urgent"
- "set buy milk priority to high"
- "change finish report priority to low"
- "make buy groceries priority normal"

#### General Priority Updates
- "set task priority"
- "change priority"
- "update task priority"
- "make priority high"
- "set priority to low"

### UPDATE Operations - Due Date
**Handler:** `UpdateDueDateHandler` | **Intent:** `UpdateDueDateIntent`

#### Change Due Date
- "change due date for buy milk to tomorrow"
- "set finish report due date to Friday"
- "update call client due date to next week"
- "reschedule buy groceries to Monday"
- "change the due date"
- "set due date"
- "update due date"
- "reschedule task"

### UPDATE Operations - Category
**Handler:** `UpdateTaskCategoryHandler` | **Intent:** `UpdateTaskCategoryIntent`

#### Change Category
- "set buy milk category to personal"
- "change finish report to work category"
- "update call client category to work"
- "make buy groceries a personal task"
- "set task category"
- "change task category"
- "move task to work category"

### UPDATE Operations - Reorder
**Handler:** `ReorderTaskHandler` | **Intent:** `ReorderTaskIntent`

#### Move Task Position
- "move buy milk to first"
- "put finish report at top"
- "move call client to second position"
- "reorder buy groceries to bottom"
- "move task to first"
- "put task at top"
- "reorder task"

### DELETE Operations
**Handler:** `DeleteTaskHandler` | **Intent:** `DeleteTaskIntent`

#### Delete Tasks
- "delete buy milk"
- "remove finish the report"
- "trash call client"
- "get rid of buy groceries"
- "delete the presentation task"
- "remove finish report"
- "cancel buy milk"
- "delete task buy milk"

---

## Italian (it-IT)

### CREATE Operations
**Handler:** `AddTaskHandler` | **Intent:** `CreateTaskIntent`

#### Simple Task Creation
- "aggiungi comprare il latte"
- "aggiungi chiamare mamma"
- "aggiungi finire il rapporto"
- "aggiungi fissare appuntamento dal dentista"
- "crea un'attività per rivedere il budget"
- "ricordami di annaffiare le piante"
- "aggiungi comprare la spesa"
- "inserisci comprare il latte"
- "inserisci chiamare mamma"
- "inserisci un'attività finire il rapporto"

#### Task with Date/Time
- "aggiungi comprare il latte domani"
- "aggiungi finire rapporto oggi"
- "aggiungi chiamare cliente la prossima settimana"
- "aggiungi inviare domanda entro venerdì"
- "aggiungi preparare presentazione per lunedì"
- "aggiungi programmare riunione il prossimo mese"
- "aggiungi completare progetto entro il 15 dicembre"
- "aggiungi rivedere documenti tra 3 giorni"
- "inserisci comprare il latte domani"
- "inserisci finire rapporto oggi"

#### Task with Priority
- "aggiungi attività urgente sistemare il bug"
- "aggiungi priorità alta chiamare contatto di emergenza"
- "aggiungi priorità bassa organizzare scrivania"
- "aggiungi priorità normale aggiornare sito web"
- "aggiungi comprare il latte priorità alta"
- "aggiungi finire rapporto priorità bassa"

#### Task with Category
- "aggiungi attività lavoro preparare presentazione"
- "aggiungi attività personale comprare spesa"
- "aggiungi lavoro programmare riunione team"
- "aggiungi personale chiamare nonna"

#### Task with Multiple Attributes
- "aggiungi attività lavoro priorità alta finire rapporto entro venerdì"
- "aggiungi attività personale comprare il latte domani"
- "aggiungi attività lavoro urgente chiamare cliente oggi"
- "aggiungi attività personale priorità bassa organizzare armadio la prossima settimana"

#### Embedded Information in Task Name
- "aggiungi comprare il latte priorità alta domani"
- "aggiungi finire rapporto attività lavoro entro venerdì"
- "aggiungi urgente chiamare cliente oggi"
- "aggiungi personale comprare spesa priorità bassa"

### READ Operations
**Handler:** `QueryTasksHandler` | **Intent:** `ReadTasksIntent`

#### List All Tasks
- "mostra le mie attività"
- "leggi le mie attività"
- "elenca le mie attività"
- "quali sono le mie attività"
- "dimmi le mie attività"
- "cosa devo fare"
- "mostrami tutto"

#### Filter by Status
- "mostra le mie attività da fare"
- "leggi le mie attività in corso"
- "elenca attività completate"
- "mostra attività fatte"
- "quali attività sono in corso"
- "mostra attività che sono completate"

#### Filter by Priority
- "mostra le mie attività priorità alta"
- "leggi attività priorità bassa"
- "elenca attività priorità normale"
- "quali sono le mie attività urgenti"
- "mostra elementi priorità alta"
- "dimmi attività priorità bassa"

#### Filter by Category
- "mostra le mie attività lavoro"
- "leggi attività personali"
- "elenca elementi lavoro"
- "quali sono le mie attività personali"
- "mostra attività relative al lavoro"
- "dimmi elementi personali"

#### Filter by Date
- "mostra attività scadenza oggi"
- "leggi attività scadenza domani"
- "elenca attività scadenza la prossima settimana"
- "cosa scade questa settimana"
- "mostra attività scadute"
- "quali attività scadono presto"

#### Combined Filters
- "mostra attività lavoro priorità alta"
- "leggi attività personali completate"
- "elenca attività in corso scadenza oggi"
- "mostra elementi lavoro urgenti scadenza domani"

### UPDATE Operations - Status
**Handler:** `UpdateTaskStatusHandler` | **Intent:** `UpdateTaskStatusIntent`

#### Mark as Complete
- "segna comprare il latte come fatto"
- "completa finire il rapporto"
- "imposta comprare spesa a fatto"
- "segna chiamare cliente come completato"
- "completa l'attività presentazione"
- "segna come fatto finire rapporto"
- "imposta stato a fatto per comprare il latte"

#### Mark as In Process
- "segna finire rapporto come in corso"
- "imposta comprare spesa a in corso"
- "aggiorna stato chiamare cliente a in corso"
- "segna la presentazione come in corso"
- "imposta stato a in corso per finire rapporto"

#### Mark as To Do
- "segna comprare il latte come da fare"
- "imposta finire rapporto a da fare"
- "aggiorna stato chiamare cliente a da fare"
- "segna la presentazione come da fare"

#### General Status Updates
- "segna un'attività come fatto"
- "aggiorna lo stato di un'attività a in corso"
- "imposta stato a da fare"
- "completa un'attività"
- "cambia stato attività"

### UPDATE Operations - Priority
**Handler:** `UpdateTaskPriorityHandler` | **Intent:** `UpdateTaskPriorityIntent`

#### Set Priority
- "imposta priorità attività a alta"
- "cambia priorità a bassa"
- "rendi priorità normale"
- "aggiorna priorità attività a urgente"
- "imposta priorità comprare il latte a alta"
- "cambia priorità finire rapporto a bassa"
- "rendi priorità comprare spesa normale"

#### General Priority Updates
- "imposta priorità attività"
- "cambia priorità"
- "aggiorna priorità attività"
- "rendi priorità alta"
- "imposta priorità a bassa"

### UPDATE Operations - Due Date
**Handler:** `UpdateDueDateHandler` | **Intent:** `UpdateDueDateIntent`

#### Change Due Date
- "cambia data di scadenza per comprare il latte a domani"
- "imposta data di scadenza finire rapporto a venerdì"
- "aggiorna data di scadenza chiamare cliente a la prossima settimana"
- "riprogramma comprare spesa a lunedì"
- "cambia la data di scadenza"
- "imposta data di scadenza"
- "aggiorna data di scadenza"
- "riprogramma attività"

### UPDATE Operations - Category
**Handler:** `UpdateTaskCategoryHandler` | **Intent:** `UpdateTaskCategoryIntent`

#### Change Category
- "imposta categoria comprare il latte a personale"
- "cambia finire rapporto a categoria lavoro"
- "aggiorna categoria chiamare cliente a lavoro"
- "rendi comprare spesa un'attività personale"
- "imposta categoria attività"
- "cambia categoria attività"
- "sposta attività in categoria lavoro"

### UPDATE Operations - Reorder
**Handler:** `ReorderTaskHandler` | **Intent:** `ReorderTaskIntent`

#### Move Task Position
- "sposta comprare il latte a primo"
- "metti finire rapporto in cima"
- "sposta chiamare cliente a seconda posizione"
- "riordina comprare spesa in fondo"
- "sposta attività a primo"
- "metti attività in cima"
- "riordina attività"

### DELETE Operations
**Handler:** `DeleteTaskHandler` | **Intent:** `DeleteTaskIntent`

#### Delete Tasks
- "elimina comprare il latte"
- "rimuovi finire il rapporto"
- "cancella chiamare cliente"
- "elimina comprare spesa"
- "elimina l'attività presentazione"
- "rimuovi finire rapporto"
- "cancella comprare il latte"
- "elimina attività comprare il latte"

---

## French (fr-FR)

### CREATE Operations
**Handler:** `AddTaskHandler` | **Intent:** `CreateTaskIntent`

#### Simple Task Creation
- "ajouter acheter du lait"
- "ajouter appeler maman"
- "ajouter terminer le rapport"
- "ajouter prendre rendez-vous chez le dentiste"
- "créer une tâche pour réviser le budget"
- "rappelle-moi d'arroser les plantes"
- "ajouter faire les courses"

#### Task with Date/Time
- "ajouter acheter du lait demain"
- "ajouter terminer rapport aujourd'hui"
- "ajouter appeler client la semaine prochaine"
- "ajouter soumettre candidature avant vendredi"
- "ajouter préparer présentation pour lundi"
- "ajouter programmer réunion le mois prochain"
- "ajouter compléter projet avant le 15 décembre"
- "ajouter réviser documents dans 3 jours"

#### Task with Priority
- "ajouter tâche urgente corriger le bug"
- "ajouter priorité élevée appeler contact d'urgence"
- "ajouter priorité basse organiser bureau"
- "ajouter priorité normale mettre à jour site web"
- "ajouter acheter du lait priorité élevée"
- "ajouter terminer rapport priorité basse"

#### Task with Category
- "ajouter tâche travail préparer présentation"
- "ajouter tâche personnelle faire les courses"
- "ajouter travail programmer réunion équipe"
- "ajouter personnelle appeler grand-mère"

#### Task with Multiple Attributes
- "ajouter tâche travail priorité élevée terminer rapport avant vendredi"
- "ajouter tâche personnelle acheter du lait demain"
- "ajouter tâche travail urgente appeler client aujourd'hui"
- "ajouter tâche personnelle priorité basse organiser placard la semaine prochaine"

#### Embedded Information in Task Name
- "ajouter acheter du lait priorité élevée demain"
- "ajouter terminer rapport tâche travail avant vendredi"
- "ajouter urgent appeler client aujourd'hui"
- "ajouter personnelle faire les courses priorité basse"

### READ Operations
**Handler:** `QueryTasksHandler` | **Intent:** `ReadTasksIntent`

#### List All Tasks
- "montre mes tâches"
- "lis mes tâches"
- "liste mes tâches"
- "quelles sont mes tâches"
- "dis-moi mes tâches"
- "qu'est-ce que j'ai à faire"
- "montre-moi tout"

#### Filter by Status
- "montre mes tâches à faire"
- "lis mes tâches en cours"
- "liste tâches terminées"
- "montre tâches faites"
- "quelles tâches sont en cours"
- "montre tâches qui sont terminées"

#### Filter by Priority
- "montre mes tâches priorité élevée"
- "lis tâches priorité basse"
- "liste tâches priorité normale"
- "quelles sont mes tâches urgentes"
- "montre éléments priorité élevée"
- "dis-moi tâches priorité basse"

#### Filter by Category
- "montre mes tâches travail"
- "lis tâches personnelles"
- "liste éléments travail"
- "quelles sont mes tâches personnelles"
- "montre tâches liées au travail"
- "dis-moi éléments personnels"

#### Filter by Date
- "montre tâches échéance aujourd'hui"
- "lis tâches échéance demain"
- "liste tâches échéance la semaine prochaine"
- "qu'est-ce qui est dû cette semaine"
- "montre tâches échues"
- "quelles tâches sont dues bientôt"

#### Combined Filters
- "montre tâches travail priorité élevée"
- "lis tâches personnelles terminées"
- "liste tâches en cours échéance aujourd'hui"
- "montre éléments travail urgents échéance demain"

### UPDATE Operations - Status
**Handler:** `UpdateTaskStatusHandler` | **Intent:** `UpdateTaskStatusIntent`

#### Mark as Complete
- "marque acheter du lait comme terminé"
- "complète terminer le rapport"
- "définis acheter courses à terminé"
- "marque appeler client comme complété"
- "complète la tâche présentation"
- "marque comme terminé terminer rapport"
- "définis statut à terminé pour acheter du lait"

#### Mark as In Process
- "marque terminer rapport comme en cours"
- "définis acheter courses à en cours"
- "met à jour statut appeler client à en cours"
- "marque la présentation comme en cours"
- "définis statut à en cours pour terminer rapport"

#### Mark as To Do
- "marque acheter du lait comme à faire"
- "définis terminer rapport à à faire"
- "met à jour statut appeler client à à faire"
- "marque la présentation comme à faire"

#### General Status Updates
- "marque une tâche comme terminé"
- "met à jour le statut d'une tâche à en cours"
- "définis statut à à faire"
- "complète une tâche"
- "change statut tâche"

### UPDATE Operations - Priority
**Handler:** `UpdateTaskPriorityHandler` | **Intent:** `UpdateTaskPriorityIntent`

#### Set Priority
- "définis priorité tâche à élevée"
- "change priorité à basse"
- "rends priorité normale"
- "met à jour priorité tâche à urgente"
- "définis priorité acheter du lait à élevée"
- "change priorité terminer rapport à basse"
- "rends priorité faire courses normale"

#### General Priority Updates
- "définis priorité tâche"
- "change priorité"
- "met à jour priorité tâche"
- "rends priorité élevée"
- "définis priorité à basse"

### UPDATE Operations - Due Date
**Handler:** `UpdateDueDateHandler` | **Intent:** `UpdateDueDateIntent`

#### Change Due Date
- "change date d'échéance pour acheter du lait à demain"
- "définis date d'échéance terminer rapport à vendredi"
- "met à jour date d'échéance appeler client à la semaine prochaine"
- "reprogramme faire courses à lundi"
- "change la date d'échéance"
- "définis date d'échéance"
- "met à jour date d'échéance"
- "reprogramme tâche"

### UPDATE Operations - Category
**Handler:** `UpdateTaskCategoryHandler` | **Intent:** `UpdateTaskCategoryIntent`

#### Change Category
- "définis catégorie acheter du lait à personnelle"
- "change terminer rapport à catégorie travail"
- "met à jour catégorie appeler client à travail"
- "rends faire courses une tâche personnelle"
- "définis catégorie tâche"
- "change catégorie tâche"
- "déplace tâche dans catégorie travail"

### UPDATE Operations - Reorder
**Handler:** `ReorderTaskHandler` | **Intent:** `ReorderTaskIntent`

#### Move Task Position
- "déplace acheter du lait à premier"
- "mets terminer rapport en haut"
- "déplace appeler client à deuxième position"
- "réordonne faire courses en bas"
- "déplace tâche à premier"
- "mets tâche en haut"
- "réordonne tâche"

### DELETE Operations
**Handler:** `DeleteTaskHandler` | **Intent:** `DeleteTaskIntent`

#### Delete Tasks
- "supprime acheter du lait"
- "enlève terminer le rapport"
- "efface appeler client"
- "supprime faire les courses"
- "supprime la tâche présentation"
- "enlève terminer rapport"
- "efface acheter du lait"
- "supprime tâche acheter du lait"

---

## Spanish (es-ES)

### CREATE Operations
**Handler:** `AddTaskHandler` | **Intent:** `CreateTaskIntent`

#### Simple Task Creation
- "agregar comprar leche"
- "añadir llamar a mamá"
- "agregar terminar el informe"
- "agregar programar cita con el dentista"
- "crear una tarea para revisar el presupuesto"
- "recuérdame regar las plantas"
- "agregar hacer la compra"

#### Task with Date/Time
- "agregar comprar leche mañana"
- "agregar terminar informe hoy"
- "agregar llamar cliente la próxima semana"
- "agregar enviar solicitud antes del viernes"
- "agregar preparar presentación para lunes"
- "agregar programar reunión el próximo mes"
- "agregar completar proyecto antes del 15 de diciembre"
- "agregar revisar documentos en 3 días"

#### Task with Priority
- "agregar tarea urgente arreglar el error"
- "agregar prioridad alta llamar contacto de emergencia"
- "agregar prioridad baja organizar escritorio"
- "agregar prioridad normal actualizar sitio web"
- "agregar comprar leche prioridad alta"
- "agregar terminar informe prioridad baja"

#### Task with Category
- "agregar tarea trabajo preparar presentación"
- "agregar tarea personal hacer la compra"
- "agregar trabajo programar reunión equipo"
- "agregar personal llamar a abuela"

#### Task with Multiple Attributes
- "agregar tarea trabajo prioridad alta terminar informe antes del viernes"
- "agregar tarea personal comprar leche mañana"
- "agregar tarea trabajo urgente llamar cliente hoy"
- "agregar tarea personal prioridad baja organizar armario la próxima semana"

#### Embedded Information in Task Name
- "agregar comprar leche prioridad alta mañana"
- "agregar terminar informe tarea trabajo antes del viernes"
- "agregar urgente llamar cliente hoy"
- "agregar personal hacer la compra prioridad baja"

### READ Operations
**Handler:** `QueryTasksHandler` | **Intent:** `ReadTasksIntent`

#### List All Tasks
- "muestra mis tareas"
- "lee mis tareas"
- "lista mis tareas"
- "cuáles son mis tareas"
- "dime mis tareas"
- "qué tengo que hacer"
- "muéstrame todo"

#### Filter by Status
- "muestra mis tareas por hacer"
- "lee mis tareas en proceso"
- "lista tareas completadas"
- "muestra tareas hechas"
- "cuáles tareas están en proceso"
- "muestra tareas que están completadas"

#### Filter by Priority
- "muestra mis tareas prioridad alta"
- "lee tareas prioridad baja"
- "lista tareas prioridad normal"
- "cuáles son mis tareas urgentes"
- "muestra elementos prioridad alta"
- "dime tareas prioridad baja"

#### Filter by Category
- "muestra mis tareas trabajo"
- "lee tareas personales"
- "lista elementos trabajo"
- "cuáles son mis tareas personales"
- "muestra tareas relacionadas con el trabajo"
- "dime elementos personales"

#### Filter by Date
- "muestra tareas vencimiento hoy"
- "lee tareas vencimiento mañana"
- "lista tareas vencimiento la próxima semana"
- "qué vence esta semana"
- "muestra tareas vencidas"
- "cuáles tareas vencen pronto"

#### Combined Filters
- "muestra tareas trabajo prioridad alta"
- "lee tareas personales completadas"
- "lista tareas en proceso vencimiento hoy"
- "muestra elementos trabajo urgentes vencimiento mañana"

### UPDATE Operations - Status
**Handler:** `UpdateTaskStatusHandler` | **Intent:** `UpdateTaskStatusIntent`

#### Mark as Complete
- "marca comprar leche como hecho"
- "completa terminar el informe"
- "establece hacer la compra a hecho"
- "marca llamar cliente como completado"
- "completa la tarea presentación"
- "marca como hecho terminar informe"
- "establece estado a hecho para comprar leche"

#### Mark as In Process
- "marca terminar informe como en proceso"
- "establece hacer la compra a en proceso"
- "actualiza estado llamar cliente a en proceso"
- "marca la presentación como en proceso"
- "establece estado a en proceso para terminar informe"

#### Mark as To Do
- "marca comprar leche como por hacer"
- "establece terminar informe a por hacer"
- "actualiza estado llamar cliente a por hacer"
- "marca la presentación como por hacer"

#### General Status Updates
- "marca una tarea como hecho"
- "actualiza el estado de una tarea a en proceso"
- "establece estado a por hacer"
- "completa una tarea"
- "cambia estado tarea"

### UPDATE Operations - Priority
**Handler:** `UpdateTaskPriorityHandler` | **Intent:** `UpdateTaskPriorityIntent`

#### Set Priority
- "establece prioridad tarea a alta"
- "cambia prioridad a baja"
- "haz prioridad normal"
- "actualiza prioridad tarea a urgente"
- "establece prioridad comprar leche a alta"
- "cambia prioridad terminar informe a baja"
- "haz prioridad hacer la compra normal"

#### General Priority Updates
- "establece prioridad tarea"
- "cambia prioridad"
- "actualiza prioridad tarea"
- "haz prioridad alta"
- "establece prioridad a baja"

### UPDATE Operations - Due Date
**Handler:** `UpdateDueDateHandler` | **Intent:** `UpdateDueDateIntent`

#### Change Due Date
- "cambia fecha de vencimiento para comprar leche a mañana"
- "establece fecha de vencimiento terminar informe a viernes"
- "actualiza fecha de vencimiento llamar cliente a la próxima semana"
- "reprograma hacer la compra a lunes"
- "cambia la fecha de vencimiento"
- "establece fecha de vencimiento"
- "actualiza fecha de vencimiento"
- "reprograma tarea"

### UPDATE Operations - Category
**Handler:** `UpdateTaskCategoryHandler` | **Intent:** `UpdateTaskCategoryIntent`

#### Change Category
- "establece categoría comprar leche a personal"
- "cambia terminar informe a categoría trabajo"
- "actualiza categoría llamar cliente a trabajo"
- "haz hacer la compra una tarea personal"
- "establece categoría tarea"
- "cambia categoría tarea"
- "mueve tarea a categoría trabajo"

### UPDATE Operations - Reorder
**Handler:** `ReorderTaskHandler` | **Intent:** `ReorderTaskIntent`

#### Move Task Position
- "mueve comprar leche a primero"
- "pon terminar informe en la parte superior"
- "mueve llamar cliente a segunda posición"
- "reordena hacer la compra al final"
- "mueve tarea a primero"
- "pon tarea en la parte superior"
- "reordena tarea"

### DELETE Operations
**Handler:** `DeleteTaskHandler` | **Intent:** `DeleteTaskIntent`

#### Delete Tasks
- "elimina comprar leche"
- "quita terminar el informe"
- "borra llamar cliente"
- "elimina hacer la compra"
- "elimina la tarea presentación"
- "quita terminar informe"
- "borra comprar leche"
- "elimina tarea comprar leche"

---

## Testing Notes

### Handler Verification
Each sentence in this document has been mapped to its corresponding handler. When testing:

1. **Create Operations**: Verify that `AddTaskHandler` correctly parses embedded information (dates, priorities, categories) from the `taskName` slot.

2. **Read Operations**: Verify that `QueryTasksHandler` correctly filters tasks based on the provided slots (status, priority, category, dueDateTime).

3. **Update Operations**: Verify that each update handler correctly identifies the task and updates the appropriate field:
   - `UpdateTaskStatusHandler` updates status
   - `UpdateTaskPriorityHandler` updates priority
   - `UpdateDueDateHandler` updates due date
   - `UpdateTaskCategoryHandler` updates category
   - `ReorderTaskHandler` reorders task position

4. **Delete Operations**: Verify that `DeleteTaskHandler` correctly identifies and deletes the specified task.

### Language-Specific Considerations

- **Date Parsing**: All languages use `chrono-node` for date parsing, which supports natural language dates in multiple languages.
- **Keyword Extraction**: The parsing utilities (`parsing.ts`) include language-specific keywords for extracting priority, status, and category from natural language.
- **Dialog Management**: When slots are missing, Alexa's dialog management will elicit them using the prompts defined in each interaction model.

### Edge Cases to Test

1. **Embedded Information**: Test sentences where task name contains priority, category, or date information (e.g., "add buy milk high priority tomorrow").
2. **Missing Slots**: Test sentences that trigger dialog elicitation for required slots.
3. **Ambiguous Task Names**: Test with task names that might be confused with other commands.
4. **Multiple Filters**: Test read operations with multiple filter criteria.
5. **Natural Variations**: Test variations in phrasing that users might naturally use.

---

## Summary

This document provides **200+ sample sentences** across **4 languages** covering **all CRUD operations**:

- ✅ **Create**: 40+ sentences per language
- ✅ **Read**: 30+ sentences per language  
- ✅ **Update**: 50+ sentences per language (status, priority, due date, category, reorder)
- ✅ **Delete**: 8+ sentences per language

All sentences are mapped to their corresponding backend handlers and are ready for comprehensive testing of the Voice Planner Alexa skill.

