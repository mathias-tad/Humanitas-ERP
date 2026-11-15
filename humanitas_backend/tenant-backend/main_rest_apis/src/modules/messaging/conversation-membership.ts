import { DataSource } from 'typeorm';

/**
 * True when `userId` is a current (not-left) participant of `conversationId`
 * in the given tenant database.
 */
export async function isActiveParticipant(
  ds: DataSource,
  conversationId: string,
  userId: string,
): Promise<boolean> {
  if (!conversationId || !userId) return false;
  const rows = await ds.query(
    `SELECT 1 FROM conversation_participants
     WHERE conversation_id::text = $1 AND user_id::text = $2 AND left_at IS NULL
     LIMIT 1`,
    [String(conversationId), String(userId)],
  );
  return rows.length > 0;
}
