import { useState, useEffect, useRef } from 'react';
import { Bell, Star, Heart, MessageCircle, Send, X, SendHorizonal, Trash2, Pin, Play, Pause, Music, Wind, Film, IceCream, Flag, AlertTriangle, Check, Flame } from 'lucide-react';
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
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  increment,
  deleteDoc,
  setDoc,
  getDocs
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
  // Custom shortening for our "tighter" UI
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

function IsqueiroIcon({ aceso, value }: { aceso: boolean, value: number }) {
  return (
    <div className="relative cursor-pointer transition-all duration-300 hover:scale-110 active:scale-95 flex flex-col items-center justify-center p-1">
      {/* Absolute center SVG lighter featuring the line-art lighter structure and conditional flame */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="transition-all duration-300"
      >
        {/* Animated line-art Neon Green Flame */}
        <AnimatePresence>
          {aceso && (
            <motion.path
              d="M12 7.2 C 10 7.2, 10 4.8, 12 1.8 C 14 4.8, 14 7.2, 12 7.2 Z"
              fill="#22c55e"
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{
                scaleY: [1, 1.15, 0.95, 1.05, 1],
                scaleX: [1, 0.9, 1.05, 0.95, 1],
                y: [0, -0.6, 0.2, -0.2, 0],
                opacity: 1
              }}
              exit={{ scaleY: 0, opacity: 0 }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              style={{ originX: "12px", originY: "7.2px" }}
              className="drop-shadow-[0_0_5px_rgba(34,197,94,0.7)]"
            />
          )}
        </AnimatePresence>

        {/* Metal windshield upper cap */}
        <rect 
          x="9" 
          y="7" 
          width="6" 
          height="5.5" 
          rx="1" 
          stroke={aceso ? "#22c55e" : "#94a3b8"} 
          strokeWidth="1.6" 
          fill={aceso ? "rgba(34,197,94,0.12)" : "transparent"} 
          className="transition-colors duration-300"
        />

        {/* Lighter storage body */}
        <rect 
          x="7.5" 
          y="12.5" 
          width="9" 
          height="8.5" 
          rx="1.5" 
          stroke={aceso ? "#22c55e" : "#94a3b8"} 
          strokeWidth="1.6" 
          fill={aceso ? "rgba(34,197,94,0.04)" : "transparent"} 
          className="transition-colors duration-300"
        />

        {/* Spark wheel circle */}
        <circle 
          cx="16" 
          cy="8.5" 
          r="1" 
          stroke={aceso ? "#22c55e" : "#94a3b8"} 
          strokeWidth="1" 
          className="transition-colors duration-300"
        />

        {/* Small air hole on windshield */}
        <circle 
          cx="12" 
          cy="9.8" 
          r="0.6" 
          fill={aceso ? "#22c55e" : "#94a3b8"} 
          className="transition-colors duration-300"
        />
      </svg>

      {/* Notification badge */}
      {value > 0 && (
        <span className="absolute -top-1 -right-1 z-20 min-w-4.5 h-4.5 px-1 bg-red-600 rounded-full border border-smog-950 text-[9px] font-black text-white flex items-center justify-center shadow-lg">
          {value}
        </span>
      )}
    </div>
  );
}

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
      {category === 'brisas' ? 'brisa' : category === 'sons' ? 'sons' : category}
    </span>
  );
};

export default function Feed() {
  const { user, profile, isAdmin, auth, followingIds } = useAuth();
  const [activeFilter, setActiveFilter] = useState<'todos' | 'larica' | 'filme' | 'brisas' | 'sons'>('todos');
  const [syncedIds, setSyncedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [activeCommentsId, setActiveCommentsId] = useState<string | null>(null);
  const [commenterProfiles, setCommenterProfiles] = useState<Record<string, any>>({});
  const [reviews, setReviews] = useState<Review[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; authorHandle: string; authorId: string; text: string } | null>(null);
  const [commentLoading, setCommentLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [reportModal, setReportModal] = useState<{ id: string, type: 'post' | 'comment', content: string, targetUserId: string } | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [, setTick] = useState(0);

  // Isqueiro / Notifications state
  const [showLighterModal, setShowLighterModal] = useState(false);
  const [unreadRepliesCount, setUnreadRepliesCount] = useState(0);
  const [followRequests, setFollowRequests] = useState<any[]>([]);
  const [followRequestProfiles, setFollowRequestProfiles] = useState<Record<string, any>>({});
  const [lastViewedSintonias, setLastViewedSintonias] = useState<number>(() => {
    const saved = localStorage.getItem('feed_last_viewed_sintonias_count');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [lastViewedFeedTime, setLastViewedFeedTime] = useState<number>(() => {
    const saved = localStorage.getItem('feed_last_viewed_time');
    return saved ? parseInt(saved, 10) : Date.now();
  });

  // Audio state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  const handleReport = async () => {
    if (!reportModal || !reportReason.trim() || !user) return;
    setReportLoading(true);
    try {
      const reportId = `${user.uid}_${reportModal.id}_${Date.now()}`;
      await setDoc(doc(db, 'reports', reportId), {
        id: reportId,
        targetId: reportModal.id,
        targetUserId: reportModal.targetUserId,
        targetType: reportModal.type,
        reason: reportReason.trim(),
        reporterId: user.uid,
        reporterHandle: profile?.handle || '@anonimo',
        targetContent: reportModal.content,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      alert('Denúncia enviada com sucesso. Nossa equipe de moderação irá analisar.');
      setReportModal(null);
      setReportReason('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'reports');
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const ME_AVATAR = profile?.photoURL || `https://api.dicebear.com/9.x/avataaars/svg?seed=${user?.uid}`;
  const ME_HANDLE = profile?.handle || '@anonimo';

  useEffect(() => {
    if (!user) {
      // For anonymous users, only show public posts
      const q = query(
        collection(db, 'reviews'), 
        where('isPrivate', '==', false),
        orderBy('createdAt', 'desc')
      );
      return onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            userName: data.authorName || data.userName || 'Usuário',
            userHandle: data.authorHandle || data.userHandle || '@anonimo',
            authorAvatarStyles: data.authorAvatarStyles || data.userAvatarStyles,
            authorRainbowActive: data.authorRainbowActive,
            timestamp: data.createdAt?.toDate() || new Date()
          } as Review;
        }).filter(r => r.userHandle !== '@anonimo');
        setReviews(docs);
      });
    }

    // For logged in users: public posts OR my posts OR posts from followed accounts
    // We combine filters using 'or'. 
    // Note: 'in' is limited to 30 items. If user follows more, we might need a different approach 
    // but for now we follow the 'in' limit of 30 for followingIds.
    const limitedFollowingIds = followingIds.slice(0, 28); // Leave room for other filters
    
    let q;
    if (limitedFollowingIds.length > 0) {
      q = query(
        collection(db, 'reviews'),
        or(
          where('isPrivate', '==', false),
          where('authorId', '==', user.uid),
          where('authorId', 'in', limitedFollowingIds)
        ),
        orderBy('createdAt', 'desc')
      );
    } else {
      q = query(
        collection(db, 'reviews'),
        or(
          where('isPrivate', '==', false),
          where('authorId', '==', user.uid)
        ),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          userName: data.authorName || data.userName || 'Usuário',
          userHandle: data.authorHandle || data.userHandle || '@anonimo',
          authorAvatarStyles: data.authorAvatarStyles || data.userAvatarStyles,
          authorRainbowActive: data.authorRainbowActive,
          timestamp: data.createdAt?.toDate() || new Date()
        } as Review;
      }).filter(r => r.userHandle !== '@anonimo' || r.authorId === user.uid);
      setReviews(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'reviews');
    });
    return unsubscribe;
  }, [user, followingIds]);

  // Fetch current user's liked post IDs to persist 'synced' state
  useEffect(() => {
    if (!user) {
      setSyncedIds(new Set());
      return;
    }
    const q = query(collection(db, 'users', user.uid, 'sintonias'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSyncedIds(new Set(snapshot.docs.map(doc => doc.id)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/sintonias`);
    });
    return unsubscribe;
  }, [user]);

  // Fetch current user's saved post IDs
  useEffect(() => {
    if (!user) {
      setSavedIds(new Set());
      return;
    }
    const q = query(collection(db, 'users', user.uid, 'saved_posts'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSavedIds(new Set(snapshot.docs.map(doc => doc.id)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/saved_posts`);
    });
    return unsubscribe;
  }, [user]);

  // Set up initial last viewed sintonias if not exists
  useEffect(() => {
    if (profile && !localStorage.getItem('feed_last_viewed_sintonias_count')) {
      localStorage.setItem('feed_last_viewed_sintonias_count', String(profile.totalSintonias || 0));
      setLastViewedSintonias(profile.totalSintonias || 0);
    }
  }, [profile]);

  // Real-time Follow Requests for Notifications
  useEffect(() => {
    if (!user) {
      setFollowRequests([]);
      return;
    }
    const q = query(collection(db, 'followRequests'), where('followingId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snap) => {
      setFollowRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error('Error loading follow requests on Feed:', error);
    });
    return unsubscribe;
  }, [user]);

  // Real-time unread reply notifications
  useEffect(() => {
    if (!user) {
      setUnreadRepliesCount(0);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('receiverId', '==', user.uid),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setUnreadRepliesCount(snap.size);
    }, (error) => {
      console.error('Error loading unread notifications:', error);
    });

    return unsubscribe;
  }, [user]);

  // Load profile details of people requesting to follow
  useEffect(() => {
    if (!user || followRequests.length === 0) return;
    const fetchFollowerProfiles = async () => {
      try {
        const followerIds = [...new Set(followRequests.map(r => r.followerId))] as string[];
        const usersQ = query(collection(db, 'users'), where('__name__', 'in', followerIds));
        const userSnap = await getDocs(usersQ);
        const userProfiles: Record<string, any> = {};
        userSnap.docs.forEach(d => {
          userProfiles[d.id] = d.data();
        });
        setFollowRequestProfiles(prev => ({ ...prev, ...userProfiles }));
      } catch (err) {
        console.error('Error loading follower profiles for Feed lighter:', err);
      }
    };
    fetchFollowerProfiles();
  }, [user, followRequests]);

  const acceptFollowRequest = async (requestId: string, followerId: string) => {
    if (!user) return;
    try {
      const followId = `${followerId}_${user.uid}`;
      await setDoc(doc(db, 'follows', followId), {
        followerId,
        followingId: user.uid,
        createdAt: serverTimestamp()
      });
      
      await updateDoc(doc(db, 'users', followerId), { followingCount: increment(1) });
      await updateDoc(doc(db, 'users', user.uid), { followersCount: increment(1) });
      await deleteDoc(doc(db, 'followRequests', requestId));
    } catch (err) {
      console.error('Error accepting follow request from Feed helper:', err);
    }
  };

  const rejectFollowRequest = async (requestId: string) => {
    try {
      await deleteDoc(doc(db, 'followRequests', requestId));
    } catch (err) {
      console.error('Error rejecting follow request from Feed helper:', err);
    }
  };

  const [commenterUserIds, setCommenterUserIds] = useState<string[]>([]);

  useEffect(() => {
    if (!activeCommentsId) {
      setComments([]);
      setCommenterUserIds([]);
      return;
    }
    const q = query(
      collection(db, 'reviews', activeCommentsId, 'comments'), 
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedComments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
      setComments(fetchedComments);
      setCommenterUserIds(fetchedComments.map((c: any) => c.userId || c.authorId).filter(Boolean));

      // Auto-sync comment count if it's incorrect or missing (for legacy posts)
      const currentReview = reviews.find(r => r.id === activeCommentsId);
      if (currentReview && currentReview.commentsCount !== snapshot.size) {
        updateDoc(doc(db, 'reviews', activeCommentsId), {
          commentsCount: snapshot.size
        }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `reviews/${activeCommentsId}`));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `reviews/${activeCommentsId}/comments`);
    });
    return unsubscribe;
  }, [activeCommentsId, reviews]);

  useEffect(() => {
    const uniqueIds = Array.from(new Set(commenterUserIds)).slice(0, 30);
    if (uniqueIds.length === 0) {
      setCommenterProfiles({});
      return;
    }

    const usersQ = query(collection(db, 'users'), where('__name__', 'in', uniqueIds));
    const unsubscribe = onSnapshot(usersQ, (userSnap) => {
      const profiles: Record<string, any> = {};
      userSnap.docs.forEach(d => {
        profiles[d.id] = d.data();
      });
      setCommenterProfiles(prev => ({ ...prev, ...profiles }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users_for_comments');
    });

    return unsubscribe;
  }, [commenterUserIds]);

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const toggleSync = async (reviewId: string, authorId: string) => {
    if (!user) return;
    
    try {
      const docRef = doc(db, 'reviews', reviewId);
      const userLikeRef = doc(db, 'users', user.uid, 'sintonias', reviewId);
      
      if (!syncedIds.has(reviewId)) {
        // Like (Sintonizar)
        await setDoc(userLikeRef, { createdAt: serverTimestamp() });
        
        try {
          await updateDoc(docRef, { sintonias: increment(1) });
        } catch (err) {
          console.error('Error updating review sintonias count:', err);
        }

        if (authorId) {
          try {
            await updateDoc(doc(db, 'users', authorId), { totalSintonias: increment(1) });
          } catch (err) {
            console.error('Error updating profile totalSintonias:', err);
          }
        }
      } else {
        // Unlike (Remover Sintonia)
        await deleteDoc(userLikeRef);
        
        try {
          await updateDoc(docRef, { sintonias: increment(-1) });
        } catch (err) {
          console.error('Error decrementing review sintonias count:', err);
        }

        if (authorId) {
          try {
            await updateDoc(doc(db, 'users', authorId), { totalSintonias: increment(-1) });
          } catch (err) {
            console.error('Error decrementing profile totalSintonias:', err);
          }
        }
      }
    } catch (err) {
      console.error('Error toggling sintonia:', err);
    }
  };

  const toggleSave = async (reviewId: string) => {
    if (!user) return;
    
    try {
      const userSaveRef = doc(db, 'users', user.uid, 'saved_posts', reviewId);
      
      if (!savedIds.has(reviewId)) {
        await setDoc(userSaveRef, { 
          reviewId,
          savedAt: serverTimestamp() 
        });
      } else {
        await deleteDoc(userSaveRef);
      }
    } catch (err) {
      console.error('Error toggling save:', err);
    }
  };

  const handleAddComment = async () => {
    if (!activeCommentsId || !newCommentText.trim() || !user) return;
    setCommentLoading(true);

    try {
      const reviewRef = doc(db, 'reviews', activeCommentsId);
      const commentColl = collection(db, 'reviews', activeCommentsId, 'comments');
      const newCommentDoc = doc(commentColl);
      const commentId = newCommentDoc.id;

      const commentData: any = {
        authorId: user.uid,
        authorHandle: profile?.handle || '@usuario',
        userName: profile?.displayName || 'Usuário',
        userHandle: profile?.handle || '@usuario',
        userAvatarStyles: profile?.avatarStyles || null,
        text: newCommentText,
        createdAt: serverTimestamp()
      };

      if (replyingTo) {
        commentData.parentId = replyingTo.commentId;
        commentData.replyToHandle = replyingTo.authorHandle;
        commentData.replyToUserId = replyingTo.authorId;
      }

      await setDoc(newCommentDoc, commentData);

      await updateDoc(reviewRef, {
        commentsCount: increment(1)
      });

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
          reviewId: activeCommentsId,
          commentId: commentId,
          commentText: newCommentText,
          parentCommentText: replyingTo.text,
          read: false,
          createdAt: serverTimestamp()
        });
      }

      setNewCommentText('');
      setReplyingTo(null);
    } catch (err) {
      console.error('Error adding comment:', err);
    } finally {
      setCommentLoading(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!activeCommentsId) return;
    try {
      await deleteDoc(doc(db, 'reviews', activeCommentsId, 'comments', commentId));
      await updateDoc(doc(db, 'reviews', activeCommentsId), {
        commentsCount: increment(-1)
      });
    } catch (err) {
      console.error('Error deleting comment:', err);
    }
  };

  const deleteReview = async (id: string) => {
    setIsDeleting(null);
    try {
      await deleteDoc(doc(db, 'reviews', id));
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const filteredReviews = activeFilter === 'todos' 
    ? reviews 
    : reviews.filter(r => r.category === activeFilter);

  const activeReview = reviews.find(r => r.id === activeCommentsId);

  const { isActive: showTutorial } = useTutorial();

  const tutorialPost: Review | null = showTutorial ? {
    id: 'tutorial-post',
    authorId: 'system',
    userName: 'Equipe FeedBECK',
    userHandle: '@suporte',
    category: 'brisas',
    title: 'Bem-vindo ao FeedBECK! 🌿',
    content: 'Este é um post de exemplo para você entender como as coisas funcionam por aqui. Explore os relatos e compartilhe os seus!',
    rating: 5,
    timestamp: new Date(),
    sintonias: 42,
    commentsCount: 7,
    authorAvatarStyles: {
      top: 'shaggy',
      topColor: '2c1b18',
      facialHair: 'blank',
      skinColor: 'ffdbac',
      clothingColor: '3c4f5e',
      eyes: 'default',
      mouth: 'default',
      glasses: 'blank',
      clothes: 'shirtCrewNeck'
    },
    images: ['https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=800']
  } : null;

  // Calculate dynamic notifications for user's Lighter (only comment replies inside the app)
  const unreadFollowReqsCount = followRequests.length;
  const unreadLikesCount = Math.max(0, (profile?.totalSintonias || 0) - lastViewedSintonias);

  const newFollowedPosts = reviews.filter(r => {
    // Is it from someone we follow (not myself)?
    const isFollowed = (followingIds || []).includes(r.authorId) && r.authorId !== user?.uid;
    if (!isFollowed) return false;
    
    // Convert post time
    const postTime = r.createdAt instanceof Date 
      ? r.createdAt.getTime() 
      : (r.createdAt?.toDate ? r.createdAt.toDate().getTime() : new Date(r.createdAt || 0).getTime());
    return postTime > lastViewedFeedTime;
  });
  const unreadNewPostsCount = newFollowedPosts.length;

  const notificationCount = unreadRepliesCount;
  const hasNotifications = notificationCount > 0;

  // Handler to put off the lighter / mark as read
  const markAsRead = () => {
    const nowStr = String(Date.now());
    const totalSint = String(profile?.totalSintonias || 0);

    localStorage.setItem('feed_last_viewed_time', nowStr);
    localStorage.setItem('feed_last_viewed_sintonias_count', totalSint);

    setLastViewedFeedTime(Date.now());
    setLastViewedSintonias(profile?.totalSintonias || 0);
  };

  const displayReviews = showTutorial 
    ? (tutorialPost ? [tutorialPost] : []) 
    : (activeFilter === 'todos' ? reviews : reviews.filter(r => r.category === activeFilter));

  const filterOptions = [
// ... existing filterOptions ...
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
                      {isAdmin && (
                        <span className="bg-red-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-lg shadow-red-900/40">Admin</span>
                      )}
                    </div>
                    <p className="text-gray-500 text-[10px] mt-2 uppercase tracking-[0.2em] font-bold">Relatos da Brisa</p>
                  </div>
                  
                  <div className="flex items-center gap-4 shrink-0">
                    <Link 
                      to="/notifications"
                      className="relative p-1.5 rounded-xl hover:bg-white/5 transition-all outline-none flex items-center justify-center"
                      title="Sintonias e Notificações"
                    >
                      <LighterButton hasFlame={hasNotifications} count={notificationCount} />
                    </Link>

                    <div className="flex flex-col items-center gap-1.5 shrink-0">
                      <UserAvatar 
                        styles={profile?.avatarStyles} 
                        seed={user?.uid} 
                        size="lg" 
                        rainbow={profile?.rainbowActive}
                      />

                      <Link to={`/profile/${ME_HANDLE.replace('@', '')}`}>
                        <span className="text-[9px] font-black uppercase tracking-widest text-moss-500/60 hover:text-moss-400 transition-colors">
                          {ME_HANDLE}
                        </span>
                      </Link>
                    </div>
                  </div>
                </div>
      </header>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2 mb-8">
        {filterOptions.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setActiveFilter(opt.id as any)}
            className={`px-5 py-2 rounded-full text-[10px] uppercase tracking-widest font-bold transition-all whitespace-nowrap ${
              activeFilter === opt.id
                ? opt.id === 'larica' ? 'bg-orange-500 text-white shadow-lg shadow-orange-900/40' :
                  opt.id === 'filme' ? 'bg-amber-500 text-white shadow-lg shadow-amber-900/40' :
                  opt.id === 'brisas' ? 'bg-moss-500 text-white shadow-lg shadow-moss-900/40' :
                  opt.id === 'sons' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-900/40' :
                  'bg-moss-500 text-white shadow-lg shadow-moss-900/40'
                : 'glass text-gray-500 border-white/5 hover:border-white/20'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <section className="space-y-6">
        {displayReviews.length > 0 ? (
          displayReviews.map((review) => (
            <motion.div 
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              key={review.id} 
              id={review.id === 'tutorial-post' ? 'tutorial-post-card' : undefined}
              className={`glass-card p-6 shadow-xl shadow-black/20 overflow-hidden relative border-t-4 transition-all ${
                review.category === 'sons' ? 'border-indigo-500/50 shadow-indigo-900/10' : 'border-transparent'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div id={review.id === 'tutorial-post' ? 'tutorial-post-author' : undefined} className="flex items-center gap-3">
                  <UserAvatar 
                    styles={review.userHandle === ME_HANDLE ? profile?.avatarStyles : review.authorAvatarStyles} 
                    seed={review.userHandle} 
                    size="md" 
                    rainbow={review.userHandle === ME_HANDLE ? profile?.rainbowActive : review.authorRainbowActive}
                  />
                  <div>
                    <Link to={`/profile/${review.userHandle}`}>
                      <span className="text-sm font-bold text-gray-300 block leading-tight hover:text-white transition-colors">
                        {review.userName}
                      </span>
                      <span className="text-[10px] text-moss-400 font-bold uppercase tracking-widest block hover:underline">
                        {review.userHandle}
                      </span>
                    </Link>
                    <span className="text-[9px] text-gray-600 font-bold uppercase tracking-tighter mt-1 block">{formatRelativeTime(review.timestamp)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(isAdmin || user?.uid === review.authorId) && (
                    <button 
                      onClick={() => setIsDeleting(review.id)}
                      className="p-2 text-gray-600 hover:text-red-500 transition-colors"
                    >
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
                className={`text-xl font-bold mt-2 leading-tight ${
                  review.id === 'tutorial-post' 
                    ? 'text-moss-400 animate-pulse drop-shadow-[0_0_15px_rgba(74,222,128,1)] scale-[1.02] transition-transform' 
                    : 'text-white'
                }`}
              >
                {review.title}
              </h2>

              {/* Music Player Block */}
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
                      <button 
                        onClick={() => review.musicData && togglePlayback(review.id, review.musicData.previewUrl)}
                        className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/60 transition-all rounded-xl"
                      >
                        {playingId === review.id ? <Pause size={24} className="text-white animate-pulse" /> : <Play size={24} className="text-white ml-0.5" />}
                      </button>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">
                      {review.musicData.previewUrl ? 'Ouvindo agora' : 'Som Recomendado'}
                    </p>
                    <p className="text-lg font-black text-white truncate uppercase tracking-tighter leading-tight">
                      <span className="text-indigo-400/50">Música:</span> {review.musicData.trackName}
                    </p>
                    <p className="text-xs text-white/50 font-bold truncate uppercase tracking-widest mt-1">
                      <span className="text-indigo-400/30">Artista:</span> {review.musicData.artistName}
                    </p>
                  </div>
                </div>
              )}
              
              {/* Image Carousel (Instagram Style) */}
              {review.images && review.images.length > 0 && (
                <div 
                  id={review.id === 'tutorial-post' ? 'tutorial-post-content' : undefined}
                  className="mt-4 -mx-6"
                >
                  <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar gap-2 px-6">
                    {review.images.map((img, idx) => (
                      <div key={idx} className="flex-shrink-0 w-[85%] aspect-square snap-center rounded-2xl overflow-hidden shadow-2xl relative bg-black/40">
                        <img src={img} alt={`Post ${idx}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-gray-400 text-sm mt-3 leading-relaxed font-light italic">
                {review.content}
              </p>

              <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">
                <div className="flex items-center gap-5">
                  <button 
                    id={review.id === 'tutorial-post' ? 'tutorial-post-like-button' : undefined}
                    onClick={() => toggleSync(review.id, review.authorId || review.userId)}
                    className={`flex items-center gap-2 transition-all p-1.5 -m-1.5 rounded-xl ${
                      syncedIds.has(review.id) ? 'text-moss-400' : 'text-gray-600 hover:text-moss-400'
                    }`}
                  >
                    <Heart size={18} className={syncedIds.has(review.id) ? 'fill-current' : ''} />
                    <span className="text-[10px] font-black uppercase tracking-tighter">
                      {review.sintonias}
                    </span>
                  </button>
                    <button 
                      id={review.id === 'tutorial-post' ? 'tutorial-post-comment-button' : undefined}
                      onClick={() => setActiveCommentsId(review.id)}
                      className="flex items-center gap-2 text-gray-600 hover:text-white transition-colors"
                    >
                      <MessageCircle size={18} />
                      <span className="text-[10px] font-black uppercase tracking-tighter">
                        {review.commentsCount || 0}
                      </span>
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
                      if (navigator.share) {
                        navigator.share({
                          title: review.title,
                          text: `Confira esse relato no FeedBECK: ${review.title}`,
                          url: window.location.href,
                        }).catch(() => {});
                      } else {
                        navigator.clipboard.writeText(`Confira esse relato no FeedBECK: ${review.title} - ${window.location.href}`);
                        alert('Link copiado para compartilhar!');
                      }
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
                      title="Denunciar Post"
                    >
                      <Flag size={18} />
                    </button>
                  )}
                </div>

                <div id={review.id === 'tutorial-post' ? 'tutorial-post-stars' : undefined} className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star 
                      key={i} 
                      size={12} 
                      className={i < Math.floor(review.rating) ? 'fill-moss-400 text-moss-400' : 'text-gray-700'} 
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="text-center py-20">
            <p className="text-gray-600 italic text-sm">Nenhum relato por aqui ainda...</p>
          </div>
        )}
      </section>

      <AnimatePresence>
        {isDeleting && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleting(null)}
              className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md"
            />
            <div className="fixed inset-0 z-[310] flex items-center justify-center p-6 pointer-events-none">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-[#0f0f0f] border border-white/10 p-8 rounded-[40px] max-w-sm w-full shadow-2xl pointer-events-auto"
              >
                <div className="bg-red-500/10 w-16 h-16 rounded-full flex items-center justify-center mb-6 mx-auto">
                  <Trash2 size={32} className="text-red-500" />
                </div>
                <h3 className="text-xl font-black text-white text-center uppercase tracking-tighter mb-2">Excluir Relato?</h3>
                <p className="text-gray-400 text-center text-sm mb-8 leading-relaxed italic">
                  Você está prestes a apagar este post. Tem certeza? Essa ação não pode ser desfeita.
                </p>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => deleteReview(isDeleting)}
                    className="w-full bg-red-500 hover:bg-red-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs transition-all shadow-lg shadow-red-900/20"
                  >
                    Sim, excluir agora
                  </button>
                  <button 
                    onClick={() => setIsDeleting(null)}
                    className="w-full bg-white/5 hover:bg-white/10 text-gray-400 font-bold py-4 rounded-2xl uppercase tracking-widest text-xs transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {reportModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !reportLoading && setReportModal(null)}
              className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-md"
            />
            <div className="fixed inset-0 z-[410] flex items-center justify-center p-6 pointer-events-none">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-[#0f0f0f] border border-white/10 p-8 rounded-[40px] max-w-sm w-full shadow-2xl pointer-events-auto"
              >
                <div className="bg-red-500/10 w-16 h-16 rounded-full flex items-center justify-center mb-6 mx-auto">
                  <AlertTriangle size={32} className="text-red-500" />
                </div>
                <h3 className="text-xl font-black text-white text-center uppercase tracking-tighter mb-2">Denunciar {reportModal.type === 'post' ? 'Relato' : 'Comentário'}</h3>
                <p className="text-gray-400 text-center text-xs mb-6 italic">
                  Isso será revisado pela nossa moderação. Por favor, explique o motivo.
                </p>
                
                <textarea 
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Por que você está denunciando isso? (ex: spam, insultos, impróprio...)"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-white outline-none focus:border-moss-500 transition-all resize-none h-32 mb-6 placeholder:text-gray-600"
                />

                <div className="flex flex-col gap-3">
                  <button 
                    onClick={handleReport}
                    disabled={reportLoading || !reportReason.trim()}
                    className="w-full bg-red-500 hover:bg-red-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs transition-all shadow-lg shadow-red-900/20 disabled:opacity-50"
                  >
                    {reportLoading ? 'Enviando...' : 'Enviar Denúncia'}
                  </button>
                  <button 
                    onClick={() => setReportModal(null)}
                    disabled={reportLoading}
                    className="w-full bg-white/5 hover:bg-white/10 text-gray-400 font-bold py-4 rounded-2xl uppercase tracking-widest text-xs transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeCommentsId && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveCommentsId(null)}
              className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 z-[310] bg-[#0d0d0d] border-t border-white/10 rounded-t-[40px] max-h-[85vh] flex flex-col shadow-2xl p-6 pb-20 max-w-lg mx-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tighter text-moss-400">Comentários</h3>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Relato de {reviews.find(r => r.id === activeCommentsId)?.userName}</p>
                </div>
                <button 
                  onClick={() => setActiveCommentsId(null)}
                  className="p-2 bg-white/5 rounded-full text-gray-400"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-6 pr-2 no-scrollbar mb-6 flex flex-col">
                <AnimatePresence initial={false}>
                  {comments.length > 0 ? (
                    comments.map((comment) => {
                      const commenterId = (comment as any).userId || (comment as any).authorId;
                      const liveProfile = commenterId ? commenterProfiles[commenterId] : null;
                      
                      const handleVal = liveProfile?.handle || (comment as any).userHandle || comment.authorHandle || '@usuario';
                      const nameVal = liveProfile?.displayName || (comment as any).userName || handleVal.replace('@', '');
                      const avatarStylesVal = liveProfile?.avatarStyles || (comment as any).userAvatarStyles || (handleVal === profile?.handle ? profile?.avatarStyles : null);
                      const seedVal = handleVal;

                      return (
                        <motion.div 
                          key={comment.id} 
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="flex gap-4"
                        >
                          <UserAvatar 
                            styles={avatarStylesVal} 
                            seed={seedVal} 
                            size="sm" 
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Link to={`/profile/${handleVal.replace('@', '')}`} onClick={() => setActiveCommentsId(null)}>
                                <span className="text-xs font-bold text-moss-400 uppercase tracking-tighter hover:underline">
                                  {nameVal}
                                </span>
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter ml-1">
                                  {handleVal}
                                </span>
                              </Link>
                              <span className="text-[9px] text-gray-600 font-bold ml-auto">{formatRelativeTime(comment.createdAt)}</span>
                              {(isAdmin || user?.uid === commenterId) && (
                                <button 
                                  onClick={() => handleDeleteComment(comment.id)}
                                  className="text-gray-600 hover:text-red-500 transition-colors ml-1"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                              {user && commenterId !== user.uid && (
                                <button 
                                  onClick={() => setReportModal({ id: comment.id, type: 'comment', content: comment.text, targetUserId: comment.authorId || comment.userId })}
                                  className="text-gray-600 hover:text-red-500 transition-colors ml-1"
                                  title="Denunciar Comentário"
                                >
                                  <Flag size={12} />
                                </button>
                              )}
                            </div>
                            {comment.replyToHandle && (
                              <p className="text-[10px] text-moss-500 font-bold mb-0.5">
                                respondendo a <span className="underline">{comment.replyToHandle}</span>
                              </p>
                            )}
                            <p className="text-sm text-gray-300 leading-relaxed italic">{comment.text}</p>
                            {user && (
                              <div className="flex items-center gap-3 mt-1">
                                <button 
                                  onClick={() => {
                                    setReplyingTo({
                                      commentId: comment.id,
                                      authorHandle: handleVal,
                                      authorId: commenterId,
                                      text: comment.text
                                    });
                                  }}
                                  className="text-[10px] font-extrabold uppercase text-moss-500 hover:text-moss-400 cursor-pointer active:scale-95 transition-all"
                                >
                                  Responder
                                </button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })
                  ) : (
                    <div className="text-center py-10 opacity-30 italic text-sm">Seja o primeiro a brisar aqui...</div>
                  )}
                </AnimatePresence>
              </div>

              {replyingTo && (
                <div className="bg-moss-500/10 border-l-4 border-moss-500 px-4 py-2 rounded-t-xl flex justify-between items-center text-xs text-gray-300 mb-2 max-w-full">
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

              <div className="bg-white/5 p-4 rounded-[24px] border border-white/10 flex items-center gap-4 transition-all focus-within:border-moss-500/50">
                <div className="w-8 h-8 rounded-lg bg-moss-900 border border-white/10 overflow-hidden">
                  <img src={profile?.photoURL || `https://api.dicebear.com/9.x/avataaars/svg?seed=${user?.uid}`} alt="Me" />
                </div>
                <input 
                  type="text" 
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                  placeholder="Escreva sua brisa aqui..."
                  className="bg-transparent flex-1 outline-none text-sm text-white placeholder:text-gray-600 font-medium"
                />
                <button 
                  onClick={() => handleAddComment()}
                  disabled={commentLoading}
                  className="p-2 bg-moss-500 text-white rounded-xl shadow-lg shadow-moss-900/40 hover:bg-moss-400 transition-colors disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLighterModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowLighterModal(false);
                markAsRead();
              }}
              className="fixed inset-0 z-[300] bg-black/85 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 z-[310] bg-[#0a0a0a] border-t border-moss-500/20 rounded-t-[40px] max-h-[85vh] flex flex-col shadow-2xl p-6 pb-20 max-w-lg mx-auto"
            >
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Flame className="w-6 h-6 text-orange-500 animate-pulse" />
                    <span className="absolute inset-0 bg-orange-500/30 blur-md rounded-full -z-10 animate-ping" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tighter text-white italic">Isqueiro do FeedBECK</h3>
                    <p className="text-[9px] text-moss-400 uppercase tracking-widest font-bold">Chamas de notificações</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setShowLighterModal(false);
                    markAsRead();
                  }}
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-gray-400 hover:text-white transition-all active:scale-95"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto pr-1 no-scrollbar space-y-6">
                
                {/* 1. Unread Likes (Sintonias) */}
                {unreadLikesCount > 0 ? (
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="p-5 bg-orange-500/10 border border-orange-500/20 rounded-3xl flex items-center gap-4 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 -mr-6 -mt-6 w-20 h-20 bg-orange-500/10 rounded-full blur-xl" />
                    <div className="w-12 h-12 bg-orange-500/20 rounded-2xl flex items-center justify-center text-orange-400 shrink-0">
                      <Flame size={24} className="fill-orange-500/20 animate-bounce" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-widest text-orange-400">Novas Sintonias recebidas!</h4>
                      <p className="text-sm text-gray-200 font-bold mt-1 leading-tight">
                        Seus relatos receberam <span className="text-orange-400 font-black">{unreadLikesCount}</span> novas sintonias!
                      </p>
                      <p className="text-[10px] text-gray-500 mt-2">Sua vibe se espalhou na mente dos outros brisados.</p>
                    </div>
                  </motion.div>
                ) : (
                  <div className="p-4 bg-white/2 border border-white/5 rounded-3xl opacity-50 flex items-center gap-3">
                    <Flame size={18} className="text-gray-600 animate-pulse" />
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Nenhuma nova sintonia nos seus posts</p>
                  </div>
                )}

                {/* 2. Follow Requests */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-moss-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-moss-500" />
                    Solicitações de Sintonia ({unreadFollowReqsCount})
                  </h4>

                  {followRequests.length > 0 ? (
                    <div className="space-y-3 overflow-y-auto max-h-40 no-scrollbar">
                      {followRequests.map((req) => {
                        const profileData = followRequestProfiles[req.followerId];
                        if (!profileData) return null;

                        return (
                          <motion.div 
                            key={req.id}
                            initial={{ x: -10, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            className="bg-moss-500/5 border border-moss-500/10 rounded-2xl p-3 flex items-center gap-3 justify-between"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <UserAvatar 
                                styles={profileData.avatarStyles} 
                                seed={profileData.handle} 
                                size="sm" 
                                rainbow={profileData.rainbowActive} 
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-black text-white truncate leading-none uppercase">{profileData.displayName}</p>
                                <p className="text-[9px] text-moss-500 font-bold leading-none mt-1">{profileData.handle}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button 
                                onClick={() => acceptFollowRequest(req.id, req.followerId)}
                                className="p-2 bg-moss-500 text-white rounded-lg active:scale-95 transition-all hover:bg-moss-400 animate-pulse"
                                title="Aceitar"
                              >
                                <Check size={14} />
                              </button>
                              <button 
                                onClick={() => rejectFollowRequest(req.id)}
                                className="p-2 bg-white/5 text-gray-400 rounded-lg active:scale-95 transition-all hover:bg-red-500/20 hover:text-white"
                                title="Recusar"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 italic py-2">Sua sintonia privada está 100% atualizada.</p>
                  )}
                </div>

                {/* 3. New posts from followed accounts */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-moss-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-moss-500" />
                    Brisas Recentes das Suas Sintonias ({unreadNewPostsCount})
                  </h4>

                  {unreadNewPostsCount > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1 no-scrollbar">
                      {newFollowedPosts.map((post) => (
                        <div 
                          key={post.id}
                          className="bg-white/5 border border-white/5 rounded-2xl p-3 flex items-center justify-between gap-4"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-white leading-tight truncate">
                              <span className="text-moss-400 font-extrabold">{post.userHandle}</span> postou:
                            </p>
                            <p className="text-[11px] text-gray-400 truncate mt-0.5 leading-normal italic">
                              "{post.title}"
                            </p>
                          </div>
                          <span className="text-[8px] text-gray-500 font-black uppercase shrink-0">
                            {formatRelativeTime(post.createdAt || post.timestamp)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 italic py-2">Os brisados que você segue não postaram nada novo recentemente.</p>
                  )}
                </div>

              </div>

              {/* Action Buttons */}
              <div className="mt-8 border-t border-white/5 pt-4 flex flex-col gap-3">
                <button 
                  onClick={() => {
                    markAsRead();
                    setShowLighterModal(false);
                  }}
                  className="w-full bg-[#10b981] hover:bg-emerald-400 text-black text-xs font-black py-4 rounded-2xl uppercase tracking-widest transition-all shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-2"
                >
                  🧯 Apagar chama (Marcar como lidas)
                </button>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

