export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      beer_barcodes: {
        Row: {
          barcode: string;
          beer_id: string;
          off_last_modified: string | null;
        };
        ComputedFields: never;
        Insert: {
          barcode: string;
          beer_id: string;
          off_last_modified?: string | null;
        };
        Update: {
          barcode?: string;
          beer_id?: string;
          off_last_modified?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'beer_barcodes_beer_id_fkey';
            columns: ['beer_id'];
            isOneToOne: false;
            referencedRelation: 'beers';
            referencedColumns: ['id'];
          },
        ];
      };
      beer_styles: {
        Row: {
          code: string;
          sort_order: number;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          sort_order: number;
        };
        Update: {
          code?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      beers: {
        Row: {
          abv: number | null;
          brand: string;
          brand_key: string;
          brewery_id: string | null;
          country: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          image_thumb_url: string | null;
          image_url: string | null;
          merged_into: string | null;
          name: string;
          name_key: string;
          source: string;
          status: string;
          style_code: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          abv?: number | null;
          brand: string;
          brand_key: string;
          brewery_id?: string | null;
          country?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          image_thumb_url?: string | null;
          image_url?: string | null;
          merged_into?: string | null;
          name: string;
          name_key: string;
          source: string;
          status?: string;
          style_code?: string | null;
          updated_at?: string;
        };
        Update: {
          abv?: number | null;
          brand?: string;
          brand_key?: string;
          brewery_id?: string | null;
          country?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          image_thumb_url?: string | null;
          image_url?: string | null;
          merged_into?: string | null;
          name?: string;
          name_key?: string;
          source?: string;
          status?: string;
          style_code?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'beers_brewery_id_fkey';
            columns: ['brewery_id'];
            isOneToOne: false;
            referencedRelation: 'breweries';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'beers_merged_into_fkey';
            columns: ['merged_into'];
            isOneToOne: false;
            referencedRelation: 'beers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'beers_style_code_fkey';
            columns: ['style_code'];
            isOneToOne: false;
            referencedRelation: 'beer_styles';
            referencedColumns: ['code'];
          },
        ];
      };
      blocks: {
        Row: {
          blocked_id: string;
          blocker_id: string;
          created_at: string;
        };
        ComputedFields: never;
        Insert: {
          blocked_id: string;
          blocker_id: string;
          created_at?: string;
        };
        Update: {
          blocked_id?: string;
          blocker_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'blocks_blocked_id_fkey';
            columns: ['blocked_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'blocks_blocked_id_fkey';
            columns: ['blocked_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'blocks_blocker_id_fkey';
            columns: ['blocker_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'blocks_blocker_id_fkey';
            columns: ['blocker_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      breweries: {
        Row: {
          city: string | null;
          country: string | null;
          created_at: string;
          id: string;
          location: unknown;
          name: string;
          name_key: string;
          obdb_id: string | null;
          source: string;
          updated_at: string;
          website: string | null;
        };
        ComputedFields: never;
        Insert: {
          city?: string | null;
          country?: string | null;
          created_at?: string;
          id?: string;
          location?: unknown;
          name: string;
          name_key: string;
          obdb_id?: string | null;
          source: string;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          city?: string | null;
          country?: string | null;
          created_at?: string;
          id?: string;
          location?: unknown;
          name?: string;
          name_key?: string;
          obdb_id?: string | null;
          source?: string;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [];
      };
      friendships: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          requested_by: string;
          status: string;
          user_high: string;
          user_low: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          requested_by: string;
          status?: string;
          user_high: string;
          user_low: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          requested_by?: string;
          status?: string;
          user_high?: string;
          user_low?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'friendships_user_high_fkey';
            columns: ['user_high'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'friendships_user_high_fkey';
            columns: ['user_high'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'friendships_user_low_fkey';
            columns: ['user_low'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'friendships_user_low_fkey';
            columns: ['user_low'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      legal_drinking_age: {
        Row: {
          country: string;
          min_age: number;
        };
        ComputedFields: never;
        Insert: {
          country: string;
          min_age: number;
        };
        Update: {
          country?: string;
          min_age?: number;
        };
        Relationships: [];
      };
      post_photos: {
        Row: {
          created_at: string;
          exif_taken_at: string | null;
          height: number;
          id: string;
          path: string;
          post_id: string;
          source: string;
          thumb_path: string;
          width: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          exif_taken_at?: string | null;
          height: number;
          id?: string;
          path: string;
          post_id: string;
          source: string;
          thumb_path: string;
          width: number;
        };
        Update: {
          created_at?: string;
          exif_taken_at?: string | null;
          height?: number;
          id?: string;
          path?: string;
          post_id?: string;
          source?: string;
          thumb_path?: string;
          width?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'post_photos_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: true;
            referencedRelation: 'posts';
            referencedColumns: ['id'];
          },
        ];
      };
      posts: {
        Row: {
          author_id: string;
          beer_id: string;
          caption: string | null;
          consumed_at: string;
          created_at: string;
          id: string;
          is_retroactive: boolean;
          publish_to_feed: boolean;
          serving: string;
          updated_at: string;
          verification_level: string;
          volume_ml: number | null;
        };
        ComputedFields: never;
        Insert: {
          author_id: string;
          beer_id: string;
          caption?: string | null;
          consumed_at: string;
          created_at?: string;
          id?: string;
          is_retroactive?: boolean;
          publish_to_feed?: boolean;
          serving: string;
          updated_at?: string;
          verification_level?: string;
          volume_ml?: number | null;
        };
        Update: {
          author_id?: string;
          beer_id?: string;
          caption?: string | null;
          consumed_at?: string;
          created_at?: string;
          id?: string;
          is_retroactive?: boolean;
          publish_to_feed?: boolean;
          serving?: string;
          updated_at?: string;
          verification_level?: string;
          volume_ml?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'posts_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'posts_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'public_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'posts_beer_id_fkey';
            columns: ['beer_id'];
            isOneToOne: false;
            referencedRelation: 'beers';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          bio: string | null;
          birthdate: string | null;
          country: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          is_private: boolean;
          onboarded_at: string | null;
          updated_at: string;
          username: string | null;
        };
        ComputedFields: never;
        Insert: {
          avatar_path?: string | null;
          bio?: string | null;
          birthdate?: string | null;
          country?: string | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
          is_private?: boolean;
          onboarded_at?: string | null;
          updated_at?: string;
          username?: string | null;
        };
        Update: {
          avatar_path?: string | null;
          bio?: string | null;
          birthdate?: string | null;
          country?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          is_private?: boolean;
          onboarded_at?: string | null;
          updated_at?: string;
          username?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      public_profiles: {
        Row: {
          avatar_path: string | null;
          bio: string | null;
          country: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          is_private: boolean;
          username: string | null;
        };
        ComputedFields: never;
        Insert: {
          avatar_path?: string | null;
          bio?: string | null;
          country?: string | null;
          created_at?: string | null;
          display_name?: string | null;
          id?: string | null;
          is_private?: boolean | null;
          username?: string | null;
        };
        Update: {
          avatar_path?: string | null;
          bio?: string | null;
          country?: string | null;
          created_at?: string | null;
          display_name?: string | null;
          id?: string | null;
          is_private?: boolean | null;
          username?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      accept_friend_request: { Args: { user_id: string }; Returns: undefined };
      are_friends: { Args: { a: string; b: string }; Returns: boolean };
      beer_by_barcode: { Args: { code: string }; Returns: string };
      block_user: { Args: { user_id: string }; Returns: undefined };
      can_see_post: { Args: { author: string; published: boolean }; Returns: boolean };
      catalog_register_lookup: { Args: { uid: string }; Returns: boolean };
      catalog_upsert_beer: { Args: { g: Json }; Returns: string };
      complete_profile: { Args: { display_name: string; username: string }; Returns: undefined };
      create_post: {
        Args: {
          beer_id: string;
          caption?: string;
          consumed_at?: string;
          photo?: Json;
          publish_to_feed?: boolean;
          serving: string;
          volume_ml?: number;
        };
        Returns: string;
      };
      decline_friend_request: { Args: { user_id: string }; Returns: undefined };
      f_unaccent: { Args: { value: string }; Returns: string };
      find_people: {
        Args: { max?: number; q: string };
        Returns: {
          avatar_path: string;
          display_name: string;
          id: string;
          relationship: string;
          username: string;
        }[];
      };
      get_feed: {
        Args: { before_created_at?: string; before_id?: string; max?: number };
        Returns: {
          author_avatar_path: string;
          author_display_name: string;
          author_id: string;
          author_username: string;
          beer_brand: string;
          beer_id: string;
          beer_image_thumb_url: string;
          beer_name: string;
          caption: string;
          comment_count: number;
          consumed_at: string;
          created_at: string;
          id: string;
          is_retroactive: boolean;
          my_reaction: string;
          photo_height: number;
          photo_path: string;
          photo_thumb_path: string;
          photo_width: number;
          reaction_counts: Json;
          serving: string;
          verification_level: string;
          volume_ml: number;
        }[];
      };
      get_profile: {
        Args: { user_id: string };
        Returns: {
          avatar_path: string;
          beers_count: number;
          bio: string;
          can_see_posts: boolean;
          display_name: string;
          friends_count: number;
          id: string;
          is_private: boolean;
          posts_count: number;
          relationship: string;
          username: string;
        }[];
      };
      is_blocked_between: { Args: { a: string; b: string }; Returns: boolean };
      is_valid_username: { Args: { candidate: string }; Returns: boolean };
      min_drinking_age: { Args: { country: string }; Returns: number };
      my_blocked_users: {
        Args: Record<PropertyKey, never>;
        Returns: {
          avatar_path: string;
          blocked_at: string;
          display_name: string;
          id: string;
          username: string;
        }[];
      };
      my_friend_requests: {
        Args: Record<PropertyKey, never>;
        Returns: {
          avatar_path: string;
          display_name: string;
          id: string;
          requested_at: string;
          username: string;
        }[];
      };
      my_friends: {
        Args: Record<PropertyKey, never>;
        Returns: {
          avatar_path: string;
          display_name: string;
          id: string;
          since: string;
          username: string;
        }[];
      };
      normalize_gtin: { Args: { code: string }; Returns: string };
      remove_friend: { Args: { user_id: string }; Returns: undefined };
      resolve_beer: { Args: { beer: string }; Returns: string };
      search_beers: {
        Args: { max_results?: number; q: string };
        Returns: {
          abv: number;
          brand: string;
          id: string;
          image_thumb_url: string;
          name: string;
          style_code: string;
        }[];
      };
      send_friend_request: { Args: { user_id: string }; Returns: string };
      set_birthdate: { Args: { birthdate: string; country: string }; Returns: undefined };
      unblock_user: { Args: { user_id: string }; Returns: undefined };
      update_post: {
        Args: {
          caption: string;
          consumed_at: string;
          post_id: string;
          publish_to_feed: boolean;
          serving: string;
          volume_ml: number;
        };
        Returns: undefined;
      };
      username_available: { Args: { candidate: string }; Returns: boolean };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema['Tables'] & DefaultSchema['Views']) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
