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
  user: null, 
  loading: true, 
  profile: null, 
  isAdmin: false, 
  auth: null,
  pendingRequestsCount: 0,
  followingIds: []
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Explicitly enforce local persistence (standard Instagram behavior)
    setPersistence(auth, browserLocalPersistence).catch(err => {
      console.error("Auth persistence error:", err);
    });

    const unsubscribe = onAuthStateChanged(auth, (u) => {
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

  // Listeners for authenticated user data
  useEffect(() => {
    if (!user) return;

    let profileUnsubscribe: (() => void) | null = null;
    let requestsUnsubscribe: (() => void) | null = null;
    let followingUnsubscribe: (() => void) | null = null;

    // Real-time profile listener
    profileUnsubscribe = onSnapshot(doc(db, 'users', user.uid), async (userSnap) => {
      try {
        if (userSnap.exists()) {
          setProfile(userSnap.data());
        } else {
          setProfile(null);
        }
        
        // Check admin status
        if (user.email || !user.isAnonymous) {
          const adminRef = doc(db, 'admins', user.uid);
          const adminSnap = await getDoc(adminRef);
          
          if (user.email === 'd.manasterski@avanhandava.org' && !adminSnap.exists()) {
            await setDoc(adminRef, {
              email: user.email,
              addedAt: serverTimestamp(),
              isMaster: true
            });
            setIsAdmin(true);
          } else {
            setIsAdmin(adminSnap.exists());
          }
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error("Error updating profile state:", err);
      } finally {
        setLoading(false);
      }
    }, (error) => {
      console.error("Profile onSnapshot error:", error);
      // We don't call handleFirestoreError here because it throws, 
      // which can crash the entire Auth provider initialization.
      // Instead we just set profile to null and allow the app to handle it (e.g. show Onboarding)
      setProfile(null);
      setLoading(false);
    });

    // Listen to follow requests
    const requestsQ = query(collection(db, 'followRequests'), where('followingId', '==', user.uid));
    requestsUnsubscribe = onSnapshot(requestsQ, (snap) => {
      setPendingRequestsCount(snap.size);
    }, (error) => {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.LIST, 'followRequests');
      }
    });

    // Listen to following list
    const followingQ = query(collection(db, 'follows'), where('followerId', '==', user.uid));
    followingUnsubscribe = onSnapshot(followingQ, (snap) => {
      setFollowingIds(snap.docs.map(doc => doc.data().followingId));
    }, (error) => {
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.LIST, 'follows');
      }
    });

    return () => {
      if (profileUnsubscribe) profileUnsubscribe();
      if (requestsUnsubscribe) requestsUnsubscribe();
      if (followingUnsubscribe) followingUnsubscribe();
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, profile, isAdmin, auth, pendingRequestsCount, followingIds }}>
      {children}
    </AuthContext.Provider>
  );
};
