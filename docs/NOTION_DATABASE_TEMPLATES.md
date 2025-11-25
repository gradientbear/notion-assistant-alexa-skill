# Notion Database Templates

This guide provides step-by-step instructions for creating the required Notion databases.

## Quick Setup

You can create these databases manually or duplicate a template if provided. The exact property names and types are critical for the skill to work correctly.

## Recommended Structure

**We recommend creating a dedicated page for privacy and organizing all three databases on that page.**

1. Create a new page in your Notion workspace (e.g., "Privacy" or "Alexa Skill Data")
2. Add all three databases to this page (as inline tables or full-page databases)
3. This keeps your task management data organized and separate from other workspace content

**Benefits:**
- Better organization and privacy
- Easier to find and manage all skill-related data
- Cleaner workspace structure

## Database 1: Tasks

### Create Database

1. In your Notion workspace, create a new page (recommended: "Privacy" or "Alexa Skill Data")
2. Type `/database` and select "Table - Inline" or "Table - Full page"
3. Name the database: **Tasks** (exact name, case-sensitive)

### Add Properties

Click the "+" button in the table header to add properties:

1. **Task Name** (Title)
   - Type: Title
   - This is the default property, already exists

2. **Priority** (Select)
   - Type: Select
   - Options: `High`, `Medium`, `Low`
   - Default: `Medium`

3. **Due Date** (Date)
   - Type: Date
   - Include time: No (optional)

4. **Status** (Select)
   - Type: Select
   - Options: `To Do`, `In Progress`, `Done`
   - Default: `To Do`

5. **Category** (Select)
   - Type: Select
   - Options: `Work`, `Personal`, `Fitness`, `Shopping`
   - Default: `Personal`

6. **Notes** (Text)
   - Type: Text
   - Optional field for additional information

### Final Structure

Your Tasks database should look like this:

```
Tasks
├── Task Name (Title) *
├── Priority (Select: High, Medium, Low)
├── Due Date (Date)
├── Status (Select: To Do, In Progress, Done)
├── Category (Select: Work, Personal, Fitness, Shopping)
└── Notes (Text)
```

## Database 2: Focus_Logs

### Create Database

1. On the same page where you created Tasks (or create a new page)
2. Type `/database` and select "Table - Inline" or "Table - Full page"
3. Name the database: **Focus_Logs** (exact name, case-sensitive, with underscore)

### Add Properties

1. **Date** (Date)
   - Type: Date
   - Include time: No
   - Default: Today

2. **Duration (minutes)** (Number)
   - Type: Number
   - Format: Number
   - This will store the focus session duration in minutes

3. **Focus Level** (Select)
   - Type: Select
   - Options: `Low`, `Medium`, `High`
   - Default: `Medium`

4. **Notes** (Text)
   - Type: Text
   - Optional field

### Final Structure

```
Focus_Logs
├── Date (Date) *
├── Duration (minutes) (Number)
├── Focus Level (Select: Low, Medium, High)
└── Notes (Text)
```

## Database 3: Energy_Logs

### Create Database

1. On the same page where you created Tasks and Focus_Logs (or create a new page)
2. Type `/database` and select "Table - Inline" or "Table - Full page"
3. Name the database: **Energy_Logs** (exact name, case-sensitive, with underscore)

### Add Properties

1. **Date** (Date)
   - Type: Date
   - Include time: No
   - Default: Today

2. **Energy Level** (Select)
   - Type: Select
   - Options: `Low`, `Medium`, `High`
   - Default: `Medium`

3. **Time of Day** (Select)
   - Type: Select
   - Options: `Morning`, `Afternoon`, `Evening`
   - Default: `Morning`

4. **Notes** (Text)
   - Type: Text
   - Optional field

### Final Structure

```
Energy_Logs
├── Date (Date) *
├── Energy Level (Select: Low, Medium, High)
├── Time of Day (Select: Morning, Afternoon, Evening)
└── Notes (Text)
```

## Verification Checklist

Before using the skill, verify:

- [ ] All three databases exist: `Tasks`, `Focus_Logs`, `Energy_Logs`
- [ ] Database names match exactly (case-sensitive)
- [ ] All required properties are present
- [ ] Select property options match exactly (e.g., "To Do" not "Todo")
- [ ] Databases are accessible (not archived or in trash)

## Common Mistakes

### ❌ Wrong Database Names

- `tasks` (lowercase) - Should be `Tasks`
- `Focus Logs` (space) - Should be `Focus_Logs` (underscore)
- `EnergyLogs` (no underscore) - Should be `Energy_Logs`

### ❌ Wrong Property Names

- `Task` instead of `Task Name`
- `Duration` instead of `Duration (minutes)`
- `Focus` instead of `Focus Level`

### ❌ Wrong Select Options

- `Todo` instead of `To Do`
- `in-progress` instead of `In Progress`
- `high` (lowercase) instead of `High`

## Testing Your Setup

After creating the databases:

1. Add a test task manually in Notion
2. Enable the Alexa skill
3. Link your Notion account
4. Try: "Alexa, what's my priority?"
5. Verify the task appears in the response

## Need Help?

If the skill can't find your databases:

1. Double-check database names (case-sensitive)
2. Verify property names match exactly
3. Ensure databases are in your main workspace (not archived)
4. Check that your Notion integration has access to the workspace

## Template Export (Optional)

If you'd like to share these templates with others, you can:

1. Create the databases as described above
2. In Notion, click the "..." menu on the database
3. Select "Export" → "Markdown & CSV"
4. Share the exported file

---

**Remember:** The skill searches for databases by name, so exact matching is critical!

