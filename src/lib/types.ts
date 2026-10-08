export type User = {
  id: number;
  username: string;
  email?: string | null;
  password: string;
  name?: string | null;
  role: string;
  created_at: string;
};

export type Member = {
  id: number;
  member_code: string;
  name: string;
  phone: string;
  email?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  blood_group?: string | null;
  address?: string | null;
  membership_plan: string;
  start_date: string;
  end_date: string;
  amount: number;
  emergency_contact?: string | null;
  image_path?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};
