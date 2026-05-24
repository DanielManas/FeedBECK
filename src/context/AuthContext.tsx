import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp, collection, query, where } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/utils/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  profile: any | null;
  isAdmin: boolean;
  auth: any;
  pendingRequestsCount: number;
  followingIds: string[];
}

const AuthContext = createContext<AuthContextType>({
  user: null, loading: true, profile: null,
  isAdmin: false, auth: null,
  pendingRequestsCount: 0, followingIds: [],
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser]       = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(console.error);

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u && !u.emailVerified && !u.isAnonymous) {
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
        setLoading(false);

        // onAuthStateChanged does NOT re-fire when emailVerified changes.
        // Poll every 3s and create Firestore profile + update state when verified.
        const interval = setInterval(async () => {
          try {
            await u.reload();
            const refreshed = auth.currentUser;
            if (refreshed?.emailVerified) {
              clearInterval(interval);

              // Create Firestore profile NOW (only after verification)
              const userRef = doc(db, 'users', refreshed.uid);
              const userSnap = await getDoc(userRef);
              if (!userSnap.exists()) {
                // Retrieve pending profile data saved during registration
                const pendingRaw = window.localStorage.getItem('feedbeck_pending_profile');
                const pending = pendingRaw ? JSON.parse(pendingRaw) : null;

                await setDoc(userRef, {
                  uid: refreshed.uid,
                  email: refreshed.email,
                  handle: pending?.handle ?? `@user${refreshed.uid.slice(0, 6)}`,
                  displayName: pending?.displayName ?? 'Novo Usuário',
                  photoURL: null,
                  bio: '',
                  isPrivate: false,
                  onboardingComplete: false,
                  tutorial_completed: false,
                  followersCount: 0,
                  followingCount: 0,
                  postsCount: 0,
                  munchiesCount: 0,
                  moviesCount: 0,
                  categoryCounts: {},
                  dominantVibe: 'semente',
                  totalSintonias: 0,
                  redEyesCount: 0,
                  showRedEyes: true,
                  rainbowActive: false,
                  yarokActive: false,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });

                window.localStorage.removeItem('feedbeck_pending_profile');
              }

              setUser(refreshed);
            }
          } catch (err) {
            console.error('[AuthContext polling]', err);
          }
        }, 3000);

        return;
      }

      setUser(u);
      if (!u) {
        setProfile(null);
        setIsAdmin(false);
        setPendingRequestsCount(0);
        setFollowingIds([]);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  // Listeners for authenticated + verified user
  useEffect(() => {
    if (!user) return;

    let profileUnsub: (() => void) | null = null;
    let requestsUnsub: (() => void) | null = null;
    let followingUnsub: (() => void) | null = null;

    // Profile
    profileUnsub = onSnapshot(doc(db, 'users', user.uid), async (snap) => {
      try {
        setProfile(snap.exists() ? snap.data() : null);

        // Admin check
        if (user.email || !user.isAnonymous) {
          const adminRef = doc(db, 'admins', user.uid);
          const adminSnap = await getDoc(adminRef);

          if (user.email === 'd.manasterski@avanhandava.org' && !adminSnap.exists()) {
            await setDoc(adminRef, { email: user.email, addedAt: serverTimestamp(), isMaster: true });
            setIsAdmin(true);
          } else {
            setIsAdmin(adminSnap.exists());
          }
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error('AuthContext profile error:', err);
      } finally {
        setLoading(false);
      }
    }, (error) => {
      console.error('Profile snapshot error:', error);
      setProfile(null);
      setLoading(false);
    });

    // Follow requests
    requestsUnsub = onSnapshot(
      query(collection(db, 'followRequests'), where('followingId', '==', user.uid)),
      (snap) => setPendingRequestsCount(snap.size),
      (error) => { if (auth.currentUser) handleFirestoreError(error, OperationType.LIST, 'followRequests'); }
    );

    // Following list
    followingUnsub = onSnapshot(
      query(collection(db, 'follows'), where('followerId', '==', user.uid)),
      (snap) => setFollowingIds(snap.docs.map(d => d.data().followingId)),
      (error) => { if (auth.currentUser) handleFirestoreError(error, OperationType.LIST, 'follows'); }
    );

    return () => {
      if (profileUnsub)  profileUnsub();
      if (requestsUnsub) requestsUnsub();
      if (followingUnsub) followingUnsub();
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, profile, isAdmin, auth, pendingRequestsCount, followingIds }}>
      {children}
    </AuthContext.Provider>
  );
};
