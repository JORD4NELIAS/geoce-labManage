export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'admin' | 'researcher' | 'student';
export type MachineStatus = 'available' | 'in_use' | 'maintenance' | 'offline';
export type ReservationStatus = 'queued' | 'approved' | 'active' | 'completed' | 'cancelled' | 'expired';
export type WorkloadCategory = 'deep_learning' | 'data_science' | 'cad_3d' | 'general_compilation' | 'testing';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          avatar_url: string | null;
          role: UserRole;
          weekly_hours_limit: number;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          avatar_url?: string | null;
          role?: UserRole;
          weekly_hours_limit?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          avatar_url?: string | null;
          role?: UserRole;
          weekly_hours_limit?: number;
          created_at?: string;
        };
      };
      machines: {
        Row: {
          id: string;
          code_name: string;
          specs: {
            gpu?: string;
            vram_gb?: number;
            cpu_cores?: number;
            ram_gb?: number;
            storage?: string;
            [key: string]: any;
          };
          status: MachineStatus;
          is_exclusive: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          code_name: string;
          specs: Record<string, any>;
          status?: MachineStatus;
          is_exclusive?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          code_name?: string;
          specs?: Record<string, any>;
          status?: MachineStatus;
          is_exclusive?: boolean;
          created_at?: string;
        };
      };
      reservations: {
        Row: {
          id: string;
          user_id: string;
          machine_id: string;
          purpose: string;
          workload_type: WorkloadCategory;
          status: ReservationStatus;
          start_time: string | null;
          end_time: string | null;
          duration_hours: number | null;
          requested_at: string;
          cancelled_by: string | null;
          cancelled_at: string | null;
          check_in_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          machine_id: string;
          purpose: string;
          workload_type?: WorkloadCategory;
          status?: ReservationStatus;
          start_time?: string | null;
          end_time?: string | null;
          requested_at?: string;
          cancelled_by?: string | null;
          cancelled_at?: string | null;
          check_in_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          machine_id?: string;
          purpose?: string;
          workload_type?: WorkloadCategory;
          status?: ReservationStatus;
          start_time?: string | null;
          end_time?: string | null;
          requested_at?: string;
          cancelled_by?: string | null;
          cancelled_at?: string | null;
          check_in_at?: string | null;
        };
      };
    };
    Views: {
      vw_lab_metrics: {
        Row: {
          machine_id: string;
          machine_name: string;
          gpu_model: string | null;
          vram_gb: string | null;
          total_reservations: number;
          total_hours_allocated: number;
          avg_session_duration_hours: number;
          total_cancellations: number;
          total_completed: number;
        };
      };
    };
  };
}
