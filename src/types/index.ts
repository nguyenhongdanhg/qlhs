// =====================================================
// EDUBOARD - Type Definitions
// =====================================================

export type AppRole = 'super_admin' | 'admin' | 'teacher' | 'class_teacher' | 'accountant' | 'kitchen';
export type MembershipStatus = 'active' | 'suspended';
export type AttendanceType = 'evening_study' | 'boarding' | 'breakfast' | 'lunch' | 'dinner';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type Gender = 'male' | 'female';

export interface School {
  id: string;
  code: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  username?: string;
  phone?: string;
  position?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface GlobalRole {
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface SchoolMembership {
  id: string;
  school_id: string;
  user_id: string;
  role: AppRole;
  status: MembershipStatus;
  class_id?: string;
  created_at: string;
  updated_at: string;
  school?: School;
  profile?: Profile;
}

export interface SchoolFeature {
  id: string;
  school_id: string;
  feature_code: string;
  is_enabled: boolean;
  created_at: string;
}

export interface Class {
  id: string;
  school_id: string;
  name: string;
  grade: number;
  school_year: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  school_id: string;
  class_id?: string;
  student_code: string;
  full_name: string;
  gender?: Gender;
  date_of_birth?: string;
  phone?: string;
  parent_phone?: string;
  address?: string;
  cccd?: string;
  room_number?: string;
  meal_group?: string;
  is_boarding: boolean;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
  class?: Class;
}

export interface AttendanceRecord {
  id: string;
  school_id: string;
  student_id: string;
  class_id?: string;
  attendance_date: string;
  attendance_type: AttendanceType;
  status: AttendanceStatus;
  notes?: string;
  excused_reason?: string;
  reporter_id?: string;
  created_at: string;
  updated_at: string;
  student?: Student;
}

export interface MealSettings {
  id: string;
  school_id: string;
  breakfast_deadline_time: string;
  breakfast_deadline_offset: number;
  lunch_deadline_time: string;
  lunch_deadline_offset: number;
  dinner_deadline_time: string;
  dinner_deadline_offset: number;
  rice_per_student: number;
  created_at: string;
  updated_at: string;
}

export interface DutySchedule {
  id: string;
  school_id: string;
  user_id: string;
  duty_date: string;
  shift?: string;
  location?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

export interface PermissionGroup {
  id: string;
  school_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface AppFeature {
  id: string;
  code: string;
  label: string;
  description?: string;
  icon_name?: string;
  display_order: number;
  is_active: boolean;
}

export interface UserWithMembership extends Profile {
  memberships?: SchoolMembership[];
}

// Navigation item type
export interface NavItem {
  code: string;
  label: string;
  icon: string;
  path: string;
  roles?: AppRole[];
}

// Attendance summary for statistics
export interface AttendanceSummary {
  date: string;
  type: AttendanceType;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
}

// Dashboard stats
export interface DashboardStats {
  totalStudents: number;
  boardingStudents: number;
  todayAttendance: {
    present: number;
    absent: number;
    rate: number;
  };
  totalClasses: number;
}
