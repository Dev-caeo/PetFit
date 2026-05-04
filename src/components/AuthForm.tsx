import React, { useState } from 'react';
import { auth } from '../lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { motion } from 'motion/react';
import { Activity, Mail, Lock, User, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

export function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg p-4 transition-colors duration-300">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-brand-surface rounded-3xl p-8 shadow-xl border border-brand-border transition-colors duration-300"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-brand-primary rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-brand-primary/20">
            <Activity size={28} />
          </div>
          <h1 className="text-3xl font-bold text-brand-primary">PetFit</h1>
          <p className="text-brand-muted mt-2 text-center transition-colors duration-300">
            {isLogin ? 'Bem-vindo de volta! Entre para acompanhar seu pet.' : 'Crie sua conta para começar a cuidar do seu pet.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-1">
              <label className="text-sm font-semibold text-brand-text ml-1 opacity-80">Nome</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted" size={18} />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-brand-bg border border-brand-border rounded-2xl outline-none focus:border-brand-primary transition-all text-brand-text"
                  placeholder="Seu nome"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-semibold text-brand-text ml-1 opacity-80">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted" size={18} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-brand-bg border border-brand-border rounded-2xl outline-none focus:border-brand-primary transition-all text-brand-text"
                placeholder="seu@email.com"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-brand-text ml-1 opacity-80">Senha</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted" size={18} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-brand-bg border border-brand-border rounded-2xl outline-none focus:border-brand-primary transition-all text-brand-text"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-sm mt-2 ml-1 animate-pulse">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-primary text-brand-bg py-4 rounded-2xl font-bold text-lg shadow-lg shadow-brand-primary/20 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" /> : (isLogin ? 'Entrar' : 'Criar Conta')}
          </button>
        </form>

        <div className="mt-8 text-center bg-brand-bg/50 p-4 rounded-2xl border border-brand-border transition-colors duration-300">
          <p className="text-brand-muted text-sm transition-colors duration-300">
            {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="ml-2 text-brand-primary font-bold hover:underline"
            >
              {isLogin ? 'Cadastre-se' : 'Entrar'}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
