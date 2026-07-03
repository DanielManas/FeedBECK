import { useState, useEffect, useRef, useCallback } from 'react';
import { Star, Heart, MessageCircle, Send, X, Pin, Play, Pause, Music, Flag, AlertTriangle, Trash2, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LighterButton from '../components/LighterButton';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/utils/firestore';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where,
  or,
  serverTimestamp,
  doc,
  updateDoc,
  increment,
  deleteDoc,
  setDoc,
  getDoc,
  getDocs,
  limit
} from 'firebase/firestore';

import UserAvatar from '../components/UserAvatar';
import Logo from '../components/Logo';
import { useTutorial } from '../context/TutorialContext';

interface Comment {
  id: string;
  authorId: string;
  authorHandle: string;
  userName?: string;
  userHandle?: string;
  userAvatarStyles?: any;
  text: string;
  createdAt: any;
  parentId?: string;
  replyToHandle?: string;
  replyToUserId?: string;
}

const formatRelativeTime = (date: any) => {
  if (!date) return '...';
  const d = date instanceof Date ? date : date.toDate();
  const distance = formatDistanceToNow(d, { locale: ptBR, addSuffix: false });
  return distance
    .replace('menos de um minuto', 'agora')
    .replace('cerca de ', '')
    .replace(' de', '')
    .replace('segundos', 's').replace('segundo', 's')
    .replace('minutos', 'm').replace('minuto', 'm')
    .replace('horas', 'h').replace('hora', 'h')
    .replace('dias', 'd').replace('dia', 'd');
};

interface Review {
  id: string;
  authorId: string;
  userName: string;
  userHandle: string;
  category: 'larica' | 'filme' | 'brisas' | 'sons';
  title: string;
  content: string;
  rating: number;
  timestamp: Date;
  sintonias: number;
  commentsCount?: number;
  authorAvatarStyles?: any;
  authorRainbowActive?: boolean;
  images?: string[];
  musicData?: {
    trackName: string;
    artistName: string;
    artworkUrl: string;
    previewUrl: string;
  };
}

const CategoryBadge = ({ category }: { category: Review['category'] }) => {
  const styles = {
    larica: 'bg-orange-500/20 text-orange-400',
    filme: 'bg-amber-500/20 text-amber-400',
    brisas: 'bg-green-500/20 text-green-400',
    sons: 'bg-indigo-500/20 text-indigo-400'
  };
  return (
    <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md ${styles[category]}`}>
      {category === 'brisas' ? 'brisa' : category}
    </span>
  );
};

// Quantos posts carregar inicialmente / por página — evita travar o app com feed gigante
const FEED_PAGE_SIZE = 30;

export default function Feed() {
  const { user, profile, isAdmin, followingIds } = useAuth();
  const [activeFilter, setActiveFilter] = useState<'todos' | 'larica' | 'filme' | 'brisas' | 'sons'>('todos');
  const [syncedIds, setSyncedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // ── Marco de "última visita" — salvo no Firestore (users/{uid}.lastFeedVisitAt) ──
  // Tudo criado DEPOIS desse timestamp = novo. Tudo criado ANTES = já visto.
  const [lastVisitMark, setLastVisitMark] = useState<Date | null>(null);
  const [markLoaded, setMarkLoaded] = useState(false);

  // Quantos posts exibir no momento (paginação local, sem re-fetch pesado)
  const [visibleCount, setVisibleCount] = useState(FEED_PAGE_SIZE);

  const [activeCommentsId, setActiveCommentsId] = useState<string | null>(null);
  const [commenterProfiles, setCommenterProfiles] = useState<Record<string, any>>({});
  const [reviews, setReviews] = useState<Review[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; authorHandle: string; authorId: string; text: string } | null>(null);
  const [commentLoading, setCommentLoading] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState<any[]>([]);
  const [showMentionList, setShowMentionList] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [reportModal, setReportModal] = useState<{ id: string, type: 'post' | 'comment', content: string, targetUserId: string } | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [, setTick] = useState(0);
  const [unreadRepliesCount, setUnreadRepliesCount] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const inputAreaRef = useRef<HTMLDivElement | null>(null);
  const [mentionListBottom, setMentionListBottom] = useState(0);
  const [visibleVH, setVisibleVH] = useState(window.innerHeight);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ── 1. Carregar e gravar o marco de última visita ────────────────────────
  // Ao montar o Feed: lê users/{uid}.lastFeedVisitAt (define onde fica a linha
  // "você viu até aqui"), e em seguida ATUALIZA esse campo para agora — assim
  // a próxima visita usa o timestamp desta sessão.
  useEffect(() => {
    if (!user) {
      setLastVisitMark(null);
      setMarkLoaded(true);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        const data = snap.exists() ? snap.data() : null;
        const previousMark = data?.lastFeedVisitAt
          ? (data.lastFeedVisitAt.toDate ? data.lastFeedVisitAt.toDate() : new Date(data.lastFeedVisitAt))
          : null;

        if (!cancelled) {
          setLastVisitMark(previousMark);
          setMarkLoaded(true);
        }

        // Atualiza o marco para "agora" — só vale para a PRÓXIMA visita
        await updateDoc(userRef, { lastFeedVisitAt: serverTimestamp() }).catch(() => {});
      } catch (_) {
        if (!cancelled) {
          setLastVisitMark(null);
          setMarkLoaded(true);
        }
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // ── Viewport ──────────────────────────────────────────────────────────────
  const recalcViewport = () => {
    const vh = window.visualViewport?.height ?? window.innerHeight;
    setVisibleVH(vh);
    if (inputAreaRef.current) {
      const rect = inputAreaRef.current.getBoundingClientRect();
      setMentionListBottom(window.innerHeight - rect.top + 8);
    }
  };

  useEffect(() => {
    window.visualViewport?.addEventListener('resize', recalcViewport);
    window.visualViewport?.addEventListener('scroll', recalcViewport);
    recalcViewport();
    return () => {
      window.visualViewport?.removeEventListener('resize', recalcViewport);
      window.visualViewport?.removeEventListener('scroll', recalcViewport);
    };
  }, []);

  // ── Audio ─────────────────────────────────────────────────────────────────
  const togglePlayback = (id: string, url: string) => {
    if (playingId === id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
      } else {
        const audio = new Audio(url);
        audio.onended = () => setPlayingId(null);
        audio.play();
        audioRef.current = audio;
      }
      setPlayingId(id);
    }
  };
  useEffect(() => { return () => { audioRef.current?.pause(); }; }, []);

  // ── Denúncia ───────────────────────────────────────────────────────────────
  const handleReport = async () => {
    if (!reportModal || !reportReason.trim() || !user) return;
    setReportLoading(true);
    try {
      const reportId = `${user.uid}_${reportModal.id}_${Date.now()}`;
      await setDoc(doc(db, 'reports', reportId), {
        id: reportId, targetId: reportModal.id, targetUserId: reportModal.targetUserId,
        targetType: reportModal.type, reason: reportReason.trim(),
        reporterId: user.uid, reporterHandle: profile?.handle || '@anonimo',
        targetContent: reportModal.content, status: 'pending', createdAt: serverTimestamp()
      });
      alert('Denúncia enviada com sucesso. Nossa equipe de moderação irá analisar.');
      setReportModal(null);
      setReportReason('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'reports');
    } finally { setReportLoading(false); }
  };

  const ME_HANDLE = profile?.handle || '@anonimo';

  // ── 2. Reviews — limitado para não travar o app com feeds gigantes ───────
  useEffect(() => {
    if (!user) {
      const q = query(
        collection(db, 'reviews'),
        where('isPrivate', '==', false),
        orderBy('createdAt', 'desc'),
        limit(FEED_PAGE_SIZE * 3) // margem para filtros locais (categoria/anônimo)
      );
      return onSnapshot(q, (snap) => {
        setReviews(snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id, ...data,
            userName: data.authorName || data.userName || 'Usuário',
            userHandle: data.authorHandle || data.userHandle || '@anonimo',
            authorAvatarStyles: data.authorAvatarStyles || data.userAvatarStyles,
            authorRainbowActive: data.authorRainbowActive,
            timestamp: data.createdAt?.toDate() || new Date()
          } as Review;
        }).filter(r => r.userHandle !== '@anonimo'));
      });
    }

    const limitedFollowingIds = followingIds.slice(0, 28);
    const q = limitedFollowingIds.length > 0
      ? query(
          collection(db, 'reviews'),
          or(
            where('isPrivate', '==', false),
            where('authorId', '==', user.uid),
            where('authorId', 'in', limitedFollowingIds)
          ),
          orderBy('createdAt', 'desc'),
          limit(FEED_PAGE_SIZE * 3)
        )
      : query(
          collection(db, 'reviews'),
          or(
            where('isPrivate', '==', false),
            where('authorId', '==', user.uid)
          ),
          orderBy('createdAt', 'desc'),
          limit(FEED_PAGE_SIZE * 3)
        );

    return onSnapshot(q, (snap) => {
      setReviews(snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id, ...data,
          userName: data.authorName || data.userName || 'Usuário',
          userHandle: data.authorHandle || data.userHandle || '@anonimo',
          authorAvatarStyles: data.authorAvatarStyles || data.userAvatarStyles,
          authorRainbowActive: data.authorRainbowActive,
          timestamp: data.createdAt?.toDate() || new Date()
        } as Review;
      }).filter(r => r.userHandle !== '@anonimo' || r.authorId === user.uid));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'reviews'));
  }, [user, followingIds]);

  useEffect(() => {
    if (!user) { setSyncedIds(new Set()); return; }
    return onSnapshot(query(collection(db, 'users', user.uid, 'sintonias')), (snap) => setSyncedIds(new Set(snap.docs.map(d => d.id))), (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/sintonias`));
  }, [user]);

  useEffect(() => {
    if (!user) { setSavedIds(new Set()); return; }
    return onSnapshot(query(collection(db, 'users', user.uid, 'saved_posts')), (snap) => setSavedIds(new Set(snap.docs.map(d => d.id))), (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/saved_posts`));
  }, [user]);

  useEffect(() => {
    if (!user) { setUnreadRepliesCount(0); return; }
    return onSnapshot(query(collection(db, 'notifications'), where('receiverId', '==', user.uid), where('read', '==', false)), (snap) => setUnreadRepliesCount(snap.size), () => {});
  }, [user]);

  const [commenterUserIds, setCommenterUserIds] = useState<string[]>([]);
  useEffect(() => {
    if (!activeCommentsId) { setComments([]); setCommenterUserIds([]); return; }
    return onSnapshot(query(collection(db, 'reviews', activeCommentsId, 'comments'), orderBy('createdAt', 'desc')), (snap) => {
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() } as Comment));
      setComments(fetched);
      setCommenterUserIds(fetched.map((c: any) => c.userId || c.authorId).filter(Boolean));
      const cur = reviews.find(r => r.id === activeCommentsId);
      if (cur && cur.commentsCount !== snap.size) {
        updateDoc(doc(db, 'reviews', activeCommentsId), { commentsCount: snap.size }).catch(() => {});
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, `reviews/${activeCommentsId}/comments`));
  }, [activeCommentsId, reviews]);

  useEffect(() => {
    const uniqueIds = Array.from(new Set(commenterUserIds)).slice(0, 30);
    if (uniqueIds.length === 0) { setCommenterProfiles({}); return; }
    return onSnapshot(query(collection(db, 'users'), where('__name__', 'in', uniqueIds)), (snap) => {
      const p: Record<string, any> = {};
      snap.docs.forEach(d => { p[d.id] = d.data(); });
      setCommenterProfiles(prev => ({ ...prev, ...p }));
    }, () => {});
  }, [commenterUserIds]);

  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 60000);
    return () => clearInterval(t);
  }, []);

  // ── Ações ──────────────────────────────────────────────────────────────────
  const toggleSync = async (reviewId: string, authorId: string) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'reviews', reviewId);
      const userLikeRef = doc(db, 'users', user.uid, 'sintonias', reviewId);
      if (!syncedIds.has(reviewId)) {
        await setDoc(userLikeRef, { createdAt: serverTimestamp() });
        try { await updateDoc(docRef, { sintonias: increment(1) }); } catch (_) {}
        if (authorId) { try { await updateDoc(doc(db, 'users', authorId), { totalSintonias: increment(1) }); } catch (_) {} }
        if (authorId && authorId !== user.uid) {
          try {
            const likedReview = reviews.find(r => r.id === reviewId);
            const ref = doc(collection(db, 'notifications'));
            await setDoc(ref, { id: ref.id, type: 'like_post', senderId: user.uid, senderHandle: profile?.handle || '@usuario', senderName: profile?.displayName || 'Usuário', senderAvatarStyles: profile?.avatarStyles || null, receiverId: authorId, reviewId, reviewTitle: likedReview?.title || '', commentId: '', commentText: '', parentCommentText: '', read: false, createdAt: serverTimestamp() });
          } catch (_) {}
        }
      } else {
        await deleteDoc(userLikeRef);
        try { await updateDoc(docRef, { sintonias: increment(-1) }); } catch (_) {}
        if (authorId) { try { await updateDoc(doc(db, 'users', authorId), { totalSintonias: increment(-1) }); } catch (_) {} }
      }
    } catch (err) { console.error('Error toggling sintonia:', err); }
  };

  const toggleSave = async (reviewId: string) => {
    if (!user) return;
    try {
      const ref = doc(db, 'users', user.uid, 'saved_posts', reviewId);
      if (!savedIds.has(reviewId)) { await setDoc(ref, { reviewId, savedAt: serverTimestamp() }); }
      else { await deleteDoc(ref); }
    } catch (err) { console.error('Error toggling save:', err); }
  };

  const handleAddComment = async () => {
    if (!activeCommentsId || !newCommentText.trim() || !user) return;
    const textToSend = newCommentText.trim();
    const replyingToSnapshot = replyingTo;
    const currentReview = reviews.find(r => r.id === activeCommentsId);
    setNewCommentText(''); setReplyingTo(null); setShowMentionList(false); setMentionSuggestions([]); setCommentLoading(true);
    try {
      const commentColl = collection(db, 'reviews', activeCommentsId, 'comments');
      const newCommentDoc = doc(commentColl);
      const commentId = newCommentDoc.id;
      const commentData: any = { authorId: user.uid, authorHandle: profile?.handle || '@usuario', userName: profile?.displayName || 'Usuário', userHandle: profile?.handle || '@usuario', userAvatarStyles: profile?.avatarStyles || null, text: textToSend, createdAt: serverTimestamp() };
      if (replyingToSnapshot) { commentData.parentId = replyingToSnapshot.commentId; commentData.replyToHandle = replyingToSnapshot.authorHandle; commentData.replyToUserId = replyingToSnapshot.authorId; }
      await setDoc(newCommentDoc, commentData);
      await updateDoc(doc(db, 'reviews', activeCommentsId), { commentsCount: increment(1) });
      try {
        const senderAvatarStyles = profile?.avatarStyles || null;
        const reviewTitle = currentReview?.title || '';
        const mentionMatches = textToSend.match(/@[a-z0-9_]+/g) || [];
        if (replyingToSnapshot && replyingToSnapshot.authorId !== user.uid) {
          const ref = doc(collection(db, 'notifications'));
          await setDoc(ref, { id: ref.id, type: 'reply', senderId: user.uid, senderHandle: profile?.handle || '@usuario', senderName: profile?.displayName || 'Usuário', senderAvatarStyles, receiverId: replyingToSnapshot.authorId, reviewId: activeCommentsId, reviewTitle, commentId, commentText: textToSend, parentCommentText: replyingToSnapshot.text, read: false, createdAt: serverTimestamp() });
        }
        if (currentReview && currentReview.authorId !== user.uid) {
          const ref = doc(collection(db, 'notifications'));
          await setDoc(ref, { id: ref.id, type: 'comment_post', senderId: user.uid, senderHandle: profile?.handle || '@usuario', senderName: profile?.displayName || 'Usuário', senderAvatarStyles, receiverId: currentReview.authorId, reviewId: activeCommentsId, reviewTitle, commentId, commentText: textToSend, parentCommentText: '', read: false, createdAt: serverTimestamp() });
        }
        for (const mentionHandle of [...new Set(mentionMatches)]) {
          try {
            const snap = await getDocs(query(collection(db, 'users'), where('handle', '==', mentionHandle)));
            if (!snap.empty) {
              const mu = snap.docs[0].data();
              if (mu.uid !== user.uid) {
                const ref = doc(collection(db, 'notifications'));
                await setDoc(ref, { id: ref.id, type: 'mention', senderId: user.uid, senderHandle: profile?.handle || '@usuario', senderName: profile?.displayName || 'Usuário', senderAvatarStyles, receiverId: mu.uid, reviewId: activeCommentsId, reviewTitle, commentId, commentText: textToSend, parentCommentText: '', read: false, createdAt: serverTimestamp() });
              }
            }
          } catch (_) {}
        }
      } catch (err) { console.error('FEEDBECK NOTIF ERROR:', err); }
    } catch (err) { console.error('Error adding comment:', err); setNewCommentText(textToSend); }
    finally { setCommentLoading(false); }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!activeCommentsId) return;
    try {
      await deleteDoc(doc(db, 'reviews', activeCommentsId, 'comments', commentId));
      await updateDoc(doc(db, 'reviews', activeCommentsId), { commentsCount: increment(-1) });
    } catch (_) {}
  };

  const deleteReview = async (id: string) => {
    setIsDeleting(null);
    try { await deleteDoc(doc(db, 'reviews', id)); } catch (err) { console.error('Delete error:', err); }
  };

  // ── Tutorial post ──────────────────────────────────────────────────────────
  const { isActive: showTutorial } = useTutorial();
  const tutorialPost: Review | null = showTutorial ? {
    id: 'tutorial-post', authorId: 'system', userName: 'Equipe FeedBECK', userHandle: '@suporte',
    category: 'brisas', title: 'Bem-vindo ao FeedBECK! 🌿',
    content: 'Este é um post de exemplo para você entender como as coisas funcionam por aqui. Explore os relatos e compartilhe os seus!',
    rating: 5, timestamp: new Date(), sintonias: 42, commentsCount: 7,
    authorAvatarStyles: { top: 'shaggy', topColor: '2c1b18', facialHair: 'blank', skinColor: 'ffdbac', clothingColor: '3c4f5e', eyes: 'default', mouth: 'default', glasses: 'blank', clothes: 'shirtCrewNeck' },
    images: ['https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=800']
  } : null;

  // ── 3. Feed final: novos acima, linha "você viu até aqui", antigos abaixo ──
  const filteredReviews = showTutorial
    ? (tutorialPost ? [tutorialPost] : [])
    : (activeFilter === 'todos' ? reviews : reviews.filter(r => r.category === activeFilter));

  // Posts novos = criados DEPOIS do último marco de visita salvo
  const newPosts = (!showTutorial && lastVisitMark)
    ? filteredReviews.filter(r => r.timestamp > lastVisitMark)
    : filteredReviews;
  const oldPosts = (!showTutorial && lastVisitMark)
    ? filteredReviews.filter(r => r.timestamp <= lastVisitMark)
    : [];

  // Paginação local — corta a lista total no visibleCount para não travar o app
  const totalOrdered = [...newPosts, ...oldPosts];
  const paginated = totalOrdered.slice(0, visibleCount);
  const hasMore = totalOrdered.length > visibleCount;

  // Índice onde a linha separadora deve aparecer dentro da lista paginada
  const dividerIndex = newPosts.length > 0 && newPosts.length < paginated.length ? newPosts.length : -1;

  const notificationCount = unreadRepliesCount;
  const hasNotifications = notificationCount > 0;

  const filterOptions = [
    { id: 'todos', label: 'Todos' },
    { id: 'larica', label: 'Larica' },
    { id: 'filme', label: 'Filme' },
    { id: 'brisas', label: 'Brisa' },
    { id: 'sons', label: 'Sons' }
  ];

  return (
    <div className="p-6 pt-12 pb-24">
      <header className="mb-6">
        <div className="flex justify-between items-start">
          <div id="tutorial-welcome">
            <div className="flex items-center gap-3">
              <Logo size={42} showText />
              {isAdmin && <span className="bg-red-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-lg shadow-red-900/40">Admin</span>}
            </div>
            <p className="text-gray-500 text-[10px] mt-2 uppercase tracking-[0.2em] font-bold">Relatos da Brisa</p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <Link to="/notifications" className="relative p-1.5 rounded-xl hover:bg-white/5 transition-all outline-none flex items-center justify-center">
              <LighterButton hasFlame={hasNotifications} count={notificationCount} />
            </Link>
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <UserAvatar styles={profile?.avatarStyles} seed={user?.uid} size="lg" rainbow={profile?.rainbowActive} />
              <Link to={`/profile/${ME_HANDLE.replace('@', '')}`}>
                <span className="text-[9px] font-black uppercase tracking-widest text-moss-500/60 hover:text-moss-400 transition-colors">{ME_HANDLE}</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2 mb-8">
        {filterOptions.map((opt) => (
          <button key={opt.id} onClick={() => { setActiveFilter(opt.id as any); setVisibleCount(FEED_PAGE_SIZE); }}
            className={`px-5 py-2 rounded-full text-[10px] uppercase tracking-widest font-bold transition-all whitespace-nowrap ${
              activeFilter === opt.id
                ? opt.id === 'larica' ? 'bg-orange-500 text-white shadow-lg shadow-orange-900/40'
                  : opt.id === 'filme' ? 'bg-amber-500 text-white shadow-lg shadow-amber-900/40'
                  : opt.id === 'brisas' ? 'bg-moss-500 text-white shadow-lg shadow-moss-900/40'
                  : opt.id === 'sons' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-900/40'
                  : 'bg-moss-500 text-white shadow-lg shadow-moss-900/40'
                : 'glass text-gray-500 border-white/5 hover:border-white/20'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <section className="space-y-6">
        {/* Aguardando o marco de última visita carregar (evita flash de ordenação errada) */}
        {!markLoaded ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-moss-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : paginated.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-600 italic text-sm">Nenhum relato por aqui ainda...</p>
          </div>
        ) : (
          <>
            {paginated.map((review, index) => (
              <div key={review.id}>
                {/* Linha "você viu até aqui" — entre os novos e os antigos */}
                {index === dividerIndex && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-3 py-6 mb-2"
                  >
                    <div className="flex-1 h-[1px] bg-white/10" />
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-600 whitespace-nowrap px-2">
                      Você viu até aqui
                    </span>
                    <div className="flex-1 h-[1px] bg-white/10" />
                  </motion.div>
                )}

                <motion.div
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  id={review.id === 'tutorial-post' ? 'tutorial-post-card' : undefined}
                  className={`glass-card p-6 shadow-xl shadow-black/20 overflow-hidden relative border-t-4 transition-all ${
                    review.category === 'sons' ? 'border-indigo-500/50 shadow-indigo-900/10' : 'border-transparent'
                  } ${dividerIndex !== -1 && index >= dividerIndex ? 'opacity-70' : ''}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div id={review.id === 'tutorial-post' ? 'tutorial-post-author' : undefined} className="flex items-center gap-3">
                      <UserAvatar
                        styles={review.userHandle === ME_HANDLE ? profile?.avatarStyles : review.authorAvatarStyles}
                        seed={review.userHandle} size="md"
                        rainbow={review.userHandle === ME_HANDLE ? profile?.rainbowActive : review.authorRainbowActive}
                      />
                      <div>
                        <Link to={`/profile/${review.userHandle}`}>
                          <span className="text-sm font-bold text-gray-300 block leading-tight hover:text-white transition-colors">{review.userName}</span>
                          <span className="text-[10px] text-moss-400 font-bold uppercase tracking-widest block hover:underline">{review.userHandle}</span>
                        </Link>
                        <span className="text-[9px] text-gray-600 font-bold uppercase tracking-tighter mt-1 block">{formatRelativeTime(review.timestamp)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(isAdmin || user?.uid === review.authorId) && (
                        <button onClick={() => setIsDeleting(review.id)} className="p-2 text-gray-600 hover:text-red-500 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      )}
                      <div id={review.id === 'tutorial-post' ? 'tutorial-post-category' : undefined}>
                        <CategoryBadge category={review.category} />
                      </div>
                    </div>
                  </div>

                  <h2
                    id={review.id === 'tutorial-post' ? 'tutorial-post-title' : undefined}
                    className={`text-xl font-bold mt-2 leading-tight ${review.id === 'tutorial-post' ? 'text-moss-400 animate-pulse drop-shadow-[0_0_15px_rgba(74,222,128,1)] scale-[1.02] transition-transform' : 'text-white'}`}
                  >
                    {review.title}
                  </h2>

                  {/* Music Player */}
                  {review.category === 'sons' && review.musicData && (
                    <div className="mt-4 bg-indigo-500/5 border border-indigo-500/20 rounded-[28px] p-4 flex items-center gap-4 relative overflow-hidden group">
                      <div className="absolute inset-0 bg-indigo-500/5 blur-3xl -z-10" />
                      <div className="relative shrink-0">
                        {review.musicData.artworkUrl === 'placeholder:sons' ? (
                          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center shadow-lg border border-white/20">
                            <Music size={28} className="text-white/80" />
                          </div>
                        ) : (
                          <img src={review.musicData.artworkUrl} className="w-16 h-16 rounded-xl shadow-lg border border-white/10" alt="" />
                        )}
                        {review.musicData.previewUrl && (
                          <button onClick={() => review.musicData && togglePlayback(review.id, review.musicData.previewUrl)}
                            className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/60 transition-all rounded-xl">
                            {playingId === review.id ? <Pause size={24} className="text-white animate-pulse" /> : <Play size={24} className="text-white ml-0.5" />}
                          </button>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">{review.musicData.previewUrl ? 'Ouvindo agora' : 'Som Recomendado'}</p>
                        <p className="text-lg font-black text-white truncate uppercase tracking-tighter leading-tight"><span className="text-indigo-400/50">Música:</span> {review.musicData.trackName}</p>
                        <p className="text-xs text-white/50 font-bold truncate uppercase tracking-widest mt-1"><span className="text-indigo-400/30">Artista:</span> {review.musicData.artistName}</p>
                      </div>
                    </div>
                  )}

                  {/* Image Carousel */}
                  {review.images && review.images.length > 0 && (
                    <div id={review.id === 'tutorial-post' ? 'tutorial-post-content' : undefined} className="mt-4 -mx-6">
                      <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar gap-2 px-6">
                        {review.images.map((img, idx) => (
                          <div key={idx} className="flex-shrink-0 w-[85%] aspect-square snap-center rounded-2xl overflow-hidden shadow-2xl relative bg-black/40">
                            <img src={img} alt={`Post ${idx}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-gray-400 text-sm mt-3 leading-relaxed font-light italic">{review.content}</p>

                  <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">
                    <div className="flex items-center gap-5">
                      <button
                        id={review.id === 'tutorial-post' ? 'tutorial-post-like-button' : undefined}
                        onClick={() => toggleSync(review.id, review.authorId || (review as any).userId)}
                        className={`flex items-center gap-2 transition-all p-1.5 -m-1.5 rounded-xl ${syncedIds.has(review.id) ? 'text-moss-400' : 'text-gray-600 hover:text-moss-400'}`}
                      >
                        <Heart size={18} className={syncedIds.has(review.id) ? 'fill-current' : ''} />
                        <span className="text-[10px] font-black uppercase tracking-tighter">{review.sintonias}</span>
                      </button>
                      <button
                        id={review.id === 'tutorial-post' ? 'tutorial-post-comment-button' : undefined}
                        onClick={() => setActiveCommentsId(review.id)}
                        className="flex items-center gap-2 text-gray-600 hover:text-white transition-colors"
                      >
                        <MessageCircle size={18} />
                        <span className="text-[10px] font-black uppercase tracking-tighter">{review.commentsCount || 0}</span>
                      </button>
                      <button
                        id={review.id === 'tutorial-post' ? 'tutorial-post-save-button' : undefined}
                        onClick={() => toggleSave(review.id)}
                        className={`transition-all ${savedIds.has(review.id) ? 'text-moss-400' : 'text-gray-600 hover:text-white'}`}
                      >
                        <Pin size={18} className={savedIds.has(review.id) ? 'fill-current' : ''} />
                      </button>
                      <button
                        id={review.id === 'tutorial-post' ? 'tutorial-post-share-button' : undefined}
                        onClick={() => {
                          if (navigator.share) { navigator.share({ title: review.title, text: `Confira esse relato no FeedBECK: ${review.title}`, url: window.location.href }).catch(() => {}); }
                          else { navigator.clipboard.writeText(`Confira esse relato no FeedBECK: ${review.title} - ${window.location.href}`); alert('Link copiado para compartilhar!'); }
                        }}
                        className="text-gray-600 hover:text-moss-400 transition-colors"
                      >
                        <Send size={18} />
                      </button>
                      {user && review.authorId !== user.uid && (
                        <button
                          id={review.id === 'tutorial-post' ? 'tutorial-post-report-button' : undefined}
                          onClick={() => setReportModal({ id: review.id, type: 'post', content: review.content, targetUserId: review.authorId })}
                          className="text-gray-600 hover:text-red-500 transition-colors"
                        >
                          <Flag size={18} />
                        </button>
                      )}
                    </div>
                    <div id={review.id === 'tutorial-post' ? 'tutorial-post-stars' : undefined} className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={12} className={i < Math.floor(review.rating) ? 'fill-moss-400 text-moss-400' : 'text-gray-700'} />
                      ))}
                    </div>
                  </div>
                </motion.div>
              </div>
            ))}

            {/* Botão "carregar mais" — paginação local, evita travar puxando tudo de uma vez */}
            {hasMore && (
              <button
                onClick={() => setVisibleCount(prev => prev + FEED_PAGE_SIZE)}
                className="w-full py-4 glass rounded-2xl border border-white/5 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-moss-400 hover:border-moss-500/20 transition-all flex items-center justify-center gap-2"
              >
                <ChevronDown size={14} />
                Carregar mais relatos
              </button>
            )}
          </>
        )}
      </section>

      {/* ── Delete Modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isDeleting && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsDeleting(null)} className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md" />
            <div className="fixed inset-0 z-[310] flex items-center justify-center p-6 pointer-events-none">
              <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-[#0f0f0f] border border-white/10 p-8 rounded-[40px] max-w-sm w-full shadow-2xl pointer-events-auto">
                <div className="bg-red-500/10 w-16 h-16 rounded-full flex items-center justify-center mb-6 mx-auto"><Trash2 size={32} className="text-red-500" /></div>
                <h3 className="text-xl font-black text-white text-center uppercase tracking-tighter mb-2">Excluir Relato?</h3>
                <p className="text-gray-400 text-center text-sm mb-8 leading-relaxed italic">Você está prestes a apagar este post. Tem certeza? Essa ação não pode ser desfeita.</p>
                <div className="flex flex-col gap-3">
                  <button onClick={() => deleteReview(isDeleting)} className="w-full bg-red-500 hover:bg-red-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs transition-all shadow-lg shadow-red-900/20">Sim, excluir agora</button>
                  <button onClick={() => setIsDeleting(null)} className="w-full bg-white/5 hover:bg-white/10 text-gray-400 font-bold py-4 rounded-2xl uppercase tracking-widest text-xs transition-all">Cancelar</button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* ── Report Modal ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {reportModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !reportLoading && setReportModal(null)} className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-md" />
            <div className="fixed inset-0 z-[410] flex items-center justify-center p-6 pointer-events-none">
              <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="bg-[#0f0f0f] border border-white/10 p-8 rounded-[40px] max-w-sm w-full shadow-2xl pointer-events-auto">
                <div className="bg-red-500/10 w-16 h-16 rounded-full flex items-center justify-center mb-6 mx-auto"><AlertTriangle size={32} className="text-red-500" /></div>
                <h3 className="text-xl font-black text-white text-center uppercase tracking-tighter mb-2">Denunciar {reportModal.type === 'post' ? 'Relato' : 'Comentário'}</h3>
                <p className="text-gray-400 text-center text-xs mb-6 italic">Isso será revisado pela nossa moderação. Por favor, explique o motivo.</p>
                <textarea value={reportReason} onChange={(e) => setReportReason(e.target.value)} placeholder="Por que você está denunciando isso?" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-white outline-none focus:border-moss-500 transition-all resize-none h-32 mb-6 placeholder:text-gray-600" />
                <div className="flex flex-col gap-3">
                  <button onClick={handleReport} disabled={reportLoading || !reportReason.trim()} className="w-full bg-red-500 hover:bg-red-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs transition-all disabled:opacity-50">{reportLoading ? 'Enviando...' : 'Enviar Denúncia'}</button>
                  <button onClick={() => setReportModal(null)} disabled={reportLoading} className="w-full bg-white/5 hover:bg-white/10 text-gray-400 font-bold py-4 rounded-2xl uppercase tracking-widest text-xs transition-all">Cancelar</button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* ── Mention suggestions ───────────────────────────────────────────── */}
      <AnimatePresence>
        {showMentionList && mentionSuggestions.length > 0 && activeCommentsId && (
          <motion.div initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.97 }} transition={{ type: 'spring', damping: 22, stiffness: 260 }} style={{ bottom: mentionListBottom, left: 0, right: 0, zIndex: 500 }} className="fixed px-4">
            <div className="bg-[#131313] border border-moss-500/20 rounded-2xl overflow-y-auto shadow-2xl shadow-black/60 max-w-lg mx-auto divide-y divide-white/5" style={{ maxHeight: 180 }}>
              {mentionSuggestions.map((u, idx) => (
                <motion.button key={u.uid} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const lastAt = newCommentText.lastIndexOf("@");
                    const newText = newCommentText.slice(0, lastAt) + u.handle + " ";
                    setNewCommentText(newText);
                    const editable = document.querySelector("[data-mention-input=\"true\"]") as HTMLElement;
                    if (editable) { editable.innerText = newText; const range = document.createRange(); const sel = window.getSelection(); range.selectNodeContents(editable); range.collapse(false); sel?.removeAllRanges(); sel?.addRange(range); editable.focus(); }
                    setShowMentionList(false); setMentionSuggestions([]);
                    try { const key = "feedbeck_mention_history"; const existing = JSON.parse(localStorage.getItem(key) || "[]"); localStorage.setItem(key, JSON.stringify([u.handle, ...existing.filter((h: string) => h !== u.handle)].slice(0, 10))); } catch {}
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-moss-500/10 active:bg-moss-500/20 transition-all text-left group"
                >
                  <div className="shrink-0 relative">
                    <UserAvatar styles={u.avatarStyles} seed={u.handle} size="sm" />
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-moss-500 rounded-full flex items-center justify-center shadow"><span className="text-[7px] font-black text-white">@</span></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-white leading-tight truncate group-hover:text-moss-300 transition-colors">{u.displayName}</p>
                    <p className="text-[10px] text-moss-400/70 font-bold group-hover:text-moss-400 transition-colors">{u.handle}</p>
                  </div>
                  <span className="text-moss-500/40 group-hover:text-moss-400 transition-colors text-sm shrink-0">→</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Comments Modal ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {activeCommentsId && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setActiveCommentsId(null); setShowMentionList(false); setMentionSuggestions([]); }} className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md" />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} style={{ maxHeight: visibleVH - 80 }} className="fixed bottom-[80px] left-0 right-0 z-[310] bg-[#0d0d0d] border-t border-white/10 rounded-t-[40px] flex flex-col shadow-2xl p-6 pb-4 max-w-lg mx-auto">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tighter text-moss-400">Comentários</h3>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Relato de {reviews.find(r => r.id === activeCommentsId)?.userName}</p>
                </div>
                <button onClick={() => { setActiveCommentsId(null); setShowMentionList(false); setMentionSuggestions([]); }} className="p-2 bg-white/5 rounded-full text-gray-400"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-6 pr-2 no-scrollbar mb-4 flex flex-col">
                <AnimatePresence initial={false}>
                  {comments.length > 0 ? comments.map((comment) => {
                    const commenterId = (comment as any).userId || (comment as any).authorId;
                    const liveProfile = commenterId ? commenterProfiles[commenterId] : null;
                    const handleVal = liveProfile?.handle || (comment as any).userHandle || comment.authorHandle || '@usuario';
                    const nameVal = liveProfile?.displayName || (comment as any).userName || handleVal.replace('@', '');
                    const avatarStylesVal = liveProfile?.avatarStyles || (comment as any).userAvatarStyles || (handleVal === profile?.handle ? profile?.avatarStyles : null);
                    return (
                      <motion.div key={comment.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="flex gap-4 min-w-0">
                        <UserAvatar styles={avatarStylesVal} seed={handleVal} size="sm" />
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="flex items-center gap-2 mb-1">
                            <Link to={`/profile/${handleVal.replace('@', '')}`} onClick={() => setActiveCommentsId(null)}>
                              <span className="text-xs font-bold text-moss-400 uppercase tracking-tighter hover:underline">{nameVal}</span>
                              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter ml-1">{handleVal}</span>
                            </Link>
                            <span className="text-[9px] text-gray-600 font-bold ml-auto">{formatRelativeTime(comment.createdAt)}</span>
                            {(isAdmin || user?.uid === commenterId) && (<button onClick={() => handleDeleteComment(comment.id)} className="text-gray-600 hover:text-red-500 transition-colors ml-1"><Trash2 size={12} /></button>)}
                            {user && commenterId !== user.uid && (<button onClick={() => setReportModal({ id: comment.id, type: 'comment', content: comment.text, targetUserId: comment.authorId || (comment as any).userId })} className="text-gray-600 hover:text-red-500 transition-colors ml-1"><Flag size={12} /></button>)}
                          </div>
                          {comment.replyToHandle && (<p className="text-[10px] text-moss-500 font-bold mb-0.5">respondendo a <span className="underline">{comment.replyToHandle}</span></p>)}
                          <p className="text-sm text-gray-300 leading-relaxed italic break-words break-all overflow-hidden w-full">
                            {comment.text.split(/(@[a-zA-Z0-9_]+)/g).map((part, i) =>
                              /^@[a-zA-Z0-9_]+$/.test(part)
                                ? <Link key={i} to={`/profile/${part.slice(1)}`} onClick={() => setActiveCommentsId(null)} className="text-moss-400 font-black not-italic hover:underline">{part}</Link>
                                : part
                            )}
                          </p>
                          {user && (<button onClick={() => setReplyingTo({ commentId: comment.id, authorHandle: handleVal, authorId: commenterId, text: comment.text })} className="text-[10px] font-extrabold uppercase text-moss-500 hover:text-moss-400 cursor-pointer active:scale-95 transition-all mt-1">Responder</button>)}
                        </div>
                      </motion.div>
                    );
                  }) : (<div className="text-center py-10 opacity-30 italic text-sm">Seja o primeiro a brisar aqui...</div>)}
                </AnimatePresence>
              </div>
              {replyingTo && (
                <div className="bg-moss-500/10 border-l-4 border-moss-500 px-4 py-2 rounded-t-xl flex justify-between items-center text-xs text-gray-300 mb-2">
                  <div className="truncate pr-4 flex-1"><span className="font-bold text-moss-400">Respondendo a {replyingTo.authorHandle}:</span>{' '}<span className="italic opacity-60">"{replyingTo.text}"</span></div>
                  <button onClick={() => setReplyingTo(null)} className="p-1 text-gray-500 hover:text-white transition-colors"><X size={14} /></button>
                </div>
              )}
              <div ref={inputAreaRef} className="bg-white/5 p-4 rounded-[24px] border border-white/10 flex items-center gap-4 transition-all focus-within:border-moss-500/50">
                <div className="shrink-0"><UserAvatar styles={profile?.avatarStyles} seed={user?.uid} size="sm" rainbow={profile?.rainbowActive} /></div>
                <div
                  contentEditable suppressContentEditableWarning
                  data-mention-input="true" data-placeholder="Escreva sua brisa aqui..."
                  onInput={async (e) => {
                    const el = e.currentTarget;
                    const rawText = el.innerText || '';
                    setNewCommentText(rawText);
                    const lastAt = rawText.lastIndexOf('@');
                    if (lastAt !== -1) {
                      const afterAt = rawText.slice(lastAt + 1);
                      if (/^[a-zA-Z0-9_]*$/.test(afterAt) && !afterAt.includes(' ')) {
                        setShowMentionList(true); recalcViewport();
                        try {
                          if (afterAt.length === 0) {
                            const histKey = 'feedbeck_mention_history';
                            const history: string[] = JSON.parse(localStorage.getItem(histKey) || '[]');
                            if (history.length > 0) { const snap = await getDocs(query(collection(db, 'users'), where('handle', 'in', history.slice(0, 5)))); setMentionSuggestions(snap.docs.map(d => d.data()).filter((u: any) => u.uid !== user?.uid && u.email)); }
                            else { const snap = await getDocs(query(collection(db, 'users'), where('handle', '>=', '@a'), where('handle', '<=', '@zzzzzz'))); setMentionSuggestions(snap.docs.map(d => d.data()).filter((u: any) => u.uid !== user?.uid && u.email).slice(0, 5)); }
                          } else {
                            const term = '@' + afterAt.toLowerCase();
                            const snap = await getDocs(query(collection(db, 'users'), where('handle', '>=', term), where('handle', '<=', term + 'zzzz')));
                            setMentionSuggestions(snap.docs.map(d => d.data()).filter((u: any) => u.uid !== user?.uid && u.email).slice(0, 5));
                          }
                        } catch { setMentionSuggestions([]); }
                      } else { setShowMentionList(false); setMentionSuggestions([]); }
                    } else { setShowMentionList(false); setMentionSuggestions([]); }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !showMentionList) { e.preventDefault(); handleAddComment(); const el = e.currentTarget; setTimeout(() => { el.innerHTML = ''; }, 10); }
                    if (e.key === 'Escape') { setShowMentionList(false); setMentionSuggestions([]); }
                  }}
                  onBlur={() => { setTimeout(() => { setShowMentionList(false); setMentionSuggestions([]); }, 200); }}
                  className="flex-1 outline-none text-sm font-medium min-h-[20px] max-h-[80px] overflow-y-auto"
                  style={{ color: 'white', caretColor: 'white', wordBreak: 'break-word' }}
                  data-gramm="false" spellCheck={false}
                />
                <button
                  onClick={() => { handleAddComment(); const el = document.querySelector('[data-mention-input="true"]') as HTMLElement; if (el) setTimeout(() => { el.innerHTML = ''; }, 10); }}
                  disabled={commentLoading}
                  className="p-2 bg-moss-500 text-white rounded-xl shadow-lg shadow-moss-900/40 hover:bg-moss-400 transition-colors disabled:opacity-50 shrink-0"
                >
                  <Send size={18} />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
