import { useState, useEffect } from 'react';
import { Shield, Bell, LogOut, ChevronRight, HelpCircle, Lock, Globe, Terminal, Key, Sparkles, X, Eye, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { deleteDoc, doc, updateDoc, arrayUnion, setDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/utils/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { deleteUser, signOut, reauthenticateWithPopup, GoogleAuthProvider } from 'firebase/auth';

export default function Settings() {
  const navigate = useNavigate();
  const { user, profile, isAdmin } = useAuth();
  const [isPrivate, setIsPrivate] = useState(false);
  const [showRedEyes, setShowRedEyes] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [codeValue, setCodeValue] = useState('');
  const [codeStatus, setCodeStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [reauthRequired, setReauthRequired] = useState(false);

  useEffect(() => {
    if (profile) {
      setIsPrivate(profile.isPrivate || false);
      setShowRedEyes(profile.showRedEyes !== false);
    }
  }, [profile]);

  const togglePrivate = async () => {
    if (!user) return;
    const newValue = !isPrivate;
    setIsPrivate(newValue);
    setSaveLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        isPrivate: newValue
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      // Revert on error
      setIsPrivate(!newValue);
    } finally {
      setSaveLoading(false);
    }
  };

  const toggleRedEyes = async () => {
    if (!user) return;
    const newValue = !showRedEyes;
    setShowRedEyes(newValue);
    setSaveLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        showRedEyes: newValue
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      // Revert on error
      setShowRedEyes(!newValue);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const validateCode = async () => {
    if (!user || !codeValue.trim()) return;
    
    const normalizedCode = codeValue.trim().toLowerCase();
    
    try {
      if (normalizedCode === 'yarok' || normalizedCode === '420') {
        setCodeStatus('success');
        await updateDoc(doc(db, 'users', user.uid), {
          unlockedVibes: arrayUnion('yarok'),
          yarokActive: true
        });
      } else if (normalizedCode === 'cogu') {
        setCodeStatus('success');
        await updateDoc(doc(db, 'users', user.uid), {
          rainbowActive: true
        });
      } else if (normalizedCode === 'clean') {
        setCodeStatus('success');
        await updateDoc(doc(db, 'users', user.uid), {
          redEyesCount: 0
        });
      } else if (normalizedCode === 'master') {
        // Just a fun placeholder that gives a special toast for now
        setCodeStatus('success');
        alert('MODO MASTER REQUISITADO. AGUARDANDO SINCRONIA...');
      } else {
        setCodeStatus('error');
        setTimeout(() => setCodeStatus('idle'), 2000);
        return;
      }

      setTimeout(() => {
        setShowCodeModal(false);
        setCodeValue('');
        setCodeStatus('idle');
      }, 1500);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      setCodeStatus('error');
    }
  };

  const resetVibe = async () => {
    if (!user) return;
    setSaveLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        yarokActive: false
      });
      alert('Vibe resetada para o normal!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setSaveLoading(false);
    }
  };

  const resetFeatures = async () => {
    if (!user) return;
    setSaveLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        rainbowActive: false
      });
      alert('Efeitos resetados para o normal!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setSaveLoading(false);
    }
  };

  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [supportTitle, setSupportTitle] = useState('');
  const [supportDescription, setSupportDescription] = useState('');
  const [supportLoading, setSupportLoading] = useState(false);

  const handleDeleteAccount = async () => {
    if (!user) return;
    setSaveLoading(true);
    try {
      // 1. Delete user's reviews (posts) first
      const reviewsQuery = query(collection(db, 'reviews'), where('authorId', '==', user.uid));
      const reviewsSnap = await getDocs(reviewsQuery);
      for (const reviewDoc of reviewsSnap.docs) {
        await deleteDoc(reviewDoc.ref);
      }

      // 2. Delete Firestore Profile Data while still authenticated
      // This ensures Firestore rules (isOwner) allow the operation.
      await deleteDoc(doc(db, 'users', user.uid));
      
      // 3. Delete Auth Account
      await deleteUser(user);
      
      alert('Sua conta foi excluída permanentemente. Todos os seus rastros foram apagados.');
      navigate('/login');
    } catch (err: any) {
      console.error('Delete error:', err);
      if (err.code === 'auth/requires-recent-login') {
        setReauthRequired(true);
        alert('Para sua segurança, esta operação exige uma confirmação recente. Clique em "Confirmar Identidade" e tente novamente.');
      } else {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}`);
      }
    } finally {
      setSaveLoading(false);
      if (!reauthRequired) setShowDeleteModal(false);
    }
  };

  const handleReauthenticate = async () => {
    if (!user) return;
    setSaveLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await reauthenticateWithPopup(user, provider);
      setReauthRequired(false);
      alert('Identidade confirmada! Agora você pode excluir sua conta.');
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        setSaveLoading(false);
        return;
      }
      console.error('Re-auth error:', err);
      alert('Erro ao confirmar identidade. Se estiver usando e-mail/senha, por favor saia e entre novamente.');
    } finally {
      setSaveLoading(false);
    }
  };

  const submitSupport = async () => {
    if (!user || !supportTitle.trim() || !supportDescription.trim()) return;
    
    setSupportLoading(true);
    try {
      const ticketId = `ticket_${Date.now()}_${user.uid.slice(0, 5)}`;
      await setDoc(doc(db, 'support_tickets', ticketId), {
        id: ticketId,
        userId: user.uid,
        userEmail: user.email,
        userName: profile?.displayName || 'Usuário',
        title: supportTitle,
        description: supportDescription,
        status: 'open',
        createdAt: new Date().toISOString()
      });
      
      setSupportTitle('');
      setSupportDescription('');
      setShowSupportModal(false);
      alert('Relato enviado com sucesso! Nossa equipe analisará em breve.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'support_tickets');
    } finally {
      setSupportLoading(false);
    }
  };

  return (
    <div className="p-6 pt-12 pb-24">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-black italic tracking-tighter text-white">Ajustes</h1>
        <p className="text-gray-600 text-[10px] uppercase tracking-widest font-bold mt-1">Calibre sua experiência</p>
      </header>

      <div className="space-y-8">
        {/* Admin Section */}
        {isAdmin && (
          <div>
            <h2 className="text-[10px] uppercase tracking-[0.2em] font-bold text-moss-400 mb-4 px-2">Administração</h2>
            <div className="glass-card rounded-3xl overflow-hidden border border-moss-500/20">
              <div 
                onClick={() => navigate('/admin')}
                className="flex items-center justify-between p-5 hover:bg-moss-500/5 transition-colors cursor-pointer border-b border-white/5"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-moss-500/10 rounded-xl text-moss-400">
                    <Shield size={20} />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-gray-200 block">Moderação de Denúncias</span>
                    <span className="text-[10px] text-moss-500/60 uppercase font-black uppercase tracking-tighter">Central de Suporte</span>
                  </div>
                </div>
                <ChevronRight size={18} className="text-moss-400" />
              </div>
              <div className="flex items-center justify-between p-5 hover:bg-moss-500/5 transition-colors cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-moss-500/10 rounded-xl text-moss-400">
                    <Terminal size={20} />
                  </div>
                  <span className="text-sm font-medium text-gray-300">Console de Desenvolvedor</span>
                </div>
                <ChevronRight size={18} className="text-moss-400" />
              </div>
            </div>
          </div>
        )}

        {/* Privacidade */}
        <div>
          <h2 className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-500 mb-4 px-2">Privacidade</h2>
          <div className="glass-card rounded-3xl overflow-hidden">
            <button 
              onClick={togglePrivate}
              disabled={saveLoading}
              className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50 border-b border-white/5"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-white/5 rounded-xl text-moss-400">
                  {isPrivate ? <Lock size={20} /> : <Globe size={20} />}
                </div>
                <div className="text-left">
                  <span className="text-sm font-bold text-gray-300 block">Conta Privada</span>
                  <span className="text-[10px] text-gray-600 uppercase tracking-tighter">
                    {isPrivate ? 'Só sua sintonia vê seus relatos' : 'Todo mundo vê seus relatos'}
                  </span>
                </div>
              </div>
              <div className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${isPrivate ? 'bg-moss-500' : 'bg-gray-800'}`}>
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full shadow-md transition-all duration-300 ${isPrivate ? 'right-1' : 'left-1'}`} />
              </div>
            </button>

            <button 
              onClick={toggleRedEyes}
              disabled={saveLoading}
              className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-white/5 rounded-xl text-red-500">
                  <Eye size={20} />
                </div>
                <div className="text-left">
                  <span className="text-sm font-bold text-gray-300 block">Olhinhos Vermelhos</span>
                  <span className="text-[10px] text-gray-600 uppercase tracking-tighter">
                    {showRedEyes ? 'Exibir contador de sesh no perfil' : 'Ocultar contador do seu perfil'}
                  </span>
                </div>
              </div>
              <div className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${showRedEyes ? 'bg-red-500' : 'bg-gray-800'}`}>
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full shadow-md transition-all duration-300 ${showRedEyes ? 'right-1' : 'left-1'}`} />
              </div>
            </button>
          </div>
        </div>

        {/* Preferências */}
        <div>
          <h2 className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-500 mb-4 px-2">Geral</h2>
          <div className="glass-card rounded-3xl overflow-hidden">
            <div className="flex items-center justify-between p-5 hover:bg-white/5 transition-colors cursor-pointer border-b border-white/5">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-white/5 rounded-xl text-moss-400">
                  <Bell size={20} />
                </div>
                <span className="text-sm font-medium text-gray-300">Notificações de Brisa</span>
              </div>
              <ChevronRight size={18} className="text-gray-700" />
            </div>
          </div>
        </div>

        {/* Labs / Experimental */}
        <div>
          <h2 className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-500 mb-4 px-2">Experimental</h2>
          <div className="glass-card rounded-3xl overflow-hidden">
            <button 
              onClick={() => setShowCodeModal(true)}
              className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors cursor-pointer border-b border-white/5"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-moss-500/10 rounded-xl text-moss-400">
                  <Key size={20} />
                </div>
                <div className="text-left">
                  <span className="text-sm font-bold text-gray-300 block">Códigos Secretos</span>
                  <span className="text-[10px] text-gray-600 uppercase tracking-tighter">Desbloqueie brisas ocultas</span>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-700" />
            </button>

            {/* Efeitos especiais check */}
            {profile?.yarokActive && (
              <button 
                onClick={resetVibe}
                disabled={saveLoading}
                className="w-full flex items-center justify-between p-5 hover:bg-moss-500/5 transition-colors cursor-pointer disabled:opacity-50 group border-b border-white/5 font-italic"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-moss-500/10 rounded-xl text-moss-400 group-hover:scale-110 transition-transform">
                    <Sparkles size={20} />
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-bold text-moss-400 block uppercase italic tracking-tighter">Voltar ao Normal</span>
                    <span className="text-[10px] text-moss-900/50 uppercase tracking-tighter italic">Desativar visual Yarok Master</span>
                  </div>
                </div>
                <div className="text-[10px] font-black text-moss-500/20 uppercase tracking-widest">Reset</div>
              </button>
            )}

            {profile?.rainbowActive && (
              <button 
                onClick={resetFeatures}
                disabled={saveLoading}
                className="w-full flex items-center justify-between p-5 hover:bg-red-500/5 transition-colors cursor-pointer disabled:opacity-50 group"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-red-500/10 rounded-xl text-red-500 group-hover:scale-110 transition-transform">
                    <Sparkles size={20} />
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-bold text-red-500 block uppercase italic tracking-tighter">Limpar Efeitos</span>
                    <span className="text-[10px] text-red-900/50 uppercase tracking-tighter italic">Remover arco-íris e outros efeitos visuais</span>
                  </div>
                </div>
                <div className="text-[10px] font-black text-red-500/20 uppercase tracking-widest">Reset</div>
              </button>
            )}
          </div>
        </div>

        {/* Outros */}
        <div>
          <h2 className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-500 mb-4 px-2">Suporte</h2>
          <div className="glass-card rounded-3xl overflow-hidden">
            <button 
              onClick={() => setShowSupportModal(true)}
              className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-white/5 rounded-xl text-moss-400">
                  <HelpCircle size={20} />
                </div>
                <div className="text-left">
                  <span className="text-sm font-bold text-gray-300 block">Central de Ajuda</span>
                  <span className="text-[10px] text-gray-600 uppercase tracking-tighter italic">Relate problemas ou dúvidas</span>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-700" />
            </button>
          </div>
        </div>

        <button 
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-3 p-5 glass-card rounded-3xl text-gray-400 hover:bg-white/5 transition-all font-bold text-sm mb-4"
        >
          <LogOut size={20} />
          Encerrar Sessão
        </button>

        <button 
          onClick={() => setShowDeleteModal(true)}
          className="w-full flex items-center justify-center gap-3 p-5 border border-red-500/10 rounded-3xl text-red-500/50 hover:text-red-500 hover:bg-red-500/5 transition-all font-bold text-[10px] uppercase tracking-widest"
        >
          Excluir Conta Permanentemente
        </button>

        <div className="text-center pt-8 flex flex-col items-center gap-4">
          <Logo size={24} className="opacity-30 grayscale" />
          <p className="text-[10px] font-mono text-gray-700 uppercase tracking-tighter">FeedBECK v4.2.0 • 2026</p>
        </div>
      </div>

      {/* Delete Account Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm glass-card border-red-500/20 border-2 p-8 shadow-2xl overflow-hidden"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center text-red-500 mx-auto mb-4">
                  <AlertCircle size={32} />
                </div>
                <h3 className="text-xl font-black text-white italic tracking-tighter uppercase">AVISO CRÍTICO</h3>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Exclusão irreversível</p>
              </div>

              <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl mb-8">
                <p className="text-[10px] text-red-500 uppercase font-black leading-relaxed">
                  Ao confirmar, todos os seus relatos, fotos de perfil e histórico serão apagados para sempre. Não há como desfazer esta ação.
                </p>
              </div>

              <div className="space-y-4">
                {reauthRequired ? (
                  <button 
                    onClick={handleReauthenticate}
                    disabled={saveLoading}
                    className="w-full py-4 bg-moss-500 hover:bg-moss-400 rounded-2xl font-black uppercase tracking-widest text-[10px] text-white transition-all flex items-center justify-center gap-2"
                  >
                    {saveLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : 'CONFIRMAR IDENTIDADE'}
                  </button>
                ) : (
                  <button 
                    onClick={handleDeleteAccount}
                    disabled={saveLoading}
                    className="w-full py-4 bg-red-500 hover:bg-red-600 rounded-2xl font-black uppercase tracking-widest text-[10px] text-white transition-all flex items-center justify-center gap-2"
                  >
                    {saveLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : 'ENTENDO, PODE EXCLUIR'}
                  </button>
                )}

                <button 
                  onClick={() => {
                    setShowDeleteModal(false);
                    setReauthRequired(false);
                  }}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-black uppercase tracking-widest text-[10px] text-white transition-all"
                >
                  CANCELAR
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Code Modal */}
      <AnimatePresence>
        {showCodeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCodeModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm glass-card border-moss-500/20 border-2 p-8 shadow-2xl overflow-hidden"
            >
              <button 
                onClick={() => setShowCodeModal(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>

              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-moss-500/20 rounded-2xl flex items-center justify-center text-moss-400 mx-auto mb-4">
                  <Key size={32} />
                </div>
                <h3 className="text-xl font-black text-white italic tracking-tighter">CÓDIGO SECRETO</h3>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Insira a cifra da brisa</p>
              </div>

              <div className="space-y-4">
                <input 
                  type="text"
                  value={codeValue}
                  onChange={(e) => {
                    setCodeValue(e.target.value);
                    if (codeStatus !== 'idle') setCodeStatus('idle');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && validateCode()}
                  placeholder="DIGITE AQUI..."
                  className={`w-full bg-black/40 border-2 rounded-2xl py-4 px-6 text-white text-center font-black tracking-widest focus:outline-none transition-all ${
                    codeStatus === 'success' ? 'border-moss-500 bg-moss-500/10' : 
                    codeStatus === 'error' ? 'border-red-500 bg-red-500/10 animate-shake' : 
                    'border-white/10 focus:border-moss-500'
                  }`}
                />

                <button 
                  onClick={validateCode}
                  disabled={!codeValue.trim() || codeStatus === 'success'}
                  className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 ${
                    codeStatus === 'success' ? 'bg-moss-500 text-white' : 'bg-white text-black hover:bg-moss-400 hover:text-white'
                  }`}
                >
                  {codeStatus === 'success' ? (
                    <>
                      <Sparkles size={16} />
                      DESBLOQUEADO
                    </>
                  ) : 'VALIDAR CIFRA'}
                </button>
              </div>

              {codeStatus === 'error' && (
                <p className="text-center mt-4 text-red-500 text-[10px] font-black uppercase tracking-widest animate-pulse">
                  CIFRA INCORRETA OU INVÁLIDA
                </p>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Support Modal */}
      <AnimatePresence>
        {showSupportModal && (
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSupportModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm glass-card border-moss-500/20 border-2 p-8 shadow-2xl"
            >
              <button 
                onClick={() => setShowSupportModal(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>

              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-moss-500/20 rounded-2xl flex items-center justify-center text-moss-400 mx-auto mb-4">
                  <HelpCircle size={32} />
                </div>
                <h3 className="text-xl font-black text-white italic tracking-tighter uppercase">Central de Ajuda</h3>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Relate seu problema</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[9px] uppercase tracking-widest font-bold text-gray-500 mb-1 block ml-1">Assunto</label>
                  <input 
                    type="text"
                    value={supportTitle}
                    onChange={(e) => setSupportTitle(e.target.value)}
                    placeholder="Título do problema..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-moss-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[9px] uppercase tracking-widest font-bold text-gray-500 mb-1 block ml-1">Descrição</label>
                  <textarea 
                    value={supportDescription}
                    onChange={(e) => setSupportDescription(e.target.value)}
                    placeholder="Conte-nos o que aconteceu..."
                    rows={4}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-moss-500 transition-colors resize-none"
                  />
                </div>

                <button 
                  onClick={submitSupport}
                  disabled={supportLoading || !supportTitle.trim() || !supportDescription.trim()}
                  className="w-full py-4 bg-moss-500 hover:bg-moss-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-black uppercase tracking-widest text-[10px] text-white transition-all flex items-center justify-center gap-2"
                >
                  {supportLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : 'ENVIAR RELATO'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
