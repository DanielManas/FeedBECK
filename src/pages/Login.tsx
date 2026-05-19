import React, { useState, useEffect, useRef } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
  reload,
  signOut,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  serverTimestamp,
  collection,
  query,
  where,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail,
  LogIn,
  UserPlus,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  RefreshCw,
  KeyRound,
} from 'lucide-react';
import Logo from '../components/Logo';

// ─── Types ─────────────────────────────────────────────────────────────────────
type Mode = 'login' | 'register' | 'awaiting_verification' | 'forgot_password';

// ─── Component ─────────────────────────────────────────────────────────────────
export default function Login() {
  const [mode, setMode] = useState<Mode>('login');

  // Shared fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Register-only fields
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  // Polling: check every 3s if user verified their email
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const startVerificationPolling = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        await reload(user); // refresh user data from Firebase
        if (user.emailVerified) {
          clearInterval(pollingRef.current!);
          // AuthContext will pick up the verified user automatically
        }
      } catch {
        // network hiccup — keep polling
      }
    }, 3000);
  };

  // ── Register ─────────────────────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!displayName.trim()) { setError('Informe seu nome.'); return; }
    if (!username.trim() || username.length < 3) {
      setError('Username deve ter pelo menos 3 caracteres.');
      return;
    }
    if (password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return; }
    if (password !== confirmPassword) { setError('As senhas não coincidem.'); return; }

    setLoading(true);
    try {
      // 1. Check handle uniqueness
      const cleanHandle = `@${username.toLowerCase().trim()}`;
      const handleQ = query(collection(db, 'users'), where('handle', '==', cleanHandle));
      const handleSnap = await getDocs(handleQ);
      if (!handleSnap.empty) {
        setError('Esse username já está em uso. Escolha outro.');
        setLoading(false);
        return;
      }

      // 2. Create Firebase Auth account
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = credential.user;

      // 3. Send verification e-mail
      await sendEmailVerification(user, {
        url: window.location.href,
        handleCodeInApp: false,
      });

      // 4. Save profile to Firestore
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        handle: cleanHandle,
        displayName: displayName.trim(),
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

      // 5. Switch to waiting screen + start polling
      setMode('awaiting_verification');
      startVerificationPolling();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já possui uma conta. Tente fazer login.');
      } else if (err.code === 'auth/invalid-email') {
        setError('E-mail inválido.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Erro de conexão. Verifique sua internet.');
      } else {
        setError('Erro ao criar conta. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Login ─────────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = credential.user;

      // If user exists but never verified, send another verification e-mail
      if (!user.emailVerified) {
        await sendEmailVerification(user, {
          url: window.location.href,
          handleCodeInApp: false,
        });
        setMode('awaiting_verification');
        startVerificationPolling();
        setInfo('Seu e-mail ainda não foi verificado. Reenviamos o link de confirmação.');
        return;
      }
      // Verified → AuthContext will handle navigation
    } catch (err: any) {
      console.error(err);
      if (
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/invalid-credential'
      ) {
        setError('E-mail ou senha incorretos.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Erro de conexão. Verifique sua internet.');
      } else {
        setError('Erro ao entrar. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot password ───────────────────────────────────────────────────────────
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!email.trim()) { setError('Informe seu e-mail.'); return; }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setError('Nenhuma conta encontrada com esse e-mail.');
      } else {
        setError('Erro ao enviar e-mail. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Resend verification e-mail ────────────────────────────────────────────────
  const handleResend = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setError('');
    setInfo('');
    setLoading(true);
    try {
      await sendEmailVerification(user, {
        url: window.location.href,
        handleCodeInApp: false,
      });
      setInfo('Link reenviado! Verifique sua caixa de entrada (e o spam).');
    } catch (err: any) {
      if (err.code === 'auth/too-many-requests') {
        setError('Aguarde alguns minutos antes de reenviar.');
      } else {
        setError('Erro ao reenviar. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Google OAuth ──────────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (!user.email) throw new Error('Não foi possível obter seu e-mail do Google.');

      const emailQ = query(collection(db, 'users'), where('email', '==', user.email));
      const emailSnap = await getDocs(emailQ);
      const conflict = emailSnap.docs.find(d => d.id !== user.uid);
      if (conflict) {
        setError('Este e-mail já está vinculado a outra conta. Use o método de login original.');
        await signOut(auth);
        return;
      }

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        const baseHandle = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || 'Novo Usuário',
          photoURL: user.photoURL,
          handle: `@${baseHandle}`,
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
      }
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') return;
      console.error(err);
      setError('Erro ao entrar com Google. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // ── Cancel verification ───────────────────────────────────────────────────────
  const handleCancelVerification = async () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    await signOut(auth).catch(() => {});
    setMode('login');
    setError('');
    setInfo('');
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setInfo('');
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[20%] left-[-10%] w-64 h-64 bg-moss-500/20 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-64 h-64 bg-purple-600/20 rounded-full blur-[80px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm z-10"
      >
        <div className="text-center mb-10">
          <Logo size={140} className="mb-8 justify-center" />
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">
            Feed<span className="text-moss-400">BECK</span>
          </h1>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-[0.3em] mt-2">
            Rede Social de Brisados
          </p>
        </div>

        <div className="glass-card p-8 rounded-[40px] border border-white/5 relative overflow-hidden">
          <AnimatePresence mode="wait">

            {/* ── LOGIN ──────────────────────────────────────────────────── */}
            {mode === 'login' && (
              <motion.div key="login" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-5">
                <TabSwitcher active="login" onSwitch={switchMode} />

                <form onSubmit={handleLogin} className="space-y-4">
                  <Field label="E-mail">
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@exemplo.com" className={inputCls} />
                  </Field>
                  <Field label="Senha">
                    <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className={inputCls} />
                    <button type="button" onClick={() => switchMode('forgot_password')} className="text-[10px] font-bold uppercase tracking-widest text-moss-500 hover:text-moss-400 transition-colors mt-1 ml-1">
                      Esqueci minha senha
                    </button>
                  </Field>

                  {error && <ErrorBox message={error} />}
                  {info && <InfoBox message={info} />}
                  <SubmitButton loading={loading} icon={<LogIn size={18} />} label="Entrar" />
                </form>

                <Divider />
                <GoogleButton loading={loading} onClick={handleGoogle} />
              </motion.div>
            )}

            {/* ── REGISTER ───────────────────────────────────────────────── */}
            {mode === 'register' && (
              <motion.div key="register" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                <TabSwitcher active="register" onSwitch={switchMode} />

                <form onSubmit={handleRegister} className="space-y-4">
                  <Field label="Seu Nome">
                    <input type="text" required value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Como te chamam?" className={inputCls} />
                  </Field>
                  <Field label="Username (@)">
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-moss-500/60 font-black text-sm select-none">@</span>
                      <input type="text" required value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="seu_vulgo" className={`${inputCls} pl-10`} />
                    </div>
                  </Field>
                  <Field label="E-mail">
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@exemplo.com" className={inputCls} />
                  </Field>
                  <Field label="Senha">
                    <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className={inputCls} />
                  </Field>
                  <Field label="Confirmar Senha">
                    <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repita a senha" className={inputCls} />
                  </Field>

                  {error && <ErrorBox message={error} />}
                  <SubmitButton loading={loading} icon={<UserPlus size={18} />} label="Criar Conta" />
                </form>

                <Divider />
                <GoogleButton loading={loading} onClick={handleGoogle} />
              </motion.div>
            )}

            {/* ── AWAITING VERIFICATION ──────────────────────────────────── */}
            {mode === 'awaiting_verification' && (
              <motion.div key="awaiting" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-6 text-center">
                <div className="relative mx-auto w-20 h-20">
                  <motion.div
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="w-20 h-20 bg-moss-500/20 rounded-[28px] flex items-center justify-center text-moss-400 border border-moss-500/20 shadow-[0_0_30px_rgba(34,197,94,0.15)]"
                  >
                    <Mail size={36} />
                  </motion.div>
                  <motion.div
                    animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute inset-0 rounded-[28px] border-2 border-moss-500/30"
                  />
                </div>

                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tighter italic mb-2">Verifique seu E-mail</h2>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Enviamos um link para <span className="text-moss-400 font-bold">{email || auth.currentUser?.email}</span>. Clique nele para ativar sua conta.
                  </p>
                  <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mt-3">
                    Esta tela atualiza automaticamente ✦
                  </p>
                </div>

                <div className="flex items-center justify-center gap-2 text-moss-500/50">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                    <RefreshCw size={14} />
                  </motion.div>
                  <span className="text-[10px] font-bold uppercase tracking-widest">Aguardando verificação…</span>
                </div>

                {error && <ErrorBox message={error} />}
                {info && <InfoBox message={info} />}

                <div className="space-y-3">
                  <button onClick={handleResend} disabled={loading} className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-2xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                    {loading ? <Spinner /> : <><RefreshCw size={16} /> Reenviar e-mail</>}
                  </button>
                  <button onClick={handleCancelVerification} className="w-full py-3 text-gray-600 hover:text-gray-400 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
                    <ArrowLeft size={14} /> Usar outro e-mail
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── FORGOT PASSWORD ────────────────────────────────────────── */}
            {mode === 'forgot_password' && (
              <motion.div key="forgot" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                <div className="text-center">
                  <div className="w-14 h-14 bg-moss-500/20 rounded-[20px] flex items-center justify-center text-moss-400 mx-auto mb-4">
                    <KeyRound size={28} />
                  </div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tighter italic">Recuperar Senha</h2>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1 font-bold">Enviaremos um link de redefinição</p>
                </div>

                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <Field label="Seu E-mail">
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@exemplo.com" className={inputCls} />
                  </Field>
                  {error && <ErrorBox message={error} />}
                  {info && <InfoBox message={info} />}
                  <SubmitButton loading={loading} icon={<Mail size={18} />} label="Enviar Link" />
                </form>

                <button onClick={() => switchMode('login')} className="w-full py-3 text-gray-600 hover:text-gray-400 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
                  <ArrowLeft size={14} /> Voltar para login
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        <footer className="mt-10 text-center">
          <div className="flex items-center justify-center gap-3 text-gray-600">
            <Sparkles size={16} />
            <p className="text-[10px] font-bold uppercase tracking-widest">Experiência Social Imersiva</p>
          </div>
        </footer>
      </motion.div>
    </div>
  );
}

// ─── Shared style ──────────────────────────────────────────────────────────────
const inputCls =
  'w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm focus:border-moss-500 focus:bg-moss-500/5 outline-none transition-all placeholder:text-gray-700 text-white';

// ─── Small UI helpers ──────────────────────────────────────────────────────────
function TabSwitcher({ active, onSwitch }: { active: 'login' | 'register'; onSwitch: (m: any) => void }) {
  return (
    <div className="flex bg-white/5 p-1 rounded-2xl mb-2">
      {(['login', 'register'] as const).map(tab => (
        <button
          key={tab}
          type="button"
          onClick={() => onSwitch(tab)}
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-xl transition-all ${active === tab ? 'bg-moss-500 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
        >
          {tab === 'login' ? 'Entrar' : 'Criar Conta'}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] uppercase tracking-widest font-bold text-gray-600 block mx-1">{label}</label>
      {children}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400">
      <AlertCircle size={14} className="shrink-0 mt-0.5" />
      <span className="text-[11px] font-bold leading-relaxed">{message}</span>
    </motion.div>
  );
}

function InfoBox({ message }: { message: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2 p-4 bg-moss-500/10 border border-moss-500/20 rounded-2xl text-moss-400">
      <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
      <span className="text-[11px] font-bold leading-relaxed">{message}</span>
    </motion.div>
  );
}

function SubmitButton({ loading, icon, label }: { loading: boolean; icon: React.ReactNode; label: string }) {
  return (
    <button disabled={loading} className="w-full bg-moss-500 hover:bg-moss-400 disabled:opacity-50 text-white py-4 rounded-2xl font-black uppercase tracking-[0.3em] shadow-lg shadow-moss-900/40 flex items-center justify-center gap-3 transition-all text-sm">
      {loading ? <Spinner /> : <>{icon} {label}</>}
    </button>
  );
}

function GoogleButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={loading} className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white py-4 rounded-2xl font-bold uppercase tracking-widest flex items-center justify-center gap-3 transition-all text-xs disabled:opacity-50">
      <img src="https://www.google.com/favicon.ico" className="w-4 h-4 grayscale opacity-70" alt="" />
      Entrar com Google
    </button>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-4">
      <div className="h-[1px] flex-1 bg-white/5" />
      <span className="text-[9px] uppercase font-bold text-gray-700 tracking-widest">ou</span>
      <div className="h-[1px] flex-1 bg-white/5" />
    </div>
  );
}

function Spinner() {
  return <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />;
}
