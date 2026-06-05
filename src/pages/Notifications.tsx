/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Check, X, Ghost, ChevronLeft, MessageSquare, Bell, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, deleteDoc, setDoc, serverTimestamp, getDocs, updateDoc, increment, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/utils/firestore';
import UserAvatar from '../components/UserAvatar';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatRelativeTime = (date: any) => {
  if (!date) return '...';
  const d = date instanceof Date ? date : date.toDate();
  const distance = formatDistanceToNow(d, { locale: ptBR, addSuffix: false });
  return distance
    .replace('menos de um minuto', 'agora')
    .replace('cerca de ', '')
    .replace(' de', '')
    .replace('segundos', 's')
    .replace('segundo', 's')
    .replace('minutos', 'm')
    .replace('minuto', 'm')
    .replace('horas', 'h')
    .replace('hora', 'h')
    .replace('dias', 'd')
    .replace('dia', 'd');
};

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'respostas' | 'pedidos'>('respostas');
  
  // Follow requests state
  const [requests, setRequests] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [requestsLoading, setRequestsLoading] = useState(true);

  // Comment replies state
  const [replies, setReplies] = useState<any[]>([]);
  const [repliesLoading, setRepliesLoading] = useState(true);

  // Load follow requests
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'followRequests'), where('followingId', '==', user.uid));
    const unsubscribe = onSnapshot(q, async (snap) => {
      const reqList = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setRequests(reqList);

      if (reqList.length > 0) {
        const followerIds = [...new Set(reqList.map(r => r.followerId))] as string[];
        const usersQ = query(collection(db, 'users'), where('__name__', 'in', followerIds));
        const userSnap = await getDocs(usersQ);
        const userProfiles: Record<string, any> = {};
        userSnap.docs.forEach(d => {
          userProfiles[d.id] = d.data();
        });
        setProfiles(userProfiles);
      }
      setRequestsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'followRequests');
      setRequestsLoading(false);
    });

    return unsubscribe;
  }, [user]);

  // Load comment reply notifications
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('receiverId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const replyList = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setReplies(replyList);
      setRepliesLoading(false);
    }, (error) => {
      // Create empty collection or ignore list error silently to prevent crash
      setRepliesLoading(false);
    });

    return unsubscribe;
  }, [user]);

  const acceptRequest = async (requestId: string, followerId: string) => {
    if (!user) return;
    try {
      const followId = `${followerId}_${user.uid}`;
      await setDoc(doc(db, 'follows', followId), {
        followerId,
        followingId: user.uid,
        createdAt: serverTimestamp()
      });
      
      // Update counters
      await updateDoc(doc(db, 'users', followerId), { followingCount: increment(1) });
      await updateDoc(doc(db, 'users', user.uid), { followersCount: increment(1) });

      await deleteDoc(doc(db, 'followRequests', requestId));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `follows/${followerId}_${user.uid}`);
    }
  };

  const rejectRequest = async (requestId: string) => {
    try {
      await deleteDoc(doc(db, 'followRequests', requestId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `followRequests/${requestId}`);
    }
  };

  const handleNotificationClick = async (notif: any) => {
    try {
      if (!notif.read) {
        await updateDoc(doc(db, 'notifications', notif.id), { read: true });
      }
      navigate(`/post-view/${notif.reviewId}`);
    } catch (err) {
      console.error('Error handling notification click:', err);
    }
  };

  const markAllAsRead = async () => {
    const unreadNotifications = replies.filter(r => !r.read);
    for (const notif of unreadNotifications) {
      try {
        await updateDoc(doc(db, 'notifications', notif.id), { read: true });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const unreadRepliesCount = replies.filter(r => !r.read).length;
  const pendingRequestsCount = requests.length;

  return (
    <div className="min-h-screen bg-smog-950 pb-24 text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-smog-950/80 backdrop-blur-xl border-b border-moss-500/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-moss-400 hover:bg-white/5 rounded-xl transition-colors">
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-xl font-black uppercase tracking-tighter italic">Sintonias</h1>
        </div>

        {activeTab === 'respostas' && unreadRepliesCount > 0 && (
          <button 
            onClick={markAllAsRead}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-xl hover:bg-white/10 text-moss-400 hover:text-moss-300 text-[10px] font-black uppercase tracking-widest transition-all"
          >
            <Eye size={12} />
            Lidas
          </button>
        )}
      </header>

      {/* Tabs Menu */}
      <div className="px-6 mt-4 flex border-b border-white/5">
        <button 
          onClick={() => setActiveTab('respostas')}
          className={`flex-1 py-3 text-center text-xs font-black uppercase tracking-wider relative transition-all ${activeTab === 'respostas' ? 'text-moss-400' : 'text-gray-500'}`}
        >
          <span className="flex items-center justify-center gap-2">
            Respostas
            {unreadRepliesCount > 0 && (
              <span className="bg-moss-500 text-white min-w-5 h-5 px-1.5 rounded-full text-[9px] font-bold flex items-center justify-center animate-pulse">
                {unreadRepliesCount}
              </span>
            )}
          </span>
          {activeTab === 'respostas' && (
            <motion.div layoutId="notifTabLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-moss-400" />
          )}
        </button>

        <button 
          onClick={() => setActiveTab('pedidos')}
          className={`flex-1 py-3 text-center text-xs font-black uppercase tracking-wider relative transition-all ${activeTab === 'pedidos' ? 'text-moss-400' : 'text-gray-500'}`}
        >
          <span className="flex items-center justify-center gap-2">
            Pedidos
            {pendingRequestsCount > 0 && (
              <span className="bg-moss-500 text-white min-w-5 h-5 px-1.5 rounded-full text-[9px] font-bold flex items-center justify-center">
                {pendingRequestsCount}
              </span>
            )}
          </span>
          {activeTab === 'pedidos' && (
            <motion.div layoutId="notifTabLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-moss-400" />
          )}
        </button>
      </div>

      <main className="px-6 py-6">
        <AnimatePresence mode="wait">
          {activeTab === 'respostas' ? (
            <motion.div 
              key="respostas-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {repliesLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-10 h-10 border-4 border-moss-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : replies.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                  <Ghost size={64} className="text-moss-400 mb-4" />
                  <p className="font-black uppercase tracking-widest text-xs">Nenhuma resposta pendente</p>
                  <p className="text-xs text-gray-400 mt-2">Ninguém brisou nos seus comentários ainda.</p>
                </div>
              ) : (
                replies.map((notif) => (
                  <motion.div 
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-4 rounded-[28px] border transition-all cursor-pointer flex flex-col gap-3 relative ${
                      notif.read 
                        ? 'bg-white/2 border-white/5 opacity-70 hover:opacity-100 hover:bg-white/5' 
                        : 'bg-moss-500/5 border-moss-500/10 hover:bg-moss-500/10 hover:border-moss-500/20 shadow-lg shadow-moss-900/10'
                    }`}
                  >
                    {!notif.read && (
                      <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-moss-400 animate-pulse" />
                    )}

                    <div className="flex items-center gap-3">
                      <UserAvatar 
                        styles={notif.senderId === user?.uid ? null : null}
                        seed={notif.senderHandle}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black tracking-tight leading-tight uppercase">
                          {notif.senderName} 
                          <span className="text-gray-500 font-bold lowercase tracking-normal ml-1">
                            {notif.senderHandle}
                          </span>
                        </p>
                        <p className="text-[10px] text-moss-400 font-bold uppercase tracking-wider mt-0.5">
                          respondeu ao seu comentário • {formatRelativeTime(notif.createdAt)}
                        </p>
                      </div>
                    </div>

                    {notif.parentCommentText && (
                      <div className="bg-white/2 rounded-2xl p-3 border border-white/5">
                        <p className="text-[9px] text-gray-500 uppercase tracking-widest font-black leading-tight mb-1">Seu Comentário</p>
                        <p className="text-xs text-gray-400 italic line-clamp-2">"{notif.parentCommentText}"</p>
                      </div>
                    )}

                    <div className="bg-moss-500/5 border-l-2 border-moss-500 rounded-r-2xl p-3">
                      <p className="text-xs text-gray-200 font-medium italic">"{notif.commentText}"</p>
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="pedidos-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {requestsLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-10 h-10 border-4 border-moss-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : requests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                  <Ghost size={64} className="text-moss-400 mb-4" />
                  <p className="font-black uppercase tracking-widest text-xs">Nenhum pedido de sintonia</p>
                  <p className="text-xs text-gray-400 mt-2">Sua vibe está em paz por enquanto.</p>
                </div>
              ) : (
                requests.map((req) => {
                  const profile = profiles[req.followerId];
                  if (!profile) return null;

                  return (
                    <motion.div 
                      key={req.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-moss-500/5 border border-moss-500/10 rounded-[32px] p-4 flex items-center gap-4"
                    >
                      <UserAvatar styles={profile.avatarStyles} seed={profile.handle} size="md" rainbow={profile.rainbowActive} />
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-white truncate uppercase tracking-tighter leading-tight">{profile.displayName}</p>
                        <p className="text-[10px] text-moss-400 font-bold tracking-widest leading-tight">{profile.handle}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => acceptRequest(req.id, req.followerId)}
                          className="p-3 bg-moss-500 text-white rounded-2xl shadow-xl shadow-moss-900/40 active:scale-95 transition-all"
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
