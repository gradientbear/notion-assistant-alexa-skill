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

