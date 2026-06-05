import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Star, Heart, MessageCircle, Send, X, Trash2, Pin, Play, Pause, Music, Flag, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { doc, onSnapshot, updateDoc, increment, deleteDoc, collection, addDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/utils/firestore';
import UserAvatar from '../components/UserAvatar';

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

const CategoryBadge = ({ category }: { category: any }) => {
  const styles: any = {
    larica: 'bg-orange-500/20 text-orange-400',
    filme: 'bg-amber-500/20 text-amber-400',
    brisas: 'bg-green-500/20 text-green-400',
    sons: 'bg-indigo-500/20 text-indigo-400'
  };
  return (
    <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md ${styles[category] || 'bg-gray-500/20 text-gray-400'}`}>
      {category === 'brisas' ? 'brisa' : category}
    </span>
  );
};

export default function ReviewDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile, isAdmin } = useAuth();
  const [review, setReview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; authorHandle: string; authorId: string; text: string } | null>(null);
  const [commentLoading, setCommentLoading] = useState(false);
  const [syncedIds, setSyncedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  
  // Audio state
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlayback = (url: string) => {
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
      } else {
        const audio = new Audio(url);
        audio.onended = () => setIsPlaying(false);
        audio.play();
        audioRef.current = audio;
      }
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    const unsubscribe = onSnapshot(doc(db, 'reviews', id), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setReview({
          id: snapshot.id,
          ...data,
          userName: data.authorName || data.userName || 'Usuário',
          userHandle: data.authorHandle || data.userHandle || '@anonimo',
          authorAvatarStyles: data.authorAvatarStyles || data.userAvatarStyles,
          authorRainbowActive: data.authorRainbowActive,
          timestamp: data.createdAt?.toDate() || new Date()
        });
      } else {
        setReview(null);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `reviews/${id}`);
      setLoading(false);
    });

    const commentsUnsubscribe = onSnapshot(
      collection(db, 'reviews', id, 'comments'),
      (snapshot) => {
        const fetchedComments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setComments(fetchedComments.sort((a: any, b: any) => b.createdAt?.seconds - a.createdAt?.seconds));
      }
    );

    return () => {
      unsubscribe();
      commentsUnsubscribe();
      audioRef.current?.pause();
    };
  }, [id]);

  useEffect(() => {
    if (!user) return;
    const unsubSyncs = onSnapshot(collection(db, 'users', user.uid, 'sintonias'), (snapshot) => {
      setSyncedIds(new Set(snapshot.docs.map(doc => doc.id)));
    });
    const unsubSaves = onSnapshot(collection(db, 'users', user.uid, 'saved_posts'), (snapshot) => {
      setSavedIds(new Set(snapshot.docs.map(doc => doc.id)));
    });
    return () => {
      unsubSyncs();
      unsubSaves();
    };
  }, [user]);

  const toggleSync = async () => {
    if (!user || !review) return;
    try {
      const docRef = doc(db, 'reviews', review.id);
      const userLikeRef = doc(db, 'users', user.uid, 'sintonias', review.id);
      if (!syncedIds.has(review.id)) {
        await setDoc(userLikeRef, { createdAt: serverTimestamp() });
        await updateDoc(docRef, { sintonias: increment(1) });
      } else {
        await deleteDoc(userLikeRef);
        await updateDoc(docRef, { sintonias: increment(-1) });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleSave = async () => {
    if (!user || !review) return;
    try {
      const userSaveRef = doc(db, 'users', user.uid, 'saved_posts', review.id);
      if (!savedIds.has(review.id)) {
        await setDoc(userSaveRef, { reviewId: review.id, savedAt: serverTimestamp() });
      } else {
        await deleteDoc(userSaveRef);
      }
    } catch (err) { }
  };

  const handleAddComment = async () => {
    if (!id || !newComment.trim() || !user) return;
    setCommentLoading(true);
    try {
      const commentColl = collection(db, 'reviews', id, 'comments');
      const newCommentDoc = doc(commentColl);
      const commentId = newCommentDoc.id;

      const commentData: any = {
        authorId: user.uid,
        userName: profile?.displayName || 'Usuário',
        userHandle: profile?.handle || '@usuario',
        authorHandle: profile?.handle || '@usuario',
        userAvatarStyles: profile?.avatarStyles || null,
        text: newComment.trim(),
        createdAt: serverTimestamp()
      };

      if (replyingTo) {
        commentData.parentId = replyingTo.commentId;
        commentData.replyToHandle = replyingTo.authorHandle;
        commentData.replyToUserId = replyingTo.authorId;
      }

      await setDoc(newCommentDoc, commentData);
      await updateDoc(doc(db, 'reviews', id), { commentsCount: increment(1) });

      // Create notification if replying to someone else
      if (replyingTo && replyingTo.authorId !== user.uid) {
        const notificationRef = doc(collection(db, 'notifications'));
        await setDoc(notificationRef, {
          id: notificationRef.id,
          type: 'reply',
          senderId: user.uid,
          senderHandle: profile?.handle || '@usuario',
          senderName: profile?.displayName || 'Usuário',
          receiverId: replyingTo.authorId,
          reviewId: id,
          commentId: commentId,
          commentText: newComment.trim(),
          parentCommentText: replyingTo.text,
          read: false,
          createdAt: serverTimestamp()
        });
      }

      setNewComment('');
      setReplyingTo(null);
    } catch (err) { } finally {
      setCommentLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-8 h-8 border-4 border-moss-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!review) {
    return (
      <div className="min-h-screen p-6 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500 italic">Relato não encontrado...</p>
        <button onClick={() => navigate(-1)} className="text-moss-400 font-black uppercase text-xs tracking-widest bg-white/5 px-6 py-3 rounded-2xl hover:bg-white/10 transition-all">Voltar</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32">
      <header className="sticky top-0 z-50 bg-smog-950/80 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-all">
          <ChevronLeft size={24} className="text-gray-400" />
        </button>
        <span className="text-xs font-black uppercase tracking-widest text-white/50">Detalhes do Relato</span>
      </header>

      <div className="p-6">
        <div className="glass-card p-6 shadow-2xl relative border-t-4 border-moss-500/50">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-4">
              <UserAvatar styles={review.authorAvatarStyles} seed={review.userHandle} size="lg" rainbow={review.authorRainbowActive} />
              <div>
                <span className="text-lg font-black text-white block leading-tight">{review.userName}</span>
                <span className="text-sm text-moss-400 font-bold uppercase tracking-widest block">{review.userHandle}</span>
                <span className="text-[10px] text-gray-600 font-bold uppercase tracking-tighter mt-1 block">{formatRelativeTime(review.timestamp)}</span>
              </div>
            </div>
            <CategoryBadge category={review.category} />
          </div>

          <h2 className="text-2xl font-black text-white mb-4 italic tracking-tighter leading-tight drop-shadow-lg">{review.title}</h2>

          {review.category === 'sons' && review.musicData && (
            <div className="mb-6 bg-indigo-500/10 border border-indigo-500/30 rounded-[32px] p-6 flex items-center gap-4">
              <div className="relative shrink-0">
                {review.musicData.artworkUrl === 'placeholder:sons' ? (
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-800 flex items-center justify-center shadow-2xl border border-white/20">
                    <Music size={32} className="text-white/80" />
                  </div>
                ) : (
                  <img src={review.musicData.artworkUrl} className="w-20 h-20 rounded-2xl shadow-2xl border border-white/10" alt="" />
                )}
                {review.musicData.previewUrl && (
                  <button 
                    onClick={() => review.musicData && togglePlayback(review.musicData.previewUrl)}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/60 transition-all rounded-2xl"
                  >
                    {isPlaying ? <Pause size={32} className="text-white animate-pulse" /> : <Play size={32} className="text-white ml-1" />}
                  </button>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">Recommended Vibe</p>
                <p className="text-xl font-black text-white truncate uppercase tracking-tighter leading-tight">{review.musicData.trackName}</p>
                <p className="text-sm text-white/50 font-bold truncate uppercase tracking-widest">{review.musicData.artistName}</p>
              </div>
            </div>
          )}

          {review.images && review.images.length > 0 && (
            <div className="mb-6 -mx-6 flex overflow-x-auto snap-x snap-mandatory no-scrollbar gap-4 px-6 h-[400px]">
              {review.images.map((img: string, idx: number) => (
                <div key={idx} className="flex-shrink-0 w-[90%] snap-center rounded-[32px] overflow-hidden shadow-2xl relative bg-black/40">
                   <img src={img} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}

          <p className="text-gray-300 text-lg leading-relaxed italic mb-8 font-light">{review.content}</p>

          <div className="flex items-center justify-between border-t border-white/5 pt-6 mt-8">
            <div className="flex items-center gap-6">
              <button 
                onClick={toggleSync}
                className={`flex items-center gap-2 transition-all ${syncedIds.has(review.id) ? 'text-moss-400' : 'text-gray-500 hover:text-white'}`}
              >
                <Heart size={24} className={syncedIds.has(review.id) ? 'fill-current' : ''} />
                <span className="text-xs font-black">{review.sintonias}</span>
              </button>
              <div className="flex items-center gap-2 text-gray-500">
                <MessageCircle size={24} />
                <span className="text-xs font-black">{comments.length}</span>
              </div>
              <button 
                onClick={toggleSave}
                className={`transition-all ${savedIds.has(review.id) ? 'text-moss-400' : 'text-gray-500 hover:text-white'}`}
              >
                <Pin size={24} className={savedIds.has(review.id) ? 'fill-current' : ''} />
              </button>
            </div>
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={16} className={i < Math.floor(review.rating) ? 'fill-moss-400 text-moss-400 shadow-glow' : 'text-gray-800'} />
              ))}
            </div>
          </div>
        </div>

        {/* Comments Section */}
        <div className="mt-12 space-y-6">
          <h3 className="text-xs font-black uppercase tracking-[0.3em] text-moss-400 px-2">Comentários</h3>
          
          <div className="glass-card p-6 flex flex-col gap-4">
             {replyingTo && (
               <div className="bg-moss-500/10 border-l-4 border-moss-500 px-4 py-2 rounded-xl flex justify-between items-center text-xs text-gray-300 transition-all">
                 <div className="truncate pr-4 flex-1">
                   <span className="font-bold text-moss-400">Respondendo a {replyingTo.authorHandle}:</span>{" "}
                   <span className="italic opacity-60">"{replyingTo.text}"</span>
                 </div>
                 <button 
                   onClick={() => setReplyingTo(null)}
                   className="p-1 text-gray-500 hover:text-white transition-colors"
                 >
                   <X size={14} />
                 </button>
               </div>
             )}
             <textarea 
               value={newComment}
               onChange={(e) => setNewComment(e.target.value)}
               placeholder="Deixe seu comentário..."
               className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder:text-gray-600 outline-none focus:border-moss-500 transition-all resize-none italic"
               rows={2}
             />
             <button 
               onClick={handleAddComment}
               disabled={commentLoading || !newComment.trim()}
               className="self-end bg-moss-500 hover:bg-moss-400 disabled:opacity-50 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-moss-900/40 transition-all"
             >
               {commentLoading ? 'Enviando...' : 'Comentar'}
             </button>
          </div>

          <div className="space-y-4">
            {comments.map((comment) => (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                key={comment.id} 
                className="bg-white/2 border border-white/5 rounded-3xl p-5 flex gap-4"
              >
                <UserAvatar styles={comment.userAvatarStyles} seed={comment.userHandle} size="sm" />
                <div className="flex-1 min-w-0">
                   <div className="flex justify-between items-start mb-1">
                      <span className="text-[10px] font-black text-moss-400 uppercase tracking-widest">{comment.userHandle}</span>
                      <span className="text-[8px] text-gray-600 font-bold uppercase tracking-tighter">{formatRelativeTime(comment.createdAt)}</span>
                   </div>
                   {comment.replyToHandle && (
                     <p className="text-[9px] text-moss-500 font-bold mb-1">
                       respondendo a <span className="underline">{comment.replyToHandle}</span>
                     </p>
                   )}
                   <p className="text-xs text-gray-300 leading-relaxed italic">{comment.text}</p>
                   {user && (
                     <div className="flex items-center gap-3 mt-1.5">
                       <button 
                         onClick={() => {
                           setReplyingTo({
                             commentId: comment.id,
                             authorHandle: comment.userHandle || '@usuario',
                             authorId: comment.authorId || comment.userId,
                             text: comment.text
                           });
                         }}
                         className="text-[9px] font-extrabold uppercase text-moss-500 hover:text-moss-400 cursor-pointer active:scale-95 transition-all"
                       >
                         Responder
                       </button>
                     </div>
                   )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
