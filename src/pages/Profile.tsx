import { useState, useEffect, useRef } from 'react';
import { Palette, Check, X, Sparkles, Star, ChevronLeft, Heart, Pin, LayoutGrid, Wind, IceCream, Film, Activity, Moon, Sun, Zap, MessageCircle, Send, Bell, Play, Pause, Music, Ghost, Leaf, Pizza, Cookie, Coffee, Utensils, Sandwich, Trash2, Eye, Flame, Flag, AlertTriangle } from 'lucide-react';
import Logo from '../components/Logo';
import { motion, AnimatePresence } from 'motion/react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, onSnapshot, orderBy, setDoc, deleteDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
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
    filme: 'bg-blue-500/20 text-blue-400',
    brisas: 'bg-green-500/20 text-green-400',
    sons: 'bg-indigo-500/20 text-indigo-400'
  };
  return (
    <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md ${styles[category] || 'bg-gray-500/20 text-gray-400'}`}>
      {category === 'brisas' ? 'brisa' : category}
    </span>
  );
};

// Options for DiceBear Avataaars 9.x - Refined IDs
const HAIR_STYLES = [
  { id: 'bigHair', label: 'Big Hair' },
  { id: 'bob', label: 'Bob' },
  { id: 'bun', label: 'Bun' },
  { id: 'curly', label: 'Curly' },
  { id: 'curvy', label: 'Curvy' },
  { id: 'dreads', label: 'Dreads' },
  { id: 'dreads01', label: 'Dreads 01' },
  { id: 'frida', label: 'Frida' },
  { id: 'frizzle', label: 'Frizzle' },
  { id: 'fro', label: 'Fro' },
  { id: 'hat', label: 'Hat' },
  { id: 'longButNotTooLong', label: 'Long+' },
  { id: 'miaWallace', label: 'Mia' },
  { id: 'shaggy', label: 'Shaggy' },
  { id: 'shaggyMullet', label: 'Mullet' },
  { id: 'shortCurly', label: 'Curto Enrolado' },
  { id: 'shortFlat', label: 'Curto Flat' },
  { id: 'shortRound', label: 'Curto Redondo' },
  { id: 'shortHair', label: 'Curto' },
  { id: 'shortWaved', label: 'Curto Ondulado' },
  { id: 'sides', label: 'Moicano' },
  { id: 'straight01', label: 'Liso 01' },
  { id: 'straight02', label: 'Liso 02' },
  { id: 'straightAndStrand', label: 'Liso +' },
  { id: 'theCaesar', label: 'César' },
  { id: 'careca', label: 'Careca' },
];

const HAIR_COLORS = [
  { id: '2c1b18', color: '#2c1b18', label: 'Ebano' },
  { id: '4a312c', color: '#4a312c', label: 'Castanho Escuro' },
  { id: '724133', color: '#724133', label: 'Castanho' },
  { id: 'a55728', color: '#a55728', label: 'Ruivo' },
  { id: 'c93305', color: '#c93305', label: 'Laranja' },
  { id: 'b58143', color: '#b58143', label: 'Dourado' },
  { id: 'd6b370', color: '#d6b370', label: 'Loiro' },
  { id: 'ecdcbf', color: '#ecdcbf', label: 'Platina' },
  { id: 'e8e1e1', color: '#e8e1e1', label: 'Prata' },
  { id: 'f59797', color: '#f59797', label: 'Rosa' },
  { id: 'ff0000', color: '#ff0000', label: 'Vermelho' },
  { id: '00ff00', color: '#00ff00', label: 'Verde' },
  { id: '0000ff', color: '#0000ff', label: 'Azul' },
  { id: '800080', color: '#800080', label: 'Roxo' },
];

const SKIN_COLORS = [
  { id: '614335', color: '#614335', label: 'Ebony' },
  { id: 'ae5d29', color: '#ae5d29', label: 'Marrom' },
  { id: 'd08b5b', color: '#d08b5b', label: 'Bronze' },
  { id: 'fd9841', color: '#fd9841', label: 'Quente' },
  { id: 'edb98a', color: '#edb98a', label: 'Pêssego' },
  { id: 'f8d25c', color: '#f8d25c', label: 'Dourado' },
  { id: 'ffdbb4', color: '#ffdbb4', label: 'Claro' },
];

const EYES = [
  { id: 'closed', label: 'Fechado' },
  { id: 'default', label: 'Padrão' },
  { id: 'happy', label: 'Feliz' },
  { id: 'hearts', label: 'Coração' },
  { id: 'side', label: 'Lado' },
  { id: 'squint', label: 'Squint' },
  { id: 'surprised', label: 'Surpreso' },
  { id: 'wink', label: 'Piscada' },
  { id: 'xdizzy', label: 'Dizzy' },
];

const MOUTHS = [
  { id: 'default', label: 'Padrão' },
  { id: 'disbelief', label: 'Descrédito' },
  { id: 'eating', label: 'Comendo' },
  { id: 'grimace', label: 'Careta' },
  { id: 'sad', label: 'Triste' },
  { id: 'screamOpen', label: 'Grito' },
  { id: 'serious', label: 'Sério' },
  { id: 'smile', label: 'Sorriso' },
  { id: 'tongue', label: 'Língua' },
  { id: 'twinkle', label: 'Brilho' },
];

const GLASSES = [
  { id: 'blank', label: 'Nenhum' },
  { id: 'eyepatch', label: 'Tapa Olho' },
  { id: 'kurt', label: 'Kurt' },
  { id: 'prescription02', label: 'Grau 02' },
  { id: 'round', label: 'Redondo' },
  { id: 'wayfarers', label: 'Wayfarers' },
];

const FACIAL_HAIR = [
  { id: 'blank', label: 'Nenhum' },
  { id: 'beardLight', label: 'Leve' },
  { id: 'beardMedium', label: 'Média' },
  { id: 'beardMajestic', label: 'Majestosa' },
  { id: 'moustacheFancy', label: 'Fancy' },
  { id: 'moustacheMagnum', label: 'Magnum' },
];

const CLOTHES = [
  { id: 'blazerAndShirt', label: 'Blazer' },
  { id: 'collarAndSweater', label: 'Suéter' },
  { id: 'hoodie', label: 'Moletom' },
  { id: 'overall', label: 'Macacão' },
  { id: 'shirtCrewNeck', label: 'Gola Careca' },
  { id: 'shirtScoopNeck', label: 'Gola U' },
  { id: 'shirtVNeck', label: 'Gola V' },
];

const CLOTHING_COLORS = [
  { id: 'ffffff', color: '#ffffff', label: 'Branco' },
  { id: 'e6e6e6', color: '#e6e6e6', label: 'Gelo' },
  { id: '929598', color: '#929598', label: 'Cinza' },
  { id: '262e33', color: '#262e33', label: 'Grafite' },
  { id: '000000', color: '#000000', label: 'Preto' },
  { id: 'ff2020', color: '#ff2020', label: 'Vermelho' },
  { id: '8b0000', color: '#8b0000', label: 'Vinho' },
  { id: 'ff5c5c', color: '#ff5c5c', label: 'Coral' },
  { id: 'ff8a65', color: '#ff8a65', label: 'Salmão' },
  { id: 'ffa500', color: '#ffa500', label: 'Laranja' },
  { id: 'ffd700', color: '#ffd700', label: 'Ouro' },
  { id: 'ffff00', color: '#ffff00', label: 'Amarelo' },
  { id: 'a7ffc4', color: '#a7ffc4', label: 'Menta' },
  { id: '00ff00', color: '#00ff00', label: 'Lima' },
  { id: '008000', color: '#008000', label: 'Verde' },
  { id: '228b22', color: '#228b22', label: 'Floresta' },
  { id: '008080', color: '#008080', label: 'Teal' },
  { id: '00ffff', color: '#00ffff', label: 'Ciano' },
  { id: '65c9ff', color: '#65c9ff', label: 'Céu' },
  { id: '5199e4', color: '#5199e4', label: 'Royal' },
  { id: '25557c', color: '#25557c', label: 'Navy' },
  { id: '3f51b5', color: '#3f51b5', label: 'Índigo' },
  { id: '9575cd', color: '#9575cd', label: 'Lavanda' },
  { id: '800080', color: '#800080', label: 'Roxo' },
  { id: '4b0082', color: '#4b0082', label: 'Uva' },
  { id: 'ffc0cb', color: '#ffc0cb', label: 'Rosa' },
  { id: 'a52a2a', color: '#a52a2a', label: 'Marrom' },
  { id: '8b4513', color: '#8b4513', label: 'Saddle' },
  { id: 'f5f5dc', color: '#f5f5dc', label: 'Bege' },
];


const vibeMapping: any = {
  larica: 'Lariqueiro',
  brisas: 'Brisado',
  filme: 'Cinéfilo',
  sons: 'Melômano',
  yarok: 'Yarok Master',
  semente: 'Novato'
};

export default function Profile() {
  const { user, profile: myProfile, auth, pendingRequestsCount, isAdmin } = useAuth();
  const { handle } = useParams();
  const navigate = useNavigate();
  const isMe = !handle || (myProfile && (
    handle.toLowerCase().replace(/^@/, '') === myProfile.handle.toLowerCase().replace(/^@/, '')
  ));
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [targetProfile, setTargetProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userReviews, setUserReviews] = useState<any[]>([]);
  const [savedReviews, setSavedReviews] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'relatos' | 'salvos' | 'estilo'>('relatos');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isRequested, setIsRequested] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [selectedReviewIndex, setSelectedReviewIndex] = useState<number | null>(null);
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);
  const [detailList, setDetailList] = useState<any[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [activeCommentsId, setActiveCommentsId] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [reportModal, setReportModal] = useState<{ id: string, type: 'post' | 'comment', content: string, targetUserId: string } | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportLoading, setReportLoading] = useState(false);

  const [isCurrentlyBanned, setIsCurrentlyBanned] = useState(false);

  useEffect(() => {
    if (!targetProfile?.banInfo?.isBanned) {
      setIsCurrentlyBanned(false);
      return;
    }

    const expiryTime = targetProfile.banInfo.expiresAt ? new Date(targetProfile.banInfo.expiresAt).getTime() : null;
    
    const checkBan = () => {
      const now = Date.now();
      if (!expiryTime || expiryTime > now) {
        setIsCurrentlyBanned(true);
      } else {
        setIsCurrentlyBanned(false);
      }
    };

    checkBan();

    if (expiryTime) {
      const now = Date.now();
      const delay = expiryTime - now;
      if (delay > 0 && delay < 2147483647) { // Ensure delay is within setTimeout limits
        const timer = setTimeout(() => {
          setIsCurrentlyBanned(false);
        }, delay + 500); // 500ms buffer
        return () => clearTimeout(timer);
      }
    }
  }, [targetProfile]);

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
        reporterHandle: myProfile?.handle || '@anonimo',
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

  useEffect(() => {
    if (isDetailViewOpen && selectedReviewIndex !== null && scrollContainerRef.current) {
      const element = document.getElementById(`review-detail-${selectedReviewIndex}`);
      if (element) {
        element.scrollIntoView({ behavior: 'auto', block: 'start' });
      }
    }
  }, [isDetailViewOpen, selectedReviewIndex]);

  const [syncedIds, setSyncedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  
  const [commenterProfiles, setCommenterProfiles] = useState<Record<string, any>>({});
  const [savedReviewIds, setSavedReviewIds] = useState<string[]>([]);
  const [commenterUserIds, setCommenterUserIds] = useState<string[]>([]);
  
  const [sintoniaProfiles, setSintoniaProfiles] = useState<any[]>([]);
  const [sintoniaUserIds, setSintoniaUserIds] = useState<string[]>([]);
  
  // Reactively sync saved posts IDs
  useEffect(() => {
    if (!user || (handle && handle !== myProfile?.handle)) return; // Only for current logged in user seeing their saves
    
    const qSaves = query(collection(db, 'users', user.uid, 'saved_posts'), orderBy('savedAt', 'desc'));
    const unsubscribe = onSnapshot(qSaves, (snapshot) => {
      setSavedReviewIds(snapshot.docs.map(doc => doc.id));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/saved_posts`);
    });

    return unsubscribe;
  }, [user, myProfile, handle]);

  // Reactively fetch saved post details
  useEffect(() => {
     if (!user || savedReviewIds.length === 0) {
       setSavedReviews([]);
       return;
     }

     // Use where('__name__', 'in', ...) for document IDs
     // Note: If some posts are private and user loses follow access, this might trigger permission denied
     const reviewsQ = query(collection(db, 'reviews'), where('__name__', 'in', savedReviewIds.slice(0, 30)));
     
     const unsubscribe = onSnapshot(reviewsQ, (reviewSnap) => {
       const reviewMap = new Map(reviewSnap.docs.map(d => {
         const data = d.data();
         return [d.id, { 
           id: d.id, 
           ...data,
           userName: data.authorName || data.userName || 'Usuário',
           userHandle: data.authorHandle || data.userHandle || '@anonimo',
           authorAvatarStyles: data.authorAvatarStyles || data.userAvatarStyles
         }];
       }));
       const sortedReviews = savedReviewIds.map(id => reviewMap.get(id)).filter(Boolean);
       setSavedReviews(sortedReviews);
     }, (error) => {
       if (error.message.includes('permission-denied') || error.message.includes('Permission denied')) {
         console.warn('Some saved reviews are inaccessible due to privacy/permissions');
         // We can't easily filter out just the failed ones in a single query listener, 
         // but onSnapshot will fail entirely if one document is restricted.
         // This is a known Firestore limitation with 'in' queries and mixed permissions.
         setSavedReviews([]); 
       } else {
         if (error.message.toLowerCase().includes('permission')) { setSavedReviews([]); } else { handleFirestoreError(error, OperationType.GET, 'saved_reviews_details'); };
       }
     });

     return unsubscribe;
  }, [user, savedReviewIds]);

  // Reactively fetch current user's liked and saved post IDs
  useEffect(() => {
    if (!user) {
      setSyncedIds(new Set());
      setSavedIds(new Set());
      return;
    }

    const qSyncs = query(collection(db, 'users', user.uid, 'sintonias'));
    const unsubSyncs = onSnapshot(qSyncs, (snapshot) => {
      setSyncedIds(new Set(snapshot.docs.map(doc => doc.id)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/sintonias`);
    });

    const qSaves = query(collection(db, 'users', user.uid, 'saved_posts'));
    const unsubSaves = onSnapshot(qSaves, (snapshot) => {
      setSavedIds(new Set(snapshot.docs.map(doc => doc.id)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/saved_posts`);
    });

    return () => {
      unsubSyncs();
      unsubSaves();
    };
  }, [user]);

  // Comments listener
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
      const fetchedComments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setComments(fetchedComments);
      setCommenterUserIds(fetchedComments.map((c: any) => c.userId || c.authorId).filter(Boolean));

      // Auto-sync comment count if it's incorrect or missing
      const currentReview = [...userReviews, ...savedReviews].find(r => r.id === activeCommentsId);
      if (currentReview && currentReview.commentsCount !== snapshot.size) {
        updateDoc(doc(db, 'reviews', activeCommentsId), {
          commentsCount: snapshot.size
        }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `reviews/${activeCommentsId}`));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `reviews/${activeCommentsId}/comments`);
    });

    return unsubscribe;
  }, [activeCommentsId, userReviews, savedReviews]);

  // Commenter profiles listener
  useEffect(() => {
    const uniqueIds = Array.from(new Set(commenterUserIds)).slice(0, 30);
    if (!user || uniqueIds.length === 0) {
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
  }, [user, commenterUserIds]);

  // Sintonia (Following) profiles listener
  useEffect(() => {
    if (!user || !targetProfile) {
      setSintoniaUserIds([]);
      return;
    }

    const followsQ = query(collection(db, 'follows'), where('followerId', '==', targetProfile.uid));
    const unsubscribe = onSnapshot(followsQ, (snap) => {
      const ids = snap.docs.map(doc => doc.data().followingId);
      setSintoniaUserIds(ids);
    }, (error) => {
      if (error.message.toLowerCase().includes('permission') || error.message.toLowerCase().includes('insufficient')) {
        setSintoniaUserIds([]);
      } else {
        handleFirestoreError(error, OperationType.LIST, 'follows_sintonia');
      }
    });

    return unsubscribe;
  }, [user, targetProfile]);

  useEffect(() => {
    const uniqueIds = Array.from(new Set(sintoniaUserIds)).slice(0, 30);
    if (!user || uniqueIds.length === 0) {
      setSintoniaProfiles([]);
      return;
    }

    const usersQ = query(collection(db, 'users'), where('uid', 'in', uniqueIds));
    const unsubscribe = onSnapshot(usersQ, (userSnap) => {
      const profiles = userSnap.docs.map(d => d.data());
      setSintoniaProfiles(profiles);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users_for_sintonia');
    });

    return unsubscribe;
  }, [user, sintoniaUserIds]);

  const addComment = async (reviewId: string) => {
    if (!user || !newComment.trim()) return;
    setCommentLoading(true);

    try {
      const commentData = {
        text: newComment.trim(),
        authorId: user.uid,
        authorHandle: myProfile?.handle || '@usuario',
        userName: myProfile?.displayName || 'Usuário',
        userHandle: myProfile?.handle || '@usuario',
        userAvatarStyles: myProfile?.avatarStyles || null,
        createdAt: serverTimestamp()
      };

      await setDoc(doc(collection(db, 'reviews', reviewId, 'comments')), commentData);
      await updateDoc(doc(db, 'reviews', reviewId), {
        commentsCount: increment(1)
      });
      setNewComment('');
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

  const deleteReview = async (id: string, category: string) => {
    if (!user) return;
    setIsDeleting(null);
    try {
      await deleteDoc(doc(db, 'reviews', id));
      setIsDetailViewOpen(false);

      // Update user stats
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const categoryCounts = userData.categoryCounts || {};
        if (categoryCounts[category] > 0) {
          categoryCounts[category] -= 1;
        }

        // Recalculate dominant vibe
        let dominant = 'semente';
        let max = 0;
        Object.entries(categoryCounts).forEach(([cat, count]: [any, any]) => {
          if (count > max) {
            max = count;
            dominant = cat;
          }
        });

        await updateDoc(userRef, {
          postsCount: increment(-1),
          categoryCounts,
          dominantVibe: dominant,
          updatedAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

    useEffect(() => {
      if (user) {
        // Get initial syncs/saves - This is now handled by reactive listeners above
      }
    }, [user]);

    // Auto-sync stats if they are out of sync (only for the owner)
    useEffect(() => {
      if (!isMe || !user || !targetProfile) return;

      const syncStats = async () => {
        try {
          const userRef = doc(db, 'users', user.uid);
          const updates: any = {};
          
          if (targetProfile.postsCount !== userReviews.length) {
            updates.postsCount = userReviews.length;
          }
          
          if (targetProfile.followingCount !== sintoniaUserIds.length) {
            updates.followingCount = sintoniaUserIds.length;
          }

          // We check followers as well
          const followersSnap = await getDocs(query(collection(db, 'follows'), where('followingId', '==', user.uid)));
          if (targetProfile.followersCount !== followersSnap.size) {
            updates.followersCount = followersSnap.size;
          }

          // Check total sintonias (likes received)
          const reviewsSnap = await getDocs(query(collection(db, 'reviews'), where('authorId', '==', user.uid)));
          const actualTotalLikes = reviewsSnap.docs.reduce((acc, d) => acc + (d.data().sintonias || 0), 0);
          if (targetProfile.totalSintonias !== actualTotalLikes) {
            updates.totalSintonias = actualTotalLikes;
          }

          if (Object.keys(updates).length > 0) {
            console.log('Auto-syncing profile stats:', updates);
            await updateDoc(userRef, {
              ...updates,
              updatedAt: serverTimestamp()
            });
          }
        } catch (err) {
          console.error('Error auto-syncing stats:', err);
        }
      };

      syncStats();
    }, [isMe, user, targetProfile?.uid, userReviews.length, sintoniaUserIds.length]);

  const toggleSync = async (reviewId: string, authorId: string) => {
    if (!user) return;
    
    try {
      const docRef = doc(db, 'reviews', reviewId);
      const userLikeRef = doc(db, 'users', user.uid, 'sintonias', reviewId);
      
      if (!syncedIds.has(reviewId)) {
        await setDoc(userLikeRef, { createdAt: serverTimestamp() });
        await updateDoc(docRef, { sintonias: increment(1) });
        if (authorId) {
          await updateDoc(doc(db, 'users', authorId), { totalSintonias: increment(1) });
        }
      } else {
        await deleteDoc(userLikeRef);
        await updateDoc(docRef, { sintonias: increment(-1) });
        if (authorId) {
          await updateDoc(doc(db, 'users', authorId), { totalSintonias: increment(-1) });
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

  
  // Customization State (for Me)
  const [isPrivate, setIsPrivate] = useState(false);
  const [avatarStyles, setAvatarStyles] = useState({
    top: 'bigHair',
    topColor: '2c1b18',
    facialHairColor: '2c1b18',
    skinColor: 'ffdbac',
    clothingColor: '3c4f5e',
    accessoriesColor: '262e33',
    eyes: 'default',
    mouth: 'default',
    glasses: 'blank',
    facialHair: 'blank',
    clothes: 'shirtCrewNeck'
  });

  const colorHex = avatarStyles.topColor.replace('#', '');
  const facialHairHex = (avatarStyles.facialHairColor || '2c1b18').replace('#', '');
  const skinHex = avatarStyles.skinColor.replace('#', '');
  const clothHex = avatarStyles.clothingColor.replace('#', '');
  const accessoryHex = (avatarStyles.accessoriesColor || '262e33').replace('#', '');
  
  const topParam = avatarStyles.top === 'careca' ? 'topProbability=0' : `top=${avatarStyles.top}&topProbability=100`;
  const facialHairParam = avatarStyles.facialHair === 'blank' ? 'facialHairProbability=0' : `facialHair=${avatarStyles.facialHair}&facialHairProbability=100`;
  const accessoryParam = avatarStyles.glasses === 'blank' ? 'accessoriesProbability=0' : `accessories=${avatarStyles.glasses}&accessoriesProbability=100`;
  const clothingParam = `clothing=${avatarStyles.clothes}&clothingProbability=100`;
  
  const previewAvatarUrl = `https://api.dicebear.com/9.x/avataaars/svg?${topParam}&${facialHairParam}&${accessoryParam}&${clothingParam}&topColor=${colorHex}&hairColor=${colorHex}&facialHairColor=${facialHairHex}&accessoriesColor=${accessoryHex}&skinColor=${skinHex}&clothingColor=${clothHex}&clothesColor=${clothHex}&eyes=${avatarStyles.eyes}&mouth=${avatarStyles.mouth}&clothingGraphic[]`;

  useEffect(() => {
    // Reset all view states when navigating to a different profile
    setIsDetailViewOpen(false);
    setSelectedReviewIndex(null);
    setDetailList([]);
    setActiveCommentsId(null);
    setIsCustomizing(false);
    setIsRequested(false);
    setIsFollowing(false);
    
    // Reset scroll of the main container if it exists
    const mainContainer = document.querySelector('.pb-32');
    if (mainContainer) {
      mainContainer.scrollTop = 0;
    }
  }, [handle]);

  useEffect(() => {
    // Check for customization trigger from other pages
    const params = new URLSearchParams(window.location.search);
    if (params.get('customize') === 'true' && isMe) {
      setIsCustomizing(true);
      // Clean up URL to prevent re-opening on refresh
      const newUrl = window.location.pathname + window.location.hash.split('?')[0];
      window.history.replaceState({}, '', newUrl);
    }
  }, [isMe, handle]);

  useEffect(() => {
    async function fetchProfile() {
      setLoading(true);
      if (isMe) {
        setTargetProfile(myProfile);
        if (myProfile && !isCustomizing) { // Don't overwrite while editing
          setEditDisplayName(myProfile.displayName || '');
          setEditBio(myProfile.bio || '');
          setIsPrivate(myProfile.isPrivate || false);
          if (myProfile.avatarStyles) {
            setAvatarStyles(myProfile.avatarStyles);
          }
        }
        setLoading(false);
      } else if (handle) {
        try {
          const searchHandle = handle.startsWith('@') ? handle : `@${handle}`;
          const q = query(collection(db, 'users'), where('handle', '==', searchHandle));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const profileData = querySnapshot.docs[0].data() as any;
            
            // Hide anonymous profiles from others
            if (!profileData.email && (!user || user.uid !== profileData.uid)) {
              setTargetProfile(null);
              setLoading(false);
              return;
            }

            setTargetProfile(profileData);
            
            // Check if following or requested
            if (user) {
              const followId = `${user.uid}_${profileData.uid}`;
              try {
                const followDoc = await getDoc(doc(db, 'follows', followId));
                setIsFollowing(followDoc.exists());

                if (!followDoc.exists()) {
                  try {
                    const requestDoc = await getDoc(doc(db, 'followRequests', followId));
                    setIsRequested(requestDoc.exists());
                  } catch (err) {
                    handleFirestoreError(err, OperationType.GET, `followRequests_${followId}`);
                  }
                }
              } catch (err) {
                handleFirestoreError(err, OperationType.GET, `follows_${followId}`);
              }
            }
          } else {
            setTargetProfile(null);
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.LIST, `users_query_handle_${handle}`);
        } finally {
          setLoading(false);
        }
      }
    }
    fetchProfile();
  }, [handle, isMe, myProfile]);

  useEffect(() => {
    if (!targetProfile) return;
    
    // Privacy Logic: only show reviews based on follow status
    const canSeeAnyReviews = !targetProfile.isPrivate || isMe || isFollowing;
    
    if (!canSeeAnyReviews) {
      setUserReviews([]);
      return;
    }

    // If I'm not the owner and not following, I can ONLY see public posts
    const onlyPublic = !isMe && !isFollowing;

    let q = query(
      collection(db, 'reviews'), 
      where('authorId', '==', targetProfile.uid), 
      orderBy('createdAt', 'desc')
    );

    if (onlyPublic) {
      q = query(
        collection(db, 'reviews'), 
        where('authorId', '==', targetProfile.uid),
        where('isPrivate', '==', false),
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
          authorAvatarStyles: data.authorAvatarStyles || data.userAvatarStyles
        };
      });
      setUserReviews(docs);
    }, (error) => {
      if (error.message.toLowerCase().includes('permission') || error.message.toLowerCase().includes('insufficient')) {
        setUserReviews([]);
      } else {
        handleFirestoreError(error, OperationType.LIST, 'reviews');
      }
    });
    return unsubscribe;
  }, [targetProfile, isMe, isFollowing]);

  // Reactive saved posts collection is handled at the top level

  const handleSaveProfile = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        photoURL: previewAvatarUrl,
        displayName: editDisplayName,
        bio: editBio,
        isPrivate,
        avatarStyles
      });
      setIsCustomizing(false);
    } catch (err) {
      console.error('Error saving profile:', err);
    }
  };

  const toggleFollow = async () => {
    if (!user || !targetProfile || followLoading) return;
    setFollowLoading(true);
    const followId = `${user.uid}_${targetProfile.uid}`;
    
    try {
      if (isFollowing) {
        await deleteDoc(doc(db, 'follows', followId));
        
        // Decrement counters
        await updateDoc(doc(db, 'users', user.uid), { followingCount: increment(-1) });
        await updateDoc(doc(db, 'users', targetProfile.uid), { followersCount: increment(-1) });
        
        setIsFollowing(false);
      } else if (isRequested) {
        await deleteDoc(doc(db, 'followRequests', followId));
        setIsRequested(false);
      } else {
        if (targetProfile.isPrivate) {
          await setDoc(doc(db, 'followRequests', followId), {
            followerId: user.uid,
            followingId: targetProfile.uid,
            createdAt: serverTimestamp()
          });
          setIsRequested(true);
        } else {
          await setDoc(doc(db, 'follows', followId), {
            followerId: user.uid,
            followingId: targetProfile.uid,
            createdAt: serverTimestamp()
          });
          
          // Increment counters
          await updateDoc(doc(db, 'users', user.uid), { followingCount: increment(1) });
          await updateDoc(doc(db, 'users', targetProfile.uid), { followersCount: increment(1) });
          
          setIsFollowing(true);
        }
      }
    } catch (err) {
      console.error('Error toggling follow:', err);
    } finally {
      setFollowLoading(false);
    }
  };

  const incrementRedEyes = async () => {
    if (!user || !isMe) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        redEyesCount: increment(1)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const decrementRedEyes = async () => {
    if (!user || !isMe) return;
    const currentCount = targetProfile.redEyesCount || 0;
    if (currentCount <= 0) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        redEyesCount: increment(-1)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-smog-950">
        <div className="w-12 h-12 border-4 border-moss-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!targetProfile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <Logo size={64} className="mb-4 opacity-50" />
        <h2 className="text-xl font-bold text-white mb-2">Perfil não encontrado</h2>
        <p className="text-gray-500 text-sm mb-6">Essa brisa ainda não chegou por aqui...</p>
        <button onClick={() => navigate('/')} className="px-6 py-3 bg-moss-500 text-white rounded-2xl font-bold uppercase tracking-widest text-xs">Voltar ao Feed</button>
      </div>
    );
  }

  if (isCurrentlyBanned && !isAdmin) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-sm"
        >
          <div className="w-24 h-24 bg-red-500/10 rounded-[40px] flex items-center justify-center text-red-500 mx-auto mb-8 shadow-2xl border border-red-500/20">
            <AlertTriangle size={48} />
          </div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic mb-4">Conta Suspensa</h1>
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-8 backdrop-blur-xl">
            <p className="text-sm text-gray-400 italic leading-relaxed">
              "Este perfil foi temporariamente suspenso por violar as diretrizes da comunidade FeedBECK."
            </p>
          </div>
          <p className="text-[10px] text-gray-600 uppercase tracking-[0.3em] font-black mb-8 leading-relaxed">
            Área Restrita de Moderação
          </p>
          <button 
            onClick={() => navigate(-1)}
            className="w-full py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all border border-white/10"
          >
            Voltar
          </button>
        </motion.div>
      </div>
    );
  }

    const reviewsCount = userReviews.length;

    const categoryCounts = userReviews.reduce((acc: any, r) => {
      acc[r.category] = (acc[r.category] || 0) + 1;
      return acc;
    }, {});

    let calculatedDominant = 'brisas';
    let maxCount = -1;
    Object.entries(categoryCounts).forEach(([cat, count]: [any, any]) => {
      if (count > maxCount) {
        maxCount = count;
        calculatedDominant = cat;
      }
    });

    const hasYarok = targetProfile?.yarokActive === true;
    const effectiveCategory = hasYarok ? 'yarok' : (userReviews.length > 0 ? calculatedDominant : (targetProfile.dominantVibe || 'semente'));
    
    // Improved logic: trust live query counts if we have them
    const displayPostsCount = userReviews.length;
    const displaySintonias = sintoniaUserIds.length;
    const displayFollowers = targetProfile.followersCount || 0; // Followers count would need its own listener to be 100% reactive here

    const vibe = (displayPostsCount > 0 || hasYarok) ? (vibeMapping[effectiveCategory] || 'Novato') : 'Novato';
    const activeVibeCategory = (displayPostsCount > 0 || hasYarok) ? (effectiveCategory || 'semente') : 'semente';

  const vibeBackdrops: any = {
    larica: {
      gradient: 'from-orange-600/30 via-orange-950/40 to-transparent',
      elements: (
        <>
          {/* Water Stream / River Effect Backdrop */}
          <div className="absolute inset-0 opacity-20 blur-3xl">
            <motion.div 
              animate={{ x: ['-20%', '20%'], y: ['-10%', '10%'] }}
              transition={{ duration: 12, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
              className="w-full h-full bg-gradient-to-br from-transparent via-blue-400/10 to-transparent"
            />
          </div>

          {/* Drifting Food Items - Full vertical and horizontal coverage */}
          {[...Array(25)].map((_, i) => {
            const Icons = [IceCream, Pizza, Cookie, Coffee, Utensils, Sandwich];
            const Icon = Icons[i % Icons.length];
            
            // Random but distributed vertical positioning
            const topPos = Math.random() * 90; // 0% to 90%
            const startX = -20 - (Math.random() * 60); // Start far left
            const duration = 12 + Math.random() * 20; // Varying speeds
            const delay = Math.random() * -20; // Start at different times (some already in screen)
            const size = 18 + Math.random() * 22;

            return (
              <motion.div
                key={i}
                initial={{ x: `${startX}vw`, opacity: 0, rotate: 0 }}
                animate={{ 
                  x: '120vw',
                  opacity: [0, 0.8, 0.8, 0],
                  rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)],
                  y: [0, (Math.random() - 0.5) * 40, 0] // Random bobbing amount
                }}
                transition={{ 
                  duration, 
                  repeat: Infinity, 
                  delay,
                  ease: "linear"
                }}
                style={{ top: `${topPos}%` }}
                className="absolute text-orange-400/70 drop-shadow-[0_0_15px_rgba(251,146,60,0.3)] left-0 pointer-events-none"
              >
                <Icon size={size} />
              </motion.div>
            );
          })}

          {/* Bubbles / Water Refraction sparkles spread across height */}
          {[...Array(15)].map((_, i) => (
            <motion.div
              key={`sparkle-${i}`}
              initial={{ x: '-10%', y: `${Math.random() * 100}%`, opacity: 0 }}
              animate={{ 
                x: '130%',
                opacity: [0, 0.5, 0],
                scale: [0.5, 1.2, 0.5],
                y: [`${Math.random() * 100}%`, `${Math.random() * 100}%`]
              }}
              transition={{ 
                duration: 4 + Math.random() * 6, 
                repeat: Infinity, 
                delay: Math.random() * 5,
                ease: "linear"
              }}
              className="absolute w-1.5 h-1.5 bg-white rounded-full blur-[1px] opacity-20"
            />
          ))}
        </>
      ),
      glow: 'shadow-[inset_0_0_180px_rgba(249,115,22,0.15)]',
      animation: { animate: { opacity: [0.4, 0.6, 0.4] }, transition: { duration: 4, repeat: Infinity } }
    },
    filme: {
      gradient: 'from-black via-slate-900 to-transparent',
      elements: (
        <>
          {/* Horizontal Film Strip (Single, Full Banner) */}
          <div className="absolute inset-0 overflow-hidden bg-black/40">
            <motion.div 
              animate={{ x: [-400, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="flex flex-row h-full"
            >
              {[...Array(10)].map((_, i) => (
                <div key={i} className="flex-shrink-0 w-[400px] h-full border-r border-white/5 relative">
                  {/* Top Sprockets */}
                  <div className="absolute top-3 inset-x-0 flex justify-around px-2">
                    {[...Array(6)].map((_, j) => (
                      <div key={j} className="w-5 h-8 border-2 border-white/10 rounded-md bg-black/20" />
                    ))}
                  </div>

                  {/* Frame Center Detail (Subtle reflection) */}
                  <div className="absolute inset-y-16 inset-x-8 bg-gradient-to-br from-white/5 to-transparent rounded-lg opacity-30" />

                  {/* Bottom Sprockets */}
                  <div className="absolute bottom-3 inset-x-0 flex justify-around px-2">
                    {[...Array(6)].map((_, j) => (
                      <div key={j} className="w-5 h-8 border-2 border-white/10 rounded-md bg-black/20" />
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Projector Light Cone & Dust */}
          <motion.div 
            animate={{ 
              opacity: [0.1, 0.2, 0.1, 0.3, 0.15],
            }}
            transition={{ duration: 0.2, repeat: Infinity }}
            className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none"
          />
          
          {/* Scratches & Static */}
          <div className="absolute inset-0 opacity-[0.05] pointer-events-none mix-blend-overlay overflow-hidden">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                animate={{ x: ['-100%', '200%'], opacity: [0, 1, 0] }}
                transition={{ duration: 0.1 + Math.random() * 0.15, repeat: Infinity, delay: i * 0.2 }}
                className="absolute inset-y-0 w-[1px] bg-white/60"
                style={{ left: `${Math.random() * 100}%` }}
              />
            ))}
          </div>
        </>
      ),
      glow: 'shadow-[inset_0_0_150px_rgba(255,255,255,0.08)]',
      animation: { animate: { opacity: [0.9, 1, 0.9] }, transition: { duration: 0.15, repeat: Infinity } }
    },
    brisas: {
      gradient: 'from-emerald-900/40 via-smog-950 to-transparent',
      elements: (
        <>
          {/* Swirling Wind Gusts (Curved Paths) */}
          {[...Array(4)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ x: '-10%', y: '50%', opacity: 0, scale: 0.5 }}
              animate={{ 
                x: ['0%', '150%'],
                y: ['50%', `${30 + (i * 15)}%`, `${60 - (i * 10)}%`, '50%'],
                opacity: [0, 0.4, 0.6, 0.4, 0],
                scale: [0.5, 1.2, 0.8, 1.5, 0.5],
                rotate: [0, 180, 360, 540]
              }}
              transition={{ 
                duration: 6 + i, 
                repeat: Infinity, 
                delay: i * 2,
                ease: "easeInOut"
              }}
              className="absolute w-64 h-32 border-t-2 border-emerald-400/30 rounded-full blur-[2px] pointer-events-none"
              style={{ filter: 'drop-shadow(0 0 8px rgba(52, 211, 153, 0.4))' }}
            />
          ))}

          {/* Sharp Floating Leaves / Crystals */}
          {[...Array(15)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ x: -20, y: Math.random() * 200, opacity: 0 }}
              animate={{ 
                x: ['0vw', '110vw'],
                y: [
                  '10%', 
                  `${Math.random() * 80}%`, 
                  `${Math.random() * 20}%`, 
                  '50%'
                ],
                rotate: [0, 720],
                opacity: [0, 1, 1, 0],
                scale: [0.5, 1, 0.7, 1]
              }}
              transition={{ 
                duration: 5 + Math.random() * 5, 
                repeat: Infinity, 
                delay: Math.random() * 8,
                ease: "linear"
              }}
              className="absolute w-1 h-3 bg-emerald-400 shadow-[0_0_10px_#10b981] rounded-full pointer-events-none"
              style={{ top: `${Math.random() * 100}%`, left: '-50px' }}
            />
          ))}

          {/* Large Atmospheric Swirls */}
          <motion.div 
            animate={{ 
              rotate: [0, 360],
              scale: [1, 1.2, 1]
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute -right-20 -top-20 w-[600px] h-[600px] bg-gradient-to-r from-emerald-500/10 to-transparent blur-[120px] rounded-full"
          />

          <motion.div 
            animate={{ 
              rotate: [0, 360],
              x: [-20, 20],
              y: [-10, 10]
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className="absolute -right-10 top-0 text-emerald-400 opacity-20"
          >
            <Wind className="w-96 h-96" />
          </motion.div>
        </>
      ),
      glow: 'shadow-[inset_0_0_200px_rgba(16,185,129,0.15)]',
      animation: { animate: { opacity: [0.8, 1, 0.8] }, transition: { duration: 4, repeat: Infinity } }
    },
    sons: {
      gradient: 'from-indigo-600/30 via-indigo-950/60 to-transparent',
      elements: (
        <>
          {[...Array(4)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 2, opacity: [0, 0.2, 0] }}
              transition={{ duration: 3, repeat: Infinity, delay: i * 0.75, ease: "easeOut" }}
              className="absolute -right-12 -top-12 border-2 border-indigo-500/30 rounded-full w-64 h-64 pointer-events-none"
            />
          ))}
          <motion.div 
            animate={{ 
              scale: [1, 1.05, 1],
              rotate: [-12, -15, -12]
            }}
            transition={{ duration: 0.4, repeat: Infinity, repeatType: "reverse" }}
            className="absolute -right-12 -top-12 text-indigo-400 opacity-25"
          >
            <Music className="w-64 h-64" />
          </motion.div>
        </>
      ),
      glow: 'shadow-[inset_0_0_100px_rgba(99,102,241,0.2)]',
      animation: {}
    },
    semente: {
      gradient: 'from-lime-900/40 via-emerald-950 to-transparent',
      elements: (
        <>
          <motion.div 
            animate={{ opacity: [0.1, 0.2, 0.1], scale: [1, 1.1, 1] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-yellow-500/10 blur-[120px] rounded-full"
          />
          {[...Array(15)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ y: 200, opacity: 0 }}
              animate={{ y: -100, x: Math.sin(i) * 30, opacity: [0, 0.6, 0], scale: [0.5, 1, 0.5] }}
              transition={{ duration: 6 + Math.random() * 4, repeat: Infinity, delay: Math.random() * 6 }}
              className="absolute w-1 h-1 bg-lime-400 rounded-full blur-[1px]"
              style={{ left: `${Math.random() * 90}%`, bottom: '-20px' }}
            />
          ))}
          <motion.div 
            animate={{ y: [-10, 10], rotate: [-5, 5] }}
            transition={{ duration: 6, repeat: Infinity, repeatType: "reverse" }}
            className="absolute right-10 top-1/2 -translate-y-1/2 text-lime-400 opacity-20"
          >
            <Sparkles className="w-64 h-64" />
          </motion.div>
        </>
      ),
      glow: 'shadow-[inset_0_0_120px_rgba(163,230,53,0.1)]',
      animation: { animate: { y: [2, -2, 2] }, transition: { duration: 4, repeat: Infinity } }
    },
    yarok: {
      gradient: 'from-green-700/40 via-green-950/60 to-transparent',
      elements: (
        <>
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ y: 200, x: Math.random() * 400 - 200, opacity: 0, rotate: i * 45 }}
              animate={{ 
                y: -150, 
                opacity: [0, 0.3, 0],
                rotate: i % 2 === 0 ? 360 : -360,
                x: (Math.random() * 400 - 200) + (Math.sin(i) * 60)
              }}
              transition={{ 
                duration: 6 + Math.random() * 4, 
                repeat: Infinity, 
                delay: i * 2,
                ease: "linear"
              }}
              className="absolute bottom-0 right-1/3 text-green-500 pointer-events-none"
            >
              <Leaf size={20 + Math.random() * 15} />
            </motion.div>
          ))}
          <motion.div 
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: [-15, 15, -15],
              opacity: [0.15, 0.25, 0.15]
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -right-16 -top-16 text-green-400"
          >
            <Leaf className="w-80 h-80" />
          </motion.div>
        </>
      ),
      glow: 'shadow-[inset_0_0_200px_rgba(34,197,94,0.3)]',
      animation: { animate: { opacity: [0.4, 0.7, 0.4] }, transition: { duration: 5, repeat: Infinity } }
    }
  };

  const currentBackdrop = vibeBackdrops[activeVibeCategory] || {
    gradient: 'from-moss-900/60 via-smog-900/40 to-transparent',
    elements: (
      <Sparkles className="absolute -right-12 -top-12 w-64 h-64 opacity-5 -rotate-12 text-moss-500" />
    ),
    glow: '',
    animation: {}
  };

  const currentList = activeTab === 'relatos' ? userReviews : savedReviews;

  return (
    <div className="pb-32 no-scrollbar scroll-smooth h-screen overflow-y-auto relative">
      <div>
        {/* Header / Cover */}
        <div className={`h-48 relative bg-smog-900 ${currentBackdrop.glow} transition-all duration-700`}>
          {/* Background Layer (Behind content) */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {/* Dynamic Vibe Background */}
            <motion.div 
              {...currentBackdrop.animation}
              className={`absolute inset-0 bg-gradient-to-br ${currentBackdrop.gradient}`} 
            />
            {currentBackdrop.elements}
            
            {/* Grain texture overlay */}
            <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay" 
                 style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
          </div>

        {!isMe && (
          <button 
            onClick={() => navigate(-1)}
            className="absolute top-10 left-6 z-20 p-2 bg-black/40 backdrop-blur-md rounded-xl text-white border border-white/10"
          >
            <ChevronLeft size={20} />
          </button>
        )}

        <div className="absolute top-full left-0 right-0 px-6 flex items-start gap-5 sm:gap-6 group/header z-10 sm:bottom-0 sm:top-auto sm:items-end">
             <div className="flex flex-col items-center gap-3 shrink-0 -translate-y-12 sm:translate-y-0">
               <div id="tutorial-profile-avatar" className="relative group-hover/header:scale-[1.02] transition-transform duration-500">
                 <UserAvatar 
                   styles={targetProfile.avatarStyles} 
                   seed={targetProfile.uid} 
                   className="w-24 h-24 sm:w-32 sm:h-32 rounded-[32px] sm:rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.6)] !border-smog-900 border-4"
                   rainbow={targetProfile.rainbowActive}
                 />
               </div>
               
               {/* Mobile Action Bar - Tighter for Mobile */}
               <div className="flex flex-col items-center gap-2.5 sm:hidden">
                 {targetProfile.isPrivate && (
                    <div className="h-6 px-2.5 bg-moss-500/10 border border-moss-500/20 rounded-xl flex items-center gap-1.5 backdrop-blur-md shadow-lg">
                      <Moon size={9} className="text-moss-400 fill-moss-400/20" />
                      <span className="text-[8px] font-black text-moss-400 uppercase tracking-widest">Privado</span>
                    </div>
                  )}
                  {isMe ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 bg-white/5 p-1 rounded-2xl border border-white/10 backdrop-blur-md shadow-2xl">
                        <button onClick={() => setIsCustomizing(true)} className="p-2.5 rounded-xl text-moss-400 hover:bg-white/10 transition-all active:scale-95 bg-white/5 shadow-xl">
                          <Palette size={18} />
                        </button>
                        <div className="w-[1px] h-4 bg-white/10" />
                        <button onClick={() => navigate('/notifications')} className="p-2.5 rounded-xl text-moss-400 hover:bg-white/10 transition-all relative active:scale-95 bg-white/5 shadow-xl">
                          <Bell size={18} />
                          {pendingRequestsCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-moss-500 text-white text-[8px] font-black w-4.5 h-4.5 flex items-center justify-center rounded-full border-2 border-smog-900 shadow-xl">
                              {pendingRequestsCount > 9 ? '!' : pendingRequestsCount}
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={toggleFollow} disabled={followLoading} className={`h-10 px-6 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 ${isFollowing ? 'bg-white/5 text-gray-400 border border-white/10' : isRequested ? 'bg-moss-500/10 text-moss-400 border border-moss-500/20' : 'bg-moss-500 text-white shadow-moss-900/40'}`}>
                      {followLoading ? '...' : isFollowing ? 'Conectado' : isRequested ? 'Pendente' : 'Conectar'}
                    </button>
                  )}
               </div>
             </div>
             
             <div className="min-w-0 flex-1 pb-2 sm:pb-3 sm:translate-y-1 translate-y-2">
                <div className="flex flex-col gap-0.5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3">
                    <div className="flex flex-col min-w-0">
                      <h1 className="text-xl sm:text-3xl font-black text-white leading-tight whitespace-nowrap overflow-hidden text-ellipsis tracking-tight" title={targetProfile.displayName}>
                        {targetProfile.displayName}
                      </h1>
                      <div className="flex items-center gap-2">
                        <span className="text-moss-400 text-[10px] sm:text-xs font-black tracking-widest uppercase truncate">
                          {targetProfile.handle}
                        </span>
                        {isAdmin && isMe && (
                          <span className="bg-red-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-lg shadow-red-900/40 translate-y-[1px]">Admin</span>
                        )}
                      </div>
                      <p className="text-gray-400 text-[11px] sm:text-xs leading-tight italic mt-2 break-words">
                        {targetProfile.bio}
                      </p>
                    </div>

                    {/* Desktop Action Box */}
                    <div className="hidden sm:flex items-center gap-3 shrink-0">
                      {isMe ? (
                         <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/10 backdrop-blur-lg shadow-2xl">
                           <button onClick={() => setIsCustomizing(true)} className="p-3 rounded-xl text-moss-400 hover:bg-white/10 transition-all hover:scale-110 active:scale-95 group/btn shadow-xl bg-white/5">
                            <Palette size={22} className="group-hover/btn:rotate-12 transition-transform" />
                          </button>
                          <div className="w-[1px] h-5 bg-white/10" />
                          <button onClick={() => navigate('/notifications')} className="p-3 rounded-xl text-moss-400 hover:bg-white/10 transition-all relative hover:scale-110 active:scale-95 group/btn shadow-xl bg-white/5">
                            <Bell size={22} className="group-hover/btn:rotate-12 transition-transform" />
                            {pendingRequestsCount > 0 && (
                               <span className="absolute -top-1 -right-1 bg-moss-500 text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-smog-900 shadow-2xl group-hover/btn:scale-110 transition-transform">
                                 {pendingRequestsCount > 9 ? '9+' : pendingRequestsCount}
                               </span>
                            )}
                          </button>
                         </div>
                       ) : (
                        <button onClick={toggleFollow} disabled={followLoading} className={`h-10 px-6 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 ${isFollowing ? 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10' : isRequested ? 'bg-moss-500/10 text-moss-400 border border-moss-500/20 hover:bg-moss-500/20' : 'bg-moss-500 text-white shadow-xl shadow-moss-900/40 hover:bg-moss-400'}`}>
                          {followLoading ? '...' : isFollowing ? 'Conectado' : isRequested ? 'Pendente' : 'Conectar'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
             </div>
          </div>
      </div>

        <div className="px-6 pt-28 sm:pt-16">
          {/* Stats Grid - Conceptual Redesign */}
          <div id="tutorial-profile-stats" className="flex gap-3 my-8">
             {/* Total Relatos - The Anchor */}
             <div className="flex-1 glass-card p-5 rounded-[32px] flex flex-col items-center justify-center border-moss-500/10 hover:border-moss-500/30 transition-all group">
               <span className="text-3xl font-black text-white group-hover:scale-110 transition-transform">{displayPostsCount}</span>
               <span className="text-[9px] uppercase tracking-[0.2em] text-gray-600 font-black mt-1">Relatos</span>
             </div>

             {/* Social Clout - Sintonias */}
             <div className="flex-1 glass-card p-5 rounded-[32px] flex flex-col items-center justify-center border-moss-500/10 hover:border-moss-500/30 transition-all group">
               <div className="flex items-center gap-1.5 mb-1">
                 <Zap size={14} className="text-moss-400 fill-moss-500/20" />
                 <span className="text-2xl font-black text-white">{displaySintonias}</span>
               </div>
               <span className="text-[9px] uppercase tracking-[0.2em] text-gray-600 font-black">Sintonias</span>
             </div>

             {/* Personality / Vibe */}
             <motion.div 
               whileHover={isMe ? { scale: 1.05 } : {}}
               onClick={() => isMe && setIsCustomizing(true)}
               className={`flex-1 glass-card p-5 rounded-[32px] flex flex-col items-center justify-center border-moss-500/10 hover:border-moss-500/30 transition-all group ${isMe ? 'cursor-pointer' : ''}`}
             >
               <div className="p-1 px-3 bg-moss-500/20 rounded-full mb-2">
                 <span className="text-[7px] font-black uppercase tracking-[0.2em] text-moss-400">Vibe</span>
               </div>
               <span className="text-xs font-black text-white uppercase tracking-tighter text-center leading-none italic">{vibe}</span>
             </motion.div>
          </div>

          {/* Olhinhos Vermelhos - Manual Counter */}
          {targetProfile.showRedEyes !== false && (
            <div className="relative w-full group mb-8">
              <motion.div 
                id="tutorial-profile-red-eyes"
                whileHover={isMe ? { scale: 1.01 } : {}}
                className={`w-full glass-card p-6 rounded-[32px] border border-red-500/10 flex items-center justify-between transition-all overflow-hidden bg-smog-950/40 ${isMe ? 'hover:border-red-500/30' : ''}`}
              >
                {/* Interaction Layers (Only if it's me) */}
                {isMe && (
                  <div className="absolute inset-0 flex z-10">
                    {/* Left Side: Decrement */}
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        decrementRedEyes();
                      }}
                      className="flex-1 cursor-pointer active:bg-red-500/5 transition-colors"
                      title="Diminuir"
                    />
                    {/* Right Side: Increment */}
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        incrementRedEyes();
                      }}
                      className="flex-1 cursor-pointer active:bg-green-500/5 transition-colors"
                      title="Aumentar"
                    />
                  </div>
                )}

                <div className="flex items-center gap-4 relative z-0">
                  <div className="w-12 h-12 bg-red-500/20 rounded-2xl flex items-center justify-center text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                    <Eye size={24} className="animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-white font-black uppercase tracking-tighter italic leading-none mb-1">Olhinhos Vermelhos</h3>
                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest leading-none">
                      Contador de Sesh
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-col items-end relative z-0">
                  <div className="flex items-center gap-2">
                    <Flame size={14} className="text-red-400" />
                    <span className="text-3xl font-black text-white tracking-tighter italic">
                      {targetProfile.redEyesCount || 0}
                    </span>
                  </div>
                  {isMe && (
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-[7px] font-black text-gray-500 uppercase tracking-widest">-1 Esquerda</span>
                      <span className="text-[7px] font-black text-moss-500 uppercase tracking-widest">Direita +1</span>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </div>

        {/* Customization Modal */}
        <AnimatePresence>
          {isCustomizing && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsCustomizing(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-xl"
              />
              
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative w-full max-w-md glass-card border-moss-500/20 border-2 overflow-hidden h-[85vh] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)]"
              >
                {/* Fixed Top Part */}
                <div className="shrink-0 bg-smog-950/80 backdrop-blur-xl border-b border-white/5">
                  <header className="flex justify-between items-center p-6 pb-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-moss-500/20 rounded-xl text-moss-400">
                        <Sparkles size={20} />
                      </div>
                      <h2 className="text-xl font-black uppercase tracking-tighter">Personagem</h2>
                    </div>
                    <button onClick={() => setIsCustomizing(false)} className="text-gray-500 hover:text-white transition-colors">
                      <X size={24} />
                    </button>
                  </header>

                  <div className="flex flex-col items-center pb-6">
                    <div className="relative group transition-all duration-500 hover:scale-105">
                      <div className="p-1 bg-white/5 rounded-[48px] backdrop-blur-3xl border border-white/10 shadow-2xl relative overflow-hidden">
                        <div className={`absolute inset-0 blur-2xl opacity-10 ${
                          activeVibeCategory === 'brisas' || activeVibeCategory === 'yarok' ? 'bg-moss-500' : 
                          activeVibeCategory === 'larica' ? 'bg-orange-500' : 
                          activeVibeCategory === 'filme' ? 'bg-blue-500' : 
                          activeVibeCategory === 'sons' ? 'bg-indigo-500' : 'bg-moss-500'
                        }`} />
                        <UserAvatar styles={avatarStyles} size="xl" className="relative z-10" rainbow={targetProfile.rainbowActive} />
                      </div>
                      <div className="absolute -bottom-2 -right-1 bg-moss-500 text-white p-2 rounded-xl shadow-xl border border-moss-600">
                        <Sparkles size={14} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth p-6 pt-8">
                  <div className="space-y-10">
                    {/* Basic Info */}
                    <div className="space-y-5">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                          <label className="text-[10px] uppercase tracking-[0.2em] font-black text-moss-500/50">Privacidade</label>
                        </div>
                        <button 
                          onClick={() => setIsPrivate(!isPrivate)}
                          className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                            isPrivate 
                              ? 'bg-moss-500/10 border-moss-500 text-white' 
                              : 'bg-white/5 border-white/10 text-gray-400'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                             {isPrivate ? <Moon size={18} className="text-moss-400" /> : <Sun size={18} className="text-moss-500" />}
                             <div className="text-left">
                               <p className="text-xs font-black uppercase tracking-widest">{isPrivate ? 'Conta Privada' : 'Conta Pública'}</p>
                               <p className="text-[9px] opacity-40 font-bold uppercase">{isPrivate ? 'Apenas sintonias veem seus posts' : 'Qualquer brisado pode ver seu perfil'}</p>
                             </div>
                          </div>
                          <div className={`w-10 h-5 rounded-full relative transition-all ${isPrivate ? 'bg-moss-500' : 'bg-gray-800'}`}>
                             <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${isPrivate ? 'right-1' : 'left-1'}`} />
                          </div>
                        </button>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center px-1">
                          <label className="text-[10px] uppercase tracking-[0.2em] font-black text-moss-500/50">Identidade Visível</label>
                          <span className={`${editDisplayName.length >= 20 ? 'text-moss-400' : 'text-gray-700'} text-[9px] font-black`}>{editDisplayName.length}/20</span>
                        </div>
                        <input 
                          type="text"
                          maxLength={20}
                          value={editDisplayName}
                          onChange={(e) => setEditDisplayName(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-white focus:outline-none focus:border-moss-500 focus:bg-white/[0.08] transition-all font-bold text-sm shadow-inner"
                          placeholder="Como te chamam?"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center px-1">
                          <label className="text-[10px] uppercase tracking-[0.2em] font-black text-moss-500/50">Relato Biográfico</label>
                          <span className={`${editBio.length >= 150 ? 'text-moss-400' : 'text-gray-700'} text-[9px] font-black`}>{editBio.length}/150</span>
                        </div>
                        <textarea 
                          maxLength={150}
                          value={editBio}
                          onChange={(e) => setEditBio(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-white focus:outline-none focus:border-moss-500 focus:bg-white/[0.08] transition-all text-sm min-h-[100px] resize-none overflow-hidden break-words shadow-inner"
                          placeholder="Mande sua brisa..."
                        />
                      </div>
                    </div>

                    {/* Skin Color */}
                    <div className="space-y-4">
                      <label className="text-[10px] uppercase tracking-[0.4em] font-black text-center block text-gray-500">Pigmentação</label>
                      <div className="flex flex-wrap gap-4 justify-center">
                        {SKIN_COLORS.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => setAvatarStyles(prev => ({ ...prev, skinColor: c.id }))}
                            className={`w-8 h-8 rounded-full border-2 transition-all ${
                              avatarStyles.skinColor === c.id ? 'border-white scale-125 shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'border-white/10 hover:border-white/40'
                            }`}
                            style={{ backgroundColor: c.color }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Hair Style & Color */}
                    <div className="space-y-6">
                      <label className="text-[10px] uppercase tracking-[0.4em] font-black text-center block text-gray-500">Fios & Fibras</label>
                      <div className="grid grid-cols-3 gap-2">
                        {HAIR_STYLES.map((h) => (
                          <button
                            key={h.id}
                            onClick={() => setAvatarStyles(prev => ({ ...prev, top: h.id }))}
                            className={`px-2 py-3 rounded-xl text-[8px] font-black uppercase tracking-tighter transition-all ${
                              avatarStyles.top === h.id ? 'bg-moss-500 text-white shadow-lg' : 'bg-white/5 text-gray-500 border border-white/5 hover:bg-white/10'
                            }`}
                          >
                            {h.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-3 justify-center">
                        {HAIR_COLORS.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => setAvatarStyles(prev => ({ ...prev, topColor: c.id }))}
                            className={`w-6 h-6 rounded-full border-2 transition-all ${
                              avatarStyles.topColor === c.id ? 'border-white scale-125' : 'border-white/10 hover:border-white/30'
                            }`}
                            style={{ backgroundColor: c.color }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Facial Features */}
                    <div className="space-y-10">
                       {/* Olhos & Boca */}
                       <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <label className="text-[10px] uppercase tracking-[0.2em] font-black text-gray-500 block text-center">Olhar</label>
                            <div className="grid grid-cols-2 gap-2">
                              {EYES.map((e) => (
                                <button
                                  key={e.id}
                                  onClick={() => setAvatarStyles(prev => ({ ...prev, eyes: e.id }))}
                                  className={`py-2.5 rounded-xl text-[8px] font-black uppercase transition-all ${
                                    avatarStyles.eyes === e.id ? 'bg-white text-black shadow-lg scale-105' : 'bg-white/5 text-gray-600 hover:bg-white/10'
                                  }`}
                                >
                                  {e.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-4">
                            <label className="text-[10px] uppercase tracking-[0.2em] font-black text-gray-500 block text-center">Boca</label>
                            <div className="grid grid-cols-2 gap-2">
                              {MOUTHS.map((m) => (
                                <button
                                  key={m.id}
                                  onClick={() => setAvatarStyles(prev => ({ ...prev, mouth: m.id }))}
                                  className={`py-2.5 rounded-xl text-[8px] font-black uppercase transition-all ${
                                    avatarStyles.mouth === m.id ? 'bg-white text-black shadow-lg scale-105' : 'bg-white/5 text-gray-600 hover:bg-white/10'
                                  }`}
                                >
                                  {m.label}
                                </button>
                              ))}
                            </div>
                          </div>
                       </div>

                       {/* Barba & Óculos */}
                       <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <label className="text-[10px] uppercase tracking-[0.2em] font-black text-gray-500 block text-center">Estilo Facial</label>
                              <div className="grid grid-cols-1 gap-2">
                                {FACIAL_HAIR.map((f) => (
                                  <button
                                    key={f.id}
                                    onClick={() => setAvatarStyles(prev => ({ ...prev, facialHair: f.id }))}
                                    className={`py-2.5 rounded-xl text-[8px] font-black uppercase transition-all ${
                                      avatarStyles.facialHair === f.id ? 'bg-moss-500 text-white' : 'bg-white/5 text-gray-600 hover:bg-white/10'
                                    }`}
                                  >
                                    {f.label}
                                  </button>
                                ))}
                              </div>
                              {avatarStyles.facialHair !== 'blank' && (
                                <div className="flex flex-wrap gap-2 justify-center mt-3 scale-90">
                                  {HAIR_COLORS.map((c) => (
                                    <button
                                      key={c.id}
                                      onClick={() => setAvatarStyles(prev => ({ ...prev, facialHairColor: c.id }))}
                                      className={`w-5 h-5 rounded-full border-2 transition-all ${
                                        avatarStyles.facialHairColor === c.id ? 'border-white scale-110' : 'border-white/10'
                                      }`}
                                      style={{ backgroundColor: c.color }}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          <div className="space-y-4">
                            <label className="text-[10px] uppercase tracking-[0.2em] font-black text-gray-500 block text-center">Acessórios</label>
                            <div className="grid grid-cols-1 gap-2">
                              {GLASSES.map((g) => (
                                <button
                                  key={g.id}
                                  onClick={() => setAvatarStyles(prev => ({ ...prev, glasses: g.id }))}
                                  className={`py-2.5 rounded-xl text-[8px] font-black uppercase transition-all ${
                                    avatarStyles.glasses === g.id ? 'bg-moss-500 text-white' : 'bg-white/5 text-gray-600 hover:bg-white/10'
                                  }`}
                                >
                                  {g.label}
                                </button>
                              ))}
                            </div>
                            {avatarStyles.glasses !== 'blank' && (
                              <div className="flex flex-wrap gap-2 justify-center mt-3 scale-90">
                                {HAIR_COLORS.map((c) => (
                                  <button
                                    key={c.id}
                                    onClick={() => setAvatarStyles(prev => ({ ...prev, accessoriesColor: c.id }))}
                                    className={`w-5 h-5 rounded-full border-2 transition-all ${
                                      avatarStyles.accessoriesColor === c.id ? 'border-white scale-110' : 'border-white/10'
                                    }`}
                                    style={{ backgroundColor: c.color }}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                       </div>
                    </div>

                     {/* Vestuário */}
                    <div className="space-y-6 pb-4">
                      <label className="text-[10px] uppercase tracking-[0.4em] font-black text-center block text-gray-500">Traje & Cor</label>
                      <div className="grid grid-cols-2 gap-2">
                        {CLOTHES.map((cl) => (
                          <button
                            key={cl.id}
                            onClick={() => setAvatarStyles(prev => ({ ...prev, clothes: cl.id }))}
                            className={`px-4 py-3 rounded-xl text-[8px] font-black uppercase transition-all ${
                              avatarStyles.clothes === cl.id ? 'bg-moss-500 text-white shadow-lg' : 'bg-white/5 text-gray-500 border border-white/5 hover:bg-white/10'
                            }`}
                          >
                            {cl.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2 justify-center pt-2">
                        {CLOTHING_COLORS.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => setAvatarStyles(prev => ({ ...prev, clothingColor: c.id }))}
                            className={`w-6 h-6 rounded-full border-2 transition-all ${
                              avatarStyles.clothingColor === c.id ? 'border-white scale-125 shadow-lg' : 'border-white/10 hover:border-white/30'
                            }`}
                            style={{ backgroundColor: c.color }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fixed Footer */}
                <div className="shrink-0 p-6 bg-smog-950 border-t border-white/10">
                  <button 
                    onClick={handleSaveProfile}
                    disabled={loading}
                    className="w-full bg-white hover:bg-moss-400 text-black hover:text-white py-4 rounded-2xl font-black uppercase tracking-[0.4em] shadow-2xl active:scale-95 transition-all text-xs disabled:opacity-50"
                  >
                    {loading ? 'Salvando...' : 'Confirmar Estilo'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Detail View Modal (Instagram-style Feed) */}
        <AnimatePresence>
          {isDetailViewOpen && (
            <div className="fixed inset-0 z-[110] bg-black/95 flex flex-col pt-safe no-scrollbar">
              <div className="shrink-0 flex items-center justify-between p-4 border-b border-white/10 glass">
                <button onClick={() => setIsDetailViewOpen(false)} className="text-white p-2">
                  <ChevronLeft size={24} />
                </button>
                <h3 className="text-sm font-black uppercase tracking-widest text-moss-400">
                  {activeTab === 'relatos' ? 'Relatos' : 'Salvos'}
                </h3>
                <div className="w-10" /> {/* Spacer */}
              </div>

              <div ref={scrollContainerRef} className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
                <div className="max-w-xl mx-auto py-6 space-y-8 px-4">
                  {(activeTab === 'relatos' ? userReviews : savedReviews).map((review, index) => (
                    <div 
                      key={review.id}
                      id={`review-detail-${index}`}
                      className="glass-card p-6 border-white/5 relative"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar 
                            styles={
                              review.authorId === myProfile?.uid ? myProfile?.avatarStyles : 
                              review.authorId === targetProfile?.uid ? targetProfile?.avatarStyles : 
                              review.authorAvatarStyles
                            } 
                            seed={review.userHandle} 
                            size="md" 
                          />
                          <div>
                            <span className="text-sm font-bold text-gray-300 block leading-tight">
                              {review.authorId === targetProfile?.uid ? targetProfile?.displayName : (review.userName || 'Usuário')}
                            </span>
                            <span className="text-[10px] text-moss-400 font-bold uppercase tracking-widest block">
                              {review.authorId === targetProfile?.uid ? targetProfile?.handle : (review.userHandle || '@anonimo')}
                            </span>
                            <span className="text-[9px] text-gray-600 font-bold uppercase tracking-tighter mt-1 block">
                              {formatRelativeTime(review.createdAt)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {user?.uid !== review.authorId && (
                            <button 
                              onClick={() => setReportModal({ id: review.id, type: 'post', content: review.content, targetUserId: review.authorId })}
                              className="p-2 text-gray-600 hover:text-red-500 transition-colors"
                              title="Denunciar"
                            >
                              <Flag size={16} />
                            </button>
                          )}
                          {(isAdmin || user?.uid === review.authorId) && (
                            <button 
                              onClick={() => setIsDeleting(review.id)}
                              className="p-2 text-gray-600 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                          <CategoryBadge category={review.category} />
                        </div>
                      </div>

                      <h2 className="text-xl font-bold text-white mt-2 leading-tight">
                        {review.title}
                      </h2>

                      {/* Music Player Block */}
                      {review.category === 'sons' && review.musicData && (
                        <div className="mt-4 bg-indigo-500/5 border border-indigo-500/20 rounded-[28px] p-4 flex items-center gap-4 relative overflow-hidden group">
                          <div className="absolute inset-0 bg-indigo-500/5 blur-3xl -z-10" />
                          <div className="relative shrink-0">
                            {review.musicData.artworkUrl === 'placeholder:sons' ? (
                              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center shadow-lg border border-white/20 text-white/80">
                                <Music size={28} />
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
                      
                      {review.images && review.images.length > 0 && (
                        <div className="mt-4 -mx-6">
                          <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar gap-2 px-6">
                            {review.images.map((img: string, idx: number) => (
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
                            onClick={() => setActiveCommentsId(review.id)}
                            className="flex items-center gap-2 text-gray-600 hover:text-white transition-colors"
                          >
                            <MessageCircle size={18} />
                            <span className="text-[10px] font-black uppercase tracking-tighter">
                              {review.commentsCount || 0}
                            </span>
                          </button>

                          <button 
                            onClick={() => toggleSave(review.id)}
                            className={`transition-all ${savedIds.has(review.id) ? 'text-moss-400' : 'text-gray-600 hover:text-white'}`}
                          >
                            <Pin size={18} className={savedIds.has(review.id) ? 'fill-current' : ''} />
                          </button>

                          <button 
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
                        </div>

                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star 
                              key={i} 
                              size={12} 
                              className={i < Math.floor(review.rating) ? 'fill-moss-400 text-moss-400' : 'text-gray-700'} 
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="h-20" />
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>


        {/* Comment Modal */}
        <AnimatePresence>
          {activeCommentsId && (
            <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setActiveCommentsId(null)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              
              <motion.div 
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                className="relative bg-smog-900 w-full max-w-lg h-[80vh] sm:h-[600px] rounded-t-[40px] sm:rounded-[40px] border-t sm:border border-white/10 flex flex-col overflow-hidden"
              >
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-black/20">
                  <div>
                    <h3 className="text-xl font-black text-white">Comentários</h3>
                    <p className="text-[10px] text-moss-400 font-bold uppercase tracking-widest">Participe da brisa</p>
                  </div>
                  <button onClick={() => setActiveCommentsId(null)} className="p-3 bg-white/5 rounded-2xl text-gray-400">
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
                  {comments.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                      <MessageCircle size={48} className="mb-4" />
                      <p className="text-sm font-bold uppercase tracking-widest">Ninguém brisou ainda.<br/>Seja o primeiro!</p>
                    </div>
                  ) : (
                    comments.map(comment => {
                      const commenterId = comment.userId || comment.authorId;
                      const liveProfile = commenterId ? commenterProfiles[commenterId] : null;

                      const handle = liveProfile?.handle || comment.userHandle || comment.authorHandle || '@usuario';
                      const name = liveProfile?.displayName || comment.userName || handle.replace('@', '');
                      const avatarStyles = liveProfile?.avatarStyles || comment.userAvatarStyles || null;
                      const seed = handle;

                      return (
                        <div key={comment.id} className="flex gap-4">
                          <UserAvatar styles={avatarStyles} seed={seed} size="sm" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Link to={`/profile/${handle}`} onClick={() => setActiveCommentsId(null)}>
                                <span className="text-xs font-bold text-moss-400 uppercase tracking-tighter hover:underline">
                                  {name}
                                </span>
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter ml-1">
                                  {handle}
                                </span>
                              </Link>
                              <span className="text-[9px] text-gray-600 font-bold ml-auto">{formatRelativeTime(comment.createdAt)}</span>
                            </div>
                            <p className="text-sm text-gray-400 leading-relaxed italic">{comment.text}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="p-6 border-t border-white/5 bg-black/20">
                  <div className="flex items-center gap-3 bg-white/5 p-2 rounded-3xl border border-white/5 focus-within:border-moss-500/50 transition-all">
                    <input 
                      type="text" 
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addComment(activeCommentsId)}
                      placeholder="Mande sua brisa..."
                      className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-white px-3"
                    />
                    <button 
                      onClick={() => addComment(activeCommentsId)}
                      disabled={commentLoading || !newComment.trim()}
                      className="p-3 bg-moss-500 text-white rounded-2xl shadow-lg shadow-moss-900/50 disabled:opacity-50 transition-all active:scale-95"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        {/* Tabs and Grid - Conditional Rendering for Privacy */}
        {!isMe && targetProfile.isPrivate && !isFollowing ? (
          <div className="px-6 py-24 flex flex-col items-center justify-center text-center">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-24 h-24 bg-moss-500/10 rounded-[40px] flex items-center justify-center mb-8 border border-moss-500/20 shadow-2xl shadow-moss-900/40 relative"
            >
              <Ghost className="w-10 h-10 text-moss-400" />
              <div className="absolute -top-2 -right-2 bg-moss-500 p-2 rounded-xl border-2 border-smog-900">
                <Moon size={16} className="text-white" />
              </div>
            </motion.div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-3">Sessão Privada</h3>
            <p className="text-gray-500 text-sm font-bold leading-relaxed max-w-[280px] italic">
              Este perfil está em <span className="text-moss-400">modo brisa privada</span>. Sintonize para ver seus relatos e visões.
            </p>
            
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={toggleFollow}
              disabled={followLoading}
              className={`mt-10 px-10 py-4 rounded-2xl font-black uppercase tracking-[0.3em] text-xs shadow-2xl transition-all border ${
                isRequested 
                  ? 'bg-moss-500/10 border-moss-500 text-moss-400' 
                  : 'bg-moss-500 text-white border-moss-600 shadow-moss-900/40'
              }`}
            >
              {followLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isRequested ? (
                <div className="flex items-center gap-2">
                  <Check size={14} />
                  Pedido Enviado
                </div>
              ) : (
                'Solicitar Sintonia'
              )}
            </motion.button>
          </div>
        ) : (
          <>
            <div id="tutorial-profile-posts" className="flex border-t border-white/5 mt-8 sm:mt-8">
               <button 
                onClick={() => setActiveTab('relatos')}
                className={`flex-1 py-4 flex flex-col items-center gap-1 transition-all ${activeTab === 'relatos' ? 'border-t-2 border-moss-500' : 'opacity-20'}`}
               >
                 <LayoutGrid size={18} className={activeTab === 'relatos' ? 'text-moss-500' : 'text-gray-500'} />
                 <span className={`text-[8px] font-black uppercase tracking-widest ${activeTab === 'relatos' ? 'text-moss-500' : 'text-gray-500'}`}>Relatos</span>
               </button>
               
               {isMe && (
                 <button 
                  onClick={() => setActiveTab('salvos')}
                  className={`flex-1 py-4 flex flex-col items-center gap-1 transition-all ${activeTab === 'salvos' ? 'border-t-2 border-moss-500 text-moss-500' : 'opacity-20 text-gray-500'}`}
                 >
                   <Pin size={18} className={activeTab === 'salvos' ? 'fill-moss-500' : ''} />
                   <span className="text-[8px] font-black uppercase tracking-widest">Salvos</span>
                 </button>
               )}
            </div>

            {/* Instagram-style Grid View */}
            <section className="mb-12">
              {activeTab === 'relatos' && (
                userReviews.length > 0 ? (
                  <div className="grid grid-cols-3 gap-[1px]">
                    {userReviews.map((review, index) => (
                      <div 
                        key={review.id} 
                        onClick={() => {
                          setDetailList(userReviews);
                          setSelectedReviewIndex(index);
                          setIsDetailViewOpen(true);
                        }}
                        className="aspect-square bg-black/40 relative group cursor-pointer overflow-hidden border border-white/5"
                      >
                        {review.images && review.images.length > 0 ? (
                          <img 
                            src={review.images[0]} 
                            alt="Post" 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                            referrerPolicy="no-referrer"
                          />
                        ) : review.category === 'sons' && review.musicData?.artworkUrl && review.musicData.artworkUrl !== 'placeholder:sons' ? (
                          <img 
                            src={review.musicData.artworkUrl} 
                            alt="Música" 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className={`w-full h-full flex flex-col items-center justify-center p-3 text-center transition-all group-hover:scale-105 ${
                            review.category === 'larica' ? 'bg-orange-500/20' : 
                            review.category === 'filme' ? 'bg-amber-500/20' : 
                            review.category === 'brisas' ? 'bg-green-500/20' : 
                            review.category === 'sons' ? 'bg-indigo-500/20' : 'bg-gray-800/20'
                          }`}>
                            {review.category === 'larica' && <IceCream size={20} className="text-orange-400 mb-1" />}
                            {review.category === 'filme' && <Film size={20} className="text-amber-400 mb-1" />}
                            {review.category === 'brisas' && <Wind size={20} className="text-green-400 mb-1" />}
                            {review.category === 'sons' && <Music size={20} className="text-indigo-400 mb-1" />}
                            <span className="text-[7px] font-black uppercase tracking-tighter text-white/40 line-clamp-2 px-1">
                              {review.title}
                            </span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                          <span className="text-[8px] font-black uppercase tracking-widest text-white bg-moss-500/80 px-2 py-1 rounded">
                            {review.category}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20 bg-white/2 rounded-3xl mt-2 border border-dashed border-white/5 mx-2">
                    <Ghost size={40} className="mx-auto text-gray-800 mb-4" />
                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest italic">O silêncio reina por aqui...</p>
                    <p className="text-[8px] text-gray-700 mt-1">Nenhum relato postado nessa frequência.</p>
                  </div>
                )
              )}

              {activeTab === 'salvos' && isMe && (
                savedReviews.length > 0 ? (
                  <div className="grid grid-cols-3 gap-[1px]">
                    {savedReviews.map((review, index) => (
                      <div 
                        key={review.id} 
                        onClick={() => {
                          setDetailList(savedReviews);
                          setSelectedReviewIndex(index);
                          setIsDetailViewOpen(true);
                        }}
                        className="aspect-square bg-black/40 relative group cursor-pointer overflow-hidden border border-white/5"
                      >
                        {review.images && review.images.length > 0 ? (
                          <img 
                            src={review.images[0]} 
                            alt="Saved Post" 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                            referrerPolicy="no-referrer"
                          />
                        ) : review.category === 'sons' && review.musicData?.artworkUrl && review.musicData.artworkUrl !== 'placeholder:sons' ? (
                          <img 
                            src={review.musicData.artworkUrl} 
                            alt="Saved Music" 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className={`w-full h-full flex flex-col items-center justify-center p-3 text-center transition-all group-hover:scale-105 ${
                            review.category === 'larica' ? 'bg-orange-500/20' : 
                            review.category === 'filme' ? 'bg-amber-500/20' : 
                            review.category === 'brisas' ? 'bg-green-500/20' : 
                            review.category === 'sons' ? 'bg-indigo-500/20' : 'bg-gray-800/20'
                          }`}>
                            {review.category === 'larica' && <IceCream size={20} className="text-orange-400 mb-1" />}
                            {review.category === 'filme' && <Film size={20} className="text-amber-400 mb-1" />}
                            {review.category === 'brisas' && <Wind size={20} className="text-green-400 mb-1" />}
                            {review.category === 'sons' && <Music size={20} className="text-indigo-400 mb-1" />}
                            <span className="text-[7px] font-black uppercase tracking-tighter text-white/40 line-clamp-2 px-1">
                              {review.title}
                            </span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                          <span className="text-[8px] font-black uppercase tracking-widest text-white bg-moss-500/80 px-2 py-1 rounded">
                            {review.category}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20 bg-white/2 rounded-3xl mt-2 border border-dashed border-white/5 mx-2">
                    <Pin size={40} className="mx-auto text-gray-800 mb-4" />
                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest italic">Sua estante está vazia</p>
                    <p className="text-[8px] text-gray-700 mt-1">Fixe relatos do feed para brisar neles mais tarde.</p>
                  </div>
                )
              )}

            </section>

            {/* Sintonia (Friends Section) */}
            <section className="mb-24 px-6">
              <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-2">
                <h2 className="text-[10px] uppercase tracking-[0.2em] font-black text-moss-500">Sintonias</h2>
                <span className="text-[10px] font-black text-gray-500 uppercase">{sintoniaProfiles.length} Conexões</span>
              </div>
              
              <div className="flex gap-6 overflow-x-auto pb-6 no-scrollbar snap-x">
                {sintoniaProfiles.length > 0 ? (
                  sintoniaProfiles.map((follower) => (
                    <motion.div 
                      key={follower.uid}
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      className="flex-shrink-0 w-24 flex flex-col items-center snap-center group"
                    >
                      <Link to={`/profile/${follower.handle.replace('@', '')}`} className="relative mb-3">
                        <div className="absolute inset-0 bg-moss-500/20 blur-xl rounded-full scale-0 group-hover:scale-150 transition-transform duration-500" />
                        <UserAvatar 
                          styles={follower.avatarStyles} 
                          seed={follower.handle} 
                          size="lg" 
                          className="relative border-2 border-white/5 group-hover:border-moss-500 transition-colors shadow-2xl active:scale-90"
                        />
                        <div className="absolute -bottom-1 -right-1 bg-moss-500 text-[8px] font-black p-1 rounded-md border-2 border-smog-900 shadow-lg text-white">
                          <Zap size={8} className="fill-current" />
                        </div>
                      </Link>
                      <h4 className="text-[10px] font-black text-white uppercase tracking-tighter truncate w-full text-center group-hover:text-moss-400 transition-colors">
                        {follower.displayName}
                      </h4>
                      <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest truncate w-full text-center">
                        {follower.handle}
                      </p>
                    </motion.div>
                  ))
                ) : (
                  <div className="w-full text-center py-12 bg-white/2 rounded-[40px] border border-dashed border-white/5 flex flex-col items-center justify-center gap-3">
                    <Activity size={24} className="text-gray-800 animate-pulse" />
                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest italic">{isMe ? "Você ainda não tem sintonias..." : "Sem sintonias visíveis..."}</p>
                    <p className="text-[8px] text-gray-700">A vibração por aqui está neutra.</p>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>

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
                    onClick={() => {
                      const review = userReviews.find(r => r.id === isDeleting);
                      if (review) {
                        deleteReview(isDeleting, review.category);
                      } else {
                        // Fallback if not found in userReviews (maybe saved)
                        const savedReview = savedReviews.find(r => r.id === isDeleting);
                        deleteReview(isDeleting, savedReview?.category || 'brisas');
                      }
                    }}
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
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Relato de {currentList.find(r => r.id === activeCommentsId)?.userName}</p>
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
                      const avatarStylesVal = liveProfile?.avatarStyles || (comment as any).userAvatarStyles || (handleVal === myProfile?.handle ? myProfile?.avatarStyles : null);
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
                              {user?.uid !== commenterId && (
                                <button 
                                  onClick={() => setReportModal({ id: comment.id, type: 'comment', content: comment.text, targetUserId: comment.userId })}
                                  className="text-gray-600 hover:text-red-500 transition-colors ml-1"
                                  title="Reportar"
                                >
                                  <Flag size={12} />
                                </button>
                              )}
                              {(isAdmin || user?.uid === commenterId) && (
                                <button 
                                  onClick={() => handleDeleteComment(comment.id)}
                                  className="text-gray-600 hover:text-red-500 transition-colors ml-1"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                            <p className="text-sm text-gray-300 leading-relaxed italic">{comment.text}</p>
                          </div>
                        </motion.div>
                      );
                    })
                  ) : (
                    <div className="text-center py-10 opacity-30 italic text-sm">Seja o primeiro a brisar aqui...</div>
                  )}
                </AnimatePresence>
              </div>

              <div className="bg-white/5 p-4 rounded-[24px] border border-white/10 flex items-center gap-4 transition-all focus-within:border-moss-500/50">
                <div className="w-8 h-8 rounded-lg bg-moss-900 border border-white/10 overflow-hidden">
                  <img src={myProfile?.photoURL || `https://api.dicebear.com/9.x/avataaars/svg?seed=${user?.uid}`} alt="Me" />
                </div>
                <input 
                  type="text" 
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addComment(activeCommentsId)}
                  placeholder="Escreva sua brisa aqui..."
                  className="bg-transparent flex-1 outline-none text-sm text-white placeholder:text-gray-600 font-medium"
                />
                <button 
                  onClick={() => addComment(activeCommentsId)}
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
        {reportModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReportModal(null)}
              className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-md"
            />
            <div className="fixed inset-0 z-[410] flex items-center justify-center p-6 pointer-events-none">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-[#0f0f0f] border border-white/10 p-8 rounded-[40px] max-w-sm w-full shadow-2xl pointer-events-auto"
              >
                <div className="bg-orange-500/10 w-16 h-16 rounded-full flex items-center justify-center mb-6 mx-auto">
                  <AlertTriangle size={32} className="text-orange-500" />
                </div>
                <h3 className="text-xl font-black text-white text-center uppercase tracking-tighter mb-2">
                  Denunciar {reportModal.type === 'post' ? 'Relato' : 'Comentário'}
                </h3>
                <p className="text-gray-400 text-center text-sm mb-6 leading-relaxed italic">
                  Ajude o FeedBECK a ser um espaço seguro. Por que você está denunciando este conteúdo?
                </p>
                
                <textarea 
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Descreva o motivo (ex: inapropriado, spam, ofensivo...)"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-moss-500/50 transition-colors mb-6 min-h-[100px] resize-none"
                />

                <div className="flex flex-col gap-3">
                  <button 
                    onClick={handleReport}
                    disabled={!reportReason.trim() || reportLoading}
                    className="w-full bg-moss-500 hover:bg-moss-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs transition-all shadow-lg shadow-moss-900/20 disabled:opacity-50"
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
    </div>

  );
}
