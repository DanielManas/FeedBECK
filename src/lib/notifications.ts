/**
 * Utilitários de notificação in-app para o FeedBECK.
 * Salva em /notifications/{id} no Firestore.
 * ⚠️ Zero push — apenas notificações dentro do app.
 */

import { doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export type NotificationType =
  | 'reply'            // respondeu seu comentário
  | 'mention'          // te mencionou num comentário
  | 'like_post'        // sintonizou seu relato
  | 'comment_post'     // comentou no seu relato
  | 'follow'           // começou a te seguir
  | 'follow_request'   // pediu sintonia (perfil privado)
  | 'follow_accepted'; // aceitou seu pedido de sintonia

export interface CreateNotificationParams {
  type: NotificationType;
  senderId: string;
  senderHandle: string;
  senderName: string;
  receiverId: string;
  reviewId?: string;
  commentId?: string;
  commentText?: string;
  parentCommentText?: string;
}

/**
 * Cria uma notificação in-app no Firestore.
 * Retorna silenciosamente se senderId === receiverId.
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  if (params.senderId === params.receiverId) return;

  try {
    const ref = doc(collection(db, 'notifications'));
    await setDoc(ref, {
      id: ref.id,
      type: params.type,
      senderId: params.senderId,
      senderHandle: params.senderHandle,
      senderName: params.senderName,
      receiverId: params.receiverId,
      reviewId: params.reviewId ?? '',
      commentId: params.commentId ?? '',
      commentText: params.commentText ?? '',
      parentCommentText: params.parentCommentText ?? '',
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    // Falha silenciosa — não bloquear a ação principal
    console.warn('[createNotification] erro silencioso:', err);
  }
}

/** Texto humanizado por tipo de notificação */
export const NOTIF_LABELS: Record<NotificationType, (handle: string, extra?: string) => string> = {
  reply:           (h, c) => `${h} respondeu ao seu comentário${c ? `: "${c}"` : ''}`,
  mention:         (h, c) => `${h} te mencionou${c ? `: "${c}"` : ''}`,
  like_post:       (h, t) => `${h} sintonizou seu relato${t ? ` "${t}"` : ''}`,
  comment_post:    (h, t) => `${h} comentou no seu relato${t ? ` "${t}"` : ''}`,
  follow:          (h)    => `${h} começou a te seguir`,
  follow_request:  (h)    => `${h} quer entrar na sua sintonia`,
  follow_accepted: (h)    => `${h} aceitou seu pedido de sintonia`,
};

/** Emoji por tipo */
export const NOTIF_ICONS: Record<NotificationType, string> = {
  reply:           '↩️',
  mention:         '📢',
  like_post:       '❤️',
  comment_post:    '💬',
  follow:          '🔗',
  follow_request:  '🤝',
  follow_accepted: '✅',
};
