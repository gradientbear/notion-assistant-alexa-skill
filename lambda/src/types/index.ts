export interface User {
  id: string;
  amazon_account_id: string;
  email: string;
  license_key: string;
  notion_token: string | null;
  notion_setup_complete: boolean;
  privacy_page_id: string | null;
  tasks_db_id: string | null;
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
  parsedName: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH';
  dueDateTime: string | null;
  status: 'TO DO' | 'IN_PROCESS' | 'DONE';
  category: 'PERSONAL' | 'WORK';
  notes: string | null;
  createdAt?: string;
  updatedAt?: string;
  notionId?: string;
}

export interface DatabaseConfig {
  tasksDatabaseId: string
}

