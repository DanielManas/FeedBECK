/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Check, X, Ghost, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, deleteDoc, setDoc, serverTimestamp, getDocs, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/utils/firestore';
import UserAvatar from '../components/UserAvatar';

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

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
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'followRequests');
      setLoading(false);
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

  return (
    <div className="min-h-screen bg-smog-950 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-smog-950/80 backdrop-blur-xl border-b border-moss-500/10 px-6 py-4 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-moss-400 hover:bg-white/5 rounded-xl transition-colors">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-black text-white uppercase tracking-tighter italic">Sintonias</h1>
      </header>

      <main className="px-6 py-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-4 border-moss-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center opacity-40">
            <Ghost size={64} className="text-moss-400 mb-4" />
            <p className="text-white font-black uppercase tracking-widest text-xs">Nenhum pedido de sintonia</p>
            <p className="text-xs text-gray-400 mt-2">Sua vibe está em paz por enquanto.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-5 h-5 text-moss-400" />
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-moss-400">Pedidos Pendentes</h2>
            </div>
            
            {requests.map((req) => {
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
            })}
          </div>
        )}
      </main>
    </div>
  );
}
