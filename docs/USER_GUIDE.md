# Voice Planner Alexa Skill - User Guide

## Welcome!

The Voice Planner Alexa Skill helps you manage your tasks and track your productivity using voice commands with your Alexa device, all synced to your Notion workspace.

## Getting Started

### Prerequisites

- An Alexa-enabled device (Echo, Echo Dot, etc.)
- A Notion account
- A valid license key
- Voice Plannerbases set up (automatically created during setup)

### Step 1: Enable the Skill

1. Open the Alexa app on your phone
2. Search for "Voice Planner"
3. Click "Enable" or "Link Account"
4. You'll be redirected to the web login page

### Step 2: Sign Up and Link Your Notion Account

1. Sign up with your email address
2. Enter your license key
3. Click "Connect Notion Account"
4. You'll be redirected to Notion to authorize access
5. Click "Allow" to grant permissions
6. **Automatic Setup**: The skill will automatically create:
   - A "Privacy" page in your Notion workspace
   - 6 databases: Tasks, Shopping, Workouts, Meals, Notes, and EnergyLogs
7. You'll be redirected back to confirm the link

### Step 3: Link Your Amazon Account

1. On the dashboard, click "Link Alexa" button
2. Follow the instructions to link your Amazon account
3. Complete the OAuth flow

### Step 4: Start Using the Skill

Say: **"Alexa, open Voice Planner"**

## Voice Commands

### Task Management

**Add Tasks:**
- "Alexa, add finish the report"
- "Alexa, add call mom"
- "Alexa, add buy groceries high priority"
- "Alexa, add finish report due tomorrow"
- "Alexa, add workout task for fitness category"

**List Tasks:**
- "Alexa, what are my tasks"
- "Alexa, read my tasks"
- "Alexa, what are my work tasks"
- "Alexa, what are my high priority tasks"
- "Alexa, what's due tomorrow"
- "Alexa, what's overdue"
- "Alexa, what's due this week"

**Complete Tasks:**
- "Alexa, mark finish the report as done"
- "Alexa, complete finish report"
- "Alexa, I finished the report"

**Update Task Status:**
- "Alexa, set finish report to in progress"
- "Alexa, start finish report"
- "Alexa, move finish report to done"

**Delete Tasks:**
- "Alexa, delete finish the report"
- "Alexa, remove finish report"
- "Alexa, delete completed tasks"

**Task Statistics:**
- "Alexa, how many tasks do I have"
- "Alexa, how many tasks are done"
- "Alexa, give me a summary"
- "Alexa, when is my next deadline"

### Shopping List

**Add Items:**
- "Alexa, add milk to shopping list"
- "Alexa, add bread and eggs to shopping"

**Read List:**
- "Alexa, read my shopping list"
- "Alexa, what's on my shopping list"

**Mark Complete:**
- "Alexa, mark milk as bought"

### Workouts

**Log Workouts:**
- "Alexa, log workout running 30 minutes"
- "Alexa, I did chest day for 45 minutes"
- "Alexa, add workout running today"

### Meals

**Log Meals:**
- "Alexa, log breakfast 500 calories"
- "Alexa, I ate pizza for 800 calories"
- "Alexa, add meal lunch 600 calories"

### Notes

**Add Notes:**
- "Alexa, add note meeting notes"
- "Alexa, save note project ideas"

**Read Notes:**
- "Alexa, read my notes"
- "Alexa, what are my notes from yesterday"

### Energy Tracking

**Log Energy:**
- "Alexa, log energy 7"
- "Alexa, my energy is 5"
- "Alexa, track energy 8"

## Tips & Best Practices

### Task Management

- Use clear, specific task names
- Set priorities appropriately (urgent for time-sensitive items)
- Add due dates for time-sensitive tasks
- Use categories to organize (work, personal, fitness, health, notes, general)
- Use tags for additional organization
- Set recurring tasks for regular activities

### Energy Tracking

- Log energy levels consistently (1-10 scale)
- Track patterns over time in Notion
- Use the data to optimize your schedule

## Troubleshooting

### "License key invalid"

- Verify your license key is correct
- Contact support if you believe your key should be valid
- Ensure you're using the email associated with your license

### "Voice Plannerbase not found"

- Check that all databases exist in your Notion workspace
- Verify database names match exactly: `Tasks`, `Shopping`, `Workouts`, `Meals`, `Notes`, `EnergyLogs`
- Ensure the databases are in a location accessible to your Notion integration
- Try reconnecting Notion from the dashboard

### "Please link your Notion account"

- Go to the Alexa app
- Find Voice Planner in your skills
- Click "Link Account" or "Settings"
- Complete the OAuth flow again

### Skill not responding

- Try: "Alexa, open Voice Planner"
- Check your internet connection
- Ensure the skill is enabled in your Alexa app
- Restart your Alexa device if needed

### Task not found

- Try saying the full task name
- Check the task exists in your Notion Tasks database
- Verify the task name matches exactly (case-sensitive)

## Privacy & Security

- Your Voice Planner remains in your workspace
- The skill only has read/write access to pages and databases
- License keys are securely stored and validated
- OAuth tokens are encrypted in our database
- All data is stored in your own Notion workspace

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

**Q: How do I update my license key?**  
A: Contact support to update your license key or account information.

**Q: Is my data stored securely?**  
A: Yes, all data is stored in your own Notion workspace. We only store minimal account information (email, license key, encrypted OAuth token) in our secure database.

**Q: Does everyone need their own Notion account?**  
A: Yes! Each user links their own Notion account. Each user has their own Notion workspace and creates their own databases. Users cannot see or access each other's data.

**Q: Can I customize the databases?**  
A: Yes, you can customize your databases in Notion after they're created. However, the skill expects certain property names to work correctly. See the developer guide for details.

**Q: What if I accidentally delete a database?**  
A: You can reconnect Notion from the dashboard, and the skill will recreate the databases automatically.

**Q: Can I use this without a license key?**  
A: No, a valid license key is required to use the skill. Contact support to obtain a license key.

---

Enjoy using Voice Planner! 🎉
