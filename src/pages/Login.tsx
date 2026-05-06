import React, { useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, UserPlus, Sparkles, AlertCircle } from 'lucide-react';
import Logo from '../components/Logo';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Por favor, informe seu e-mail para recuperar a senha.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMessage('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
    } catch (err: any) {
      console.error(err);
      setError('Erro ao enviar e-mail de recuperação. Verifique o endereço digitado.');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // Validate fields for sign up
        if (!username || !displayName) {
          throw new Error('Preencha todos os campos para entrar na brisa.');
        }
        if (username.length < 3) {
          throw new Error('Username deve ter pelo menos 3 caracteres.');
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Create initial profile so onboarding can skip or use these
        try {
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: user.email,
            handle: `@${username.toLowerCase().trim()}`,
            displayName: displayName.trim(),
            createdAt: serverTimestamp(),
            onboardingComplete: true, // Mark as true so they skip step 1 in App.tsx logic and go directly to tutorial if needed
            tutorial_completed: false
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('O método E-mail/Senha está desativado no Firebase. Ative-o em: Authentication > Sign-in method > Email/Password.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Erro de conexão. Verifique sua internet.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.message.includes('auth/invalid-credential')) {
        setError('E-mail ou senha incorretos.');
      } else {
        setError(err.message.includes('auth/email-already-in-use') 
          ? 'Este e-mail já está em uso.' 
          : 'Erro ao autenticar. Verifique seus dados.');
      }
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (!user.email) {
        throw new Error('Não foi possível obter seu e-mail do Google.');
      }

      // Check if this email is already linked to ANOTHER uid in Firestore
      const emailQuery = query(collection(db, 'users'), where('email', '==', user.email));
      const emailSnap = await getDocs(emailQuery);
      
      const existingDoc = emailSnap.docs.find(d => d.id !== user.uid);
      if (existingDoc) {
        setError('Este e-mail já está vinculado a outra conta. Use o método de login original.');
        await auth.signOut();
        setLoading(false);
        return;
      }

      // Ensure minimal profile exists for stats and early tracking
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || 'Novo Usuário',
          photoURL: user.photoURL,
          handle: user.email ? `@${user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')}` : `@user${user.uid.slice(0,5)}`,
          onboardingComplete: true,
          tutorial_completed: false,
          createdAt: serverTimestamp()
        });
      }
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        // User closed the popup, just stop loading without showing error
        setLoading(false);
        return;
      }
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('O Login com Google está desabilitado no Console do Firebase.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Erro de conexão com o Google. Verifique sua internet.');
      } else {
        setError('Erro ao entrar com Google. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-[20%] left-[-10%] w-64 h-64 bg-moss-500/20 rounded-full blur-[80px]" />
      <div className="absolute bottom-[20%] right-[-10%] w-64 h-64 bg-purple-600/20 rounded-full blur-[80px]" />

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
          <p className="text-gray-500 text-xs font-bold uppercase tracking-[0.3em] mt-2">Rede Social de Brisados</p>
        </div>

        <div className="glass-card p-8 rounded-[40px] border border-white/5 relative overflow-hidden">
          <div className="flex bg-white/5 p-1 rounded-2xl mb-8">
            <button 
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-xl transition-all ${isLogin ? 'bg-moss-500 text-white shadow-lg' : 'text-gray-500'}`}
            >
              Entrar
            </button>
            <button 
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-xl transition-all ${!isLogin ? 'bg-moss-500 text-white shadow-lg' : 'text-gray-500'}`}
            >
              Criar Conta
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-hidden"
                >
                  <div className="space-y-4">
                    <div className="relative group/input">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-moss-500/60 mb-2 block mx-2 group-focus-within/input:text-moss-400 transition-colors">Nome Completo</label>
                      <div className="relative">
                        <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 text-moss-500/30 group-focus-within/input:text-moss-400 transition-colors" size={16} />
                        <input 
                          type="text" 
                          required={!isLogin}
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Como te chamam?"
                          className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-5 py-3.5 text-sm focus:border-moss-500 focus:bg-moss-500/5 outline-none transition-all placeholder:text-gray-700"
                        />
                      </div>
                    </div>
                    <div className="relative group/input">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-moss-500/60 mb-2 block mx-2 group-focus-within/input:text-moss-400 transition-colors">Username (@)</label>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-moss-500/30 font-black text-sm group-focus-within/input:text-moss-400 transition-colors">@</div>
                        <input 
                          type="text" 
                          required={!isLogin}
                          value={username}
                          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                          placeholder="seu_vulgo"
                          className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-5 py-3.5 text-sm focus:border-moss-500 focus:bg-moss-500/5 outline-none transition-all placeholder:text-gray-700"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative group/input">
              <label className="text-[10px] uppercase tracking-widest font-bold text-gray-600 mb-2 block mx-2 group-focus-within/input:text-moss-400">E-mail</label>
              <input 
                type="email" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm focus:border-moss-500 focus:bg-moss-500/5 outline-none transition-all placeholder:text-gray-700"
              />
            </div>
            <div className="relative group/input">
              <label className="text-[10px] uppercase tracking-widest font-bold text-gray-600 mb-2 block mx-2 group-focus-within/input:text-moss-400">Senha</label>
              <input 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm focus:border-moss-500 focus:bg-moss-500/5 outline-none transition-all placeholder:text-gray-700"
              />
              {isLogin && (
                <div className="flex justify-end mt-2 items-center gap-2">
                  <button 
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-[10px] font-bold uppercase tracking-widest text-moss-500 hover:text-moss-400 transition-colors px-1"
                  >
                    Esqueci minha senha
                  </button>
                </div>
              )}
            </div>

            {successMessage && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-moss-500/10 border border-moss-500/20 rounded-[24px] text-moss-400 text-[10px] font-bold uppercase tracking-wider text-center"
              >
                {successMessage}
              </motion.div>
            )}

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex flex-col gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-[24px] text-red-500"
              >
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                  <AlertCircle size={14} />
                  {error.includes('Firebase') ? 'Erro Técnico Detectado' : error}
                </div>
                {error.includes('desativado') && (
                  <p className="text-[9px] leading-relaxed opacity-80 font-medium">
                    Para resolver, acesse o Console do Firebase, vá em <span className="font-bold underline">Authentication &gt; Sign-in method</span> e ative os provedores necessários (E-mail, Google ou Anônimo).
                  </p>
                )}
              </motion.div>
            )}

            <button 
              disabled={loading}
              className="w-full bg-moss-500 hover:bg-moss-400 disabled:opacity-50 text-white py-4 rounded-2xl font-black uppercase tracking-[0.3em] shadow-lg shadow-moss-900/40 flex items-center justify-center gap-3 transition-all"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isLogin ? <LogIn size={18} /> : <UserPlus size={18} />}
                  {isLogin ? 'Iniciar Brisa' : 'Entrar na Brisa'}
                </>
              )}
            </button>
          </form>

          <div className="my-8 flex items-center gap-4">
             <div className="h-[1px] flex-1 bg-white/5" />
             <span className="text-[9px] uppercase font-bold text-gray-700 tracking-widest">ou</span>
             <div className="h-[1px] flex-1 bg-white/5" />
          </div>

          <button 
            onClick={signInWithGoogle}
            disabled={loading}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white py-4 rounded-2xl font-bold uppercase tracking-widest flex items-center justify-center gap-3 transition-all text-xs"
          >
            <img src="https://www.google.com/favicon.ico" className="w-4 h-4 grayscale opacity-70" alt="Google" />
            Entrar com Google
          </button>
        </div>

        <footer className="mt-10 text-center space-y-4">
           <div className="flex items-center justify-center gap-3 text-gray-600">
             <Sparkles size={16} />
             <p className="text-[10px] font-bold uppercase tracking-widest">Experiência Social Imersiva</p>
           </div>
        </footer>
      </motion.div>
    </div>
  );
}
