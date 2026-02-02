// TypeScript type definitions for the application

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff?: boolean;
}

export interface Tag {
  id: number;
  name: string;
  user?: number;
}

export interface Slip {
  id: number;
  account_name: string;
  amount: number | string;
  date: string;
  time?: string | null;
  note?: string;
  type: 'income' | 'expense';
  tag: { id: number; name: string } | null;
  image?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SlipFormData {
  account_name: string;
  amount: string;
  date: string;
  time: string;
  note: string;
  tag_id: string;
  type: 'income' | 'expense';
}

export interface OcrResponse {
  text: string;
  found_names: string[];
  user_fullname: string | null;
  match: boolean | null;
  match_detail: string | null;
  match_confidence?: string;
  is_valid_slip?: boolean;
  extracted?: {
    account_name: string;
    transaction_title: string | null;
    amount: number | null;
    date: string;
    time: string | null;
    type: 'income' | 'expense';
    type_confidence?: string;
    type_warning?: string | null;
  };
}

export interface TagBreakdown {
  tag_id: number | null;
  tag_name: string;
  amount: number;
  count: number;
}

export interface DailyTrend {
  date: string;
  income: number;
  expense: number;
  count: number;
}

export interface DashboardData {
  income: number;
  expense: number;
  balance: number;
  recent_slips?: RecentSlip[];
  slip_count?: number;
  tag_breakdown?: TagBreakdown[];
  daily_trend?: DailyTrend[];
}

export interface RecentSlip {
  id: number;
  account_name: string;
  amount: number;
  date: string;
  type: 'income' | 'expense';
  tag_name: string | null;
}

export interface ApiError {
  detail?: string;
  message?: string;
  [key: string]: unknown;
}
