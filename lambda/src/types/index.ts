export interface User {
  id: string;
  amazon_account_id: string;
  email: string;
  license_key: string;
  notion_token: string | null;
  notion_setup_complete: boolean;
  privacy_page_id: string | null;
  tasks_db_id: string | null;
  focus_logs_db_id: string | null;
  energy_logs_db_id: string | null;
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

