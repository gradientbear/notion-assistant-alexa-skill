**1. READING / QUERYING COMMANDS**

**1.1 Simple List Queries**

  -----------------------------------------------------------------------
  **User Says**    **Alexa Should        **Example Output**
                   Return**              
  ---------------- --------------------- --------------------------------
  \"Alexa, what    Read all tasks from   \"You have 5 tasks: Buy
  are my tasks?\"  default database      groceries, Call mom, Finish
                                         report, Gym session, Review
                                         notes\"

  \"Alexa, what    Filter and read only  \"Your high priority tasks are:
  are my high      high-priority items   Finish report, Call dentist\"
  priority                               
  tasks?\"                               

  \"Alexa, what\'s Read to-do items      \"Your to-do items are: Email
  on my to-do                            client, Prepare presentation,
  list?\"                                Buy coffee\"

  \"Alexa, read my Read today\'s tasks   \"Today you have: Team meeting
  tasks for                              at 10am, Lunch with Sarah, Gym
  today\"                                at 6pm\"

  \"Alexa, what    Read incomplete tasks \"You have 3 pending tasks\...\"
  are my pending   (status = To Do or In 
  tasks?\"         Progress)             
  -----------------------------------------------------------------------

**1.2 Specific Category Queries**

  ------------------------------------------------------------------------
  **User Says**         **Alexa Should     **Example Output**
                        Return**           
  --------------------- ------------------ -------------------------------
  \"Alexa, what\'s my   Read               \"Your workout plan: Chest day,
  workout plan?\"       fitness-related    5km run, Yoga session\"
                        tasks              

  \"Alexa, read my      Read shopping      \"Milk, bread, eggs, chicken,
  grocery list\"        items              vegetables\"

  \"Alexa, what are my  Read               \"Your work tasks: Finish
  work tasks?\"         work-categorized   report, Email client, Team
                        items              meeting prep\"

  \"Alexa, tell me my   Read personal      \"Your reminders: Call mom,
  personal reminders\"  category items     Birthday gift for John, Car
                                           service\"
  ------------------------------------------------------------------------

**1.3 Date-Based Queries**

  -----------------------------------------------------------------------
  **User Says**        **Alexa Should    **Example Output**
                       Return**          
  -------------------- ----------------- --------------------------------
  \"Alexa, what\'s due Read tasks due    \"Tomorrow you have: Project
  tomorrow?\"          tomorrow          deadline, Doctor appointment\"

  \"Alexa, what\'s due Read tasks due    \"This week: 3 tasks due\"
  this week?\"         within 7 days     

  \"Alexa, what\'s     Read past-due     \"You have 2 overdue tasks:
  overdue?\"           tasks             Follow-up email, Return book\"

  \"Alexa, when is my  Return the        \"Your next deadline is
  next deadline?\"     nearest due date  tomorrow: Project deadline\"
  -----------------------------------------------------------------------

**1.4 Status-Based Queries**

  ------------------------------------------------------------------------
  **User Says**       **Alexa Should       **Example Output**
                      Return**             
  ------------------- -------------------- -------------------------------
  \"Alexa, what am I  Read in-progress     \"You\'re currently working on:
  working on?\"       items                Website redesign, Learning
                                           Italian\"

  \"Alexa, what have  Read completed items \"You\'ve completed 8 tasks
  I completed?\"                           this week\"

  \"Alexa, what\'s    Read completed items \"You completed: Gym session,
  done this week?\"   from this week       Report done, Client call\"
  ------------------------------------------------------------------------

**1.5 Custom Field Queries (Examples)**

  ------------------------------------------------------------------------
  **User Says**           **Alexa Should       **Example Output**
                          Return**             
  ----------------------- -------------------- ---------------------------
  \"Alexa, how many       Read and sum calorie \"You\'ve logged 1,800
  calories did I log      entries              calories today\"
  today?\"                                     

  \"Alexa, what workouts  Read workout         \"This week: Chest day, 5km
  did I do?\"             database entries     run, Yoga, Cardio\"

  \"Alexa, read my notes  Read note entries    \"Your notes: Meeting
  from yesterday\"        from specific date   insights, Task ideas,
                                               Reminder\"
  ------------------------------------------------------------------------

**2. ADDING / INSERTING COMMANDS**

**2.1 Simple Task Addition**

  ------------------------------------------------------------------------
  **User Says**         **Alexa               **Backend Action**
                        Confirmation**        
  --------------------- --------------------- ----------------------------
  \"Alexa, add buy milk \"Added: Buy milk to  Create new item: Name=\"Buy
  to my to-do list\"    your to-do list\"     milk\", Status=\"To Do\"

  \"Alexa, add call     \"Added: Call mom to  Create new item: Name=\"Call
  mom\"                 your tasks\"          mom\"

  \"Alexa, remind me to \"Added: Finish the   Create reminder item
  finish the report\"   report\"              
  ------------------------------------------------------------------------

**2.2 Task with Priority**

  -----------------------------------------------------------------------
  **User Says**           **Alexa Confirmation**    **Backend Action**
  ----------------------- ------------------------- ---------------------
  \"Alexa, add high       \"Added high priority     Create item with
  priority: finish        task: Finish project\"    Priority=\"High\"
  project\"                                         

  \"Alexa, add low        \"Added low priority      Create item with
  priority: organize      task: Organize closet\"   Priority=\"Low\"
  closet\"                                          

  \"Alexa, add urgent     \"Added urgent task: Call Create item with
  task: call client\"     client\"                  Priority=\"High\"
  -----------------------------------------------------------------------

**2.3 Task with Due Date**

  ------------------------------------------------------------------------
  **User Says**           **Alexa Confirmation**  **Backend Action**
  ----------------------- ----------------------- ------------------------
  \"Alexa, add finish     \"Added: Finish report, Create item with
  report due tomorrow\"   due tomorrow\"          Due_Date=tomorrow

  \"Alexa, add gym        \"Added: Gym session    Create item with
  session due today\"     for today\"             Due_Date=today

  \"Alexa, add dentist    \"Added: Dentist        Create item with
  appointment due         appointment, due        Due_Date=Friday
  Friday\"                Friday\"                

  \"Alexa, add project    \"Added: Project        Create item with
  deadline in 3 days\"    deadline, due in 3      Due_Date=+3days
                          days\"                  
  ------------------------------------------------------------------------

**2.4 Task with Priority + Due Date**

  ------------------------------------------------------------------------
  **User Says**         **Alexa Confirmation**  **Backend Action**
  --------------------- ----------------------- --------------------------
  \"Alexa, add high     \"Added high priority   Create item with
  priority: finish      task: Finish report,    Priority=\"High\",
  report due tomorrow\" due tomorrow\"          Due_Date=tomorrow

  \"Alexa, add urgent:  \"Added: Client call    Create urgent item for
  client call today\"   for today\"             today
  ------------------------------------------------------------------------

**2.5 Task with Category**

  -----------------------------------------------------------------------
  **User Says**            **Alexa Confirmation** **Backend Action**
  ------------------------ ---------------------- -----------------------
  \"Alexa, add workout:    \"Added to fitness:    Create item with
  chest day\"              Chest day\"            Category=\"Fitness\"

  \"Alexa, add to work:    \"Added to work:       Create item with
  finish presentation\"    Finish presentation\"  Category=\"Work\"

  \"Alexa, add to          \"Added to shopping:   Create 3 items in
  shopping: milk, eggs,    Milk, eggs, bread\"    shopping list
  bread\"                                         
  -----------------------------------------------------------------------

**2.6 Complex Task Addition (Multiple Properties)**

  ------------------------------------------------------------------------
  **User Says**         **Alexa Confirmation**  **Backend Action**
  --------------------- ----------------------- --------------------------
  \"Alexa, add high     \"Added: Finish client  Create item:
  priority work task:   report to work tasks,   Priority=\"High\",
  finish client report, high priority, due      Category=\"Work\",
  due Monday\"          Monday\"                Due_Date=Monday

  \"Alexa, add urgent:  \"Added urgent fitness  Create item:
  gym session today,    task: Gym session for   Priority=\"High\",
  fitness\"             today\"                 Category=\"Fitness\",
                                                Due_Date=today
  ------------------------------------------------------------------------

**2.7 Calorie/Fitness Logging**

  ------------------------------------------------------------------------
  **User Says**            **Alexa Confirmation** **Backend Action**
  ------------------------ ---------------------- ------------------------
  \"Alexa, log 500         \"Logged 500           Add entry to calorie
  calories\"               calories\"             database: Calories=500

  \"Alexa, add workout:    \"Added: Chest day, 45 Create fitness entry
  chest day, 45 minutes\"  minutes\"              with duration

  \"Alexa, log meal:       \"Logged: Chicken and  Create meal entry
  chicken and rice, 650    rice, 650 calories\"   
  calories\"                                      
  ------------------------------------------------------------------------

**3. UPDATING / MODIFYING COMMANDS**

**3.1 Mark Complete**

  -----------------------------------------------------------------------
  **User Says**             **Alexa Confirmation**   **Backend Action**
  ------------------------- ------------------------ --------------------
  \"Alexa, mark finish      \"Marked: Finish report  Update item
  report as done\"          as complete\"            Status=\"Done\"

  \"Alexa, complete gym     \"Completed: Gym         Update
  session\"                 session\"                Status=\"Done\"

  \"Alexa, mark all         \"Marked 5 tasks as      Batch update
  today\'s tasks as done\"  complete\"               today\'s items
  -----------------------------------------------------------------------

**3.2 Change Priority**

  -----------------------------------------------------------------------
  **User Says**            **Alexa Confirmation**    **Backend Action**
  ------------------------ ------------------------- --------------------
  \"Alexa, make client     \"Updated: Client call to Update item
  call high priority\"     high priority\"           Priority=\"High\"

  \"Alexa, lower priority  \"Updated: Grocery list   Update item
  on grocery list\"        to low priority\"         Priority=\"Low\"
  -----------------------------------------------------------------------

**3.3 Change Status**

  -----------------------------------------------------------------------
  **User Says**            **Alexa Confirmation**     **Backend Action**
  ------------------------ -------------------------- -------------------
  \"Alexa, set gym session \"Updated: Gym session to  Update Status=\"In
  to in progress\"         in progress\"              Progress\"

  \"Alexa, move report to  \"Updated: Report moved to Update Status=\"In
  in progress\"            in progress\"              Progress\"
  -----------------------------------------------------------------------

**4. DELETION COMMANDS**

  -----------------------------------------------------------------------
  **User Says**           **Alexa               **Backend Action**
                          Confirmation**        
  ----------------------- --------------------- -------------------------
  \"Alexa, delete buy     \"Deleted: Buy milk   Remove item from database
  milk\"                  from your list\"      

  \"Alexa, remove dentist \"Removed: Dentist    Delete item
  appointment\"           appointment\"         

  \"Alexa, delete         \"Deleted all         Batch delete items with
  completed tasks\"       completed tasks\"     Status=\"Done\"
  -----------------------------------------------------------------------

**5. SUMMARY / STATS COMMANDS**

  -----------------------------------------------------------------------
  **User Says**            **Alexa Should  **Example Output**
                           Return**        
  ------------------------ --------------- ------------------------------
  \"Alexa, how many tasks  Count and       \"You have 12 tasks\"
  do I have?\"             return total    

  \"Alexa, how many tasks  Count completed \"You\'ve completed 8 tasks\"
  are done?\"              items           

  \"Alexa, give me a       Overview of all \"Total tasks: 12. Completed:
  summary\"                statuses        8. In progress: 2. To do: 2\"

  \"Alexa, what\'s my      Summary stats   \"This week: 15 completed, 3
  productivity this                        pending, 1 overdue\"
  week?\"                                  

  \"Alexa, how many        Sum custom      \"You\'ve logged 1,800
  calories have I          field           calories today\"
  logged?\"                                
  -----------------------------------------------------------------------

**6. TECHNICAL NOTES FOR DEVELOPER**

**Database Structure Expected:**

text

Notion Database Fields:

\- Item Name (Text)

\- Priority (Select: High, Medium, Low)

\- Due Date (Date)

\- Status (Select: To Do, In Progress, Done)

\- Category (Select: Work, Personal, Fitness, Shopping, etc.)

\- Notes (Text - optional)

\- Custom Fields (Calories, Duration, etc. - optional)

**Voice Command Parsing Requirements:**

-   Extract item name

-   Detect priority keywords (urgent, important, high, low, etc.)

-   Parse dates (today, tomorrow, Monday, \"in 3 days\", etc.)

-   Identify categories from context

-   Handle natural language variations

**7. USER SCENARIOS**

**Scenario 1: Morning Routine**

text

User: \"Alexa, what\'s my schedule for today?\"

Alexa: \"You have 5 tasks today: Team meeting at 10am, Lunch with Sarah,
Finish report, Gym at 6pm, Buy groceries\"

User: \"Alexa, add urgent: call client before 5pm\"

Alexa: \"Added: Call client, high priority, due today\"

**Scenario 2: Fitness Tracking**

text

User: \"Alexa, log my workout\"

Alexa: \"What workout did you do?\"

User: \"Chest day, 45 minutes\"

Alexa: \"Logged: Chest day, 45 minutes\"

User: \"Alexa, how many workouts this week?\"

Alexa: \"You completed 4 workouts this week\"

**Scenario 3: Shopping List**

text

User: \"Alexa, add to shopping: milk, eggs, bread\"

Alexa: \"Added to shopping: Milk, eggs, bread\"

User: \"Alexa, read my shopping list\"

Alexa: \"Your shopping list: Milk, eggs, bread, chicken, vegetables\"

User: \"Alexa, mark milk as done\"

Alexa: \"Marked: Milk as complete\"
