# Notion Assistant Alexa Skill - User Guide

## Welcome!

The Notion Assistant Alexa Skill helps you manage your tasks and track your productivity using voice commands with your Alexa device, all synced to your Notion workspace.

## Getting Started

### Prerequisites

- An Alexa-enabled device (Echo, Echo Dot, etc.)
- A Notion account
- A valid license key
- Three Notion databases set up (see below)

### Step 1: Set Up Notion Databases

Before using the skill, you need to create three databases in your Notion workspace:

#### 1. Tasks Database

Create a database named **"Tasks"** with the following properties:

| Property Name | Type | Options |
|--------------|------|---------|
| Task Name | Title | - |
| Priority | Select | High, Medium, Low |
| Due Date | Date | - |
| Status | Select | To Do, In Progress, Done |
| Category | Select | Work, Personal, Fitness, Shopping |
| Notes | Text | - |

#### 2. Focus Logs Database

Create a database named **"Focus_Logs"** with the following properties:

| Property Name | Type | Options |
|--------------|------|---------|
| Date | Date | - |
| Duration (minutes) | Number | - |
| Focus Level | Select | Low, Medium, High |
| Notes | Text | - |

#### 3. Energy Logs Database

Create a database named **"Energy_Logs"** with the following properties:

| Property Name | Type | Options |
|--------------|------|---------|
| Date | Date | - |
| Energy Level | Select | Low, Medium, High |
| Time of Day | Select | Morning, Afternoon, Evening |
| Notes | Text | - |

**Important:** The database names must match exactly (case-sensitive).

### Step 2: Enable the Skill

1. Open the Alexa app on your phone
2. Search for "Notion Assistant"
3. Click "Enable" or "Link Account"
4. You'll be redirected to the web login page

### Step 3: Link Your Notion Account

1. Enter your email address
2. Enter your license key
3. Click "Link Notion Account"
4. You'll be redirected to Notion to authorize access
5. Click "Allow" to grant permissions
6. You'll be redirected back to confirm the link

### Step 4: Start Using the Skill

Say: **"Alexa, open Notion Assistant"**

## Voice Commands

### Brain Dump

Add multiple tasks quickly:

- **"Alexa, dump my brain"**
- Alexa will ask for your tasks
- List them one by one: "Buy groceries, Call mom, Finish report"
- Say "done" when finished
- All tasks are added to your Notion Tasks database

### Priority List

Get your top 3 priority tasks:

- **"Alexa, what's my priority?"**
- Alexa reads your top 3 tasks sorted by priority and due date

### Focus Timer

Start a 25-minute Pomodoro session:

- **"Alexa, start focus timer"**
- Timer starts and session is logged to Focus_Logs

### Energy Tracker

Log your energy level:

- **"Alexa, log energy 7"**
- Energy level (1-10) is mapped to Low (1-3), Medium (4-7), or High (8-10)
- Automatically logged with current time of day

### Schedule

View today's tasks:

- **"Alexa, what's my schedule for today?"**
- Alexa lists all tasks due today or overdue

### Shopping List

Manage your shopping list:

**Add items:**
- **"Alexa, add to shopping: milk, eggs, bread"**

**Read list:**
- **"Alexa, read my shopping list"**

**Mark complete:**
- **"Alexa, mark milk as done"**

## Tips & Best Practices

### Task Management

- Use clear, specific task names
- Set priorities appropriately (High for urgent items)
- Add due dates for time-sensitive tasks
- Use categories to organize (Work, Personal, Fitness, Shopping)

### Energy Tracking

- Log energy levels consistently (morning, afternoon, evening)
- Track patterns over time in Notion
- Use the data to optimize your schedule

### Focus Sessions

- Use the focus timer for deep work
- Review your Focus_Logs to see productivity patterns
- Adjust focus level based on your actual performance

## Troubleshooting

### "License key invalid"

- Verify your license key is correct
- Contact support if you believe your key should be valid
- Ensure you're using the email associated with your license

### "Notion database not found"

- Check that all three databases exist in your Notion workspace
- Verify database names match exactly: `Tasks`, `Focus_Logs`, `Energy_Logs`
- Ensure the databases are in a location accessible to your Notion integration

### "Please link your Notion account"

- Go to the Alexa app
- Find Notion Assistant in your skills
- Click "Link Account" or "Settings"
- Complete the OAuth flow again

### Skill not responding

- Try: "Alexa, open Notion Assistant"
- Check your internet connection
- Ensure the skill is enabled in your Alexa app
- Restart your Alexa device if needed

## Privacy & Security

- Your Notion data remains in your workspace
- The skill only has read/write access to pages and databases
- License keys are securely stored and validated
- OAuth tokens are encrypted in our database

## Support

For technical issues or questions:

1. Check this user guide
2. Review the troubleshooting section
3. Contact support with your license key and issue description

## Frequently Asked Questions

**Q: Can I use this with multiple Notion workspaces?**  
A: Currently, one license key links to one Notion workspace. Each Amazon account can have one active license.

**Q: What happens if I revoke Notion access?**  
A: You'll need to re-link your account through the Alexa app to continue using the skill.

**Q: Can I customize the focus timer duration?**  
A: Currently, the timer is set to 25 minutes (Pomodoro). Custom durations may be available in future updates.

**Q: How do I update my license key?**  
A: Contact support to update your license key or account information.

**Q: Is my data stored securely?**  
A: Yes, all data is stored in your own Notion workspace. We only store minimal account information (email, license key, encrypted OAuth token) in our secure database.

---

Enjoy using Notion Assistant! 🎉

