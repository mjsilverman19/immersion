export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          home_city_id: string | null;
          is_local_verified: boolean;
          contribution_count: number;
          unlocked_cities: string[];
          taste_preferences: string[];
          category_preferences: string[];
          taste_vector: number[];
          taste_vector_version: number;
          onboarding_version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          home_city_id?: string | null;
          is_local_verified?: boolean;
          contribution_count?: number;
          unlocked_cities?: string[];
          taste_preferences?: string[];
          category_preferences?: string[];
          taste_vector?: number[];
          taste_vector_version?: number;
          onboarding_version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          home_city_id?: string | null;
          is_local_verified?: boolean;
          contribution_count?: number;
          unlocked_cities?: string[];
          taste_preferences?: string[];
          category_preferences?: string[];
          taste_vector?: number[];
          taste_vector_version?: number;
          onboarding_version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_home_city_id_fkey";
            columns: ["home_city_id"];
            isOneToOne: false;
            referencedRelation: "cities";
            referencedColumns: ["id"];
          },
        ];
      };
      cities: {
        Row: {
          id: string;
          name: string;
          slug: string;
          country: string;
          country_code: string;
          latitude: number;
          longitude: number;
          timezone: string | null;
          photo_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          country: string;
          country_code: string;
          latitude: number;
          longitude: number;
          timezone?: string | null;
          photo_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          country?: string;
          country_code?: string;
          latitude?: number;
          longitude?: number;
          timezone?: string | null;
          photo_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      places: {
        Row: {
          id: string;
          google_place_id: string | null;
          name: string;
          city_id: string;
          address: string | null;
          latitude: number;
          longitude: number;
          category: string;
          subcategory: string | null;
          photo_urls: string[] | null;
          google_maps_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          google_place_id?: string | null;
          name: string;
          city_id: string;
          address?: string | null;
          latitude: number;
          longitude: number;
          category: string;
          subcategory?: string | null;
          photo_urls?: string[] | null;
          google_maps_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          google_place_id?: string | null;
          name?: string;
          city_id?: string;
          address?: string | null;
          latitude?: number;
          longitude?: number;
          category?: string;
          subcategory?: string | null;
          photo_urls?: string[] | null;
          google_maps_url?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "places_city_id_fkey";
            columns: ["city_id"];
            isOneToOne: false;
            referencedRelation: "cities";
            referencedColumns: ["id"];
          },
        ];
      };
      logs: {
        Row: {
          id: string;
          user_id: string;
          place_id: string;
          rating: number;
          tags: string[];
          vibe_tags: string[];
          review: string | null;
          photos: string[] | null;
          is_local_log: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          place_id: string;
          rating: number;
          tags?: string[];
          vibe_tags?: string[];
          review?: string | null;
          photos?: string[] | null;
          is_local_log?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          place_id?: string;
          rating?: number;
          tags?: string[];
          vibe_tags?: string[];
          review?: string | null;
          photos?: string[] | null;
          is_local_log?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "logs_place_id_fkey";
            columns: ["place_id"];
            isOneToOne: false;
            referencedRelation: "places";
            referencedColumns: ["id"];
          },
        ];
      };
      lists: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          city_id: string | null;
          cover_photo_url: string | null;
          is_public: boolean;
          save_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          city_id?: string | null;
          cover_photo_url?: string | null;
          is_public?: boolean;
          save_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          city_id?: string | null;
          cover_photo_url?: string | null;
          is_public?: boolean;
          save_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lists_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lists_city_id_fkey";
            columns: ["city_id"];
            isOneToOne: false;
            referencedRelation: "cities";
            referencedColumns: ["id"];
          },
        ];
      };
      list_items: {
        Row: {
          id: string;
          list_id: string;
          place_id: string;
          position: number;
          note: string | null;
        };
        Insert: {
          id?: string;
          list_id: string;
          place_id: string;
          position: number;
          note?: string | null;
        };
        Update: {
          id?: string;
          list_id?: string;
          place_id?: string;
          position?: number;
          note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "list_items_list_id_fkey";
            columns: ["list_id"];
            isOneToOne: false;
            referencedRelation: "lists";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "list_items_place_id_fkey";
            columns: ["place_id"];
            isOneToOne: false;
            referencedRelation: "places";
            referencedColumns: ["id"];
          },
        ];
      };
      follows: {
        Row: {
          follower_id: string;
          following_id: string;
          created_at: string;
        };
        Insert: {
          follower_id: string;
          following_id: string;
          created_at?: string;
        };
        Update: {
          follower_id?: string;
          following_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey";
            columns: ["follower_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "follows_following_id_fkey";
            columns: ["following_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      scenario_pairs: {
        Row: {
          id: string;
          dimension: string;
          prompt: string;
          option_a_label: string;
          option_a_description: string;
          option_b_label: string;
          option_b_description: string;
          image_url_a: string | null;
          image_url_b: string | null;
          vector_direction: number[];
          display_order: number;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          dimension: string;
          prompt: string;
          option_a_label: string;
          option_a_description: string;
          option_b_label: string;
          option_b_description: string;
          image_url_a?: string | null;
          image_url_b?: string | null;
          vector_direction: number[];
          display_order?: number;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          dimension?: string;
          prompt?: string;
          option_a_label?: string;
          option_a_description?: string;
          option_b_label?: string;
          option_b_description?: string;
          image_url_a?: string | null;
          image_url_b?: string | null;
          vector_direction?: number[];
          display_order?: number;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      onboarding_choices: {
        Row: {
          id: string;
          user_id: string;
          scenario_pair_id: string;
          chose_b: boolean;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          scenario_pair_id: string;
          chose_b: boolean;
          position: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          scenario_pair_id?: string;
          chose_b?: boolean;
          position?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "onboarding_choices_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "onboarding_choices_scenario_pair_id_fkey";
            columns: ["scenario_pair_id"];
            isOneToOne: false;
            referencedRelation: "scenario_pairs";
            referencedColumns: ["id"];
          },
        ];
      };
      place_saves: {
        Row: {
          user_id: string;
          place_id: string;
          source_user_id: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          place_id: string;
          source_user_id?: string | null;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          place_id?: string;
          source_user_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "place_saves_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "place_saves_place_id_fkey";
            columns: ["place_id"];
            isOneToOne: false;
            referencedRelation: "places";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "place_saves_source_user_id_fkey";
            columns: ["source_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          actor_id: string | null;
          target_id: string | null;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          actor_id?: string | null;
          target_id?: string | null;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          actor_id?: string | null;
          target_id?: string | null;
          read?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      saves: {
        Row: {
          user_id: string;
          list_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          list_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          list_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saves_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "saves_list_id_fkey";
            columns: ["list_id"];
            isOneToOne: false;
            referencedRelation: "lists";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

// Convenience type aliases
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type City = Database["public"]["Tables"]["cities"]["Row"];
export type Place = Database["public"]["Tables"]["places"]["Row"];
export type Log = Database["public"]["Tables"]["logs"]["Row"];
export type List = Database["public"]["Tables"]["lists"]["Row"];
export type ListItem = Database["public"]["Tables"]["list_items"]["Row"];
export type Follow = Database["public"]["Tables"]["follows"]["Row"];
export type Save = Database["public"]["Tables"]["saves"]["Row"];
export type ScenarioPair = Database["public"]["Tables"]["scenario_pairs"]["Row"];
export type OnboardingChoice = Database["public"]["Tables"]["onboarding_choices"]["Row"];
export type PlaceSave = Database["public"]["Tables"]["place_saves"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];

export type PlaceCategory =
  | "restaurant"
  | "bar"
  | "cafe"
  | "park"
  | "shop"
  | "viewpoint"
  | "experience";

export interface TasteProfile {
  topTags: { tag: string; count: number }[];
  categoryBreakdown: Record<string, number>;
  averageRating: number;
  citiesLogged: number;
  localLogsPercentage: number;
}
