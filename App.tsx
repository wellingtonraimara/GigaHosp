
import React, { useState, useEffect, useMemo } from 'react';
import { 
  MessageSquare, ChevronRight, CheckCircle2, ArrowLeft, 
  Loader2, Home, Star, BarChart3, Download, Users, 
  TrendingUp, Calendar, Trash2, Lock, ShieldCheck, UserRound,
  Filter, X, Briefcase, Clock, Moon, Sun
} from 'lucide-react';
import { AppStep, FeedbackData } from './types';
import { analyzeFeedback } from './geminiService';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const STORAGE_KEY = 'hospital_santa_filomena_stats';
const DASHBOARD_PASSWORD = '102530';
const PROFESSIONALS = [
  "Dr. Elvy Soares", 
  "Dr. Julio Cesar",
  "Dr. Gerson Marques",
  "Dr. Nagipe Sousa",
  "Drª Gercilane",
  "Dr. Ricardo Lages",
  "Dr. Rafael Avelino"
];

const EMOJIS = [
  { char: '😡', label: 'Péssimo', range: [0, 1, 2], default: 1 },
  { char: '😕', label: 'Ruim', range: [3, 4], default: 3 },
  { char: '😐', label: 'Regular', range: [5, 6], default: 5 },
  { char: '🙂', label: 'Bom', range: [7, 8], default: 8 },
  { char: '🤩', label: 'Incrível', range: [9, 10], default: 10 },
];

const ProfessionalBtn: React.FC<{ 
  name: string; 
  isSelected: boolean; 
  isDarkMode: boolean;
  onClick: () => void 
}> = ({ name, isSelected, isDarkMode, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-4 p-6 rounded-[2rem] transition-all duration-500 border-2 transform ${
      isSelected 
      ? (isDarkMode ? 'bg-indigo-500/20 border-indigo-500 scale-105 shadow-[0_0_20px_rgba(99,102,241,0.3)]' : 'bg-indigo-50 border-indigo-500 scale-105 shadow-xl shadow-indigo-100') 
      : (isDarkMode ? 'bg-neutral-900/50 backdrop-blur-md border-neutral-800 hover:border-indigo-500/30' : 'bg-white/80 backdrop-blur-md border-slate-100 hover:border-indigo-200 shadow-sm')
    } active:scale-95`}
  >
    <div className={`p-4 rounded-full transition-colors duration-300 ${isSelected ? 'bg-indigo-500 text-white' : (isDarkMode ? 'bg-neutral-800 text-neutral-500' : 'bg-slate-50 text-slate-400')}`}>
      <UserRound className="w-8 h-8" />
    </div>
    <span className={`text-sm font-bold leading-tight transition-colors duration-300 ${isSelected ? (isDarkMode ? 'text-indigo-300' : 'text-indigo-700') : (isDarkMode ? 'text-neutral-400' : 'text-slate-600')}`}>{name}</span>
  </button>
);

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.WELCOME);
  const [history, setHistory] = useState<FeedbackData[]>([]);
  const [feedback, setFeedback] = useState<FeedbackData>({
    professional: null,
    nps: null,
    comment: '',
    timestamp: ''
  });
  const [aiMessage, setAiMessage] = useState('');
  
  const [isPromptingPassword, setIsPromptingPassword] = useState(false);
  const [passwordValue, setPasswordValue] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  // Filter States
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterProfessional, setFilterProfessional] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [activePredefined, setActivePredefined] = useState<'today' | '7days' | '30days' | null>(null);

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme === 'dark';
  });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const handleNext = () => {
    if (step === AppStep.WELCOME) setStep(AppStep.PROFESSIONAL);
    else if (step === AppStep.PROFESSIONAL) setStep(AppStep.NPS);
    else if (step === AppStep.NPS) setStep(AppStep.COMMENT);
    else if (step === AppStep.COMMENT) handleSubmit();
  };

  const handleBack = () => {
    if (isPromptingPassword) {
      setIsPromptingPassword(false);
      setPasswordValue('');
      setPasswordError(false);
      return;
    }
    if (step === AppStep.PROFESSIONAL) setStep(AppStep.WELCOME);
    else if (step === AppStep.NPS) setStep(AppStep.PROFESSIONAL);
    else if (step === AppStep.COMMENT) setStep(AppStep.NPS);
    else if (step === AppStep.DASHBOARD) setStep(AppStep.WELCOME);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordValue === DASHBOARD_PASSWORD) {
      setIsPromptingPassword(false);
      setPasswordValue('');
      setPasswordError(false);
      setStep(AppStep.DASHBOARD);
    } else {
      setPasswordError(true);
      setPasswordValue('');
    }
  };

  const handlePredefinedFilter = (range: 'today' | '7days' | '30days') => {
    const end = new Date();
    const start = new Date();
    
    if (range === 'today') {
      // Keep today
    } else if (range === '7days') {
      start.setDate(end.getDate() - 7);
    } else if (range === '30days') {
      start.setDate(end.getDate() - 30);
    }

    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    setFilterStartDate(startStr);
    setFilterEndDate(endStr);
    setActivePredefined(range);
  };

  const clearFilters = () => {
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterProfessional('');
    setActivePredefined(null);
  };

  const handleSubmit = async () => {
    setStep(AppStep.PROCESSING);
    const result = await analyzeFeedback(feedback);
    setAiMessage(result);

    const finalFeedback = { ...feedback, timestamp: new Date().toISOString() };
    const newHistory = [...history, finalFeedback];
    setHistory(newHistory);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));

    setStep(AppStep.SUCCESS);
  };

  const getNpsColor = (n: number) => {
    if (n <= 2) return 'bg-rose-500';
    if (n <= 4) return 'bg-orange-500';
    if (n <= 6) return 'bg-amber-400';
    if (n <= 8) return 'bg-lime-500';
    return 'bg-emerald-500';
  };

  // Filtered History
  const filteredHistory = useMemo(() => {
    return history.filter(h => {
      const date = new Date(h.timestamp);
      const start = filterStartDate ? new Date(filterStartDate + 'T00:00:00') : null;
      const end = filterEndDate ? new Date(filterEndDate + 'T23:59:59') : null;
      
      if (start && date < start) return false;
      if (end && date > end) return false;
      if (filterProfessional && h.professional !== filterProfessional) return false;
      return true;
    });
  }, [history, filterStartDate, filterEndDate, filterProfessional]);

  // Stats Calculations
  const stats = useMemo(() => {
    const total = filteredHistory.length;
    if (total === 0) return { avg: 0, nps: 0, promoters: 0, detractors: 0, profCounts: {} };

    const sum = filteredHistory.reduce((acc, curr) => acc + (curr.nps || 0), 0);
    const promoters = filteredHistory.filter(h => (h.nps || 0) >= 9).length;
    const detractors = filteredHistory.filter(h => (h.nps || 0) <= 6).length;
    const nps = Math.round(((promoters / total) - (detractors / total)) * 100);
    
    const profCounts: Record<string, number> = {};
    filteredHistory.forEach(h => {
      if (h.professional) profCounts[h.professional] = (profCounts[h.professional] || 0) + 1;
    });

    return { total, avg: (sum / total).toFixed(1), nps, promoters, detractors, profCounts };
  }, [filteredHistory]);

  const trendData = useMemo(() => {
    const grouped: Record<string, { p: number, d: number, t: number }> = {};
    filteredHistory.forEach(h => {
      const day = new Date(h.timestamp).toLocaleDateString('pt-BR');
      if (!grouped[day]) grouped[day] = { p: 0, d: 0, t: 0 };
      grouped[day].t++;
      if ((h.nps || 0) >= 9) grouped[day].p++;
      else if ((h.nps || 0) <= 6) grouped[day].d++;
    });
    return Object.entries(grouped)
      .map(([day, val]) => ({
        day,
        nps: Math.round(((val.p / val.t) - (val.d / val.t)) * 100)
      }))
      .sort((a, b) => {
        const [da, ma, ya] = a.day.split('/').map(Number);
        const [db, mb, yb] = b.day.split('/').map(Number);
        return new Date(ya, ma-1, da).getTime() - new Date(yb, mb-1, db).getTime();
      });
  }, [filteredHistory]);

  const generatePDFReport = () => {
    const doc = new jsPDF();
    const today = new Date().toLocaleDateString('pt-BR');
    doc.setFontSize(22);
    doc.setTextColor(63, 81, 181);
    doc.text('Hospital Santa Filomena', 105, 20, { align: 'center' });
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text('Relatório Gerencial de Atendimento', 105, 30, { align: 'center' });
    const filtersUsed = [];
    if (filterStartDate || filterEndDate) filtersUsed.push(`${filterStartDate || 'Início'} até ${filterEndDate || 'Fim'}`);
    if (filterProfessional) filtersUsed.push(`Profissional: ${filterProfessional}`);
    const periodText = filtersUsed.length > 0 ? `Filtros: ${filtersUsed.join(' | ')}` : `Data de Emissão: ${today}`;
    doc.text(periodText, 105, 38, { align: 'center' });
    doc.setDrawColor(230);
    doc.line(20, 45, 190, 45);
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('RESUMO EXECUTIVO', 20, 55);
    const tableData = [['Total de Avaliações', stats.total.toString()], ['Nota Média Geral', `${stats.avg} / 10`], ['NPS (Net Promoter Score)', `${stats.nps}`], ['Promotores (9-10)', stats.promoters.toString()], ['Detratores (0-6)', stats.detractors.toString()]];
    (doc as any).autoTable({ startY: 60, head: [['Métrica', 'Valor']], body: tableData, theme: 'striped', headStyles: { fillColor: [63, 81, 181] } });
    const profData = Object.entries(stats.profCounts).map(([name, count]) => [name, count]);
    if (profData.length > 0) {
      doc.text('ATENDIMENTOS POR PROFISSIONAL', 20, (doc as any).lastAutoTable.finalY + 15);
      (doc as any).autoTable({ startY: (doc as any).lastAutoTable.finalY + 20, head: [['Profissional', 'Total de Avaliações']], body: profData });
    }
    const comments = filteredHistory.filter(h => h.comment.length > 0).map(h => [new Date(h.timestamp).toLocaleTimeString('pt-BR'), h.professional, h.nps, h.comment]);
    if (comments.length > 0) {
      doc.text('COMENTÁRIOS DOS PACIENTES', 20, (doc as any).lastAutoTable.finalY + 15);
      (doc as any).autoTable({ startY: (doc as any).lastAutoTable.finalY + 20, head: [['Horário', 'Profissional', 'Nota', 'Comentário']], body: comments, columnStyles: { 3: { cellWidth: 100 } } });
    }
    doc.save(`Relatorio_Atendimento_${today.replace(/\//g, '-')}.pdf`);
  };

  const renderStepContent = () => {
    if (isPromptingPassword) {
      return (
        <div className="space-y-8 py-4 animate-in fade-in zoom-in duration-500">
          <div className="text-center">
            <div className={`inline-flex p-5 rounded-full mb-6 ${isDarkMode ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
              <Lock className="w-10 h-10" />
            </div>
            <h2 className={`text-3xl font-bold ${isDarkMode ? 'text-neutral-100' : 'text-slate-800'}`}>Acesso Restrito</h2>
            <p className={`${isDarkMode ? 'text-neutral-400' : 'text-slate-500'} mt-2`}>Insira a senha para acessar o dashboard.</p>
          </div>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <input
              type="password"
              value={passwordValue}
              autoFocus
              onChange={(e) => { setPasswordValue(e.target.value); setPasswordError(false); }}
              placeholder="••••••"
              className={`w-full p-6 border-2 rounded-[2rem] text-center text-3xl tracking-[0.5em] font-mono focus:outline-none transition-all ${isDarkMode ? 'bg-neutral-900 border-neutral-800 text-neutral-100 focus:border-indigo-500' : 'bg-slate-50 border-slate-100 focus:border-indigo-500 text-slate-800'} ${passwordError ? 'border-rose-400 bg-rose-50' : ''}`}
            />
            {passwordError && <p className="text-rose-500 text-xs font-bold text-center mt-2 animate-bounce">Senha Incorreta</p>}
            <div className="grid grid-cols-2 gap-4">
              <button type="button" onClick={handleBack} className={`py-5 rounded-[1.5rem] font-bold transition-all ${isDarkMode ? 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Voltar</button>
              <button type="submit" className="py-5 bg-indigo-600 text-white rounded-[1.5rem] font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 active:scale-95 transition-all">Entrar</button>
            </div>
          </form>
        </div>
      );
    }

    switch (step) {
      case AppStep.WELCOME:
        return (
          <div className="text-center space-y-10 py-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="relative inline-block">
              <div className="absolute -inset-4 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-full blur-2xl opacity-20 animate-pulse"></div>
              <div className={`relative p-8 rounded-full shadow-2xl ${isDarkMode ? 'bg-neutral-900 border border-neutral-800' : 'bg-white'}`}>
                <Star className={`w-14 h-14 ${isDarkMode ? 'text-indigo-400 fill-indigo-900/30' : 'text-indigo-600 fill-indigo-50'}`} />
              </div>
            </div>
            <div>
              <h1 className={`text-4xl font-black tracking-tight ${isDarkMode ? 'text-neutral-100' : 'text-slate-900'}`}>Avaliação de Atendimento</h1>
              <p className={`mt-4 text-xl font-medium ${isDarkMode ? 'text-neutral-400' : 'text-slate-500'}`}>Hospital Santa Filomena</p>
            </div>
            <div className="space-y-4 max-w-sm mx-auto">
              <button onClick={handleNext} className="group relative w-full inline-flex items-center justify-center px-8 py-5 font-bold text-white transition-all duration-300 bg-indigo-600 rounded-[2rem] hover:bg-indigo-700 shadow-xl shadow-indigo-600/25 active:scale-95">
                Avaliar Agora
                <ChevronRight className="ml-2 w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </button>
              <button onClick={() => setIsPromptingPassword(true)} className={`w-full py-3 font-semibold flex items-center justify-center gap-2 transition-all group ${isDarkMode ? 'text-neutral-500 hover:text-indigo-400' : 'text-slate-400 hover:text-indigo-600'}`}>
                <Lock className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" /> Painel Gestão
              </button>
            </div>
          </div>
        );

      case AppStep.PROFESSIONAL:
        return (
          <div className="space-y-8 py-4 animate-in slide-in-from-right duration-500 flex flex-col h-full max-h-[65vh]">
            <div className="text-center space-y-2">
              <h2 className={`text-3xl font-black ${isDarkMode ? 'text-neutral-100' : 'text-slate-900'}`}>Quem te atendeu?</h2>
              <p className={`${isDarkMode ? 'text-neutral-500' : 'text-slate-500'} font-medium`}>Selecione o profissional abaixo</p>
            </div>
            <div className="grid grid-cols-2 gap-4 overflow-y-auto px-2 py-4 no-scrollbar">
              {PROFESSIONALS.map(name => (
                <ProfessionalBtn 
                  key={name}
                  name={name} 
                  isDarkMode={isDarkMode}
                  isSelected={feedback.professional === name} 
                  onClick={() => setFeedback({ ...feedback, professional: name })} 
                />
              ))}
            </div>
            <button 
              disabled={!feedback.professional}
              onClick={handleNext}
              className={`w-full py-5 mt-4 rounded-[2rem] font-bold transition-all shrink-0 ${feedback.professional ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20 active:scale-95' : (isDarkMode ? 'bg-neutral-800 text-neutral-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed')}`}
            >
              Próximo Passo
            </button>
          </div>
        );

      case AppStep.NPS:
        return (
          <div className="space-y-10 py-6 animate-in slide-in-from-right duration-500">
            <div className="text-center space-y-2">
              <h2 className={`text-3xl font-black leading-tight ${isDarkMode ? 'text-neutral-100' : 'text-slate-900'}`}>Como foi sua experiência?</h2>
              <p className={`${isDarkMode ? 'text-neutral-500' : 'text-slate-500'} font-medium`}>De 0 a 10, que nota você daria?</p>
            </div>
            
            <div className="flex justify-between px-2 gap-2">
              {EMOJIS.map((emoji) => {
                const isSelected = feedback.nps !== null && emoji.range.includes(feedback.nps);
                return (
                  <button 
                    key={emoji.char}
                    onClick={() => setFeedback({ ...feedback, nps: emoji.default })}
                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all duration-300 transform ${isSelected ? 'scale-125' : 'opacity-40 hover:opacity-100'}`}
                  >
                    <span className="text-4xl">{emoji.char}</span>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isSelected ? (isDarkMode ? 'text-indigo-400' : 'text-indigo-600') : 'text-transparent'}`}>{emoji.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col items-center gap-5">
              <div className="flex flex-wrap justify-center gap-2">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <button 
                    key={num} 
                    onClick={() => setFeedback({ ...feedback, nps: num })} 
                    className={`w-11 h-11 rounded-full text-white font-bold text-base transition-all transform ${getNpsColor(num)} ${feedback.nps === num ? 'scale-125 ring-4 ring-indigo-500/30 z-10 shadow-lg' : 'opacity-90 hover:opacity-100 active:scale-75'}`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
            
            <div className={`flex justify-between text-[11px] font-black uppercase tracking-[0.2em] px-4 ${isDarkMode ? 'text-neutral-700' : 'text-slate-300'}`}>
              <span>Insatisfeito</span>
              <span>Encantado</span>
            </div>

            <button disabled={feedback.nps === null} onClick={handleNext} className={`w-full py-5 rounded-[2rem] font-bold transition-all ${feedback.nps !== null ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20 active:scale-95' : (isDarkMode ? 'bg-neutral-800 text-neutral-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed')}`}>Confirmar Nota</button>
          </div>
        );

      case AppStep.COMMENT:
        return (
          <div className="space-y-8 py-6 animate-in slide-in-from-right duration-500">
            <div className="text-center space-y-2">
              <h2 className={`text-3xl font-black ${isDarkMode ? 'text-neutral-100' : 'text-slate-900'}`}>Algo a adicionar?</h2>
              <p className={`${isDarkMode ? 'text-neutral-500' : 'text-slate-500'} font-medium`}>Seu comentário nos ajuda a crescer!</p>
            </div>
            <div className="relative group">
              <textarea 
                value={feedback.comment} 
                onChange={(e) => setFeedback({ ...feedback, comment: e.target.value })} 
                placeholder="Conte-nos como foi..." 
                className={`w-full h-44 p-6 rounded-[2.5rem] border-2 transition-all resize-none text-lg leading-relaxed placeholder:text-neutral-600 outline-none ${isDarkMode ? 'bg-neutral-900/50 border-neutral-800 text-neutral-100 focus:border-indigo-500/50' : 'bg-slate-50/50 border-slate-100 text-slate-700 focus:border-indigo-500/50'}`} 
              />
              <div className={`absolute bottom-6 right-8 transition-colors ${feedback.comment ? 'text-indigo-500' : (isDarkMode ? 'text-neutral-800' : 'text-slate-200')}`}>
                <MessageSquare className="w-6 h-6" />
              </div>
            </div>
            <button onClick={handleNext} className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-bold shadow-xl shadow-indigo-600/20 active:scale-95 transition-all">Enviar Feedback</button>
          </div>
        );

      case AppStep.PROCESSING:
        return (
          <div className="flex flex-col items-center justify-center py-24 space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="relative">
               <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 animate-pulse"></div>
               <Loader2 className="w-20 h-20 text-indigo-600 animate-spin relative" />
            </div>
            <div className="text-center space-y-2">
              <h3 className={`text-2xl font-black ${isDarkMode ? 'text-neutral-100' : 'text-slate-900'}`}>Quase pronto...</h3>
              <p className={`${isDarkMode ? 'text-neutral-500' : 'text-slate-500'} font-medium`}>A IA está processando seu feedback</p>
            </div>
          </div>
        );

      case AppStep.SUCCESS:
        return (
          <div className="text-center space-y-10 py-10 animate-in zoom-in duration-700">
            <div className="inline-flex items-center justify-center w-28 h-28 bg-emerald-500/10 rounded-full animate-bounce">
              <CheckCircle2 className="w-16 h-16 text-emerald-500" />
            </div>
            <div className="space-y-4">
              <h2 className={`text-4xl font-black tracking-tight ${isDarkMode ? 'text-neutral-100' : 'text-slate-900'}`}>Obrigado!</h2>
              <div className={`mx-auto p-8 rounded-[2.5rem] border relative overflow-hidden transition-all duration-500 ${isDarkMode ? 'bg-indigo-950/10 border-indigo-900/30' : 'bg-indigo-50/50 border-indigo-100'}`}>
                <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500/30"></div>
                <p className={`text-lg leading-relaxed italic whitespace-pre-wrap ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900'}`}>
                  {aiMessage}
                </p>
              </div>
            </div>
            <button 
              onClick={() => { setFeedback({ professional: null, nps: null, comment: '', timestamp: '' }); setStep(AppStep.WELCOME); }} 
              className={`w-full py-5 font-bold flex items-center justify-center gap-3 transition-all ${isDarkMode ? 'text-neutral-500 hover:text-indigo-400' : 'text-slate-500 hover:text-indigo-600'}`}
            >
              <Home className="w-5 h-5" /> Início
            </button>
          </div>
        );

      case AppStep.DASHBOARD:
        return (
          <div className={`space-y-8 py-4 h-[82vh] overflow-y-auto no-scrollbar transition-all duration-500 px-6 sm:px-10 ${isDarkMode ? 'bg-black text-neutral-100' : 'bg-white text-slate-900'}`}>
            <div className={`flex flex-col sticky top-0 z-30 pb-6 transition-all duration-500 ${isDarkMode ? 'bg-black/80 backdrop-blur-xl' : 'bg-white/80 backdrop-blur-xl'}`}>
              <div className="flex items-center justify-between py-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-600/20">
                    <ShieldCheck className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">Analytics</h2>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-neutral-600' : 'text-slate-400'}`}>Gestão Hospitalar</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowFilters(!showFilters)} 
                    className={`p-3 rounded-2xl transition-all border ${showFilters || filterStartDate || filterEndDate || filterProfessional ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/20' : (isDarkMode ? 'bg-neutral-900 text-indigo-400 border-neutral-800' : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100')}`}
                    title="Filtros"
                  >
                    <Filter className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={generatePDFReport} 
                    disabled={filteredHistory.length === 0} 
                    className={`p-3 rounded-2xl disabled:opacity-30 transition-all border ${isDarkMode ? 'bg-neutral-900 text-neutral-100 border-neutral-800 hover:bg-neutral-800' : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100'}`}
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              </div>
              {showFilters && (
                <div className={`p-6 rounded-[2rem] border mb-4 space-y-6 animate-in slide-in-from-top-4 duration-500 shadow-2xl ${isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="space-y-3">
                    <label className={`text-[10px] font-black uppercase flex items-center gap-2 ${isDarkMode ? 'text-neutral-600' : 'text-slate-500'}`}><Clock className="w-4 h-4" /> Períodos Rápidos</label>
                    <div className="flex gap-2">
                      {[{ id: 'today', label: 'Hoje' }, { id: '7days', label: '7 dias' }, { id: '30days', label: '30 dias' }].map(chip => (
                        <button key={chip.id} onClick={() => handlePredefinedFilter(chip.id as any)} className={`flex-1 py-3 text-xs font-black rounded-xl border transition-all ${activePredefined === chip.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : (isDarkMode ? 'bg-black border-neutral-800 text-neutral-500 hover:border-neutral-700' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300')}`}>{chip.label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className={`text-[10px] font-black uppercase ${isDarkMode ? 'text-neutral-600' : 'text-slate-500'}`}>Início</label>
                      <input type="date" value={filterStartDate} onChange={(e) => { setFilterStartDate(e.target.value); setActivePredefined(null); }} className={`w-full p-3 border-2 rounded-xl text-xs outline-none focus:border-indigo-500 transition-all ${isDarkMode ? 'bg-black border-neutral-800 text-neutral-100' : 'bg-white border-slate-200 text-slate-900'}`} />
                    </div>
                    <div className="space-y-2">
                      <label className={`text-[10px] font-black uppercase ${isDarkMode ? 'text-neutral-600' : 'text-slate-500'}`}>Fim</label>
                      <input type="date" value={filterEndDate} onChange={(e) => { setFilterEndDate(e.target.value); setActivePredefined(null); }} className={`w-full p-3 border-2 rounded-xl text-xs outline-none focus:border-indigo-500 transition-all ${isDarkMode ? 'bg-black border-neutral-800 text-neutral-100' : 'bg-white border-slate-200 text-slate-900'}`} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className={`text-[10px] font-black uppercase flex items-center gap-2 ${isDarkMode ? 'text-neutral-600' : 'text-slate-500'}`}><Briefcase className="w-4 h-4" /> Profissional</label>
                    <select value={filterProfessional} onChange={(e) => setFilterProfessional(e.target.value)} className={`w-full p-3 border-2 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all ${isDarkMode ? 'bg-black border-neutral-800 text-neutral-100' : 'bg-white border-slate-200 text-slate-900'}`}>
                      <option value="">Todos os Médicos</option>
                      {PROFESSIONALS.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </div>
                  <div className={`flex justify-between items-center pt-4 border-t ${isDarkMode ? 'border-neutral-800' : 'border-slate-200'}`}>
                    <button onClick={clearFilters} className="text-xs text-rose-500 font-black hover:underline flex items-center gap-2"><X className="w-4 h-4" /> Limpar</button>
                    <button onClick={() => setShowFilters(false)} className="text-xs bg-indigo-600 text-white px-8 py-3 rounded-full font-black shadow-lg shadow-indigo-600/20 active:scale-95 transition-all">Aplicar Filtros</button>
                  </div>
                </div>
              )}
            </div>

            {filteredHistory.length === 0 ? (
              <div className="text-center py-24 text-slate-400 space-y-4">
                <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${isDarkMode ? 'bg-neutral-900' : 'bg-slate-50'}`}>
                   <BarChart3 className={`w-10 h-10 ${isDarkMode ? 'opacity-20' : 'opacity-10'}`} />
                </div>
                <p className="font-medium">Nenhum dado encontrado para os filtros selecionados.</p>
              </div>
            ) : (
              <div className="space-y-8 animate-in fade-in duration-700 pb-16">
                <div className="grid grid-cols-2 gap-4">
                  <div className={`p-6 rounded-[2rem] border transition-all duration-500 ${isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-indigo-50 border-indigo-100'}`}>
                    <div className={`flex items-center gap-2 mb-2 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}><Users className="w-5 h-5" /><span className="text-[10px] font-black uppercase tracking-widest">Avaliações</span></div>
                    <p className={`text-4xl font-black ${isDarkMode ? 'text-neutral-100' : 'text-indigo-900'}`}>{stats.total}</p>
                  </div>
                  <div className={`p-6 rounded-[2rem] border transition-all duration-500 ${isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-emerald-50 border-emerald-100'}`}>
                    <div className={`flex items-center gap-2 mb-2 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}><TrendingUp className="w-5 h-5" /><span className="text-[10px] font-black uppercase tracking-widest">NPS Global</span></div>
                    <p className={`text-4xl font-black ${isDarkMode ? 'text-neutral-100' : 'text-emerald-900'}`}>{stats.nps}</p>
                  </div>
                  <div className={`p-6 rounded-[2rem] border transition-all duration-500 ${isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-amber-50 border-amber-100'}`}>
                    <div className={`flex items-center gap-2 mb-2 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}><Star className="w-5 h-5" /><span className="text-[10px] font-black uppercase tracking-widest">Nota Média</span></div>
                    <p className={`text-4xl font-black ${isDarkMode ? 'text-neutral-100' : 'text-amber-900'}`}>{stats.avg}</p>
                  </div>
                  <div className={`p-6 rounded-[2rem] border transition-all duration-500 ${isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-slate-50 border-slate-100'}`}>
                    <div className={`flex items-center gap-2 mb-2 ${isDarkMode ? 'text-neutral-500' : 'text-slate-400'}`}><Calendar className="w-5 h-5" /><span className="text-[10px] font-black uppercase tracking-widest">Período</span></div>
                    <p className={`text-4xl font-black ${isDarkMode ? 'text-neutral-400' : 'text-slate-800'}`}>{filteredHistory.length}</p>
                  </div>
                </div>

                <div className={`p-8 rounded-[2.5rem] border shadow-sm transition-all duration-500 ${isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-100'}`}>
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className={`text-lg font-black ${isDarkMode ? 'text-neutral-200' : 'text-slate-800'}`}>Fluxo de Sentimento</h3>
                      <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-neutral-600' : 'text-slate-400'}`}>Evolução Temporal do NPS</p>
                    </div>
                    <span className="text-[10px] font-black px-4 py-1.5 rounded-full bg-indigo-500/10 text-indigo-500 uppercase tracking-widest">{filterProfessional || 'Todos'}</span>
                  </div>
                  <div className="flex items-end gap-3 h-40 pt-6 px-2 overflow-x-auto no-scrollbar">
                    {trendData.length > 0 ? trendData.map((d, i) => {
                      const h = Math.max(12, ((d.nps + 100) / 200) * 100); 
                      return (
                        <div key={i} className="flex-1 min-w-[35px] flex flex-col items-center gap-3 group relative">
                          <div className={`w-full rounded-t-xl transition-all duration-700 hover:brightness-110 ${d.nps >= 70 ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : d.nps >= 0 ? 'bg-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.3)]' : 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]'}`} style={{ height: `${h}%` }} />
                          <span className={`text-[9px] font-black rotate-45 mt-4 origin-left whitespace-nowrap ${isDarkMode ? 'text-neutral-700' : 'text-slate-300'}`}>{d.day.split('/').slice(0,2).join('/')}</span>
                          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-black px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-40 whitespace-nowrap border border-white/10">NPS: {d.nps}</div>
                        </div>
                      );
                    }) : <div className="w-full flex items-center justify-center text-slate-300 text-xs py-10">Dados insuficientes para gerar gráfico</div>}
                  </div>
                </div>

                {!filterProfessional && (
                  <div className={`p-8 rounded-[2.5rem] border shadow-sm transition-all duration-500 ${isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-100'}`}>
                    <h3 className={`text-lg font-black mb-8 ${isDarkMode ? 'text-neutral-200' : 'text-slate-800'}`}>Performance por Médico</h3>
                    <div className="space-y-6">
                      {PROFESSIONALS.map((name) => {
                        const count = stats.profCounts[name] || 0;
                        const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                        return (
                          <div key={name} className="flex items-center gap-5">
                            <span className={`text-xs font-black w-36 truncate ${isDarkMode ? 'text-neutral-400' : 'text-slate-600'}`}>{name}</span>
                            <div className={`flex-1 h-3 rounded-full overflow-hidden ${isDarkMode ? 'bg-black' : 'bg-slate-100'}`}>
                               <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-1000" style={{ width: `${pct}%` }} />
                            </div>
                            <span className={`text-xs font-black w-10 text-right ${isDarkMode ? 'text-neutral-600' : 'text-slate-400'}`}>{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-5">
                  <h3 className={`text-lg font-black px-2 ${isDarkMode ? 'text-neutral-400' : 'text-slate-800'}`}>Feedbacks Recentes</h3>
                  <div className="grid grid-cols-1 gap-4">
                    {filteredHistory.slice(-12).reverse().map((h, i) => (
                      <div key={i} className={`p-6 rounded-[2rem] border transition-all duration-500 hover:scale-[1.01] ${isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-slate-50/50 border-slate-100 shadow-sm'}`}>
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black text-white shadow-lg shadow-black/10 ${getNpsColor(h.nps || 0)}`}>NOTA {h.nps}</span>
                              <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-indigo-500' : 'text-indigo-600'}`}>{h.professional}</span>
                            </div>
                          </div>
                          <span className={`text-[10px] font-black ${isDarkMode ? 'text-neutral-700' : 'text-slate-300'}`}>{new Date(h.timestamp).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <p className={`text-base leading-relaxed italic ${isDarkMode ? 'text-neutral-400' : 'text-slate-600'}`}>"{h.comment || 'Sem observações adicionais.'}"</p>
                      </div>
                    ))}
                  </div>
                </div>

                <button onClick={() => { if (confirm('Atenção: Todos os dados serão permanentemente apagados. Deseja continuar?')) { localStorage.removeItem(STORAGE_KEY); setHistory([]); } }} className={`w-full py-6 text-xs font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 opacity-30 hover:opacity-100 transition-all mt-12 hover:text-rose-500 ${isDarkMode ? 'text-neutral-800' : 'text-slate-300'}`}><Trash2 className="w-4 h-4" /> Resetar Banco de Dados</button>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-700 ${isDarkMode ? 'bg-[#050505]' : 'bg-slate-50'}`}>
      <div className={`w-full max-w-xl rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden relative border transition-all duration-700 ${isDarkMode ? 'bg-neutral-950 border-neutral-900 shadow-indigo-950/20' : 'bg-white/95 backdrop-blur-3xl border-white shadow-slate-200'}`}>
        
        {/* Top Controls */}
        <div className="absolute top-8 right-10 z-50 flex gap-3">
           <button 
             onClick={() => setIsDarkMode(!isDarkMode)} 
             className={`p-3 rounded-2xl transition-all duration-300 transform active:scale-90 border shadow-sm ${isDarkMode ? 'bg-neutral-900 text-amber-400 border-neutral-800' : 'bg-white text-indigo-600 border-slate-100 hover:bg-slate-50'}`}
             title={isDarkMode ? 'Tema Claro' : 'Tema Escuro'}
           >
             {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
           </button>
        </div>

        {step !== AppStep.WELCOME && step !== AppStep.PROCESSING && step !== AppStep.SUCCESS && (
          <div className={`px-10 pt-10 flex items-center transition-all duration-500`}>
            <button onClick={handleBack} className={`p-3 -ml-3 rounded-2xl transition-all ${isDarkMode ? 'text-neutral-700 hover:bg-neutral-900 hover:text-neutral-400' : 'text-slate-300 hover:bg-slate-50 hover:text-slate-500'}`}>
                <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex gap-2 flex-1 mx-6 mr-14">
              {!isPromptingPassword && step !== AppStep.DASHBOARD && [1, 2, 3].map((i) => {
                const stepNum = step as number;
                return (
                  <div key={i} className={`h-2 rounded-full transition-all duration-500 ${i <= stepNum ? 'w-10 bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : (isDarkMode ? 'w-4 bg-neutral-900' : 'w-4 bg-slate-100')}`} />
                );
              })}
              {isPromptingPassword && <div className={`h-2 w-full rounded-full overflow-hidden ${isDarkMode ? 'bg-neutral-900' : 'bg-indigo-50'}`}><div className="h-full w-full bg-indigo-600 animate-pulse"></div></div>}
              {step === AppStep.DASHBOARD && <div className={`h-2 w-full rounded-full overflow-hidden ${isDarkMode ? 'bg-neutral-900' : 'bg-indigo-50'}`}><div className="h-full w-1/3 bg-indigo-600 animate-pulse"></div></div>}
            </div>
          </div>
        )}

        <div className={`transition-all duration-500 ${step === AppStep.DASHBOARD ? 'p-0' : 'p-10 sm:p-14'}`}>
            {renderStepContent()}
        </div>

        <div className={`p-6 text-center border-t flex justify-center items-center gap-3 transition-colors duration-500 ${isDarkMode ? 'bg-black/50 border-neutral-900' : 'bg-slate-50/30 border-slate-100'}`}>
           <span className={`text-[10px] font-black uppercase tracking-[0.4em] ${isDarkMode ? 'text-neutral-800' : 'text-slate-300'}`}>Santa Filomena</span>
           <div className={`w-1.5 h-1.5 rounded-full ${isDarkMode ? 'bg-neutral-900' : 'bg-slate-200'}`} />
           <p className={`text-[10px] font-black uppercase tracking-[0.4em] ${isDarkMode ? 'text-neutral-800' : 'text-slate-300'}`}>RateFlow AI</p>
        </div>
      </div>
    </div>
  );
};

export default App;
