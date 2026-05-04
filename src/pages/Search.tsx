import React, { useState, useEffect } from 'react';
import { Search as SearchIcon, TrendingUp, Zap, Ghost, UserPlus, Star } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import UserAvatar from '../components/UserAvatar';
import { useAuth } from '../context/AuthContext';

import { handleFirestoreError, OperationType } from '../lib/utils/firestore';

interface UserProfile {
  id: string;
  uid: string;
  email?: string;
  handle: string;
  displayName: string;
  avatarStyles?: any;
  rainbowActive?: boolean;
  banInfo?: {
    isBanned: boolean;
    reason: string;
    expiresAt: string;
  };
}

export default function Search() {
  const { user: authUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestedUsers, setSuggestedUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    // Initial fetch of some users to show as "sugestões"
    const fetchSuggestions = async () => {
      try {
        const q = query(collection(db, 'users'), limit(10));
        const querySnapshot = await getDocs(q);
        const fetchedUsers: UserProfile[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        // Filter banned users AND anonymous users (no email)
        setSuggestedUsers(fetchedUsers.filter(u => 
          (u.email || u.uid === authUser?.uid) &&
          (!u.banInfo?.isBanned || (u.banInfo.expiresAt && new Date(u.banInfo.expiresAt) < new Date()))
        ));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'users_suggestions');
      }
    };
    fetchSuggestions();
  }, []);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setUsers([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      try {
        // Simple search logic: check for matches in handle
        const term = searchTerm.startsWith('@') ? searchTerm.toLowerCase() : `@${searchTerm.toLowerCase()}`;
        const q = query(
          collection(db, 'users'), 
          where('handle', '>=', term),
          where('handle', '<=', term + '\uf8ff'),
          limit(10)
        );
        const querySnapshot = await getDocs(q);
        const fetchedUsers: UserProfile[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        // Filter banned users AND anonymous users (no email)
        setUsers(fetchedUsers.filter(u => 
          (u.email || u.uid === authUser?.uid) &&
          (!u.banInfo?.isBanned || (u.banInfo.expiresAt && new Date(u.banInfo.expiresAt) < new Date()))
        ));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, `users_search_${searchTerm}`);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  return (
    <div className="p-6 pt-12 pb-24 max-w-2xl mx-auto">
      <header className="mb-10">
        <h1 className="text-4xl font-black italic tracking-tighter text-white mb-8 uppercase">Encontrar Galera</h1>
        <div className="relative group">
          <div className="absolute inset-0 bg-moss-500/10 blur-2xl group-focus-within:bg-moss-500/20 transition-all rounded-full pointer-events-none" />
          <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 text-moss-400" size={20} />
          <input 
            id="tutorial-search-input"
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquise o @ do seu amigo..."
            className="w-full bg-black/40 backdrop-blur-xl border border-white/5 rounded-3xl pl-16 pr-6 py-5 text-base focus:border-moss-500 outline-none transition-all placeholder:text-gray-700 text-white font-bold shadow-2xl relative z-10"
          />
        </div>
      </header>

      <section className="relative z-10">
        {/* Search Results */}
        {searchTerm.trim() ? (
          <div>
            <div className="flex items-center justify-between mb-6 px-2">
              <h2 className="text-[10px] uppercase tracking-[0.3em] font-black text-moss-400">Resultado da busca</h2>
              {loading && <div className="w-4 h-4 border-2 border-moss-500 border-t-transparent rounded-full animate-spin" />}
            </div>
            
            <div className="space-y-4">
              {users.length > 0 ? (
                users.map((user) => (
                  <Link 
                    key={user.id} 
                    to={`/profile/${user.handle.replace('@', '')}`}
                    className="flex items-center justify-between p-5 bg-white/[0.03] border border-white/5 rounded-3xl hover:bg-white/[0.08] hover:border-white/10 transition-all group"
                  >
                    <div className="flex items-center gap-5">
                      <UserAvatar styles={user.avatarStyles} seed={user.handle} size="md" rainbow={user.rainbowActive} />
                      <div>
                        <span className="text-base font-black text-white block tracking-tight group-hover:text-moss-400 transition-colors">{user.displayName}</span>
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{user.handle}</span>
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-gray-600 group-hover:bg-moss-500 group-hover:text-white transition-all">
                      <UserPlus size={18} />
                    </div>
                  </Link>
                ))
              ) : (
                !loading && (
                  <div className="text-center py-20 bg-white/[0.02] rounded-[40px] border border-dashed border-white/5">
                    <p className="text-gray-600 text-xs font-black uppercase tracking-[0.2em] italic">Ninguém encontrado nessa brisa</p>
                  </div>
                )
              )}
            </div>
          </div>
        ) : (
          /* Suggested / Initial View */
          <div>
            <h2 className="text-[10px] uppercase tracking-[0.3em] font-black text-gray-600 mb-6 px-2">Destaques da Comunidade</h2>
            <div className="space-y-4">
              {suggestedUsers.length > 0 ? (
                suggestedUsers.map((user) => (
                  <Link 
                    key={user.id} 
                    to={`/profile/${user.handle.replace('@', '')}`}
                    className="flex items-center gap-5 p-5 bg-white/[0.02] border border-white/5 rounded-3xl hover:bg-white/[0.05] transition-all"
                  >
                    <UserAvatar styles={user.avatarStyles} seed={user.handle} size="md" rainbow={user.rainbowActive} />
                    <div>
                      <span className="text-base font-black text-gray-200 block tracking-tight">{user.displayName}</span>
                      <span className="text-[10px] text-moss-400/60 font-black uppercase tracking-widest">{user.handle}</span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="p-8 text-center bg-white/[0.02] rounded-[32px] border border-white/5">
                  <Star size={24} className="text-gray-700 mx-auto mb-3 opacity-20" />
                  <p className="text-[10px] text-gray-700 font-black uppercase tracking-widest">Inicie uma nova conexão pesquisando acima</p>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
