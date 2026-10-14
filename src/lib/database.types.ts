// Types for the Supabase schema in supabase/migrations.
// Started from `supabase gen types typescript` and tightened by hand where the database
// enforces more than the generator can see: appointments can't be inserted by clients
// (only through book_appointment) and their status is a closed set.

export type Database = {
  public: {
    Tables: {
      businesses: {
        Row: {
          id: string;
          owner_id: string;
          slug: string;
          name: string;
          timezone: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string;
          slug: string;
          name: string;
          timezone?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["businesses"]["Insert"]>;
        Relationships: [];
      };
      services: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          duration_minutes: number;
          price_cop: number;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          duration_minutes: number;
          price_cop?: number;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["services"]["Insert"]>;
        Relationships: [];
      };
      working_hours: {
        Row: { business_id: string; weekday: number; opens_at: string; closes_at: string };
        Insert: { business_id: string; weekday: number; opens_at: string; closes_at: string };
        Update: Partial<Database["public"]["Tables"]["working_hours"]["Insert"]>;
        Relationships: [];
      };
      appointments: {
        Row: {
          id: string;
          business_id: string;
          service_id: string;
          customer_name: string;
          customer_phone: string;
          starts_at: string;
          ends_at: string;
          status: "confirmed" | "cancelled";
          created_at: string;
        };
        Insert: never; // only through book_appointment()
        Update: { status?: "confirmed" | "cancelled" };
        Relationships: [
          {
            foreignKeyName: "appointments_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      available_slots: {
        Args: { p_business_slug: string; p_service_id: string; p_day: string };
        Returns: { starts_at: string }[];
      };
      book_appointment: {
        Args: {
          p_business_slug: string;
          p_service_id: string;
          p_starts_at: string;
          p_customer_name: string;
          p_customer_phone: string;
        };
        Returns: string;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Business = Database["public"]["Tables"]["businesses"]["Row"];
export type Service = Database["public"]["Tables"]["services"]["Row"];
export type WorkingHours = Database["public"]["Tables"]["working_hours"]["Row"];
export type Appointment = Database["public"]["Tables"]["appointments"]["Row"];
