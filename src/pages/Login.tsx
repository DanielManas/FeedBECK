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
  getDocs,
  collection, query, where,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail, LogIn, UserPlus, Sparkles, AlertCircle,
  CheckCircle2, ArrowLeft, RefreshCw, KeyRound,
} from 'lucide-react';
import Logo from '../components/Logo';

type Mode = 'login' | 'register' | 'awaiting_verification' | 'forgot_password';

// Translates Firebase error codes into Portuguese messages
function firebaseError(code: string): string {
  const map: Record<string, string> = {
    'auth/invalid-email':          'E-mail inválido.',
    'auth/user-not-found':         'Nenhuma conta com esse e-mail.',
    'auth/wrong-password':         'Senha incorreta.',
    'auth/invalid-credential':     'E-mail ou senha incorretos.',
    'auth/email-already-in-use':   'Este e-mail já possui uma conta.',
    'auth/weak-password':          'Senha muito fraca. Use pelo menos 6 caracteres.',
    'auth/too-many-requests':      'Muitas tentativas. Aguarde alguns minutos.',
    'auth/network-request-failed': 'Sem conexão. Verifique sua internet.',
    'auth/operation-not-allowed':  'Método de login não ativado no Firebase.',
    'auth/popup-blocked':          'Popup bloqueado pelo navegador. Permita popups para este site.',
    'auth/popup-closed-by-user':   '',   // intentional — user closed popup
  };
  return map[code] ?? `Erro inesperado (${code}). Tente novamente.`;
}

export default function Login() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername]         = useState('');
  const [displayName, setDisplayName]   = useState('');
  const [error, setError]   = useState('');
  const [info, setInfo]     = useState('');
  const [loading, setLoading] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current); }, []);

  // ── Polling: every 3 s reload user and check emailVerified ────────────────
  const startPolling = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        await reload(user);
        if (user.emailVerified) {
          clearInterval(pollingRef.current!);
          // AuthContext reacts automatically — no extra navigate needed
        }
      } catch { /* ignore network blips */ }
    }, 3000);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const switchMode = (next: Mode) => { setMode(next); setError(''); setInfo(''); };

  const setErr = (msg: string) => { setError(msg); setInfo(''); };
  const setOk  = (msg: string) => { setInfo(msg);  setError(''); };

  // ── Register ──────────────────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setInfo('');

    if (!displayName.trim())              return setErr('Informe seu nome.');
    if (username.trim().length < 3)       return setErr('Username deve ter ao menos 3 caracteres.');
    if (!/^[a-z0-9_]+$/.test(username))  return setErr('Username: apenas letras minúsculas, números e _');
    if (password.length < 6)             return setErr('Senha deve ter ao menos 6 caracteres.');
    if (password !== confirmPassword)    return setErr('As senhas não coincidem.');

    setLoading(true);
    try {
      // 1. Handle uniqueness check
      const handle = `@${username.toLowerCase().trim()}`;
      const snap = await getDocs(query(collection(db, 'users'), where('handle', '==', handle)));
      if (!snap.empty) return setErr('Esse @ já está em uso. Escolha outro.');

      // 2. Create auth account
      const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);

      // 3. Save pending profile data in localStorage (NOT Firestore yet)
      // Profile will only be created in Firestore after email is verified.
      const pendingProfile = {
        uid: user.uid,
        email: user.email,
        handle,
        displayName: displayName.trim(),
      };
      window.localStorage.setItem('feedbeck_pending_profile', JSON.stringify(pendingProfile));

      // 4. Send verification email
      await sendEmailVerification(user);

      // 5. Show waiting screen
      setMode('awaiting_verification');
      startPolling();
    } catch (err: any) {
      console.error('[Register]', err.code, err.message);
      const msg = firebaseError(err.code);
      if (msg) setErr(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Login ─────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setInfo('');
    setLoading(true);
    try {
      const { user } = await signInWithEmailAndPassword(auth, email.trim(), password);
      console.log('[Login] success, emailVerified:', user.emailVerified);

      if (!user.emailVerified) {
        // Resend verification and hold them on the waiting screen
        await sendEmailVerification(user);
        setMode('awaiting_verification');
        startPolling();
        setOk('Conta ainda não verificada. Reenviamos o link para ' + user.email);
        return;
      }
      // Verified → AuthContext will navigate automatically
    } catch (err: any) {
      console.error('[Login]', err.code, err.message);
      const msg = firebaseError(err.code);
      if (msg) setErr(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot password ───────────────────────────────────────────────────────
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setInfo('');
    if (!email.trim()) return setErr('Digite seu e-mail acima.');

    setLoading(true);
    try {
      // actionCodeSettings intentionally omitted — uses Firebase default (works everywhere)
      await sendPasswordResetEmail(auth, email.trim());
      console.log('[ForgotPassword] reset email sent to', email.trim());
      setOk('E-mail de recuperação enviado! Verifique também o spam.');
    } catch (err: any) {
      console.error('[ForgotPassword]', err.code, err.message);
      const msg = firebaseError(err.code);
      if (msg) setErr(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Resend verification ───────────────────────────────────────────────────
  const handleResend = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setError(''); setInfo(''); setLoading(true);
    try {
      await sendEmailVerification(user);
      setOk('Link reenviado! Verifique também o spam.');
    } catch (err: any) {
      console.error('[Resend]', err.code, err.message);
      setErr(firebaseError(err.code));
    } finally {
      setLoading(false);
    }
  };

  // ── Google ────────────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setError(''); setInfo(''); setLoading(true);
    try {
      const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
      if (!user.email) throw new Error('auth/no-email');

      // Collision check
      const snap = await getDocs(query(collection(db, 'users'), where('email', '==', user.email)));
      if (snap.docs.some(d => d.id !== user.uid)) {
        setErr('E-mail já vinculado a outra conta. Use o login original.');
        await signOut(auth);
        return;
      }

      // First login — create profile
      const ref = doc(db, 'users', user.uid);
      if (!(await getDoc(ref)).exists()) {
        const base = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        await setDoc(ref, {
          uid: user.uid, email: user.email,
          displayName: user.displayName || 'Novo Usuário',
          photoURL: user.photoURL,
          handle: `@${base}`,
          onboardingComplete: false, tutorial_completed: false,
          followersCount: 0, followingCount: 0, postsCount: 0,
          munchiesCount: 0, moviesCount: 0, categoryCounts: {},
          dominantVibe: 'semente', totalSintonias: 0,
          redEyesCount: 0, showRedEyes: true,
          rainbowActive: false, yarokActive: false,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
      }
    } catch (err: any) {
      console.error('[Google]', err.code, err.message);
      const msg = firebaseError(err.code);
      if (msg) setErr(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Cancel verification ───────────────────────────────────────────────────
  const cancelVerification = async () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    await signOut(auth).catch(() => {});
    switchMode('login');
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[20%] left-[-10%] w-64 h-64 bg-moss-500/20 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-64 h-64 bg-purple-600/20 rounded-full blur-[80px] pointer-events-none" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm z-10">

        {/* Logo */}
        <div className="text-center mb-10">
          <Logo size={140} className="mb-8 justify-center" />
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">
            Feed<span className="text-moss-400">BECK</span>
          </h1>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-[0.3em] mt-2">Rede Social de Brisados</p>
        </div>

        <div className="glass-card p-8 rounded-[40px] border border-white/5">
          <AnimatePresence mode="wait">

            {/* LOGIN */}
            {mode === 'login' && (
              <motion.div key="login" {...slide('left')} className="space-y-5">
                <Tabs active="login" onSwitch={switchMode} />
                <form onSubmit={handleLogin} className="space-y-4">
                  <Field label="E-mail">
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="voce@exemplo.com" className={inputCls} />
                  </Field>
                  <Field label="Senha">
                    <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••" className={inputCls} />
                    <button type="button" onClick={() => switchMode('forgot_password')}
                      className="text-[10px] font-bold uppercase tracking-widest text-moss-500 hover:text-moss-400 mt-1 ml-1 transition-colors">
                      Esqueci minha senha
                    </button>
                  </Field>
                  {error && <Err msg={error} />}
                  {info  && <Ok  msg={info}  />}
                  <Btn loading={loading} icon={<LogIn size={18}/>} label="Entrar" />
                </form>
                <Divider />
                <GBtn loading={loading} onClick={handleGoogle} />
              </motion.div>
            )}

            {/* REGISTER */}
            {mode === 'register' && (
              <motion.div key="register" {...slide('right')} className="space-y-5">
                <Tabs active="register" onSwitch={switchMode} />
                <form onSubmit={handleRegister} className="space-y-4">
                  <Field label="Seu Nome">
                    <input type="text" required value={displayName} onChange={e => setDisplayName(e.target.value)}
                      placeholder="Como te chamam?" className={inputCls} />
                  </Field>
                  <Field label="Username (@)">
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-moss-500/60 font-black text-sm select-none">@</span>
                      <input type="text" required value={username}
                        onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        placeholder="seu_vulgo" className={`${inputCls} pl-10`} />
                    </div>
                  </Field>
                  <Field label="E-mail">
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="voce@exemplo.com" className={inputCls} />
                  </Field>
                  <Field label="Senha">
                    <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres" className={inputCls} />
                  </Field>
                  <Field label="Confirmar Senha">
                    <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Repita a senha" className={inputCls} />
                  </Field>
                  {error && <Err msg={error} />}
                  <Btn loading={loading} icon={<UserPlus size={18}/>} label="Criar Conta" />
                </form>
                <Divider />
                <GBtn loading={loading} onClick={handleGoogle} />
              </motion.div>
            )}

            {/* AWAITING VERIFICATION */}
            {mode === 'awaiting_verification' && (
              <motion.div key="awaiting" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="space-y-6 text-center">
                <div className="relative mx-auto w-20 h-20">
                  <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2, repeat: Infinity }}
                    className="w-20 h-20 bg-moss-500/20 rounded-[28px] flex items-center justify-center text-moss-400 border border-moss-500/20 shadow-[0_0_30px_rgba(34,197,94,0.15)]">
                    <Mail size={36} />
                  </motion.div>
                  <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }} transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 rounded-[28px] border-2 border-moss-500/30" />
                </div>

                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tighter italic mb-2">Verifique seu E-mail</h2>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Enviamos um link para{' '}
                    <span className="text-moss-400 font-bold">{email || auth.currentUser?.email}</span>.
                    {' '}Clique nele para ativar sua conta.
                  </p>
                  <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mt-3">
                    Verifique também a pasta de spam
                  </p>
                </div>

                <div className="flex items-center justify-center gap-2 text-moss-500/50">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                    <RefreshCw size={14} />
                  </motion.div>
                  <span className="text-[10px] font-bold uppercase tracking-widest">Aguardando verificação…</span>
                </div>

                {error && <Err msg={error} />}
                {info  && <Ok  msg={info}  />}

                <div className="space-y-3">
                  <button onClick={handleResend} disabled={loading}
                    className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-2xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                    {loading ? <Spinner /> : <><RefreshCw size={16}/> Reenviar e-mail</>}
                  </button>
                  <button onClick={cancelVerification}
                    className="w-full py-3 text-gray-600 hover:text-gray-400 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
                    <ArrowLeft size={14}/> Usar outro e-mail
                  </button>
                </div>
              </motion.div>
            )}

            {/* FORGOT PASSWORD */}
            {mode === 'forgot_password' && (
              <motion.div key="forgot" {...slide('right')} className="space-y-5">
                <div className="text-center">
                  <div className="w-14 h-14 bg-moss-500/20 rounded-[20px] flex items-center justify-center text-moss-400 mx-auto mb-4">
                    <KeyRound size={28}/>
                  </div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tighter italic">Recuperar Senha</h2>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1 font-bold">Enviaremos um link de redefinição</p>
                </div>
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <Field label="Seu E-mail">
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="voce@exemplo.com" className={inputCls} />
                  </Field>
                  {error && <Err msg={error} />}
                  {info  && <Ok  msg={info}  />}
                  <Btn loading={loading} icon={<Mail size={18}/>} label="Enviar Link" />
                </form>
                <button onClick={() => switchMode('login')}
                  className="w-full py-3 text-gray-600 hover:text-gray-400 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
                  <ArrowLeft size={14}/> Voltar para login
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        <footer className="mt-10 text-center">
          <div className="flex items-center justify-center gap-3 text-gray-600">
            <Sparkles size={16}/>
            <p className="text-[10px] font-bold uppercase tracking-widest">Experiência Social Imersiva</p>
          </div>
        </footer>
      </motion.div>
    </div>
  );
}

// ─── Styles & micro-components ─────────────────────────────────────────────────
const inputCls = 'w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm focus:border-moss-500 focus:bg-moss-500/5 outline-none transition-all placeholder:text-gray-700 text-white';

const slide = (from: 'left' | 'right') => ({
  initial: { opacity: 0, x: from === 'left' ? -20 : 20 },
  animate: { opacity: 1, x: 0 },
  exit:    { opacity: 0, x: from === 'left' ? 20 : -20 },
});

function Tabs({ active, onSwitch }: { active: 'login' | 'register'; onSwitch: (m: any) => void }) {
  return (
    <div className="flex bg-white/5 p-1 rounded-2xl mb-2">
      {(['login', 'register'] as const).map(tab => (
        <button key={tab} type="button" onClick={() => onSwitch(tab)}
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-xl transition-all ${active === tab ? 'bg-moss-500 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>
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

function Err({ msg }: { msg: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400">
      <AlertCircle size={14} className="shrink-0 mt-0.5"/>
      <span className="text-[11px] font-bold leading-relaxed">{msg}</span>
    </motion.div>
  );
}

function Ok({ msg }: { msg: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2 p-4 bg-moss-500/10 border border-moss-500/20 rounded-2xl text-moss-400">
      <CheckCircle2 size={14} className="shrink-0 mt-0.5"/>
      <span className="text-[11px] font-bold leading-relaxed">{msg}</span>
    </motion.div>
  );
}

function Btn({ loading, icon, label }: { loading: boolean; icon: React.ReactNode; label: string }) {
  return (
    <button disabled={loading}
      className="w-full bg-moss-500 hover:bg-moss-400 disabled:opacity-50 text-white py-4 rounded-2xl font-black uppercase tracking-[0.3em] shadow-lg shadow-moss-900/40 flex items-center justify-center gap-3 transition-all text-sm">
      {loading ? <Spinner /> : <>{icon} {label}</>}
    </button>
  );
}

function GBtn({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={loading} type="button"
      className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white py-4 rounded-2xl font-bold uppercase tracking-widest flex items-center justify-center gap-3 transition-all text-xs disabled:opacity-50">
      <img src="https://www.google.com/favicon.ico" className="w-4 h-4 grayscale opacity-70" alt=""/>
      Entrar com Google
    </button>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-4">
      <div className="h-[1px] flex-1 bg-white/5"/>
      <span className="text-[9px] uppercase font-bold text-gray-700 tracking-widest">ou</span>
      <div className="h-[1px] flex-1 bg-white/5"/>
    </div>
  );
}

function Spinner() {
  return <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>;
}
