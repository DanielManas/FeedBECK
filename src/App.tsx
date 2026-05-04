/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import BottomNav from './components/Layout/BottomNav';
import Feed from './pages/Feed';
import Search from './pages/Search';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Post from './pages/Post';
import ReviewDetail from './pages/ReviewDetail';
import AdminDashboard from './pages/AdminDashboard';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import Notifications from './pages/Notifications';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TutorialProvider, useTutorial } from './context/TutorialContext';
import TutorialTour from './components/TutorialTour';
import SplashScreen from './components/SplashScreen';
import { AnimatePresence, motion } from 'motion/react';

function BanCountdown({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const expiration = new Date(expiresAt);
      const difference = expiration.getTime() - now.getTime();

      if (difference <= 0) {
        setTimeLeft('Banimento Expirado');
        window.location.reload();
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      let parts = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0 || days > 0) parts.push(`${hours}h`);
      parts.push(`${minutes}m`);
      parts.push(`${seconds}s`);

      setTimeLeft(parts.join(' '));
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <div className="bg-red-500/10 rounded-xl p-2 text-[10px] font-black uppercase tracking-widest text-red-400 border border-red-500/10">
      Tempo Restante: {timeLeft}
    </div>
  );
}

function AppContent() {
  const { user, profile, loading, isAdmin, auth } = useAuth();
  const { isActive } = useTutorial();
  const [minLoadingDone, setMinLoadingDone] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMinLoadingDone(true);
    }, 2000); // 2 seconds minimum initial logo time
    return () => clearTimeout(timer);
  }, []);

  // Show splash transition when user state changes (from null to authenticated)
  useEffect(() => {
    if (user && minLoadingDone && !loading) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 2000); // Brief transition splash
      return () => clearTimeout(timer);
    }
  }, [user, loading, minLoadingDone]);

  const showSplash = (loading || !minLoadingDone || isTransitioning);
  
  const isBanned = profile?.banInfo?.isBanned && (
    !profile.banInfo.expiresAt || new Date(profile.banInfo.expiresAt) > new Date()
  );

  const getStatus = () => {
    if (loading) return "Iniciando...";
    if (user && !profile) return "Sintonizando seu perfil...";
    if (isTransitioning) return "Entrando no App...";
    return undefined;
  };

  if (isBanned) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-sm"
        >
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center text-red-500 mx-auto mb-6">
            <span className="text-4xl">🚫</span>
          </div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter italic mb-4">Sua conta foi suspensa</h1>
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 mb-8">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Motivo do Banimento</p>
            <p className="text-sm text-gray-300 italic">"{profile.banInfo.reason}"</p>
            {profile.banInfo.expiresAt && (
              <div className="mt-4 pt-4 border-t border-white/5">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Acesso liberado em</p>
                <p className="text-xs text-moss-400 font-bold mb-2">
                  {new Date(profile.banInfo.expiresAt).toLocaleString()}
                </p>
                <BanCountdown expiresAt={profile.banInfo.expiresAt} />
              </div>
            )}
          </div>
          <p className="text-xs text-gray-600 mb-8 leading-relaxed">
            Se você acredita que isso foi um erro, entre em contato com o suporte através do e-mail oficial.
          </p>
          <div className="grid grid-cols-1 gap-3 w-full">
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all border border-white/10"
            >
              Tentar Novamente
            </button>
            <button 
              onClick={() => auth.signOut()}
              className="w-full py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all border border-red-500/10"
            >
              Sair da Conta
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {showSplash && <SplashScreen key="splash" status={getStatus()} />}
      </AnimatePresence>

      {!showSplash && (
        <>
          {!user ? (
            <Login />
          ) : (!profile || profile.onboardingComplete === false) ? (
            <Onboarding />
          ) : (
            <div className="min-h-screen relative selection:bg-moss-500/30">
              {isActive && <TutorialTour />}
              
              {/* Background Atmosphere Layers */}
              <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                 {/* Superior Moss Glow */}
                 <div className="absolute -top-[15%] -right-[10%] w-[90%] h-[70%] bg-moss-500/20 rounded-full blur-[100px]" />
                 
                 {/* Deep Purple Center Haze */}
                 <div className="absolute top-[20%] -left-[20%] w-[80%] h-[60%] bg-purple-600/15 rounded-full blur-[120px]" />
                 
                 {/* Bottom Emerald Tint */}
                 <div className="absolute -bottom-[20%] right-[10%] w-[70%] h-[50%] bg-moss-900/40 rounded-full blur-[100px]" />
              </div>
              
              <main className="relative z-10 max-w-lg mx-auto overflow-x-hidden min-h-screen">
                <Routes>
                  <Route path="/" element={<Feed />} />
                  <Route path="/search" element={<Search />} />
                  <Route path="/post" element={<Post />} />
                  <Route path="/post-view/:id" element={<ReviewDetail />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/profile/:handle" element={<Profile />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/admin" element={isAdmin ? <AdminDashboard /> : <Navigate to="/" replace />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>

              <BottomNav />
            </div>
          )}
        </>
      )}
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <TutorialProvider>
          <AppContent />
        </TutorialProvider>
      </AuthProvider>
    </HashRouter>
  );
}


