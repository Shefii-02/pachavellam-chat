import { z } from 'zod';

export const listConversationsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().optional(),
  search: z.string().optional(),
});

export const createConversationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('individual'),
    participant_user_ids: z.array(z.number().int()).length(1),
  }),
  z.object({
    type: z.literal('group'),
    name: z.string().min(1),
    description: z.string().optional(),
    course_id: z.number().int().optional(),
    is_public: z.boolean().optional(),
    participant_user_ids: z.array(z.number().int()).default([]),
  }),
  z.object({
    type: z.literal('course_group'),
    name: z.string().min(1),
    description: z.string().optional(),
    course_id: z.number().int().optional(),
    is_public: z.boolean().optional(),
    participant_user_ids: z.array(z.number().int()).default([]),
  }),
]);

export const sendMessageSchema = z.object({
  body: z.string().min(1),
  reply_to_message_id: z.number().int().optional().nullable(),
});

export const sendMediaMessageSchema = z.object({
  type: z.enum(['image', 'video', 'document', 'audio', 'voice_note']),
  caption: z.string().optional(),
  reply_to_message_id: z.coerce.number().int().optional(),
  duration_seconds: z.coerce.number().int().optional(),
  width: z.coerce.number().int().optional(),
  height: z.coerce.number().int().optional(),
});

export const listMessagesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().optional(),
});

export const markReadSchema = z.object({
  last_read_message_id: z.number().int(),
});

export const muteSchema = z.object({
  minutes: z.number().int().positive().optional(),
});

export const reactionSchema = z.object({
  emoji: z.string().min(1).max(32),
});

export const forwardSchema = z.object({
  target_conversation_ids: z.array(z.number().int()).min(1),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().optional(),
});

export const mentionsAutocompleteQuerySchema = z.object({
  conversation_id: z.coerce.number().int(),
  q: z.string().optional().default(''),
});

export const updateConversationSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  avatar_path: z.string().optional(),
  only_admins_can_send: z.boolean().optional(),
  only_admins_can_add_members: z.boolean().optional(),
  only_admins_can_edit_info: z.boolean().optional(),
});

export const addMembersSchema = z.object({
  user_ids: z.array(z.number().int()).min(1),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'member']).optional(),
  action: z.literal('remove').optional(),
});

export const createJoinLinkSchema = z.object({
  expires_at: z.coerce.date().optional(),
  max_uses: z.number().int().positive().optional(),
});

export const directoryQuerySchema = z.object({
  course_id: z.coerce.number().int().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().optional(),
});
