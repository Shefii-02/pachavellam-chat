// Hand-written mirror of the Laravel migrations under web/database/migrations/2026_10_07_*.
// Laravel owns the schema. If a migration changes, update this file (and the
// repositories that use it) to match — Node never runs migrations itself.

export type ConversationType = 'individual' | 'group' | 'course_group';
export type ParticipantRole = 'owner' | 'admin' | 'member';
export type MessageType = 'text' | 'image' | 'video' | 'document' | 'audio' | 'voice_note' | 'system';

export interface ConversationRow {
  id: number;
  type: ConversationType;
  individual_key: string | null;
  course_id: number | null;
  name: string | null;
  description: string | null;
  avatar_path: string | null;
  is_public: 0 | 1;
  only_admins_can_send: 0 | 1;
  only_admins_can_add_members: 0 | 1;
  only_admins_can_edit_info: 0 | 1;
  pinned_message_id: number | null;
  last_message_at: Date | null;
  last_message_preview: string | null;
  last_message_sender_id: number | null;
  last_message_type: MessageType | null;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface ConversationParticipantRow {
  id: number;
  conversation_id: number;
  user_id: number;
  role: ParticipantRole;
  invited_by: number | null;
  joined_at: Date;
  left_at: Date | null;
  muted_until: Date | null;
  last_read_message_id: number | null;
  last_read_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface MessageRow {
  id: number;
  conversation_id: number;
  sender_id: number | null;
  type: MessageType;
  body: string | null;
  reply_to_message_id: number | null;
  forwarded_from_message_id: number | null;
  forwarded_from_conversation_id: number | null;
  metadata: string | null; // JSON column, stored as string by mysql2 unless parsed
  edited_at: Date | null;
  deleted_at: Date | null;
  created_at: Date;
}

export interface MessageAttachmentRow {
  id: number;
  message_id: number;
  type: string;
  disk_path: string;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  thumbnail_path: string | null;
  created_at: Date;
}

export interface MessageReactionRow {
  id: number;
  message_id: number;
  user_id: number;
  emoji: string;
  created_at: Date;
}

export interface MessageMentionRow {
  id: number;
  message_id: number;
  mentioned_user_id: number;
  created_at: Date;
}

export interface ConversationJoinLinkRow {
  id: number;
  conversation_id: number;
  token: string;
  created_by: number;
  expires_at: Date | null;
  max_uses: number | null;
  use_count: number;
  revoked_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface DeviceTokenRow {
  id: number;
  user_id: number;
  token: string;
  platform: 'android' | 'ios' | 'web';
  last_seen_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserRow {
  id: number;
  name: string;
  email: string;
  image: string | null;
  mobile: string | null;
  type: string | null;
}
