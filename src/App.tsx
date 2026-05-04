import React, { useState, useMemo, useEffect } from 'react';
import { 
  Trash2,
  Dog, 
  Cat, 
  Activity, 
  Utensils, 
  TrendingUp, 
  Settings, 
  Plus, 
  Calendar,
  Weight,
  ChevronRight,
  User as UserIcon,
  LogOut,
  Bell,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Moon,
  Sun,
  Loader2,
  X,
  Save,
  Check
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { PetProfile, CalorieLog, DailySummary, MealOption, MealCategory } from './types';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  doc,
  getDocFromServer,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { AuthForm } from './components/AuthForm';

// Helper for Firestore Errors
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
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Model Fallback for missing data
const DEFAULT_PET: PetProfile = {
  id: 'new',
  name: 'Carregando...',
  species: 'dog',
  breed: '-',
  age: 0,
  weight: 0,
  targetWeight: 0,
  dailyCalorieTarget: 1400,
};

const MOCK_MEAL_OPTIONS: MealOption[] = [
  { id: 'm1', name: 'Ração Premium Adulto', calories: 350, category: 'Café da manhã', description: 'Ração balanceada para cães adultos.', image: 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&q=80&w=100&h=100' },
  { id: 'm2', name: 'Mix de Vegetais e Frango', calories: 450, category: 'Almoço', description: 'Peito de frango cozido com cenoura e vagem.', image: 'https://images.unsplash.com/photo-1585073137640-441230280146?auto=format&fit=crop&q=80&w=100&h=100' },
  { id: 'm3', name: 'Ração Úmida Gourmet', calories: 400, category: 'Jantar', description: 'Patê de carne com molho especial.', image: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&q=80&w=100&h=100' },
  { id: 'm4', name: 'Biscoito de Maçã e Canela', calories: 50, category: 'Snacks', description: 'Petisco natural e crocante.', image: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&q=80&w=100&h=100' },
  { id: 'm5', name: 'Iogurte Natural (Sem Açúcar)', calories: 80, category: 'Snacks', description: 'Ótimo para a digestão.', image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&q=80&w=100&h=100' },
];

const MOCK_LOGS: CalorieLog[] = [
  { id: '1', date: '2026-03-26', type: 'intake', amount: 450, description: 'Café da manhã Premium', category: 'Café da manhã' },
  { id: '2', date: '2026-03-26', type: 'expenditure', amount: 200, description: 'Caminhada matinal' },
  { id: '3', date: '2026-03-26', type: 'intake', amount: 300, description: 'Petisco de treinamento', category: 'Snacks' },
  { id: '4', date: '2026-03-25', type: 'intake', amount: 1400, description: 'Total do dia', category: 'Almoço' },
  { id: '5', date: '2026-03-25', type: 'expenditure', amount: 450, description: 'Parque de cães' },
];

const MOCK_HISTORY: DailySummary[] = [
  { date: '20/03', intake: 1400, expenditure: 300 },
  { date: '21/03', intake: 1550, expenditure: 450 },
  { date: '22/03', intake: 1300, expenditure: 200 },
  { date: '23/03', intake: 1450, expenditure: 500 },
  { date: '24/03', intake: 1600, expenditure: 350 },
  { date: '25/03', intake: 1400, expenditure: 450 },
  { date: '26/03', intake: 750, expenditure: 200 },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'profile' | 'history' | 'meals'>('dashboard');
  const [pet, setPet] = useState<PetProfile | null>(null);
  const [logs, setLogs] = useState<CalorieLog[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isPetModalOpen, setIsPetModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [logType, setLogType] = useState<'intake' | 'expenditure'>('intake');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Fetch User's first pet (simplified for Demo)
    const petsQuery = query(collection(db, 'pets'), where('ownerId', '==', user.uid));
    const unsubscribePets = onSnapshot(petsQuery, (snapshot) => {
      const petsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PetProfile));
      if (petsData.length > 0) {
        setPet(petsData[0]);
      } else {
        // Create initial pet if none exists
        const createInitialPet = async () => {
          try {
            await addDoc(collection(db, 'pets'), {
              name: 'Novo Pet',
              species: 'dog',
              breed: 'Sem raça definida',
              age: 1,
              weight: 10,
              targetWeight: 10,
              dailyCalorieTarget: 800,
              ownerId: user.uid,
              createdAt: new Date().toISOString(),
              photoUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=200&h=200'
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, 'pets');
          }
        };
        createInitialPet();
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'pets');
    });

    // Fetch Logs
    const logsQuery = query(collection(db, 'logs'), where('ownerId', '==', user.uid));
    const unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CalorieLog));
      // Sort by date desc
      setLogs(logsData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'logs');
    });

    return () => {
      unsubscribePets();
      unsubscribeLogs();
    };
  }, [user]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const todayStats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayLogs = logs.filter(l => l.date === today);
    const intake = todayLogs.filter(l => l.type === 'intake').reduce((acc, curr) => acc + curr.amount, 0);
    const expenditure = todayLogs.filter(l => l.type === 'expenditure').reduce((acc, curr) => acc + curr.amount, 0);
    return { intake, expenditure, net: intake - expenditure };
  }, [logs]);

  const handleAddMealLog = async (option: MealOption) => {
    if (!user || !pet) return;
    try {
      await addDoc(collection(db, 'logs'), {
        petId: pet.id,
        ownerId: user.uid,
        date: new Date().toISOString().split('T')[0],
        type: 'intake',
        amount: option.calories,
        description: option.name,
        category: option.category,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'logs');
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'logs', logId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'logs');
    }
  };

  const currentPet = pet || DEFAULT_PET;
  const progressPercentage = Math.min((todayStats.intake / currentPet.dailyCalorieTarget) * 100, 100);

  if (authLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-brand-bg">
        <Loader2 className="animate-spin text-brand-primary" size={48} />
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <div className="flex h-screen bg-brand-bg font-sans text-brand-text transition-colors duration-300">
      {/* Sidebar */}
      <aside className="w-64 bg-brand-surface border-r border-brand-border flex flex-col transition-colors duration-300">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center text-white transition-colors duration-300">
            <Activity size={24} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-brand-primary transition-colors duration-300">PetFit</h1>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          <SidebarItem 
            icon={<TrendingUp size={20} />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <SidebarItem 
            icon={<Utensils size={20} />} 
            label="Refeições" 
            active={activeTab === 'meals'} 
            onClick={() => setActiveTab('meals')} 
          />
          <SidebarItem 
            icon={<UserIcon size={20} />} 
            label="Perfil do Pet" 
            active={activeTab === 'profile'} 
            onClick={() => setActiveTab('profile')} 
          />
          <SidebarItem 
            icon={<Calendar size={20} />} 
            label="Histórico" 
            active={activeTab === 'history'} 
            onClick={() => setActiveTab('history')} 
          />
          <SidebarItem 
            icon={<Settings size={20} />} 
            label="Configurações" 
            active={false} 
            onClick={() => {}} 
          />
        </nav>

        <div className="p-4 border-t border-brand-border transition-colors duration-300">
          <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-red-500/10 transition-colors cursor-pointer group" onClick={() => signOut(auth)}>
            <img src={currentPet.photoUrl} alt="User" className="w-10 h-10 rounded-full object-cover" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{user.displayName || 'Usuário'}</p>
              <p className="text-[10px] text-brand-muted truncate transition-colors duration-300">Sair da conta</p>
            </div>
            <LogOut size={16} className="text-brand-muted group-hover:text-red-500 transition-colors duration-300" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="h-20 bg-brand-surface border-b border-brand-border flex items-center justify-between px-8 sticky top-0 z-10 transition-colors duration-300">
          <div className="flex items-center gap-4 bg-brand-primary/10 px-4 py-2 rounded-full w-96 transition-colors duration-300">
            <Search size={18} className="text-brand-muted transition-colors duration-300" />
            <input 
              type="text" 
              placeholder="Buscar registros, alimentos..." 
              className="bg-transparent border-none outline-none text-sm w-full placeholder:text-brand-muted text-brand-text transition-colors duration-300"
            />
          </div>
          <div className="flex items-center gap-6">
            {/* Dark Mode Switch */}
            <div className="flex items-center gap-3 bg-brand-primary/10 p-1.5 rounded-full transition-colors duration-300">
              <button 
                onClick={() => setIsDarkMode(false)}
                className={cn(
                  "p-1.5 rounded-full transition-all duration-300",
                  !isDarkMode ? "bg-brand-surface text-brand-primary shadow-sm" : "text-brand-muted"
                )}
              >
                <Sun size={18} />
              </button>
              <button 
                onClick={() => setIsDarkMode(true)}
                className={cn(
                  "p-1.5 rounded-full transition-all duration-300",
                  isDarkMode ? "bg-brand-surface text-brand-primary shadow-sm" : "text-brand-muted"
                )}
              >
                <Moon size={18} />
              </button>
            </div>

            <button className="relative p-2 text-brand-muted hover:text-brand-primary transition-colors duration-300">
              <Bell size={22} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-brand-surface transition-colors duration-300"></span>
            </button>
            <button 
              onClick={() => {
                setLogType('intake');
                setIsLogModalOpen(true);
              }}
              className="bg-brand-primary text-brand-bg px-5 py-2.5 rounded-full font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-sm"
            >
              <Plus size={20} />
              Novo Registro
            </button>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                {/* Hero Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatCard 
                    title="Consumo Diário" 
                    value={`${todayStats.intake} kcal`} 
                    subtitle={`Meta: ${currentPet.dailyCalorieTarget} kcal`}
                    icon={<Utensils className="text-brand-primary" />}
                    progress={progressPercentage}
                    color="var(--brand-primary)"
                  />
                  <StatCard 
                    title="Gasto Calórico" 
                    value={`${todayStats.expenditure} kcal`} 
                    subtitle="Atividade física hoje"
                    icon={<Activity className="text-brand-primary" />}
                    trend="+12%"
                    trendIsGood={true}
                    color="var(--brand-primary)"
                  />
                  <StatCard 
                    title="Peso Atual" 
                    value={`${currentPet.weight} kg`} 
                    subtitle={`Meta: ${currentPet.targetWeight} kg`}
                    icon={<Weight className="text-brand-primary" />}
                    trend="-0.5kg"
                    trendIsGood={false}
                    color="var(--brand-primary)"
                  />
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-brand-surface p-6 rounded-3xl border border-brand-border shadow-sm transition-colors duration-300">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-bold">Resumo Semanal</h3>
                      <select className="bg-brand-primary/10 border-none text-xs font-semibold rounded-lg px-3 py-1.5 outline-none text-brand-text transition-colors duration-300">
                        <option>Últimos 7 dias</option>
                        <option>Últimos 30 dias</option>
                      </select>
                    </div>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={MOCK_HISTORY}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--brand-border)" />
                          <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 12, fill: 'var(--brand-muted)' }} 
                            dy={10}
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 12, fill: 'var(--brand-muted)' }} 
                          />
                          <Tooltip 
                            cursor={{ fill: 'var(--brand-primary)', opacity: 0.1 }}
                            contentStyle={{ 
                              borderRadius: '12px', 
                              border: 'none', 
                              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                              backgroundColor: 'var(--brand-surface)',
                              color: 'var(--brand-text)'
                            }}
                          />
                          <Bar dataKey="intake" fill="var(--brand-primary)" radius={[4, 4, 0, 0]} barSize={20} />
                          <Bar dataKey="expenditure" fill="var(--brand-muted)" radius={[4, 4, 0, 0]} barSize={20} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-brand-surface p-6 rounded-3xl border border-brand-border shadow-sm transition-colors duration-300">
                    <h3 className="text-lg font-bold mb-6">Registros Recentes</h3>
                    <div className="space-y-4">
                      {logs.slice(0, 5).map((log) => (
                        <div key={log.id} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-brand-primary/5 transition-colors border border-transparent hover:border-brand-border">
                          <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center",
                            log.type === 'intake' ? "bg-red-500/10 text-red-500" : "bg-brand-primary/10 text-brand-primary"
                          )}>
                            {log.type === 'intake' ? <Utensils size={20} /> : <Activity size={20} />}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-sm">{log.description}</p>
                            <p className="text-xs text-brand-muted transition-colors duration-300">{log.date}</p>
                          </div>
                          <div className="text-right flex items-center gap-3">
                            <div>
                              <p className={cn(
                                "font-bold",
                                log.type === 'intake' ? "text-red-500" : "text-brand-primary"
                              )}>
                                {log.type === 'intake' ? '+' : '-'}{log.amount} kcal
                              </p>
                              {log.portionWeight && (
                                <p className="text-[10px] text-brand-muted">{log.portionWeight}g</p>
                              )}
                            </div>
                            <button 
                              onClick={() => handleDeleteLog(log.id)}
                              className="p-2 text-brand-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                              title="Remover registro"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button className="w-full mt-6 py-3 text-brand-primary font-semibold text-sm hover:bg-brand-primary/10 rounded-xl transition-colors flex items-center justify-center gap-2">
                      Ver todos os registros <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-brand-surface rounded-3xl border border-brand-border shadow-sm overflow-hidden transition-colors duration-300"
              >
                <div className="h-48 bg-gradient-to-r from-brand-primary to-brand-muted relative">
                  <div className="absolute -bottom-16 left-12 p-2 bg-brand-surface rounded-3xl shadow-lg transition-colors duration-300">
                    <img src={currentPet.photoUrl} alt={currentPet.name} className="w-32 h-32 rounded-2xl object-cover" />
                  </div>
                </div>
                <div className="pt-20 pb-12 px-12">
                  <div className="flex justify-between items-start mb-12">
                    <div>
                      <h2 className="text-3xl font-bold mb-1">{currentPet.name}</h2>
                      <p className="text-brand-muted flex items-center gap-2 transition-colors duration-300">
                        {currentPet.species === 'dog' ? <Dog size={18} /> : <Cat size={18} />}
                        {currentPet.breed} • {currentPet.age} anos
                      </p>
                    </div>
                    <button 
                      onClick={() => setIsPetModalOpen(true)}
                      className="border border-brand-border px-6 py-2.5 rounded-full font-semibold hover:bg-brand-primary/10 transition-colors duration-300"
                    >
                      Editar Perfil
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <ProfileInfoCard label="Peso Atual" value={`${currentPet.weight} kg`} icon={<Weight size={20} />} />
                    <ProfileInfoCard label="Meta de Peso" value={`${currentPet.targetWeight} kg`} icon={<TrendingUp size={20} />} />
                    <ProfileInfoCard label="Meta Calórica" value={`${currentPet.dailyCalorieTarget} kcal`} icon={<Utensils size={20} />} />
                  </div>

                  <div className="mt-12 p-8 bg-brand-primary/10 rounded-3xl transition-colors duration-300">
                    <h4 className="font-bold mb-4">Dicas de Saúde para {currentPet.name}</h4>
                    <ul className="space-y-3 text-sm text-brand-text/80">
                      <li className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-brand-primary rounded-full"></div>
                        Mantenha uma rotina de exercícios de pelo menos 30 minutos por dia.
                      </li>
                      <li className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-brand-primary rounded-full"></div>
                        Evite petiscos fora do horário planejado para manter a meta de peso.
                      </li>
                      <li className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-brand-primary rounded-full"></div>
                        Certifique-se de que ele tenha sempre água fresca disponível.
                      </li>
                    </ul>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold">Histórico de Atividades</h2>
                  <div className="flex gap-3">
                    <button className="px-4 py-2 bg-brand-surface border border-brand-border rounded-xl text-sm font-semibold hover:bg-brand-primary/10 transition-colors duration-300">Exportar PDF</button>
                    <button className="px-4 py-2 bg-brand-primary text-brand-bg rounded-xl text-sm font-semibold hover:opacity-90 transition-all">Filtrar</button>
                  </div>
                </div>

                <div className="bg-brand-surface rounded-3xl border border-brand-border shadow-sm overflow-hidden transition-colors duration-300">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-brand-primary/5 border-b border-brand-border transition-colors duration-300">
                        <th className="px-6 py-4 text-xs font-bold text-brand-muted uppercase tracking-wider transition-colors duration-300">Data</th>
                        <th className="px-6 py-4 text-xs font-bold text-brand-muted uppercase tracking-wider transition-colors duration-300">Descrição</th>
                        <th className="px-6 py-4 text-xs font-bold text-brand-muted uppercase tracking-wider transition-colors duration-300">Tipo</th>
                        <th className="px-6 py-4 text-xs font-bold text-brand-muted uppercase tracking-wider text-right transition-colors duration-300">Calorias</th>
                        <th className="px-6 py-4 text-xs font-bold text-brand-muted uppercase tracking-wider text-right transition-colors duration-300">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border transition-colors duration-300">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-brand-primary/5 transition-colors group">
                          <td className="px-6 py-4 text-sm font-medium">{log.date}</td>
                          <td className="px-6 py-4 text-sm">
                            <div className="flex flex-col">
                              <span>{log.description}</span>
                              {log.portionWeight && <span className="text-[10px] text-brand-muted">{log.portionWeight}g</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                              log.type === 'intake' ? "bg-red-500/10 text-red-500" : "bg-brand-primary/10 text-brand-primary"
                            )}>
                              {log.type === 'intake' ? 'Consumo' : 'Gasto'}
                            </span>
                          </td>
                          <td className={cn(
                            "px-6 py-4 text-sm font-bold text-right",
                            log.type === 'intake' ? "text-red-500" : "text-brand-primary"
                          )}>
                            {log.type === 'intake' ? '+' : '-'}{log.amount} kcal
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => handleDeleteLog(log.id)}
                              className="p-2 text-brand-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="Remover registro"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'meals' && (
              <motion.div
                key="meals"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-bold">Refeições</h2>
                  <button 
                    onClick={() => {
                      setLogType('intake');
                      setIsLogModalOpen(true);
                    }}
                    className="bg-brand-primary text-brand-bg px-6 py-2.5 rounded-full font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-sm"
                  >
                    <Plus size={20} />
                    Adicionar Alimento
                  </button>
                </div>

                {/* Meal Options Section */}
                <section>
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Utensils size={20} className="text-brand-primary" />
                    Opções de Refeições
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {MOCK_MEAL_OPTIONS.map((option) => (
                      <div key={option.id} className="bg-brand-surface p-5 rounded-3xl border border-brand-border shadow-sm hover:shadow-md transition-all group">
                        <div className="flex gap-4 mb-4">
                          <img src={option.image} alt={option.name} className="w-16 h-16 rounded-2xl object-cover" />
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded-md mb-1 inline-block">
                              {option.category}
                            </span>
                            <h4 className="font-bold text-sm group-hover:text-brand-primary transition-colors">{option.name}</h4>
                            <p className="text-xs text-brand-muted line-clamp-1">{option.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-brand-border">
                          <span className="font-bold text-brand-primary">{option.calories} kcal</span>
                          <button 
                            onClick={() => handleAddMealLog(option)}
                            className="p-2 bg-brand-primary/10 text-brand-primary rounded-xl hover:bg-brand-primary hover:text-brand-bg transition-all active:scale-95"
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Recent Meals Section */}
                <section>
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <TrendingUp size={20} className="text-brand-primary" />
                    Refeições Recentes
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {(['Café da manhã', 'Almoço', 'Jantar', 'Snacks'] as MealCategory[]).map((category) => {
                      const categoryLogs = logs.filter(l => l.type === 'intake' && l.category === category);
                      return (
                        <div key={category} className="bg-brand-surface p-6 rounded-3xl border border-brand-border shadow-sm">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="font-bold text-brand-primary">{category}</h4>
                            <span className="text-xs text-brand-muted">{categoryLogs.length} registros</span>
                          </div>
                          <div className="space-y-3">
                            {categoryLogs.length > 0 ? (
                              categoryLogs.map((log) => (
                                <div key={log.id} className="flex items-center justify-between p-3 rounded-2xl bg-brand-bg border border-brand-border hover:border-brand-primary/30 transition-colors">
                                  <div>
                                    <p className="text-sm font-semibold">{log.description}</p>
                                    <p className="text-[10px] text-brand-muted">{log.date}</p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="font-bold text-red-500 text-sm">+{log.amount} kcal</span>
                                    <button 
                                      onClick={() => handleDeleteLog(log.id)}
                                      className="p-1.5 text-brand-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                      title="Remover registro"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="py-8 text-center border-2 border-dashed border-brand-border rounded-2xl">
                                <p className="text-xs text-brand-muted">Nenhum registro de {category.toLowerCase()} ainda.</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Pet Modal */}
      <PetModal 
        isOpen={isPetModalOpen} 
        onClose={() => setIsPetModalOpen(false)} 
        pet={currentPet} 
      />

      {/* Log Modal */}
      <LogModal 
        isOpen={isLogModalOpen} 
        onClose={() => setIsLogModalOpen(false)} 
        petId={currentPet.id}
        initialType={logType}
      />
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium text-sm",
        active 
          ? "bg-brand-primary/10 text-brand-primary shadow-sm" 
          : "text-brand-muted hover:bg-brand-primary/5 hover:text-brand-text"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function StatCard({ title, value, subtitle, icon, progress, trend, color, trendIsGood }: { 
  title: string, 
  value: string, 
  subtitle: string, 
  icon: React.ReactNode,
  progress?: number,
  trend?: string,
  color: string,
  trendIsGood?: boolean
}) {
  const isPositiveTrend = trend?.startsWith('+');
  const isGoodTrend = trendIsGood ? isPositiveTrend : !isPositiveTrend;

  return (
    <div className="bg-brand-surface p-6 rounded-3xl border border-brand-border shadow-sm hover:shadow-md transition-all duration-300 group">
      <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
          {icon}
        </div>
        {trend && (
          <span className={cn(
            "text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1",
            isGoodTrend ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
          )}>
            {isPositiveTrend ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {trend}
          </span>
        )}
      </div>
      <h3 className="text-brand-muted text-sm font-medium mb-1 transition-colors duration-300">{title}</h3>
      <p className="text-2xl font-bold mb-2">{value}</p>
      <p className="text-xs text-brand-muted mb-4 transition-colors duration-300">{subtitle}</p>
      
      {progress !== undefined && (
        <div className="w-full h-2 bg-brand-primary/10 rounded-full overflow-hidden transition-colors duration-300">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ backgroundColor: color }}
          />
        </div>
      )}
    </div>
  );
}

function ProfileInfoCard({ label, value, icon }: { label: string, value: string, icon: React.ReactNode }) {
  return (
    <div className="p-6 bg-brand-bg rounded-2xl border border-brand-border transition-colors duration-300">
      <div className="text-brand-primary mb-3 transition-colors duration-300">{icon}</div>
      <p className="text-xs text-brand-muted font-medium uppercase tracking-wider mb-1 transition-colors duration-300">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

function PetModal({ isOpen, onClose, pet }: { isOpen: boolean, onClose: () => void, pet: PetProfile }) {
  const [formData, setFormData] = useState({ ...pet });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) setFormData({ ...pet });
  }, [isOpen, pet]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pet.id || pet.id === 'new') return;
    setLoading(true);
    try {
      const petRef = doc(db, 'pets', pet.id);
      await updateDoc(petRef, {
        name: formData.name,
        breed: formData.breed,
        age: Number(formData.age),
        weight: Number(formData.weight),
        targetWeight: Number(formData.targetWeight),
        dailyCalorieTarget: Number(formData.dailyCalorieTarget),
        species: formData.species
      });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'pets');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-brand-text/40 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-brand-surface w-full max-w-lg rounded-3xl shadow-2xl p-8 border border-brand-border overflow-hidden"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold">Editar Perfil</h3>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-brand-primary/10 rounded-full text-brand-muted transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-bold text-brand-muted uppercase tracking-wider ml-1">Nome do Pet</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl focus:border-brand-primary outline-none transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-brand-muted uppercase tracking-wider ml-1">Espécie</label>
                  <select
                    value={formData.species}
                    onChange={(e) => setFormData({ ...formData, species: e.target.value as 'dog' | 'cat' })}
                    className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl focus:border-brand-primary outline-none transition-colors"
                  >
                    <option value="dog">Cachorro</option>
                    <option value="cat">Gato</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-brand-muted uppercase tracking-wider ml-1">Raça</label>
                  <input
                    type="text"
                    value={formData.breed}
                    onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
                    className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl focus:border-brand-primary outline-none transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-brand-muted uppercase tracking-wider ml-1">Idade (anos)</label>
                  <input
                    type="number"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl focus:border-brand-primary outline-none transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-brand-muted uppercase tracking-wider ml-1">Peso Atual (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl focus:border-brand-primary outline-none transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-brand-muted uppercase tracking-wider ml-1">Meta de Peso (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.targetWeight}
                    onChange={(e) => setFormData({ ...formData, targetWeight: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl focus:border-brand-primary outline-none transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-brand-muted uppercase tracking-wider ml-1">Meta Calórica Diária</label>
                  <input
                    type="number"
                    value={formData.dailyCalorieTarget}
                    onChange={(e) => setFormData({ ...formData, dailyCalorieTarget: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl focus:border-brand-primary outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={onClose}
                  className="flex-1 px-6 py-3 border border-brand-border rounded-xl font-semibold hover:bg-brand-primary/5 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-brand-primary text-brand-bg rounded-xl font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Salvar Alterações
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function LogModal({ isOpen, onClose, petId, initialType, onDeleteLog }: { isOpen: boolean, onClose: () => void, petId: string, initialType: 'intake' | 'expenditure', onDeleteLog?: (id: string) => void }) {
  const [type, setType] = useState<'intake' | 'expenditure'>(initialType);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [portionWeight, setPortionWeight] = useState('');
  const [category, setCategory] = useState<MealCategory>('Almoço');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setType(initialType);
      setDescription('');
      setAmount('');
      setPortionWeight('');
    }
  }, [isOpen, initialType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'logs'), {
        petId,
        ownerId: auth.currentUser.uid,
        date: new Date().toISOString().split('T')[0],
        type,
        amount: Number(amount),
        description,
        ...(type === 'intake' ? { category, portionWeight: Number(portionWeight) } : {}),
        createdAt: new Date().toISOString()
      });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'logs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-brand-text/40 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-brand-surface w-full max-w-md rounded-3xl shadow-2xl p-8 border border-brand-border overflow-hidden"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold">Novo Registro</h3>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-brand-primary/10 rounded-full text-brand-muted transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-2 p-1 bg-brand-bg rounded-xl border border-brand-border">
                <button
                  type="button"
                  onClick={() => setType('intake')}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
                    type === 'intake' ? "bg-brand-primary text-brand-bg" : "text-brand-muted"
                  )}
                >
                  Consumo
                </button>
                <button
                  type="button"
                  onClick={() => setType('expenditure')}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
                    type === 'expenditure' ? "bg-brand-primary text-brand-bg" : "text-brand-muted"
                  )}
                >
                  Gasto
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-brand-muted uppercase tracking-wider ml-1">Nome da Refeição</label>
                <input
                  type="text"
                  required
                  placeholder={type === 'intake' ? "Ex: Ração Premium" : "Ex: Caminhada no parque"}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl focus:border-brand-primary outline-none transition-colors placeholder:text-brand-muted/50"
                />
              </div>

              {type === 'intake' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-brand-muted uppercase tracking-wider ml-1">Período</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as MealCategory)}
                      className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl focus:border-brand-primary outline-none transition-colors"
                    >
                      <option value="Café da manhã">Café da manhã</option>
                      <option value="Almoço">Almoço</option>
                      <option value="Jantar">Jantar</option>
                      <option value="Snacks">Snacks</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-brand-muted uppercase tracking-wider ml-1">Peso da Porção (g)</label>
                    <input
                      type="number"
                      placeholder="Ex: 50"
                      value={portionWeight}
                      onChange={(e) => setPortionWeight(e.target.value)}
                      className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl focus:border-brand-primary outline-none transition-colors placeholder:text-brand-muted/50"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-brand-muted uppercase tracking-wider ml-1">Valor Calórico (kcal)</label>
                <input
                  type="number"
                  required
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl focus:border-brand-primary outline-none transition-colors placeholder:text-brand-muted/50"
                />
              </div>

              <div className="pt-4">
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand-primary text-brand-bg py-4 rounded-xl font-bold text-lg shadow-lg shadow-brand-primary/20 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" /> : <Check size={20} />}
                  Salvar Registro
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
