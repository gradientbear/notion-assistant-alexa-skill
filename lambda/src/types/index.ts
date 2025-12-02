export interface User {
  id: string;
  amazon_account_id: string;
  email: string;
  license_key: string;
  notion_token: string | null;
  notion_setup_complete: boolean;
  privacy_page_id: string | null;
  tasks_db_id: string | null;
  shopping_db_id: string | null;
  workouts_db_id: string | null;
  meals_db_id: string | null;
  notes_db_id: string | null;
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
  priority: 'low' | 'normal' | 'high' | 'urgent';
  dueDate: string | null;
  status: 'to do' | 'in progress' | 'done';
  category: 'work' | 'personal' | 'shopping' | 'fitness' | 'health' | 'notes' | 'general';
  notes: string | null;
  tags?: string[];
  recurring?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  completedAt?: string | null;
  createdAt?: string;
  notionId?: string;
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
  entry?: string;
  energyLevel: number; // 1-10
  date: string;
  notes: string | null;
  notionId?: string;
}

export interface NotionShoppingItem {
  id: string;
  name: string;
  quantity?: number;
  status: 'needed' | 'bought';
  addedAt?: string;
  notes?: string | null;
  notionId?: string;
}

export interface NotionWorkout {
  id: string;
  workout: string;
  date: string;
  duration?: number; // minutes
  caloriesBurned?: number;
  notes?: string | null;
  notionId?: string;
}

export interface NotionMeal {
  id: string;
  meal: string;
  calories: number;
  date: string;
  notes?: string | null;
  notionId?: string;
}

export interface NotionNote {
  id: string;
  title: string;
  content: string;
  date: string;
  tags?: string[];
  notionId?: string;
}

export interface DatabaseConfig {
  tasksDatabaseId: string;
  shoppingDatabaseId: string;
  workoutsDatabaseId: string;
  mealsDatabaseId: string;
  notesDatabaseId: string;
  energyLogsDatabaseId: string;
}

