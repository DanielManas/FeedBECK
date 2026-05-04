import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, X, Camera, Send, Image as ImageIcon, Headphones, Search, Play, Pause, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, getDoc, doc, updateDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/utils/firestore';

interface MusicTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  artworkUrl100: string;
  previewUrl: string;
}

export default function Post() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rating, setRating] = useState(0.0);
  const [category, setCategory] = useState<'larica' | 'filme' | 'brisas' | 'sons'>('larica');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  // Music state
  const [musicSearch, setMusicSearch] = useState('');
  const [musicResults, setMusicResults] = useState<MusicTrack[]>([]);
  const [selectedMusic, setSelectedMusic] = useState<MusicTrack | null>(null);
  const [isManualMusic, setIsManualMusic] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualArtist, setManualArtist] = useState('');
  const [isSearchingMusic, setIsSearchingMusic] = useState(false);

  const placeholders = {
    larica: {
      title: "O que você devorou?",
      content: "Descreva essa experiência gastronômica... O sabor, a textura, o nível de satisfação..."
    },
    filme: {
      title: "Qual foi a pira do filme?",
      content: "Como foi a pira de assistir? O que mais mexeu com a sua mente nessa história?"
    },
    brisas: {
      title: "Dê um nome para essa pira...",
      content: "Descreva a brisa... Onde você estava? O que sentiu? Quais foram os pensamentos?"
    },
    sons: {
      title: "Qual o som do momento?",
      content: "O que essa música te faz sentir? Qual a vibe que ela carrega?"
    }
  };

  useEffect(() => {
    if (category === 'sons' && musicSearch.length > 2) {
      const searchMusic = async () => {
        setIsSearchingMusic(true);
        try {
          const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(musicSearch)}&entity=song&limit=5`);
          const data = await response.json();
          setMusicResults(data.results);
        } catch (err) {
          console.error('Error searching music:', err);
        } finally {
          setIsSearchingMusic(false);
        }
      };

      const timer = setTimeout(searchMusic, 500);
      return () => clearTimeout(timer);
    } else {
      setMusicResults([]);
    }
  }, [musicSearch, category]);

  const handleMediaClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const processFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Image Compression using Canvas
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          const MAX_SIZE = 1080;
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // 0.6 quality is enough for mobile viewing and saves huge space
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          resolve(dataUrl);
        };
      };
      reader.onerror = reject;
    });
  };

  const handlePost = async () => {
    setFormError(null);
    setShowValidation(true);
    console.log('handlePost called', { title, content, rating, category });

    if (!user) return;

    if (!title.trim()) {
      const msg = 'Opa! Seu FeedBECK precisa de um título.';
      setFormError(msg);
      // alert(msg); // Keeping alert for now but will also show in UI
      return;
    }

    if (!content.trim()) {
      const msg = 'Conta pra gente como foi! O relato é obrigatório.';
      setFormError(msg);
      // alert(msg);
      return;
    }

    if (rating === 0) {
      const msg = 'Acho que você esqueceu de dar uma nota, hein? ⭐';
      setFormError(msg);
      // alert(msg);
      return;
    }

    // Music/Sons validation was here - removed to make it optional
    /*
    if (category === 'sons' && !selectedMusic && !isManualMusic) {
      alert('Selecione uma música ou insira manualmente os dados do som.');
      return;
    }
    */

    setLoading(true);

    try {
      let mediaUrls: string[] = [];

      if (selectedFiles.length > 0) {
        // Process all selected files with compression
        mediaUrls = await Promise.all(selectedFiles.map(file => processFile(file)));

        // Safety check for Firestore document size (1MB limit)
        const totalSize = JSON.stringify(mediaUrls).length;
        if (totalSize > 1000000) {
          throw new Error('As fotos são muito pesadas para a nuvem. Tente usar menos fotos.');
        }
      } else {
        // No media selected, leave as empty array as requested
        mediaUrls = [];
      }

      const reviewData: any = {
        authorId: user.uid,
        authorHandle: profile?.handle || '@usuario',
        authorName: profile?.displayName || user.displayName || 'Anônimo',
        authorPhoto: profile?.photoURL || user.photoURL || '',
        authorAvatarStyles: profile?.avatarStyles || null,
        authorRainbowActive: profile?.rainbowActive || false,
        isPrivate: profile?.isPrivate || false,
        category,
        title: title.trim(),
        content: content.trim(),
        rating,
        sintonias: 0,
        commentsCount: 0,
        images: mediaUrls,
        createdAt: serverTimestamp()
      };

      if (category === 'sons' && (selectedMusic || isManualMusic)) {
        reviewData.musicData = {
          trackId: selectedMusic?.trackId || `manual-${Date.now()}`,
          trackName: selectedMusic?.trackName || manualTitle.trim(),
          artistName: selectedMusic?.artistName || manualArtist.trim(),
          artworkUrl: selectedMusic 
            ? selectedMusic.artworkUrl100.replace('100x100', '400x400')
            : 'placeholder:sons',
          previewUrl: selectedMusic?.previewUrl || ''
        };
        // Update title to match manual entry if needed
        if (isManualMusic) {
          reviewData.title = manualTitle.trim();
        }
      }

      console.log('Publicando FeedBECK:', JSON.stringify(reviewData, null, 2));
      await addDoc(collection(db, 'reviews'), reviewData);

      // Update user stats
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const currentPosts = userData.postsCount || 0;
        
        // Update category counts to determine vibe
        const categoryCounts = userData.categoryCounts || {};
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        
        // Find dominant category
        let dominant = 'brisas';
        let max = -1;
        Object.entries(categoryCounts).forEach(([cat, count]: [any, any]) => {
          if (count > max) {
            max = count;
            dominant = cat;
          }
        });

        await updateDoc(userRef, {
          postsCount: currentPosts + 1,
          categoryCounts,
          dominantVibe: dominant,
          updatedAt: serverTimestamp()
        });
      }

      navigate('/profile');
    } catch (err) {
      console.error('Erro ao publicar:', err);
      handleFirestoreError(err, OperationType.CREATE, 'reviews');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4 pt-12 pb-32">
      <div className="glass-card p-6 shadow-2xl shadow-black/50 border border-white/10 relative overflow-hidden">
        {/* Subtle inner glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-moss-500/10 rounded-full blur-[60px] pointer-events-none" />

        <header className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-black tracking-tighter text-moss-400 green-glow uppercase">
            Novo FeedBECK
          </h1>
          <button onClick={() => navigate(-1)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
            <X size={20} />
          </button>
        </header>

        <div id="tutorial-post-form" className="space-y-8">
          {/* Category Selection */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-500 mb-4 block">Categoria</label>
            <div className="grid grid-cols-4 gap-2">
              {(['larica', 'filme', 'brisas', 'sons'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setCategory(cat);
                    setSelectedMusic(null);
                    setIsManualMusic(false);
                    setMusicSearch('');
                    setManualTitle('');
                    setManualArtist('');
                  }}
                  className={`py-3 rounded-2xl text-[8px] font-bold uppercase tracking-widest transition-all ${
                    category === cat 
                      ? cat === 'larica' ? 'bg-orange-500 text-white shadow-lg shadow-orange-900/40' :
                        cat === 'filme' ? 'bg-amber-500 text-white shadow-lg shadow-amber-900/40' :
                        cat === 'brisas' ? 'bg-moss-500 text-white shadow-lg shadow-moss-900/40' :
                        'bg-indigo-500 text-white shadow-lg shadow-indigo-900/40'
                      : 'bg-white/5 text-gray-500'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Music Search (Only if Sons category) */}
          <AnimatePresence>
            {category === 'sons' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-4"
              >
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <input 
                    type="text"
                    value={musicSearch}
                    onChange={(e) => setMusicSearch(e.target.value)}
                    placeholder="Busque por música ou artista..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold text-white placeholder:text-gray-500 focus:border-moss-500 outline-none transition-all"
                  />
                </div>

                {isSearchingMusic && (
                  <div className="flex justify-center py-2">
                    <div className="w-4 h-4 border-2 border-moss-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                {musicSearch.length > 2 && !isSearchingMusic && !selectedMusic && !isManualMusic && (
                  <div className="space-y-3">
                    {musicResults.length > 0 && (
                      <div className="space-y-2 bg-black/20 rounded-2xl p-2 border border-white/5 max-h-48 overflow-y-auto no-scrollbar">
                        {musicResults.map((track) => (
                          <button
                            key={track.trackId}
                            onClick={() => {
                              setSelectedMusic(track);
                              setIsManualMusic(false);
                              setTitle(track.trackName);
                              setMusicSearch('');
                              setMusicResults([]);
                            }}
                            className="w-full flex items-center gap-3 p-2 hover:bg-white/5 rounded-xl transition-all text-left group"
                          >
                            <img src={track.artworkUrl100} className="w-10 h-10 rounded-lg shadow-lg group-hover:scale-110 transition-transform" alt="" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-black text-white truncate uppercase tracking-tighter">{track.trackName}</p>
                              <p className="text-[10px] text-moss-400 font-bold truncate uppercase tracking-widest">{track.artistName}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    
                    <button 
                      onClick={() => setIsManualMusic(true)}
                      className="w-full py-4 bg-white/5 border border-dashed border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 hover:text-moss-400 hover:border-moss-500/30 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus size={14} />
                      Não é nenhuma dessas? Inserir Manual
                    </button>
                  </div>
                )}

                {isManualMusic && !selectedMusic && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3 bg-black/40 p-4 rounded-2xl border border-moss-500/20 relative"
                  >
                    <button 
                      onClick={() => setIsManualMusic(false)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-gray-800 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-all"
                    >
                      <X size={12} />
                    </button>

                    <div>
                      <label className="text-[8px] uppercase tracking-[0.2em] font-black text-gray-500 mb-2 block">Nome da Música</label>
                      <input 
                        type="text"
                        value={manualTitle}
                        onChange={(e) => {
                          setManualTitle(e.target.value);
                          setTitle(e.target.value);
                        }}
                        placeholder="Ex: B.Y.O.B."
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-moss-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] uppercase tracking-[0.2em] font-black text-gray-500 mb-2 block">Artista</label>
                      <input 
                        type="text"
                        value={manualArtist}
                        onChange={(e) => setManualArtist(e.target.value)}
                        placeholder="Ex: System of a Down"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-moss-500 transition-all"
                      />
                    </div>
                  </motion.div>
                )}

                {selectedMusic && (
                  <div className="bg-moss-500/10 border border-moss-500/30 rounded-2xl p-4 flex items-center gap-4 relative group">
                    <img src={selectedMusic.artworkUrl100} className="w-16 h-16 rounded-xl shadow-xl" alt="" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black text-moss-400 uppercase tracking-widest mb-1">Selecionada</p>
                      <p className="text-base font-black text-white truncate uppercase tracking-tighter leading-tight">{selectedMusic.trackName}</p>
                      <p className="text-xs text-white/50 font-bold truncate uppercase tracking-widest">{selectedMusic.artistName}</p>
                    </div>
                    <button 
                      onClick={() => setSelectedMusic(null)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-90 transition-all"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Title Input */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] font-black text-gray-400 mb-4 block flex justify-between">
              Título do Post
              {showValidation && !title.trim() && <span className="text-red-500 animate-pulse">Obrigatório</span>}
            </label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (formError) setFormError(null);
              }}
              placeholder={placeholders[category].title}
              className={`w-full bg-white/5 border rounded-2xl px-6 py-4 text-base font-bold text-white placeholder:text-gray-500 outline-none transition-all ${
                showValidation && !title.trim() ? 'border-red-500/50 bg-red-500/5' : 'border-white/10 focus:border-moss-500'
              }`}
            />
          </div>

          {/* Media Selection */}
          <div className="-mx-6">
            <label className="text-[10px] uppercase tracking-[0.2em] font-black text-gray-400 mb-4 block px-6">
              Galeria {selectedFiles.length > 0 && `(${selectedFiles.length}/4)`}
            </label>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              multiple 
              accept="image/*" 
              className="hidden" 
            />
            
            {selectedFiles.length > 0 ? (
              <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar gap-3 px-6 h-[280px]">
                {selectedFiles.map((file, idx) => (
                  <div key={idx} className="flex-shrink-0 w-[240px] aspect-[4/5] bg-black/40 rounded-3xl snap-center relative group overflow-hidden border border-white/5 shadow-2xl">
                    <img 
                      src={URL.createObjectURL(file)} 
                      alt="Preview" 
                      className="w-full h-full object-cover" 
                    />
                    
                    {/* Floating Info / Controls */}
                    <div className="absolute top-3 right-3 z-10 flex gap-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                        className="p-2 bg-black/60 backdrop-blur-md rounded-full text-white hover:bg-red-500/80 transition-colors shadow-lg"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full">
                      <span className="text-[8px] font-black text-white/70 uppercase tracking-widest">{idx + 1} de {selectedFiles.length}</span>
                    </div>
                  </div>
                ))}

                {selectedFiles.length < 4 && (
                  <button 
                    onClick={handleMediaClick}
                    className="flex-shrink-0 w-[200px] aspect-[4/5] bg-white/5 rounded-3xl snap-center flex flex-col items-center justify-center gap-3 text-gray-500 hover:text-moss-400 hover:bg-white/10 transition-all border-2 border-dashed border-white/5 group"
                  >
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Camera size={24} />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest">Mais fotos</p>
                  </button>
                )}
                
                {/* Visual Spacer for snap padding */}
                <div className="flex-shrink-0 w-3" />
              </div>
            ) : (
              <div className="px-6">
                <div 
                  onClick={handleMediaClick}
                  className="aspect-video bg-white/5 rounded-[32px] flex flex-col items-center justify-center gap-4 text-gray-400 hover:text-moss-400 hover:border-moss-500/50 transition-all cursor-pointer border-dashed border-2 border-white/5 group overflow-hidden"
                >
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Camera size={32} strokeWidth={1.5} />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-black uppercase tracking-[0.2em] mb-1">Selecionar da Galeria</p>
                    <p className="text-[8px] text-gray-600 font-bold uppercase tracking-widest">Até 4 fotos</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Rating Slider */}
          <div className={`text-center p-6 rounded-[24px] border transition-all ${
            showValidation && rating === 0 ? 'bg-red-500/10 border-red-500/50 shadow-lg shadow-red-900/20' : 'bg-black/40 border-white/5'
          }`}>
              <label className="text-[10px] uppercase tracking-[0.2em] font-black text-gray-400 mb-4 block flex justify-between px-2">
                Experiência
                {showValidation && rating === 0 && <span className="text-red-500 animate-pulse font-black uppercase text-[8px]">Esqueceu a nota!</span>}
              </label>
              <div className="flex justify-center gap-2 mb-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star 
                    key={s} 
                    size={24}
                    className={`${s <= Math.ceil(rating) ? 'fill-moss-400 text-moss-400' : 'text-gray-800'} cursor-pointer hover:scale-110 transition-transform`} 
                    onClick={() => {
                      setRating(s);
                      if (formError) setFormError(null);
                    }}
                  />
                ))}
              </div>
              <p className={`text-3xl font-black italic tracking-tighter ${rating > 0 ? 'text-moss-400' : 'text-gray-600'}`}>{rating.toFixed(1)}</p>
          </div>

          {/* Description Field */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] font-black text-gray-400 mb-4 block flex justify-between">
              O Relato
              {showValidation && !content.trim() && <span className="text-red-500 animate-pulse">Obrigatório</span>}
            </label>
            <textarea 
              rows={3}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (formError) setFormError(null);
              }}
              placeholder={placeholders[category].content}
              className={`w-full bg-white/5 border rounded-2xl px-6 py-4 text-sm leading-relaxed text-white placeholder:text-gray-500 outline-none transition-all resize-none italic ${
                showValidation && !content.trim() ? 'border-red-500/50 bg-red-500/5 shadow-inner' : 'border-white/10 focus:border-moss-500'
              }`}
            />
          </div>

          <AnimatePresence>
            {formError && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-red-500/20 border border-red-500/50 p-4 rounded-2xl flex items-center gap-3"
              >
                <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0 animate-bounce">
                  <X size={16} className="text-white" />
                </div>
                <p className="text-xs font-bold text-red-200">{formError}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={handlePost}
            disabled={loading}
            className="w-full bg-moss-500 hover:bg-moss-400 disabled:opacity-50 text-white py-5 rounded-[24px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 shadow-xl shadow-moss-900/40"
          >
            {loading ? (
               <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Send size={20} />
                Publicar
              </>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
