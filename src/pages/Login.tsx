import React, { useState, useEffect } from 'react';
import {
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  updatePassword,
  signInWithPopup,
  GoogleAuthProvider,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, LogIn, Sparkles, AlertCircle, CheckCircle2, ArrowLeft, KeyRound, AtSign } from 'lucide-react';
import Logo from '../components/Logo';

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = 'request_link' | 'check_email' | 'complete_signup';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const EMAIL_KEY = 'feedbeck_email_for_signin';

function getActionCodeSettings() {
  // In production this should be your real domain.
  // Firebase will redirect back here after the user clicks the link.
  const url = window.location.href.split('#')[0]; // strip hash, keep origin
  return {
    url,
    handleCodeInApp: true,
  };
}

async function isEmailAlreadyRegistered(email: string): Promise<boolean> {
  try {
    const methods = await fetchSignInMethodsForEmail(auth, email);
    return methods.length > 0;
  } catch {
    return false;
  }
}

async function handleExistingFirestoreEmail(email: string): Promise<boolean> {
  const q = query(collection(db, 'users'), where('email', '==', email));
  const snap = await getDocs(q);
  return !snap.empty;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Login() {
  const [step, setStep] = useState<Step>('request_link');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ── On mount: detect if we were redirected back with a sign-in link ─────────
  useEffect(() => {
    if (!isSignInWithEmailLink(auth, window.location.href)) return;

    const savedEmail = window.localStorage.getItem(EMAIL_KEY) ?? '';
    setEmail(savedEmail);
    setStep('complete_signup');
  }, []);

  // ── Step 1: Send the magic link ──────────────────────────────────────────────
  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Digite um e-mail válido.'); return; }

    setLoading(true);
    try {
      // Prevent duplicate accounts
      const alreadyExists = await isEmailAlreadyRegistered(email.trim());
      if (alreadyExists) {
        setError('Este e-mail já possui uma conta. Use "Entrar com Google" ou entre em contato com o suporte.');
        setLoading(false);
        return;
      }

      await sendSignInLinkToEmail(auth, email.trim(), getActionCodeSettings());
      window.localStorage.setItem(EMAIL_KEY, email.trim());
      setStep('check_email');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-email') setError('E-mail inválido.');
      else if (err.code === 'auth/operation-not-allowed')
        setError('Email Link não está ativado no Firebase. Ative em Authentication → Sign-in method → Email link.');
      else setError('Não foi possível enviar o link. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Complete signup after clicking the link ──────────────────────────
  const handleCompleteSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!displayName.trim()) { setError('Informe seu nome.'); return; }
    if (!username.trim() || username.length < 3) { setError('Username deve ter pelo menos 3 caracteres.'); return; }
    if (password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return; }
    if (password !== confirmPassword) { setError('As senhas não coincidem.'); return; }

    const emailToUse = email || window.localStorage.getItem(EMAIL_KEY) || '';
    if (!emailToUse) {
      setError('E-mail não encontrado. Reinicie o processo.');
      setStep('request_link');
      return;
    }

    setLoading(true);
    try {
      // 1. Sign in with the magic link (proves email ownership)
      const result = await signInWithEmailLink(auth, emailToUse, window.location.href);
      const user = result.user;

      // 2. Set a real password so the user can log in later with email+password too
      const credential = EmailAuthProvider.credentialWithLink(emailToUse, window.location.href);
      await updatePassword(user, password);

      // 3. Check handle uniqueness
      const cleanHandle = `@${username.toLowerCase().trim()}`;
      const handleQ = query(collection(db, 'users'), where('handle', '==', cleanHandle));
      const handleSnap = await getDocs(handleQ);
      if (!handleSnap.empty) {
        setError('Esse username já está em uso. Escolha outro.');
        setLoading(false);
        return;
      }

      // 4. Create Firestore profile
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        handle: cleanHandle,
        displayName: displayName.trim(),
        photoURL: null,
        bio: '',
        isPrivate: false,
        onboardingComplete: false, // will go through avatar customization
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

      // 5. Clean up localStorage
      window.localStorage.removeItem(EMAIL_KEY);

      // App will react to onAuthStateChanged → profile loaded → redirect
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-action-code')
        setError('O link expirou ou já foi usado. Solicite um novo.');
      else if (err.code === 'auth/email-already-in-use')
        setError('Este e-mail já tem uma conta.');
      else setError('Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // ── Google OAuth (unchanged logic, unchanged UX) ─────────────────────────────
  const signInWithGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (!user.email) throw new Error('Não foi possível obter seu e-mail do Google.');

      // Prevent cross-account collisions
      const emailQ = query(collection(db, 'users'), where('email', '==', user.email));
      const emailSnap = await getDocs(emailQ);
      const conflict = emailSnap.docs.find(d => d.id !== user.uid);
      if (conflict) {
        setError('Este e-mail já está vinculado a outra conta. Use o método de login original.');
        await auth.signOut();
        return;
      }

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || 'Novo Usuário',
          photoURL: user.photoURL,
          handle: `@${user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')}`,
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

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-[20%] left-[-10%] w-64 h-64 bg-moss-500/20 rounded-full blur-[80px]" />
      <div className="absolute bottom-[20%] right-[-10%] w-64 h-64 bg-purple-600/20 rounded-full blur-[80px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm z-10"
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <Logo size={140} className="mb-8 justify-center" />
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">
            Feed<span className="text-moss-400">BECK</span>
          </h1>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-[0.3em] mt-2">Rede Social de Brisados</p>
        </div>

        <div className="glass-card p-8 rounded-[40px] border border-white/5 relative overflow-hidden">
          <AnimatePresence mode="wait">

            {/* ── STEP 1: Request link ─────────────────────────────────── */}
            {step === 'request_link' && (
              <motion.div
                key="request_link"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <div className="w-14 h-14 bg-moss-500/20 rounded-[20px] flex items-center justify-center text-moss-400 mx-auto mb-4">
                    <Mail size={28} />
                  </div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tighter italic">Criar Conta</h2>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1 font-bold">
                    Vamos confirmar seu e-mail primeiro
                  </p>
                </div>

                <form onSubmit={handleSendLink} className="space-y-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-gray-600 mb-2 block mx-2">
                      Seu E-mail
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="voce@exemplo.com"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm focus:border-moss-500 focus:bg-moss-500/5 outline-none transition-all placeholder:text-gray-700"
                    />
                  </div>

                  {error && <ErrorBox message={error} />}

                  <button
                    disabled={loading}
                    className="w-full bg-moss-500 hover:bg-moss-400 disabled:opacity-50 text-white py-4 rounded-2xl font-black uppercase tracking-[0.3em] shadow-lg shadow-moss-900/40 flex items-center justify-center gap-3 transition-all text-sm"
                  >
                    {loading
                      ? <Spinner />
                      : <><Mail size={18} /> Enviar Link de Verificação</>}
                  </button>
                </form>

                <Divider />

                <button
                  onClick={signInWithGoogle}
                  disabled={loading}
                  className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white py-4 rounded-2xl font-bold uppercase tracking-widest flex items-center justify-center gap-3 transition-all text-xs"
                >
                  <img src="https://www.google.com/favicon.ico" className="w-4 h-4 grayscale opacity-70" alt="Google" />
                  Entrar com Google
                </button>
              </motion.div>
            )}

            {/* ── STEP 2: Check email ──────────────────────────────────── */}
            {step === 'check_email' && (
              <motion.div
                key="check_email"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 text-center"
              >
                <div className="w-16 h-16 bg-moss-500/20 rounded-[20px] flex items-center justify-center text-moss-400 mx-auto">
                  <CheckCircle2 size={32} />
                </div>

                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tighter italic mb-2">
                    Verifique seu E-mail
                  </h2>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Enviamos um link para{' '}
                    <span className="text-moss-400 font-bold">{email}</span>.
                    Clique no link para continuar.
                  </p>
                  <p className="text-[10px] text-gray-600 mt-4 uppercase tracking-widest font-bold">
                    O link expira em 1 hora
                  </p>
                </div>

                <button
                  onClick={() => { setStep('request_link'); setError(''); }}
                  className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 py-4 rounded-2xl font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all text-xs"
                >
                  <ArrowLeft size={16} /> Usar outro e-mail
                </button>

                {/* Resend */}
                <p className="text-[10px] text-gray-600">
                  Não chegou?{' '}
                  <button
                    onClick={handleSendLink as any}
                    className="text-moss-400 font-bold hover:underline"
                  >
                    Reenviar link
                  </button>
                </p>
              </motion.div>
            )}

            {/* ── STEP 3: Complete signup ──────────────────────────────── */}
            {step === 'complete_signup' && (
              <motion.div
                key="complete_signup"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="text-center">
                  <div className="w-14 h-14 bg-moss-500/20 rounded-[20px] flex items-center justify-center text-moss-400 mx-auto mb-4">
                    <Sparkles size={28} />
                  </div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tighter italic">Quase lá!</h2>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1 font-bold">
                    Configure sua conta
                  </p>
                </div>

                <form onSubmit={handleCompleteSignup} className="space-y-4">
                  {/* Display name */}
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-gray-600 mb-2 block mx-2">
                      Seu Nome
                    </label>
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      placeholder="Como te chamam?"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm focus:border-moss-500 outline-none transition-all placeholder:text-gray-700"
                    />
                  </div>

                  {/* Username */}
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-gray-600 mb-2 block mx-2">
                      Username (@)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-moss-500/50 font-black text-sm">@</span>
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        placeholder="seu_vulgo"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 pr-5 py-3.5 text-sm focus:border-moss-500 outline-none transition-all placeholder:text-gray-700"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-gray-600 mb-2 block mx-2">
                      Criar Senha
                    </label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm focus:border-moss-500 outline-none transition-all placeholder:text-gray-700"
                    />
                  </div>

                  {/* Confirm password */}
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-gray-600 mb-2 block mx-2">
                      Confirmar Senha
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Repita a senha"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm focus:border-moss-500 outline-none transition-all placeholder:text-gray-700"
                    />
                  </div>

                  {/* E-mail display (read-only) */}
                  <div className="flex items-center gap-2 px-4 py-3 bg-moss-500/10 border border-moss-500/20 rounded-2xl">
                    <CheckCircle2 size={14} className="text-moss-400 shrink-0" />
                    <span className="text-[11px] text-moss-400 font-bold truncate">{email} verificado</span>
                  </div>

                  {error && <ErrorBox message={error} />}

                  <button
                    disabled={loading}
                    className="w-full bg-moss-500 hover:bg-moss-400 disabled:opacity-50 text-white py-4 rounded-2xl font-black uppercase tracking-[0.3em] shadow-lg shadow-moss-900/40 flex items-center justify-center gap-3 transition-all text-sm mt-2"
                  >
                    {loading ? <Spinner /> : <><LogIn size={18} /> Criar minha conta</>}
                  </button>
                </form>
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

// ─── Small helpers ─────────────────────────────────────────────────────────────
function ErrorBox({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-[20px] text-red-400"
    >
      <AlertCircle size={14} className="shrink-0 mt-0.5" />
      <span className="text-[11px] font-bold leading-relaxed">{message}</span>
    </motion.div>
  );
}

function Spinner() {
  return <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />;
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
