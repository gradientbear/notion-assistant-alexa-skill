export interface User {
  id: string;
  amazon_account_id: string;
  email: string;
  license_key: string;
  notion_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface License {
  license_key: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  notes?: string;
}

export interface NotionTask {
  id: string;
  name: string;
  priority: 'High' | 'Medium' | 'Low';
  dueDate: string | null;
  status: 'To Do' | 'In Progress' | 'Done';
  category: 'Work' | 'Personal' | 'Fitness' | 'Shopping';
  notes: string | null;
}

export interface NotionFocusLog {
  id: string;
  date: string;
  duration: number;
  focusLevel: 'Low' | 'Medium' | 'High';
  notes: string | null;
}

export interface NotionEnergyLog {
  id: string;
  date: string;
  energyLevel: 'Low' | 'Medium' | 'High';
  timeOfDay: 'Morning' | 'Afternoon' | 'Evening';
  notes: string | null;
}

export interface DatabaseConfig {
  tasksDatabaseId: string;
  focusLogsDatabaseId: string;
  energyLogsDatabaseId: string;
}

