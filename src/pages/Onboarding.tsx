import { useState, useEffect } from 'react';
import { User, AtSign, AlignLeft, ChevronRight, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, getDoc, setDoc, getDocs, collection, query, where, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import UserAvatar from '../components/UserAvatar';
import { handleFirestoreError, OperationType } from '../lib/utils/firestore';

// Options for DiceBear Avataaars 9.x - Refined IDs
const HAIR_STYLES = [
  { id: 'bigHair', label: 'Cabelo Grande' },
  { id: 'bob', label: 'Chanel' },
  { id: 'bun', label: 'Coque' },
  { id: 'curly', label: 'Enrolado' },
  { id: 'curvy', label: 'Ondulado' },
  { id: 'dreads', label: 'Dreads' },
  { id: 'dreads01', label: 'Dreads 01' },
  { id: 'frida', label: 'Frida' },
  { id: 'frizzle', label: 'Frisado' },
  { id: 'fro', label: 'Afro' },
  { id: 'hat', label: 'Chapéu' },
  { id: 'longButNotTooLong', label: 'Comprido' },
  { id: 'miaWallace', label: 'Mia' },
  { id: 'shaggy', label: 'Franja' },
  { id: 'shaggyMullet', label: 'Franja grande' },
  { id: 'shortCurly', label: 'Curto Enrolado' },
  { id: 'shortFlat', label: 'Curto Flat' },
  { id: 'shortRound', label: 'Curto Redondo' },
  { id: 'shortWaved', label: 'Curto Ondulado' },
  { id: 'sides', label: 'Calvo' },
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
  { id: '614335', color: '#614335', label: 'Ébano' },
  { id: 'ae5d29', color: '#ae5d29', label: 'Marrom' },
  { id: 'd08b5b', color: '#d08b5b', label: 'Bronze' },
  { id: 'fd9841', color: '#fd9841', label: 'Quente' },
  { id: 'edb98a', color: '#edb98a', label: 'Pêssego' },
  { id: 'f8d25c', color: '#f8d25c', label: 'Dourado' },
  { id: 'ffdbb4', color: '#ffdbb4', label: 'Claro' },
];

const EYES = [
  { id: 'default', label: 'Normal' },
  { id: 'happy', label: 'Feliz' },
  { id: 'squint', label: 'Chapado' },
  { id: 'wink', label: 'Piscada' },
  { id: 'hearts', label: 'Coração' },
  { id: 'eyeRoll', label: 'Cima' },
];

const MOUTHS = [
  { id: 'default', label: 'Feliz' },
  { id: 'smile', label: 'Sorriso' },
  { id: 'serious', label: 'Sério' },
  { id: 'grimace', label: 'Careta' },
  { id: 'tongue', label: 'Língua' },
];

const GLASSES = [
  { id: 'blank', label: 'Nenhum' },
  { id: 'eyepatch', label: 'Tapa Olho' },
  { id: 'kurt', label: 'Kurt' },
  { id: 'prescription02', label: 'Simples' },
  { id: 'round', label: 'Redondo' },
  { id: 'wayfarers', label: 'Escuros' },
];

const FACIAL_HAIR = [
  { id: 'blank', label: 'Nenhum' },
  { id: 'beardLight', label: 'Rala' },
  { id: 'beardMedium', label: 'Média' },
  { id: 'beardMajestic', label: 'Cheia' },
  { id: 'moustacheFancy', label: 'Italiano' },
  { id: 'moustacheMagnum', label: 'Bigode' },
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
  { id: '008080', color: '#008080', label: 'Verde Água' },
  { id: '00ffff', color: '#00ffff', label: 'Ciano' },
  { id: '65c9ff', color: '#65c9ff', label: 'Céu' },
  { id: '5199e4', color: '#5199e4', label: 'Royal' },
  { id: '25557c', color: '#25557c', label: 'Marinho' },
  { id: '3f51b5', color: '#3f51b5', label: 'Índigo' },
  { id: '9575cd', color: '#9575cd', label: 'Lavanda' },
  { id: '800080', color: '#800080', label: 'Roxo' },
  { id: '4b0082', color: '#4b0082', label: 'Uva' },
  { id: 'ffc0cb', color: '#ffc0cb', label: 'Rosa' },
  { id: 'a52a2a', color: '#a52a2a', label: 'Marrom' },
  { id: '8b4513', color: '#8b4513', label: 'Couro' },
  { id: 'f5f5dc', color: '#f5f5dc', label: 'Bege' },
];

export default function Onboarding() {
  const { user, profile } = useAuth();
  const [step, setStep] = useState(1);
  const [handle, setHandle] = useState((profile?.handle || '').replace('@', ''));
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [bio, setBio] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isCheckingHandle, setIsCheckingHandle] = useState(false);
  const [handleError, setHandleError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Sync state with profile data if it arrives late and fields are still empty
  useEffect(() => {
    if (profile) {
      if (!handle && profile.handle) setHandle(profile.handle.replace('@', ''));
      if (!displayName && profile.displayName) setDisplayName(profile.displayName);
    }
  }, [profile]);

  // Customization State
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

  const validateHandle = async (h: string) => {
    const cleanHandle = h.toLowerCase().trim();
    if (cleanHandle.length < 3) {
      setHandleError('Mínimo 3 caracteres');
      return false;
    }
    if (!/^[a-z0-9_]+$/.test(cleanHandle)) {
      setHandleError('Apenas letras minúsculas, números e underline');
      return false;
    }

    setIsCheckingHandle(true);
    setHandleError('');
    try {
      // Procurar por usuários que já tenham esse handle (com o prefixo @)
      const q = query(collection(db, 'users'), where('handle', '==', `@${cleanHandle}`));
      const snap = await getDocs(q);
      
      // Se houver algum snapshot, e o UID não for o do próprio usuário (caso ele esteja re-tentando)
      const conflictingDoc = snap.docs.find(doc => doc.id !== user?.uid);
      const isTaken = !!conflictingDoc;

      if (isTaken) {
        console.log("DEBUG: Handle conflict found:", conflictingDoc?.id, conflictingDoc?.data());
        setHandleError('Esse vulgo já tá em uso');
        return false;
      }
      
      setHandleError('');
      return true;
    } catch (err) {
      console.error("Erro ao validar handle:", err);
      setHandleError('Erro ao verificar disponibilidade');
      return false;
    } finally {
      setIsCheckingHandle(false);
    }
  };

  const handleNext = async () => {
    if (step === 1) {
      const isValid = await validateHandle(handle);
      if (isValid) {
        setStep(2);
      }
    } else if (step === 2) {
      if (displayName.trim()) setStep(3);
    } else if (step === 3) {
      setStep(4);
    }
  };

  const handleFinish = async () => {
    if (!user || !handle || !displayName) return;
    setIsSaving(true);
    try {
      // Re-verificar disponibilidade do handle uma última vez antes de salvar
      const isValid = await validateHandle(handle);
      if (!isValid) {
        setStep(1); // Se o handle foi pego por outro usuário, volta para o passo 1
        return;
      }

      const userRef = doc(db, 'users', user.uid);
      
      const userData = {
        uid: user.uid,
        email: user.email || '',
        handle: `@${handle.toLowerCase().trim()}`,
        displayName,
        bio,
        isPrivate,
        photoURL: previewAvatarUrl,
        avatarStyles,
        onboardingComplete: true,
        followersCount: profile?.followersCount || 0,
        followingCount: profile?.followingCount || 0,
        postsCount: profile?.postsCount || 0,
        munchiesCount: profile?.munchiesCount || 0,
        moviesCount: profile?.moviesCount || 0,
        categoryCounts: profile?.categoryCounts || {},
        dominantVibe: profile?.dominantVibe || 'semente',
        totalSintonias: profile?.totalSintonias || 0,
        updatedAt: serverTimestamp()
      };

      // Always use setDoc with merge to be more resilient
      await setDoc(userRef, userData, { merge: true });
      
      // If it's explicitly a new profile, also add createdAt
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists() || !userSnap.data()?.createdAt) {
        await setDoc(userRef, { createdAt: serverTimestamp() }, { merge: true });
      }
      
      console.log("DEBUG: Onboarding save successful");
      // App state will refresh via onSnapshot
    } catch (err) {
      console.error("DEBUG: Onboarding save error:", err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-smog-950 text-white p-6 flex flex-col justify-center max-w-lg mx-auto relative overflow-hidden">
      {/* Background Atmosphere */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,rgba(52,211,153,0.05)_0%,transparent_100%)]" />
      </div>

      <header className="mb-12 relative z-10 text-center">
        <h1 className="text-4xl font-black italic tracking-tighter text-white mb-2">IDENTIDADE</h1>
        <div className="flex items-center justify-center gap-1">
          {[1, 2, 3, 4].map((i) => (
            <div 
              key={i} 
              className={`h-1 rounded-full transition-all duration-500 ${i <= step ? 'w-8 bg-moss-500' : 'w-4 bg-gray-800'}`} 
            />
          ))}
        </div>
      </header>

      <div className="relative z-10">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center mb-8">
                <div className="w-24 h-24 bg-moss-900 mx-auto rounded-3xl border-2 border-moss-500/30 flex items-center justify-center mb-4 relative overflow-hidden group">
                  <AtSign className="w-10 h-10 text-moss-500" />
                </div>
                <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold">Identidade iniciada</p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-moss-400 px-2">Seu Vulgo (Handle)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-moss-500 font-bold">@</span>
                  <input 
                    type="text"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="teu_nome_na_pista"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-10 pr-4 text-white placeholder:text-gray-700 focus:outline-none focus:border-moss-500/50 transition-all font-bold"
                  />
                </div>
                {handleError && <p className="text-red-500 text-[10px] font-bold uppercase px-2">{handleError}</p>}
                <p className="text-gray-600 text-[9px] px-2">Como os outros vão te encontrar.</p>
              </div>

              <button 
                onClick={handleNext}
                disabled={!handle || isCheckingHandle}
                className="w-full bg-white text-black font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-moss-400 transition-all disabled:opacity-50 disabled:grayscale mt-8 relative overflow-hidden group"
              >
                <span className="relative z-10 flex items-center gap-2">
                  {isCheckingHandle ? (
                    <>
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full"
                      />
                      CONSCULTANDO...
                    </>
                  ) : (
                    <>
                      PRÓXIMO
                      <ChevronRight size={20} />
                    </>
                  )}
                </span>
                {isCheckingHandle && (
                  <motion.div 
                    initial={{ x: '-100%' }}
                    animate={{ x: '100%' }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 bg-moss-500/20"
                  />
                )}
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-2">
                    <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-moss-400">Como quer ser chamado?</label>
                    <span className={`${displayName.length >= 20 ? 'text-moss-400' : 'text-gray-600'} text-[9px] font-bold`}>{displayName.length}/20</span>
                  </div>
                  <input 
                    type="text"
                    maxLength={20}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Seu Nome ou Apelido"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 text-white placeholder:text-gray-700 focus:outline-none focus:border-moss-500/50 transition-all font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center px-2">
                    <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-moss-400">Relato Curto (Bio)</label>
                    <span className={`${bio.length >= 150 ? 'text-moss-400' : 'text-gray-600'} text-[9px] font-bold`}>{bio.length}/150</span>
                  </div>
                  <textarea 
                    maxLength={150}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="O que te traz por aqui?"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 text-white placeholder:text-gray-700 focus:outline-none focus:border-moss-500/50 transition-all font-bold min-h-[120px] resize-none overflow-hidden break-words"
                  />
                </div>

                {/* Privacy Toggle */}
                <div className="pt-2">
                  <button 
                    onClick={() => setIsPrivate(!isPrivate)}
                    className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all"
                  >
                    <div className="text-left">
                      <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-moss-400 block mb-1">Perfil Privado</span>
                      <p className="text-[9px] text-gray-500 leading-tight">
                        {isPrivate ? 'Só seguidores aprovados veem seus relatos' : 'Todo mundo pode ver seus relatos'}
                      </p>
                    </div>
                    <div className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${isPrivate ? 'bg-moss-500' : 'bg-gray-800'}`}>
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full shadow-md transition-all duration-300 ${isPrivate ? 'right-1' : 'left-1'}`} />
                    </div>
                  </button>
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                <button 
                  onClick={() => setStep(1)}
                  className="flex-1 bg-white/5 text-white font-bold py-4 rounded-2xl hover:bg-white/10 transition-all"
                >
                  VOLTAR
                </button>
                <button 
                  onClick={handleNext}
                  disabled={!displayName}
                  className="flex-[2] bg-white text-black font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-moss-400 transition-all disabled:opacity-50"
                >
                  CONTINUAR
                  <ChevronRight size={20} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex justify-center sticky top-0 bg-smog-950/80 backdrop-blur-md z-20 py-4 -mx-6 px-6 border-b border-white/5">
                <UserAvatar styles={avatarStyles} size="xl" />
              </div>

              <div className="space-y-10 max-h-[45vh] overflow-y-auto pr-2 no-scrollbar pb-10">
                {/* Skin Color */}
                <div className="text-center">
                  <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-moss-400 mb-4 block">Cor da Pele</label>
                  <div className="flex flex-wrap gap-3 justify-center">
                    {SKIN_COLORS.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setAvatarStyles(prev => ({ ...prev, skinColor: c.id }))}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          avatarStyles.skinColor === c.id ? 'border-moss-400 scale-125' : 'border-white/10'
                        }`}
                        style={{ backgroundColor: c.color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Hair Style & Color */}
                <div className="space-y-4">
                  <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-moss-400 block text-center">Cabelo & Estilo</label>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {HAIR_STYLES.map((h) => (
                      <button
                        key={h.id}
                        onClick={() => setAvatarStyles(prev => ({ ...prev, top: h.id }))}
                        className={`px-3 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all ${
                          avatarStyles.top === h.id ? 'bg-moss-500 text-white shadow-lg shadow-moss-900/40' : 'bg-white/5 text-gray-500 border border-white/5'
                        }`}
                      >
                        {h.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3 justify-center pt-2">
                    {HAIR_COLORS.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setAvatarStyles(prev => ({ ...prev, topColor: c.id }))}
                        className={`w-7 h-7 rounded-full border-2 transition-all ${
                          avatarStyles.topColor === c.id ? 'border-moss-400 scale-110' : 'border-white/10'
                        }`}
                        style={{ backgroundColor: c.color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Eyes & Mouth */}
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-moss-400 block text-center">Olhos</label>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {EYES.map((e) => (
                        <button
                          key={e.id}
                          onClick={() => setAvatarStyles(prev => ({ ...prev, eyes: e.id }))}
                          className={`flex-1 min-w-[60px] py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all ${
                            avatarStyles.eyes === e.id ? 'bg-moss-500 text-white shadow-lg shadow-moss-900/40' : 'bg-white/5 text-gray-500 border border-white/5'
                          }`}
                        >
                          {e.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-moss-400 block text-center">Boca</label>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {MOUTHS.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setAvatarStyles(prev => ({ ...prev, mouth: m.id }))}
                          className={`flex-1 min-w-[60px] py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all ${
                            avatarStyles.mouth === m.id ? 'bg-moss-500 text-white shadow-lg shadow-moss-900/40' : 'bg-white/5 text-gray-500 border border-white/5'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Facial Hair & Glasses */}
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-moss-400 block text-center">Barba</label>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {FACIAL_HAIR.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setAvatarStyles(prev => ({ ...prev, facialHair: f.id }))}
                          className={`flex-1 min-w-[60px] py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all ${
                            avatarStyles.facialHair === f.id ? 'bg-moss-500 text-white shadow-lg shadow-moss-900/40' : 'bg-white/5 text-gray-500 border border-white/5'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-moss-400 block text-center">Óculos</label>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {GLASSES.map((g) => (
                        <button
                          key={g.id}
                          onClick={() => setAvatarStyles(prev => ({ ...prev, glasses: g.id }))}
                          className={`flex-1 min-w-[60px] py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all ${
                            avatarStyles.glasses === g.id ? 'bg-moss-500 text-white shadow-lg shadow-moss-900/40' : 'bg-white/5 text-gray-500 border border-white/5'
                          }`}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Clothes */}
                <div className="space-y-4">
                  <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-moss-400 block text-center">Vestuário</label>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {CLOTHES.map((cl) => (
                      <button
                        key={cl.id}
                        onClick={() => setAvatarStyles(prev => ({ ...prev, clothes: cl.id }))}
                        className={`px-3 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all ${
                          avatarStyles.clothes === cl.id ? 'bg-moss-500 text-white shadow-lg shadow-moss-900/40' : 'bg-white/5 text-gray-500 border border-white/5'
                        }`}
                      >
                        {cl.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3 justify-center pt-2">
                    {CLOTHING_COLORS.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setAvatarStyles(prev => ({ ...prev, clothingColor: c.id }))}
                        className={`w-7 h-7 rounded-full border-2 transition-all ${
                          avatarStyles.clothingColor === c.id ? 'border-moss-400 scale-110' : 'border-white/10'
                        }`}
                        style={{ backgroundColor: c.color }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-white/5">
                <button 
                  onClick={() => setStep(2)}
                  className="flex-1 bg-white/5 text-white font-bold py-4 rounded-2xl hover:bg-white/10 transition-all text-xs"
                >
                  VOLTAR
                </button>
                <button 
                  onClick={handleNext}
                  className="flex-[2] bg-white text-black font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-moss-400 transition-all shadow-[0_0_40px_rgba(52,211,153,0.1)] text-xs"
                >
                  CONFIRMAR VISUAL
                  <ChevronRight size={20} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center space-y-8"
            >
              <div className="relative inline-block">
                <div className="w-32 h-32 bg-moss-900 mx-auto rounded-[2rem] border-4 border-moss-500 shadow-[0_0_30px_rgba(52,211,153,0.3)] flex items-center justify-center overflow-hidden">
                  <img 
                    src={previewAvatarUrl} 
                    alt="Final Profile" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -bottom-2 -right-2 bg-moss-500 text-black p-2 rounded-xl">
                  <Check size={20} />
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-black text-white">Tudo pronto?</h3>
                <p className="text-gray-500 text-sm mt-2 px-8">Confirmando agora, você entra no app mais verde do Brasil</p>
              </div>

              <div className="glass-card p-6 rounded-3xl text-left border border-white/5 bg-white/5">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-lg font-bold text-white">{displayName}</span>
                  <span className="text-xs text-moss-500 font-bold uppercase tracking-widest leading-none">@{handle}</span>
                </div>
                <p className="text-sm text-gray-400 italic line-clamp-2">{bio || 'Nenhum segredo revelado ainda...'}</p>
              </div>

              <div className="space-y-4 pt-4">
                <button 
                  onClick={handleFinish}
                  disabled={isSaving}
                  className="w-full bg-moss-500 text-black font-black py-5 rounded-2xl flex items-center justify-center gap-2 hover:bg-moss-400 transition-all shadow-[0_0_40px_rgba(52,211,153,0.2)]"
                >
                  {isSaving ? 'CONFIGURANDO...' : 'SEGUIR COM A CONTA'}
                </button>
                <button 
                  onClick={() => setStep(3)}
                  disabled={isSaving}
                  className="text-[10px] text-gray-600 font-bold uppercase tracking-widest hover:text-white"
                >
                  Ajustar personagem
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
