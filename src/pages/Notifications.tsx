/**
 * Página de Notificações — FeedBECK
 * Suporta todos os tipos: reply, mention, like_post, comment_post,
 * follow, follow_request, follow_accepted.
 * Apenas in-app, sem push.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, Ghost, ChevronLeft, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  collection, query, where, onSnapshot, doc,
  deleteDoc, setDoc, serverTimestamp, getDocs,
  updateDoc, increment, orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/utils/firestore';
import UserAvatar from '../components/UserAvatar';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { NOTIF_ICONS, NOTIF_LABELS, NotificationType } from '../lib/notifications';

const fmt = (date: any) => {
  if (!date) return '...';
  const d = date instanceof Date ? date : date.toDate?.() ?? new Date(date);
  return formatDistanceToNow(d, { locale: ptBR, addSuffix: false })
    .replace('menos de um minuto', 'agora')
    .replace('cerca de ', '')
    .replace(/ de$/, '')
    .replace('segundos', 's').replace('segundo', 's')
    .replace('minutos', 'm').replace('minuto', 'm')
    .replace('horas', 'h').replace('hora', 'h')
    .replace('dias', 'd').replace('dia', 'd');
};

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'atividade' | 'pedidos'>('atividade');

  // ── Pedidos de sintonia ──────────────────────────────────────
  const [requests, setRequests] = useState<any[]>([]);
  const [reqProfiles, setReqProfiles] = useState<Record<string, any>>({});
  const [reqLoading, setReqLoading] = useState(true);

  // ── Notificações de atividade ────────────────────────────────
  const [notifs, setNotifs] = useState<any[]>([]);
  const [notifsLoading, setNotifsLoading] = useState(true);

  // Pedidos de follow
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'followRequests'), where('followingId', '==', user.uid));
    const unsub = onSnapshot(q, async (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      setRequests(list);
      if (list.length > 0) {
        const ids = [...new Set(list.map((r: any) => r.followerId))] as string[];
        const usersQ = query(collection(db, 'users'), where('__name__', 'in', ids));
        const usersSnap = await getDocs(usersQ);
        const map: Record<string, any> = {};
        usersSnap.docs.forEach(d => { map[d.id] = d.data(); });
        setReqProfiles(map);
      }
      setReqLoading(false);
    }, (err) => { handleFirestoreError(err, OperationType.LIST, 'followRequests'); setReqLoading(false); });
    return unsub;
  }, [user]);

  // Notificações de atividade (todos os tipos exceto follow_request)
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'notifications'), where('receiverId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      list.sort((a, b) => {
        const tA = a.createdAt?.seconds ?? 0;
        const tB = b.createdAt?.seconds ?? 0;
        return tB - tA;
      });
      setNotifs(list);
      setNotifsLoading(false);
    }, (err) => { console.error(err); setNotifsLoading(false); });
    return unsub;
  }, [user]);

  // ── Ações ────────────────────────────────────────────────────

  const acceptRequest = async (requestId: string, followerId: string) => {
    if (!user) return;
    try {
      const followId = `${followerId}_${user.uid}`;
      await setDoc(doc(db, 'follows', followId), {
        followerId, followingId: user.uid, createdAt: serverTimestamp()
      });
      await updateDoc(doc(db, 'users', followerId), { followingCount: increment(1) });
      await updateDoc(doc(db, 'users', user.uid), { followersCount: increment(1) });
      await deleteDoc(doc(db, 'followRequests', requestId));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'follows');
    }
  };

  const rejectRequest = async (requestId: string) => {
    try { await deleteDoc(doc(db, 'followRequests', requestId)); }
    catch (err) { handleFirestoreError(err, OperationType.DELETE, `followRequests/${requestId}`); }
  };

  const markAsRead = async (notif: any) => {
    try {
      if (!notif.read) {
        await updateDoc(doc(db, 'notifications', notif.id), { read: true });
      }
      // Navega para o relato se houver reviewId
      if (notif.reviewId) navigate(`/post-view/${notif.reviewId}`);
    } catch (err) { console.error(err); }
  };

  const markAllRead = async () => {
    const unread = notifs.filter(n => !n.read);
    await Promise.all(unread.map(n =>
      updateDoc(doc(db, 'notifications', n.id), { read: true }).catch(() => {})
    ));
  };

  const unreadCount = notifs.filter(n => !n.read).length;
  const pendingCount = requests.length;

  // ── Renderização de uma notificação ──────────────────────────

  const NotifCard = ({ notif }: { notif: any }) => {
    const type: NotificationType = notif.type;
    const icon = NOTIF_ICONS[type] ?? '🔔';
    const label = NOTIF_LABELS[type]?.(notif.senderHandle, notif.commentText || notif.reviewTitle) ?? `${notif.senderHandle} interagiu`;

    // Cores por tipo
    const accent: Record<NotificationType, string> = {
      like_post:       'border-rose-500/20 bg-rose-500/5',
      comment_post:    'border-sky-500/20 bg-sky-500/5',
      reply:           'border-moss-500/15 bg-moss-500/5',
      mention:         'border-purple-500/20 bg-purple-500/5',
      follow:          'border-indigo-500/20 bg-indigo-500/5',
      follow_request:  'border-moss-500/20 bg-moss-500/5',
      follow_accepted: 'border-emerald-500/20 bg-emerald-500/5',
    };

    const dotColor: Record<NotificationType, string> = {
      like_post: 'bg-rose-400', comment_post: 'bg-sky-400',
      reply: 'bg-moss-400', mention: 'bg-purple-400',
      follow: 'bg-indigo-400', follow_request: 'bg-moss-400',
      follow_accepted: 'bg-emerald-400',
    };

    return (
      <motion.div
        onClick={() => markAsRead(notif)}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative p-4 rounded-[28px] border transition-all cursor-pointer flex flex-col gap-2.5 ${
          notif.read
            ? 'bg-white/2 border-white/5 opacity-60 hover:opacity-100 hover:bg-white/5'
            : `${accent[type] ?? 'border-white/10 bg-white/5'} hover:brightness-110`
        }`}
      >
        {/* Unread dot */}
        {!notif.read && (
          <span className={`absolute top-4 right-4 w-2 h-2 rounded-full ${dotColor[type] ?? 'bg-moss-400'} animate-pulse`} />
        )}

        <div className="flex items-center gap-3">
          {/* Emoji icon chip */}
          <div className="text-lg shrink-0 w-8 text-center">{icon}</div>

          <UserAvatar seed={notif.senderHandle} size="sm" />

          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-white leading-snug">
              {label}
            </p>
            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
              {fmt(notif.createdAt)}
            </p>
          </div>
        </div>

        {/* Conteúdo contextual */}
        {(type === 'reply' || type === 'mention' || type === 'comment_post') && notif.commentText && (
          <div className="border-l-2 border-moss-500 pl-3 ml-11">
            <p className="text-xs text-gray-300 italic leading-relaxed line-clamp-2">
              "{notif.commentText}"
            </p>
          </div>
        )}

        {type === 'reply' && notif.parentCommentText && (
          <div className="ml-11">
            <p className="text-[9px] text-gray-500 italic">
              em resposta ao seu: <span className="opacity-60">"{notif.parentCommentText}"</span>
            </p>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-smog-950 pb-24 text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-smog-950/80 backdrop-blur-xl border-b border-moss-500/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-moss-400 hover:bg-white/5 rounded-xl transition-colors">
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-xl font-black uppercase tracking-tighter italic">Notificações</h1>
        </div>
        {activeTab === 'atividade' && unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-xl hover:bg-white/10 text-moss-400 hover:text-moss-300 text-[10px] font-black uppercase tracking-widest transition-all"
          >
            <Eye size={12} /> Marcar lidas
          </button>
        )}
      </header>

      {/* Tabs */}
      <div className="px-6 mt-4 flex border-b border-white/5">
        <button
          onClick={() => setActiveTab('atividade')}
          className={`flex-1 py-3 text-center text-xs font-black uppercase tracking-wider relative transition-all ${activeTab === 'atividade' ? 'text-moss-400' : 'text-gray-500'}`}
        >
          <span className="flex items-center justify-center gap-2">
            Atividade
            {unreadCount > 0 && (
              <span className="bg-moss-500 text-white min-w-5 h-5 px-1.5 rounded-full text-[9px] font-bold flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </span>
          {activeTab === 'atividade' && (
            <motion.div layoutId="notifTabLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-moss-400" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('pedidos')}
          className={`flex-1 py-3 text-center text-xs font-black uppercase tracking-wider relative transition-all ${activeTab === 'pedidos' ? 'text-moss-400' : 'text-gray-500'}`}
        >
          <span className="flex items-center justify-center gap-2">
            Sintonias
            {pendingCount > 0 && (
              <span className="bg-moss-500 text-white min-w-5 h-5 px-1.5 rounded-full text-[9px] font-bold flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </span>
          {activeTab === 'pedidos' && (
            <motion.div layoutId="notifTabLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-moss-400" />
          )}
        </button>
      </div>

      {/* Conteúdo */}
      <main className="px-6 py-6">
        <AnimatePresence mode="wait">

          {/* ── Tab: Atividade ── */}
          {activeTab === 'atividade' && (
            <motion.div
              key="atividade"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              {notifsLoading ? (
                <div className="flex justify-center py-16">
                  <div className="w-10 h-10 border-4 border-moss-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : notifs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center opacity-40">
                  <Ghost size={56} className="text-moss-400 mb-4" />
                  <p className="font-black uppercase tracking-widest text-xs">Nenhuma atividade ainda</p>
                  <p className="text-xs text-gray-400 mt-2">Suas notificações aparecem aqui.</p>
                </div>
              ) : (
                notifs.map(n => <NotifCard key={n.id} notif={n} />)
              )}
            </motion.div>
          )}

          {/* ── Tab: Pedidos de sintonia ── */}
          {activeTab === 'pedidos' && (
            <motion.div
              key="pedidos"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              {reqLoading ? (
                <div className="flex justify-center py-16">
                  <div className="w-10 h-10 border-4 border-moss-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : requests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center opacity-40">
                  <Ghost size={56} className="text-moss-400 mb-4" />
                  <p className="font-black uppercase tracking-widest text-xs">Nenhum pedido pendente</p>
                  <p className="text-xs text-gray-400 mt-2">Sua sintonia está em paz.</p>
                </div>
              ) : (
                requests.map(req => {
                  const p = reqProfiles[req.followerId];
                  if (!p) return null;
                  return (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-moss-500/5 border border-moss-500/10 rounded-[32px] p-4 flex items-center gap-4"
                    >
                      <UserAvatar styles={p.avatarStyles} seed={p.handle} size="md" rainbow={p.rainbowActive} />
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-white truncate uppercase tracking-tighter leading-tight">{p.displayName}</p>
                        <p className="text-[10px] text-moss-400 font-bold tracking-widest leading-tight">{p.handle}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => acceptRequest(req.id, req.followerId)}
                          className="p-3 bg-moss-500 text-white rounded-2xl shadow-xl shadow-moss-900/40 active:scale-95 transition-all hover:bg-moss-400"
                        >
                          <Check size={18} />
                        </button>
                        <button
                          onClick={() => rejectRequest(req.id)}
                          className="p-3 bg-white/5 text-gray-500 rounded-2xl hover:text-white hover:bg-red-500/20 active:scale-95 transition-all"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
