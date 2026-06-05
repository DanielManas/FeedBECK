/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, ChevronLeft, MessageSquare, Clock, CheckCircle2, 
  AlertCircle, X, User, BarChart3, Users, FileText, 
  Trash2, Eye, Search as SearchIcon, Filter, MoreVertical,
  Activity, ArrowUpRight, Flag
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, query, orderBy, onSnapshot, doc, 
  updateDoc, deleteDoc, limit, getCountFromServer,
  where, getDocs
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/utils/firestore';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatRelativeTime = (date: any) => {
  if (!date) return '...';
  const d = date instanceof Date ? date : (date.toDate ? date.toDate() : new Date(date));
  return formatDistanceToNow(d, { locale: ptBR, addSuffix: true });
};

interface Ticket {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  title: string;
  description: string;
  status: 'open' | 'closed' | 'in_progress';
  createdAt: string;
}

interface UserProfile {
  uid: string;
  handle: string;
  displayName: string;
  email?: string;
  createdAt: string;
  postsCount: number;
  banInfo?: {
    isBanned: boolean;
    reason: string;
    expiresAt: string;
    bannedAt: string;
  };
}

interface Review {
  id: string;
  title: string;
  authorHandle: string;
  category: string;
  createdAt: string;
}

interface Report {
  id: string;
  targetId: string;
  targetUserId: string;
  targetType: 'post' | 'comment';
  reason: string;
  reporterId: string;
  reporterHandle: string;
  targetContent: string;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: any;
}

export default function AdminDashboard() {
  const { user: authUser, isAdmin } = useAuth();
  const navigate = useNavigate();
  
  // State
  const [activeTab, setActiveTab] = useState<'moderation' | 'reports' | 'users' | 'content' | 'tools'>('moderation');
  const [loading, setLoading] = useState(true);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalReviews: 0,
    totalTickets: 0,
    openTickets: 0,
    pendingReports: 0,
    orphanUsers: 0
  });

  // Data
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [recentReviews, setRecentReviews] = useState<Review[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [banModal, setBanModal] = useState<UserProfile | null>(null);
  const [bannedInfoModal, setBannedInfoModal] = useState<UserProfile | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banDuration, setBanDuration] = useState('24h');
  const [searchTerm, setSearchTerm] = useState('');
  const [targetHandle, setTargetHandle] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteUserUid, setConfirmDeleteUserUid] = useState<string | null>(null);

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    if (!bannedInfoModal) return;
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, [bannedInfoModal]);

  const getTimeRemaining = (expiresAt: string | undefined) => {
    if (!expiresAt) return 'Permanente';
    const expiry = new Date(expiresAt).getTime();
    const remaining = expiry - currentTime.getTime();
    
    if (remaining <= 0) return 'Expirado';

    // If duration is more than 50 years, consider it permanent for display
    if (remaining > 50 * 365 * 24 * 60 * 60 * 1000) return 'Permanente';

    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((remaining / 1000 / 60) % 60);
    const seconds = Math.floor((remaining / 1000) % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);

    return parts.join(' ');
  };

  const addLog = (msg: string) => {
    setDebugLog(prev => [msg, ...prev].slice(0, 5));
    setTimeout(() => {
      setDebugLog(prev => prev.filter(m => m !== msg));
    }, 3000);
  };

  const deleteUserProfileByHandle = async (targetHandle: string) => {
    const clean = targetHandle.startsWith('@') ? targetHandle : `@${targetHandle}`;
    addLog(`BUSCANDO HANDLE: ${clean}`);
    try {
      const q = query(collection(db, 'users'), where('handle', '==', clean));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        addLog('HANDLE NÃO ENCONTRADO');
        alert('Este handle não foi encontrado na base de dados.');
        return;
      }

      const foundCount = snap.size;
      if (!window.confirm(`Encontrado(s) ${foundCount} perfil(is) com o handle ${clean}. Excluir permanentemente?`)) return;

      for (const d of snap.docs) {
        await deleteDoc(d.ref);
        addLog(`EXCLUÍDO: ${d.id.slice(0,8)}`);
      }
      
      alert('Handle(s) removido(s) com sucesso. Agora deve estar livre para uso.');
      updateCounts();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users_handle_${targetHandle}`);
    }
  };

  // 4. Get total counts (only once or periodically)
  const updateCounts = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const allUsers = querySnapshot.docs.map(d => ({ uid: d.id, ...d.data() } as any));
      
      // A user is "Real" if they have an email field OR if they were created via the proper onboarding
      // Guests/Orphans usually have no email and handle '@anonimo'
      const realUsers = allUsers.filter(u => u.email && u.email.trim() !== '');
      const orphans = allUsers.length - realUsers.length;
      
      const reviewsCount = await getCountFromServer(collection(db, 'reviews'));

      setStats(prev => ({
        ...prev,
        totalUsers: realUsers.length,
        totalReviews: reviewsCount.data().count,
        orphanUsers: orphans
      }));
      
      setLoading(false);
    } catch (err) {
      console.error('Error fetching dashboard counts:', err);
    }
  };

  useEffect(() => {
    if (!authUser || !isAdmin) return;

    // 1. Listen for tickets
    const qTickets = query(collection(db, 'support_tickets'), orderBy('createdAt', 'desc'));
    const unsubTickets = onSnapshot(qTickets, (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as Ticket));
      setTickets(list);
      setStats(prev => ({ 
        ...prev, 
        totalTickets: list.length,
        openTickets: list.filter(t => t.status === 'open').length 
      }));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'support_tickets'));

    // 1.5 Listen for reports
    const qReports = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    const unsubReports = onSnapshot(qReports, (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as Report));
      setReports(list);
      setStats(prev => ({
        ...prev,
        pendingReports: list.filter(r => r.status === 'pending').length
      }));
    });

    // 2. Load recent users
    const qUsers = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(50));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      setUsers(snap.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile)));
    });

    // 3. Load recent reviews
    const qReviews = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(100));
    const unsubReviews = onSnapshot(qReviews, (snap) => {
      const docs = snap.docs.map(d => ({ ...d.data(), id: d.id } as Review));
      console.log('ADMIN: Loaded reviews count:', docs.length);
      if (docs.length > 0) {
        console.log('ADMIN: First review sample:', { id: docs[0].id, title: docs[0].title });
      }
      setRecentReviews(docs);
    });

    updateCounts();

    return () => {
      unsubTickets();
      unsubReports();
      unsubUsers();
      unsubReviews();
    };
  }, [authUser, isAdmin]);

  const [cleanupConfirm, setCleanupConfirm] = useState(false);

  const handleCleanupAnonymous = async () => {
    setCleanupLoading(true);
    addLog('INICIANDO LIMPEZA TOTAL...');
    console.log('DEBUG: Starting cleanup process');
    
    try {
      let deletedProfilesCount = 0;
      let deletedReviewsCount = 0;
      
      addLog('BUSCANDO USUÁRIOS...');
      // 1. Fetch all users to identify EVERY anonymous profile
      const allUsersSnap = await getDocs(collection(db, 'users'));
      console.log(`DEBUG: Fetched ${allUsersSnap.docs.length} total user docs`);
      addLog(`TOTAL: ${allUsersSnap.docs.length} DOCUMENTOS`);
      
      const anonymousUsers = allUsersSnap.docs.filter(d => {
        const data = d.data();
        const hasEmail = data.email && typeof data.email === 'string' && data.email.trim() !== '';
        return !hasEmail;
      });

      console.log(`DEBUG: Found ${anonymousUsers.length} anonymous profiles`);

      if (anonymousUsers.length === 0) {
        addLog('NADA PARA LIMPAR');
        alert('Nenhum perfil de convidado encontrado para remover.');
        setCleanupLoading(false);
        setCleanupConfirm(false);
        return;
      }

      addLog(`REMOVENDO ${anonymousUsers.length} PERFIS...`);

      for (const userDoc of anonymousUsers) {
        const uid = userDoc.id;
        console.log(`DEBUG: Deleting user ${uid}`);
        
        // 2. Delete user's reviews
        try {
          const reviewsQuery = query(collection(db, 'reviews'), where('authorId', '==', uid));
          const reviewsSnap = await getDocs(reviewsQuery);
          
          for (const reviewDoc of reviewsSnap.docs) {
            await deleteDoc(reviewDoc.ref);
            deletedReviewsCount++;
          }
        } catch (e) {
          console.error(`Error deleting reviews for user ${uid}:`, e);
          addLog(`ERRO POSTS: ${uid.slice(0,5)}`);
        }

        // 3. Delete user profile
        await deleteDoc(userDoc.ref);
        deletedProfilesCount++;
        
        if (deletedProfilesCount % 5 === 0 || deletedProfilesCount === anonymousUsers.length) {
          addLog(`${deletedProfilesCount}/${anonymousUsers.length} CONCLUÍDOS`);
        }
      }
      
      addLog(`SUCESSO: ${deletedProfilesCount} PERFIS REMOVIDOS`);
      alert(`${deletedProfilesCount} perfis de convidados e ${deletedReviewsCount} publicações foram excluídos da base de dados.`);
      
      // Refresh statistics
      await updateCounts();
      
      // Update local state
      setUsers(prev => prev.filter(u => !!u.email));
    } catch (err) {
      console.error('Cleanup error:', err);
      addLog('ERRO NA LIMPEZA');
      alert('Erro ao realizar limpeza. Verifique se você tem as permissões necessárias e tente novamente.');
    } finally {
      setCleanupLoading(false);
      setCleanupConfirm(false);
    }
  };

  const updateReportStatus = async (reportId: string, status: 'pending' | 'resolved' | 'dismissed') => {
    try {
      await updateDoc(doc(db, 'reports', reportId), { status });
      if (selectedReport?.id === reportId) {
        setSelectedReport(prev => prev ? { ...prev, status } : null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reports/${reportId}`);
    }
  };

  const deleteReport = async (reportId: string) => {
    if (!window.confirm('Excluir este registro de denúncia?')) return;
    try {
      await deleteDoc(doc(db, 'reports', reportId));
      setSelectedReport(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `reports/${reportId}`);
    }
  };

  const updateTicketStatus = async (ticketId: string, status: 'open' | 'closed' | 'in_progress') => {
    try {
      await updateDoc(doc(db, 'support_tickets', ticketId), { status });
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(prev => prev ? { ...prev, status } : null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `support_tickets/${ticketId}`);
    }
  };

  const handleBanUser = async () => {
    if (!banModal) return;
    
    let expiresAt: Date | null = null;
    const now = new Date();
    
    if (banDuration === '24h') expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    else if (banDuration === '7d') expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    else if (banDuration === '30d') expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    else if (banDuration === 'permanent') expiresAt = new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000);

    try {
      await updateDoc(doc(db, 'users', banModal.uid), {
        banInfo: {
          isBanned: true,
          reason: banReason,
          expiresAt: expiresAt?.toISOString(),
          bannedAt: now.toISOString()
        }
      });
      setBanModal(null);
      setBanReason('');
      alert(`Usuário ${banModal.handle} banido com sucesso.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${banModal.uid}`);
    }
  };

  const handleUnbanUser = async (user: UserProfile) => {
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        banInfo: {
          isBanned: false,
          reason: '',
          expiresAt: null,
          bannedAt: null
        }
      });
      addLog(`USUÁRIO DESBANIDO: ${user.handle}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const deleteTicket = async (id: string) => {
    addLog(`INIT TICKET DELETE: ${id.substring(0,8)}`);
    
    if (!id) {
      addLog('ERRO: ID MISSING');
      return;
    }
    
    try {
      addLog('DELETING TICKET...');
      await deleteDoc(doc(db, 'support_tickets', id));
      
      setSelectedTicket(null);
      setConfirmDeleteId(null);
      addLog('TICKET DELETED');
    } catch (err) {
      console.error('deleteTicket Error:', err);
      addLog('ERROR DELETING TICKET');
      handleFirestoreError(err, OperationType.DELETE, `support_tickets/${id}`);
    }
  };

  const deleteUserProfile = async (uid: string) => {
    addLog(`DELETING USER: ${uid.substring(0,8)}`);
    try {
      await deleteDoc(doc(db, 'users', uid));
      setUsers(prev => prev.filter(u => u.uid !== uid));
      setConfirmDeleteUserUid(null);
      addLog('USER DELETED');
      updateCounts();
    } catch (err) {
      addLog('ERROR DELETING USER');
      handleFirestoreError(err, OperationType.DELETE, `users/${uid}`);
    }
  };

  const deleteReview = async (id: string) => {
    console.log('--- ADMIN DELETE ACTION START ---');
    addLog(`INIT DELETE: ${id.substring(0,8)}`);
    
    if (!id) {
      addLog('ERRO: ID MISSING');
      return;
    }
    
    try {
      addLog('CALLING FIRESTORE...');
      await deleteDoc(doc(db, 'reviews', id));
      addLog('FIRESTORE SUCCESS');
      
      setRecentReviews(prev => prev.filter(r => r.id !== id));
      setStats(prev => ({ ...prev, totalReviews: Math.max(0, prev.totalReviews - 1) }));
      setConfirmDeleteId(null);
      addLog('DELETED SUCCESSFULLY');
    } catch (err) {
      console.error('deleteReview: FATAL ERROR:', err);
      addLog('FATAL ERROR: ' + (err instanceof Error ? err.message : 'Unknown'));
      handleFirestoreError(err, OperationType.DELETE, `reviews/${id}`);
    }
  };

  const formatDate = (date: any) => {
    if (!date) return '...';
    try {
      const d = date.toDate ? date.toDate() : new Date(date);
      return d.toLocaleDateString('pt-BR');
    } catch (e) {
      return 'Data inválida';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <AlertCircle className="text-orange-400" size={16} />;
      case 'in_progress': return <Clock className="text-blue-400" size={16} />;
      case 'closed': return <CheckCircle2 className="text-green-400" size={16} />;
      default: return <AlertCircle className="text-gray-400" size={16} />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: any = {
      open: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      in_progress: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      closed: 'bg-green-500/10 text-green-400 border-green-500/20'
    };
    return (
      <span className={`text-[9px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full border ${styles[status]}`}>
        {status === 'open' ? 'Pendente' : status === 'in_progress' ? 'Em Análise' : 'Resolvido'}
      </span>
    );
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-smog-950 p-6 text-center">
        <div>
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mx-auto mb-4">
            <Shield size={32} />
          </div>
          <h1 className="text-xl font-black text-white uppercase tracking-tighter italic">Acesso Restrito</h1>
          <p className="text-sm text-gray-500 mt-2">Você não possui permissão para acessar esta área.</p>
          <button onClick={() => navigate('/')} className="mt-6 px-6 py-3 bg-moss-500 text-white rounded-2xl font-bold uppercase tracking-widest text-xs">Voltar</button>
        </div>
      </div>
    );
  }

  const isActuallyBanned = (user: UserProfile) => {
    const now = new Date();
    return user.banInfo?.isBanned && (
      !user.banInfo.expiresAt || new Date(user.banInfo.expiresAt) > now
    );
  };

  const filteredUsers = users.filter(u => 
    u.handle.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => {
    const aBanned = isActuallyBanned(a) ? 1 : 0;
    const bBanned = isActuallyBanned(b) ? 1 : 0;
    return bBanned - aBanned;
  });

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setSearchLoading(true);
    try {
      // Search by handle
      const hQuery = query(collection(db, 'users'), where('handle', '==', searchTerm.startsWith('@') ? searchTerm : `@${searchTerm}`));
      const hSnap = await getDocs(hQuery);
      
      // Also search by UID just in case
      const uDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', searchTerm)));
      
      const foundUsers = [...hSnap.docs, ...uDoc.docs].map(d => ({ ...d.data(), uid: d.id } as UserProfile));
      
      if (foundUsers.length > 0) {
        // Merge with existing list and remove duplicates
        setUsers(prev => {
          const combined = [...foundUsers, ...prev];
          const unique = combined.filter((v, i, a) => a.findIndex(t => t.uid === v.uid) === i);
          return unique;
        });
        addLog(`BUSCA: ${foundUsers.length} ENCONTRADO(S)`);
      } else {
        addLog('BUSCA: NENHUM RESULTADO');
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  const filteredReviews = recentReviews.filter(r => 
    r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.authorHandle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  console.log('AdminDashboard Render:', { 
    activeTab, 
    totalRecent: recentReviews.length, 
    filtered: filteredReviews.length,
    isAdmin 
  });

  return (
    <div className="min-h-screen bg-smog-950 pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-smog-950/80 backdrop-blur-xl border-b border-moss-500/10 px-6 py-4">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-moss-400 hover:bg-white/5 rounded-xl transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-black text-white uppercase tracking-tighter italic leading-tight">Admin Dashboard</h1>
            <p className="text-[10px] text-moss-500 font-bold uppercase tracking-widest leading-none">Painel de Controle Principal</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-full">
              <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">Master</span>
            </div>
          </div>
        </div>

        {/* Hero Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white/5 border border-white/5 p-4 rounded-[24px]">
            <div className="flex items-center justify-between mb-2">
              <Users size={14} className="text-moss-400" />
              {stats.orphanUsers > 0 && (
                <div 
                  onClick={() => {
                    setActiveTab('tools');
                    setTimeout(() => {
                      document.getElementById('cleanup-tool')?.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                  }}
                  className="px-1.5 py-0.5 bg-red-500/10 border border-red-500/20 rounded-md animate-pulse cursor-pointer group flex items-center gap-1"
                  title={`${stats.orphanUsers} perfis órfãos detectados`}
                >
                  <span className="text-[7px] font-black text-red-500">LIMPAR {stats.orphanUsers}</span>
                </div>
              )}
            </div>
            <p className="text-2xl font-black text-white tracking-tighter italic">{stats.totalUsers}</p>
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest leading-none mt-1">Usuários Reais</p>
          </div>
          <div className="bg-white/5 border border-white/5 p-4 rounded-[24px]">
            <div className="flex items-center justify-between mb-2">
              <FileText size={14} className="text-purple-400" />
              <ArrowUpRight size={12} className="text-purple-500/50" />
            </div>
            <p className="text-2xl font-black text-white tracking-tighter italic">{stats.totalReviews}</p>
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Relatos</p>
          </div>
          <div className="bg-white/5 border border-white/5 p-4 rounded-[24px]">
            <div className="flex items-center justify-between mb-2">
              <AlertCircle size={14} className="text-orange-400" />
              {stats.pendingReports > 0 && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
            </div>
            <p className="text-2xl font-black text-white tracking-tighter italic">{stats.pendingReports}</p>
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Denúncias</p>
          </div>
          <div className="bg-white/5 border border-white/5 p-4 rounded-[24px]">
            <div className="flex items-center justify-between mb-2">
              <MessageSquare size={14} className="text-orange-400" />
            </div>
            <p className="text-2xl font-black text-white tracking-tighter italic">{stats.openTickets}</p>
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Tickets</p>
          </div>
        </div>

        {/* Tabs Grid */}
        <div className="grid grid-cols-2 gap-2 mt-6">
          <button 
            onClick={() => setActiveTab('reports')}
            className={`flex items-center justify-center gap-2 px-4 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${
              activeTab === 'reports' ? 'bg-moss-500 text-white shadow-lg shadow-moss-900/20' : 'bg-white/5 text-gray-500 hover:bg-white/10'
            }`}
          >
            <Flag size={14} /> Denúncias {stats.pendingReports > 0 && <span className="bg-red-500 text-white px-1.5 rounded-full text-[8px]">{stats.pendingReports}</span>}
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`flex items-center justify-center gap-2 px-4 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${
              activeTab === 'users' ? 'bg-moss-500 text-white shadow-lg shadow-moss-900/20' : 'bg-white/5 text-gray-500 hover:bg-white/10'
            }`}
          >
            <Users size={14} /> Usuários
          </button>
          <button 
            onClick={() => setActiveTab('content')}
            className={`flex items-center justify-center gap-2 px-4 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${
              activeTab === 'content' ? 'bg-moss-500 text-white shadow-lg shadow-moss-900/20' : 'bg-white/5 text-gray-500 hover:bg-white/10'
            }`}
          >
            <FileText size={14} /> Conteúdo
          </button>
          <button 
            onClick={() => setActiveTab('moderation')}
            className={`flex items-center justify-center gap-2 px-4 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${
              activeTab === 'moderation' ? 'bg-moss-500 text-white shadow-lg shadow-moss-900/20' : 'bg-white/5 text-gray-500 hover:bg-white/10'
            }`}
          >
            <MessageSquare size={14} /> Suporte {stats.openTickets > 0 && <span className="bg-red-500 text-white px-1.5 rounded-full text-[8px]">{stats.openTickets}</span>}
          </button>
          <button 
            onClick={() => setActiveTab('tools')}
            className={`flex items-center justify-center gap-2 px-4 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all border border-dashed ${
              activeTab === 'tools' ? 'border-moss-500 bg-moss-500/10 text-moss-400' : 'border-white/5 text-gray-600 hover:border-white/20'
            }`}
          >
            <Activity size={14} /> Ferramentas
          </button>
        </div>
      </header>

      <main className="p-6">
        {/* Search Bar for Users/Content Tabs */}
          <div className="relative mb-6 flex gap-2">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={16} />
              <input 
                type="text"
                placeholder={activeTab === 'users' ? "Buscar usuário (handle ou @handle)..." : "Buscar publicações..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-sm text-white focus:outline-none focus:border-moss-500/50 transition-colors"
              />
            </div>
            {activeTab === 'users' && (
              <button 
                onClick={handleSearch}
                disabled={searchLoading}
                className="px-6 bg-moss-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-moss-400 transition-all disabled:opacity-50"
              >
                {searchLoading ? '...' : <SearchIcon size={18} />}
              </button>
            )}
          </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-12 h-12 border-4 border-moss-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="wait">
              {/* REPORTS TAB */}
              {activeTab === 'reports' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  {reports.length === 0 ? (
                    <div className="text-center py-24 opacity-40">
                      <CheckCircle2 size={64} className="text-moss-400 mx-auto mb-4" />
                      <p className="text-white font-black uppercase tracking-widest text-xs">Sem denúncias!</p>
                    </div>
                  ) : (
                    reports.map((report) => (
                      <motion.div 
                        key={report.id}
                        layoutId={report.id}
                        onClick={() => setSelectedReport(report)}
                        className={`glass-card rounded-[32px] p-5 border transition-all cursor-pointer group ${
                          report.status === 'pending' ? 'border-red-500/20 hover:border-red-500/50' : 'border-white/5 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                             <div className={`text-[8px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full border ${
                               report.status === 'pending' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 
                               report.status === 'resolved' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                               'bg-gray-500/10 text-gray-400 border-gray-500/20'
                             }`}>
                               {report.status}
                             </div>
                             <span className="text-[8px] font-black uppercase tracking-widest text-white/40 bg-white/5 px-2 py-0.5 rounded-full">
                               {report.targetType}
                             </span>
                          </div>
                          <span className="text-[8px] font-mono text-gray-600 uppercase tracking-tighter">
                            {formatRelativeTime(report.createdAt)}
                          </span>
                        </div>
                        
                        <h3 className="text-white font-black uppercase tracking-tighter truncate mb-1">
                          {report.reason}
                        </h3>
                        <p className="text-[10px] text-gray-500 line-clamp-1 leading-relaxed mb-4 italic italic">
                          "{(report.targetContent || '').substring(0, 50)}..."
                        </p>

                        <div className="flex items-center justify-between pt-4 border-t border-white/5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-moss-400 tracking-tighter uppercase truncate max-w-[120px]">
                              por {report.reporterHandle}
                            </span>
                          </div>
                          <button className="text-[9px] font-black uppercase tracking-widest text-moss-400 group-hover:translate-x-1 transition-transform">
                            Revisar Denúncia →
                          </button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </motion.div>
              )}

              {/* MODERATION TAB (now Support Tickets) */}
              {activeTab === 'moderation' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  {tickets.length === 0 ? (
                    <div className="text-center py-24 opacity-40">
                      <CheckCircle2 size={64} className="text-moss-400 mx-auto mb-4" />
                      <p className="text-white font-black uppercase tracking-widest text-xs">Tudo Limpo!</p>
                      <p className="text-xs text-gray-400 mt-2">Nenhuma denúncia pendente.</p>
                    </div>
                  ) : (
                    tickets.map((ticket) => (
                      <motion.div 
                        key={ticket.id}
                        layoutId={ticket.id}
                        onClick={() => setSelectedTicket(ticket)}
                        className="glass-card rounded-[32px] p-5 border border-white/5 hover:border-moss-500/30 transition-all cursor-pointer group"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(ticket.status)}
                            {getStatusBadge(ticket.status)}
                          </div>
                          <span className="text-[8px] font-mono text-gray-600 uppercase tracking-tighter">
                            {formatDate(ticket.createdAt)}
                          </span>
                        </div>
                        
                        <h3 className="text-white font-black uppercase tracking-tighter truncate mb-1">
                          {ticket.title}
                        </h3>
                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-4 italic">
                          "{ticket.description}"
                        </p>

                        <div className="flex items-center justify-between pt-4 border-t border-white/5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-moss-500/20 rounded-lg flex items-center justify-center text-moss-400">
                              <User size={12} />
                            </div>
                            <span className="text-[10px] font-bold text-moss-400 tracking-tighter uppercase truncate max-w-[120px]">
                              {ticket.userName}
                            </span>
                          </div>
                          <button className="text-[9px] font-black uppercase tracking-widest text-moss-400 group-hover:translate-x-1 transition-transform">
                            Ver Detalhes →
                          </button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </motion.div>
              )}

              {/* USERS TAB */}
              {activeTab === 'users' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3"
                >
                  {filteredUsers.map((u) => (
                    <div key={u.uid} className="bg-white/5 border border-white/5 rounded-[24px] p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                        <div className="w-10 h-10 bg-moss-500/20 rounded-full flex items-center justify-center text-moss-400 shrink-0">
                           <User size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-white font-black uppercase tracking-tighter italic text-xs leading-none mb-1.5 flex flex-wrap items-center gap-1.5">
                            <span className="truncate">{u.displayName}</span>
                            {isActuallyBanned(u) && (
                              <span className="text-[7px] bg-red-500 text-white px-1 py-0.5 rounded shadow-lg animate-pulse shrink-0">Banido</span>
                            )}
                            {!u.email && (
                              <span className="text-[7px] bg-gray-500/50 text-gray-200 px-1 py-0.5 rounded uppercase font-black tracking-widest border border-white/10 shrink-0">Anon</span>
                            )}
                          </p>
                          <p className="text-[10px] text-moss-400 font-bold uppercase tracking-widest leading-none truncate mb-1">
                            {u.handle}
                          </p>
                          {u.email && (
                            <p className="text-[8px] text-gray-500 font-mono break-all leading-tight normal-case">
                              {u.email}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                         <div className="text-right mr-2 hidden sm:block">
                            <p className="text-[8px] text-gray-600 font-black uppercase leading-none mb-1">Posts</p>
                            <p className="text-xs text-white font-bold">{u.postsCount || 0}</p>
                         </div>
                         <button 
                            onClick={() => navigate(`/profile/${u.handle.replace("@", "")}`)}
                            className="p-2 bg-white/5 rounded-xl text-gray-400 hover:text-white"
                          >
                           <Eye size={16} />
                         </button>
                         <button 
                            onClick={isActuallyBanned(u) ? () => setBannedInfoModal(u) : () => setBanModal(u)}
                            className={`p-2 rounded-xl transition-all ${isActuallyBanned(u) ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-white/5 text-gray-600 hover:text-red-500'}`}
                            title={isActuallyBanned(u) ? 'Detalhes do Banimento' : 'Banir Usuário'}
                          >
                           <Shield size={16} />
                         </button>
                         <button 
                            onClick={() => {
                              if (confirmDeleteUserUid === u.uid) {
                                deleteUserProfile(u.uid);
                              } else {
                                setConfirmDeleteUserUid(u.uid);
                                setTimeout(() => setConfirmDeleteUserUid(null), 3000);
                              }
                            }}
                             className={`p-2 rounded-xl transition-all ${confirmDeleteUserUid === u.uid ? 'bg-red-600 text-white animate-pulse' : 'bg-white/5 text-gray-600 hover:text-red-500'}`}
                             title="Excluir Perfil Permanentemente"
                           >
                            {confirmDeleteUserUid === u.uid ? <CheckCircle2 size={16} /> : <Trash2 size={16} />}
                          </button>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}

              {/* CONTENT TAB */}
              {activeTab === 'content' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3"
                >
                  {filteredReviews.map((r) => (
                    <div key={r.id} className="bg-white/5 border border-white/5 rounded-[32px] p-6 flex flex-col gap-4 shadow-xl relative z-10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <span className="p-1 px-2 bg-moss-500/10 text-moss-400 text-[8px] font-black uppercase rounded-full border border-moss-500/20">
                              {r.category}
                           </span>
                           <span className="text-[8px] font-mono text-gray-600">
                             {formatDate(r.createdAt)}
                           </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            type="button"
                            onClick={() => {
                              navigate(`/post-view/${r.id}`);
                            }}
                            className="w-14 h-14 bg-white/5 text-gray-400 hover:text-moss-400 rounded-2xl flex items-center justify-center border border-white/5 active:scale-90 transition-all shadow-lg active:bg-white/10 touch-manipulation"
                            style={{ WebkitTapHighlightColor: 'transparent' }}
                            title="Visualizar Publicação"
                          >
                            <Eye size={24} />
                          </button>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              
                              if (confirmDeleteId === r.id) {
                                addLog(`CONFIRMED: ${r.id.substring(0,6)}`);
                                deleteReview(r.id);
                              } else {
                                addLog(`CONFIRM MODE: ${r.id.substring(0,6)}`);
                                setConfirmDeleteId(r.id);
                                // Auto-reset after 3 seconds if not clicked again
                                setTimeout(() => setConfirmDeleteId(null), 3000);
                              }
                            }}
                            className={`w-16 h-16 rounded-2xl flex items-center justify-center border-2 transition-all shadow-xl z-50 touch-manipulation relative overflow-hidden ${
                              confirmDeleteId === r.id 
                                ? 'bg-red-600 border-white text-white animate-pulse' 
                                : 'bg-red-500/20 text-red-500 border-red-500/30'
                            }`}
                            style={{ WebkitTapHighlightColor: 'transparent' }}
                          >
                            {confirmDeleteId === r.id ? (
                              <div className="flex flex-col items-center">
                                <Trash2 size={24} />
                                <span className="text-[8px] font-black mt-1">CONFIRMAR?</span>
                              </div>
                            ) : (
                              <Trash2 size={28} />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="pr-12">
                        <h4 className="text-white font-black uppercase tracking-tighter italic text-base mb-1 line-clamp-1">
                          {r.title}
                        </h4>
                        <p className="text-[10px] text-moss-500 font-bold uppercase tracking-widest">
                          por {r.authorHandle}
                        </p>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
              {/* TOOLS TAB */}
              {activeTab === 'tools' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div id="cleanup-tool" className="glass-card rounded-[32px] p-8 border border-white/5">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500">
                        <Trash2 size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-white italic tracking-tighter uppercase">Limpeza de Dados</h3>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Remover perfis órfãos ou de teste</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Deep Search / Manual Handle Deletion */}
                      <div className="p-4 bg-moss-500/5 rounded-2xl border border-moss-500/10 mb-6">
                        <h4 className="text-[10px] font-black text-moss-400 uppercase tracking-widest mb-3">Busca profunda por @Handle</h4>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input 
                            type="text"
                            placeholder="Ex: teste"
                            value={targetHandle}
                            onChange={(e) => setTargetHandle(e.target.value)}
                            className="w-full sm:flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 sm:py-2 text-xs text-white focus:outline-none focus:border-moss-500/50"
                          />
                          <button 
                            onClick={() => deleteUserProfileByHandle(targetHandle)}
                            className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-white text-black text-[10px] font-black uppercase rounded-xl hover:bg-moss-400 transition-all shrink-0"
                          >
                            Localizar/Excluir
                          </button>
                        </div>
                        <p className="text-[9px] text-gray-600 mt-2 italic">Use esta ferramenta se um handle parecer travado mesmo após exclusão.</p>
                      </div>

                      {debugLog.length > 0 && (
                        <div className="bg-black/60 border border-moss-500/20 rounded-2xl p-4 space-y-1 font-mono text-[9px]">
                          <p className="text-moss-500 font-black mb-2 flex items-center gap-2">
                             <Activity size={10} className="animate-pulse" />
                             LOG DE OPERAÇÕES
                          </p>
                          {debugLog.map((log, i) => (
                            <motion.p 
                              initial={{ opacity: 0, x: -5 }} 
                              animate={{ opacity: 1, x: 0 }} 
                              key={`${log}-${i}`} 
                              className="text-gray-400"
                            >
                              <span className="text-gray-600">[{new Date().toLocaleTimeString()}]</span> {log}
                            </motion.p>
                          ))}
                        </div>
                      )}

                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Contas Sem Email</p>
                          <span className="text-sm font-black text-red-500 italic uppercase">
                            {stats.orphanUsers} encontradas
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-600 leading-relaxed uppercase font-medium">
                          Geralmente são perfis criados em modo convidado ou testes que foram deletados do Firebase Auth mas ainda ocupam espaço no Firestore.
                        </p>
                      </div>

                      {cleanupConfirm ? (
                        <div className="space-y-3">
                          <p className="text-[10px] text-red-500 font-black uppercase text-center animate-pulse">
                            Tem certeza? Isso é irreversível.
                          </p>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => setCleanupConfirm(false)}
                              className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black uppercase tracking-widest text-[9px] transition-all"
                            >
                              Cancelar
                            </button>
                            <button 
                              onClick={handleCleanupAnonymous}
                              disabled={cleanupLoading}
                              className="flex-[2] py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-[9px] transition-all flex items-center justify-center gap-2"
                            >
                              {cleanupLoading ? (
                                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              ) : 'Confirmar Exclusão'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setCleanupConfirm(true)}
                          disabled={cleanupLoading || stats.orphanUsers === 0}
                          className="w-full py-5 bg-red-500 hover:bg-red-600 disabled:opacity-30 disabled:hover:bg-red-500 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-lg shadow-red-900/20 transition-all flex items-center justify-center gap-3"
                        >
                          {cleanupLoading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <>
                              <Trash2 size={16} />
                              Limpar Perfis de Convidados
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="glass-card rounded-[32px] p-8 border border-white/5 opacity-50 grayscale pointer-events-none">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500">
                        <Activity size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-white italic tracking-tighter uppercase">Backup & Export</h3>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Breve • Exportar base JSON</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Report Details Modal */}
      <AnimatePresence>
        {selectedReport && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedReport(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              layoutId={selectedReport.id}
              className="relative w-full max-w-sm glass-card border-red-500/20 border-2 p-8 shadow-2xl overflow-hidden"
            >
              <button 
                onClick={() => setSelectedReport(null)}
                className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>

              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className={`text-[9px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full border ${
                    selectedReport.status === 'pending' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 
                    selectedReport.status === 'resolved' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                    'bg-gray-500/10 text-gray-400 border-gray-500/20'
                  }`}>
                    {selectedReport.status}
                  </span>
                  <span className="text-[10px] font-mono text-gray-500 uppercase">
                    ID: {selectedReport.id.substring(0, 8)}...
                  </span>
                </div>
                <h3 className="text-xl font-black text-white italic tracking-tighter uppercase leading-tight mb-2">
                  Denúncia de {selectedReport.targetType === 'post' ? 'Relato' : 'Comentário'}
                </h3>
                <p className="text-[10px] text-moss-400 font-bold uppercase tracking-widest leading-none">
                  Motivo: {selectedReport.reason}
                </p>
                <p className="text-[9px] text-gray-600 mt-1 uppercase">Denunciado por: {selectedReport.reporterHandle}</p>
              </div>

              <div className="space-y-4 mb-8">
                <div>
                   <p className="text-[9px] font-black uppercase tracking-widest text-gray-600 mb-2">Conteúdo Denunciado:</p>
                   <div className="bg-black/40 border border-white/5 rounded-2xl p-4 max-h-40 overflow-y-auto">
                      <p className="text-sm text-gray-400 leading-relaxed italic italic">"{selectedReport.targetContent}"</p>
                   </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-600 ml-1">Gerenciar Conteúdo</p>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => {
                      if (selectedReport.targetType === 'post') {
                         deleteReview(selectedReport.targetId);
                      } else {
                         // Comment deletion logic - simplified
                         alert('Para excluir o comentário, vá até a publicação (funcionalidade em breve de link direto)');
                      }
                    }}
                    className="py-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-red-500/20 transition-all"
                  >
                    Excluir Alvo
                  </button>
                  <button 
                    onClick={() => updateReportStatus(selectedReport.id, 'resolved')}
                    className="py-3 bg-green-500/10 text-green-400 border border-green-500/20 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-green-500/20 transition-all"
                  >
                    Resolvido
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                   <button 
                    onClick={() => updateReportStatus(selectedReport.id, 'dismissed')}
                    className="py-3 bg-white/5 text-gray-400 border border-white/10 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all"
                  >
                    Ignorar
                  </button>
                  <button 
                    onClick={() => deleteReport(selectedReport.id)}
                    className="py-3 bg-white/2 text-gray-600 border border-white/5 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-white/5 transition-all"
                  >
                    Limpar Registro
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2 mt-2">
                  <button 
                    onClick={() => {
                      const targetUser = users.find(u => u.uid === selectedReport.targetUserId);
                      if (targetUser) {
                        setBanModal(targetUser);
                      } else {
                        alert('Dados do usuário não carregados. Procure-o na aba Usuários.');
                      }
                    }}
                    className="py-3 bg-red-500/20 text-red-500 border border-red-500/30 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-red-500/40 transition-all font-black"
                  >
                    Banir Autor do Conteúdo
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Banned Info Modal */}
      <AnimatePresence>
        {bannedInfoModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setBannedInfoModal(null)}
              className="absolute inset-0 bg-black/95 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm glass-card border-red-500/20 border-2 p-8 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4">
                <button onClick={() => setBannedInfoModal(null)} className="text-gray-500 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-16 h-16 bg-red-500/10 rounded-3xl flex items-center justify-center text-red-500 mb-4 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                  <Shield size={32} />
                </div>
                <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-tight">
                  Status de Banimento
                </h3>
                <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest mt-1">
                  Usuário Restrito
                </p>
                <div className="mt-4 p-4 bg-white/5 rounded-2xl border border-white/5 w-full">
                  <p className="text-white font-black uppercase tracking-tighter italic text-lg">{bannedInfoModal.displayName}</p>
                  <p className="text-moss-400 text-[10px] font-bold uppercase tracking-widest">{bannedInfoModal.handle}</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[9px] uppercase tracking-widest font-black text-gray-500 mb-2 block ml-1">Tempo Restante</label>
                  <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex flex-col items-center justify-center">
                    <Clock size={20} className="text-red-500 mb-2 animate-pulse" />
                    <span className="text-xl font-black text-white tracking-tighter italic">
                      {getTimeRemaining(bannedInfoModal.banInfo?.expiresAt)}
                    </span>
                    {bannedInfoModal.banInfo?.expiresAt && (
                      <span className="text-[8px] text-gray-600 uppercase font-bold mt-2">
                        Expira em: {new Date(bannedInfoModal.banInfo.expiresAt).toLocaleString('pt-BR')}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[9px] uppercase tracking-widest font-black text-gray-500 mb-2 block ml-1">Motivo Registrado</label>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 min-h-[60px]">
                    <p className="text-xs text-gray-400 italic leading-relaxed">
                      "{bannedInfoModal.banInfo?.reason || 'Sem motivo especificado'}"
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={() => {
                      handleUnbanUser(bannedInfoModal);
                      setBannedInfoModal(null);
                    }}
                    className="w-full py-4 bg-green-500 hover:bg-green-400 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-xl shadow-green-900/40 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={16} />
                    Desbanir Conta Agora
                  </button>
                  <button
                    onClick={() => setBannedInfoModal(null)}
                    className="w-full py-4 bg-white/5 hover:bg-white/10 text-gray-500 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all"
                  >
                    Fechar Detalhes
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Ban Modal */}
      <AnimatePresence>
        {banModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setBanModal(null)}
              className="absolute inset-0 bg-black/95 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm glass-card border-red-500/20 border-2 p-8 shadow-2xl"
            >
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-16 h-16 bg-red-500/10 rounded-3xl flex items-center justify-center text-red-500 mb-4">
                  <Shield size={32} />
                </div>
                <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-tight">
                  Banir Usuário
                </h3>
                <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest mt-1">
                  Ação Restrita de Moderação
                </p>
                <div className="mt-4 p-3 bg-white/5 rounded-2xl border border-white/5 w-full">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Alvo:</p>
                  <p className="text-white font-black uppercase tracking-tighter italic">{banModal.displayName}</p>
                  <p className="text-moss-400 text-[10px] font-bold uppercase tracking-widest">{banModal.handle}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[9px] uppercase tracking-widest font-black text-gray-500 mb-2 block ml-1">Tempo do Ban</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: '24h', label: '24 Horas' },
                      { id: '7d', label: '7 Dias' },
                      { id: '30d', label: '30 Dias' },
                      { id: 'permanent', label: 'Permanente' }
                    ].map(d => (
                      <button
                        key={d.id}
                        onClick={() => setBanDuration(d.id)}
                        className={`py-3 rounded-xl font-bold text-[9px] uppercase tracking-widest transition-all ${
                          banDuration === d.id ? 'bg-red-500 text-white shadow-lg shadow-red-900/20' : 'bg-white/5 text-gray-500 hover:bg-white/10'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[9px] uppercase tracking-widest font-black text-gray-500 mb-2 block ml-1">Motivo do Ban</label>
                  <textarea
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder="Ex: Discurso de ódio no relato #123..."
                    className="w-full h-24 bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-xs placeholder:text-gray-700 focus:outline-none focus:border-red-500/50 transition-all resize-none"
                  />
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={handleBanUser}
                    disabled={!banReason}
                    className="w-full py-4 bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-xl shadow-red-900/40"
                  >
                    Confirmar Banimento
                  </button>
                  <button
                    onClick={() => setBanModal(null)}
                    className="w-full py-4 bg-white/5 hover:bg-white/10 text-gray-500 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Ticket Details Modal */}
      <AnimatePresence>
        {selectedTicket && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTicket(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              layoutId={selectedTicket.id}
              className="relative w-full max-w-sm glass-card border-moss-500/20 border-2 p-8 shadow-2xl overflow-hidden"
            >
              <button 
                onClick={() => setSelectedTicket(null)}
                className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>

              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  {getStatusBadge(selectedTicket.status)}
                  <span className="text-[10px] font-mono text-gray-500 uppercase">
                    ID: {selectedTicket.id}
                  </span>
                </div>
                <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-tight">
                  {selectedTicket.title}
                </h3>
                <div className="flex items-center gap-2 mt-2">
                  <div className="p-1 bg-moss-500/10 rounded-lg text-moss-400">
                    <User size={14} />
                  </div>
                  <p className="text-[10px] text-moss-400 font-bold uppercase tracking-widest">
                    {selectedTicket.userName} • {selectedTicket.userEmail || 'Sem email'}
                  </p>
                </div>
              </div>

              <div className="bg-black/40 border border-white/5 rounded-3xl p-6 mb-8 max-h-48 overflow-y-auto">
                <p className="text-sm text-gray-300 leading-relaxed italic whitespace-pre-wrap">
                  {selectedTicket.description}
                </p>
              </div>

              <div className="space-y-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-600 ml-1">Gerenciar Registro</p>
                
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => {
                      if (confirmDeleteId === selectedTicket.id) {
                        deleteTicket(selectedTicket.id);
                      } else {
                        setConfirmDeleteId(selectedTicket.id);
                        setTimeout(() => setConfirmDeleteId(null), 3000);
                      }
                    }}
                    className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl flex items-center justify-center gap-3 border-2 ${
                      confirmDeleteId === selectedTicket.id
                        ? 'bg-red-600 border-white text-white animate-pulse'
                        : 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20'
                    }`}
                  >
                    <Trash2 size={20} />
                    {confirmDeleteId === selectedTicket.id ? 'CLIQUE PARA CONFIRMAR EXCLUSÃO' : 'EXCLUIR REGISTRO'}
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => updateTicketStatus(selectedTicket.id, 'in_progress')}
                      disabled={selectedTicket.status === 'in_progress'}
                      className={`py-4 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${
                        selectedTicket.status === 'in_progress' 
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                        : 'bg-white/5 text-gray-400 border border-white/5'
                      }`}
                    >
                      Analisar
                    </button>
                    <button 
                      onClick={() => updateTicketStatus(selectedTicket.id, 'closed')}
                      disabled={selectedTicket.status === 'closed'}
                      className={`py-4 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${
                        selectedTicket.status === 'closed' 
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                        : 'bg-white/5 text-gray-400 border border-white/5'
                      }`}
                    >
                      Resolver
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-0 left-0 right-0 p-6 pointer-events-none">
        <div className="max-w-md mx-auto flex justify-center">
            <div className="bg-moss-500/10 backdrop-blur-xl border border-moss-500/20 px-4 py-2 rounded-full flex items-center gap-2">
                <div className="w-2 h-2 bg-moss-500 rounded-full animate-pulse" />
                <span className="text-[8px] font-black text-moss-400 uppercase tracking-widest">Painel de Segurança Criptografado</span>
            </div>
        </div>
      </div>
    </div>
  );
}
