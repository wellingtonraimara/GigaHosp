
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

const ProfessionalBtn: React.FC<{ 
  name: string; 
  isSelected: boolean; 
  isDarkMode: boolean;
  onClick: () => void 
}> = ({ name, isSelected, isDarkMode, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-4 p-6 rounded-3xl transition-all duration-300 border-2 transform ${
      isSelected 
      ? (isDarkMode ? 'bg-indigo-950/40 border-indigo-500 scale-105 shadow-xl shadow-indigo-900/20' : 'bg-indigo-50 border-indigo-500 scale-105 shadow-xl') 
      : (isDarkMode ? 'bg-neutral-900 border-neutral-800 hover:border-indigo-500/50 hover:bg-neutral-800' : 'bg-white border-slate-100 hover:border-indigo-200 hover:bg-slate-50')
    } active:scale-95`}
  >
    <div className={`p-4 rounded-full ${isSelected ? 'bg-indigo-500 text-white' : (isDarkMode ? 'bg-neutral-800 text-neutral-500' : 'bg-slate-100 text-slate-400')}`}>
      <UserRound className="w-8 h-8" />
    </div>
    <span className={`text-sm font-bold leading-tight ${isSelected ? (isDarkMode ? 'text-indigo-300' : 'text-indigo-700') : (isDarkMode ? 'text-neutral-400' : 'text-slate-600')}`}>{name}</span>
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
    if (n <= 2) return 'bg-[#FF5252]';
    if (n <= 4) return 'bg-[#FF9F43]';
    if (n === 5) return 'bg-[#FFD93D]';
    if (n <= 8) return 'bg-[#6BCB77]';
    return 'bg-[#00B112]';
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
        <div className="space-y-8 py-4 animate-in fade-in zoom-in duration-300">
          <div className="text-center">
            <div className={`inline-flex p-4 rounded-full mb-4 ${isDarkMode ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
              <Lock className="w-8 h-8" />
            </div>
            <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-neutral-100' : 'text-slate-800'}`}>Acesso Restrito</h2>
            <p className={`${isDarkMode ? 'text-neutral-400' : 'text-slate-500'} mt-2`}>Insira a senha administrativa para continuar.</p>
          </div>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <input
              type="password"
              value={passwordValue}
              autoFocus
              onChange={(e) => { setPasswordValue(e.target.value); setPasswordError(false); }}
              placeholder="Senha de acesso"
              className={`w-full p-5 border-2 rounded-2xl text-center text-2xl tracking-[0.5em] font-mono focus:outline-none transition-all ${isDarkMode ? 'bg-neutral-900 border-neutral-800 text-neutral-100 focus:border-indigo-500' : 'bg-slate-50 border-slate-100 focus:border-indigo-500 text-slate-800'} ${passwordError ? 'border-rose-400 bg-rose-50' : ''}`}
            />
            {passwordError && <p className="text-rose-500 text-xs font-bold text-center mt-2 animate-bounce">Senha Incorreta</p>}
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={handleBack} className={`py-4 rounded-2xl font-bold transition-colors ${isDarkMode ? 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Cancelar</button>
              <button type="submit" className="py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg hover:bg-indigo-700 active:scale-95 transition-all">Entrar</button>
            </div>
          </form>
        </div>
      );
    }

    switch (step) {
      case AppStep.WELCOME:
        return (
          <div className="text-center space-y-8 py-8 animate-in fade-in duration-500">
            <div className="relative inline-block">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full blur opacity-25"></div>
              <div className={`relative p-6 rounded-full shadow-2xl ${isDarkMode ? 'bg-neutral-900' : 'bg-white'}`}>
                <Star className={`w-12 h-12 ${isDarkMode ? 'text-indigo-400 fill-indigo-900/50' : 'text-indigo-600 fill-indigo-100'}`} />
              </div>
            </div>
            <div>
              <h1 className={`text-4xl font-bold tracking-tight ${isDarkMode ? 'text-neutral-100' : 'text-slate-800'}`}>Como foi seu atendimento?</h1>
              <p className={`mt-3 text-lg ${isDarkMode ? 'text-neutral-400' : 'text-slate-500'}`}>Hospital Santa Filomena - Sua saúde em boas mãos.</p>
            </div>
            <div className="space-y-3">
              <button onClick={handleNext} className="group relative w-full inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-200 bg-indigo-600 rounded-2xl hover:bg-indigo-700 shadow-xl active:scale-95">
                Começar Avaliação
                <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button onClick={() => setIsPromptingPassword(true)} className={`w-full py-3 font-medium flex items-center justify-center gap-2 transition-colors group ${isDarkMode ? 'text-neutral-500 hover:text-indigo-400' : 'text-slate-400 hover:text-indigo-600'}`}>
                <Lock className="w-4 h-4" /> Painel Administrativo
              </button>
            </div>
          </div>
        );

      case AppStep.PROFESSIONAL:
        return (
          <div className="space-y-6 py-4 animate-in slide-in-from-right duration-500 flex flex-col h-full max-h-[60vh]">
            <h2 className={`text-2xl font-bold text-center ${isDarkMode ? 'text-neutral-100' : 'text-slate-800'}`}>Qual profissional realizou o atendimento?</h2>
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
              className={`w-full py-4 mt-4 rounded-2xl font-bold transition-all shrink-0 ${feedback.professional ? 'bg-indigo-600 text-white shadow-lg active:scale-95' : (isDarkMode ? 'bg-neutral-800 text-neutral-600' : 'bg-gray-100 text-gray-400 cursor-not-allowed')}`}
            >
              Continuar
            </button>
          </div>
        );

      case AppStep.NPS:
        return (
          <div className="space-y-8 py-4 animate-in slide-in-from-right duration-500">
            <h2 className={`text-2xl font-bold text-center leading-tight ${isDarkMode ? 'text-neutral-100' : 'text-slate-800'}`}>Dê uma nota geral para o atendimento de 0 a 10</h2>
            <div className="flex flex-col items-center gap-3">
              <div className="flex flex-wrap justify-center gap-2">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((num) => (
                  <button key={num} onClick={() => setFeedback({ ...feedback, nps: num })} className={`w-11 h-14 rounded-xl text-white font-bold text-xl transition-all transform ${getNpsColor(num)} ${feedback.nps === num ? 'scale-110 ring-4 ring-indigo-300 ring-offset-2 z-10 shadow-2xl' : 'opacity-90 hover:opacity-100'} active:scale-90`}>{num}</button>
                ))}
              </div>
              <div className="flex justify-center gap-2">
                {[8, 9, 10].map((num) => (
                  <button key={num} onClick={() => setFeedback({ ...feedback, nps: num })} className={`w-11 h-14 rounded-xl text-white font-bold text-xl transition-all transform ${getNpsColor(num)} ${feedback.nps === num ? 'scale-110 ring-4 ring-indigo-300 ring-offset-2 z-10 shadow-2xl' : 'opacity-90 hover:opacity-100'} active:scale-90`}>{num}</button>
                ))}
              </div>
            </div>
            <div className={`flex justify-between text-[11px] font-bold uppercase tracking-widest px-6 ${isDarkMode ? 'text-neutral-500' : 'text-slate-400'}`}><span>Nada Provável</span><span>Muito Provável</span></div>
            <button disabled={feedback.nps === null} onClick={handleNext} className={`w-full py-4 rounded-2xl font-bold transition-all ${feedback.nps !== null ? 'bg-indigo-600 text-white shadow-lg active:scale-95' : (isDarkMode ? 'bg-neutral-800 text-neutral-600' : 'bg-gray-100 text-gray-400 cursor-not-allowed')}`}>Continuar</button>
          </div>
        );

      case AppStep.COMMENT:
        return (
          <div className="space-y-6 py-4 animate-in slide-in-from-right duration-500">
            <div className="text-center">
              <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-neutral-100' : 'text-slate-800'}`}>Quer contar mais?</h2>
              <p className={`${isDarkMode ? 'text-neutral-500' : 'text-slate-500'} mt-1`}>Seu comentário é opcional, mas ajuda muito!</p>
            </div>
            <div className="relative">
              <textarea 
                value={feedback.comment} 
                onChange={(e) => setFeedback({ ...feedback, comment: e.target.value })} 
                placeholder="Escreva aqui sua experiência..." 
                className={`w-full h-40 p-5 rounded-3xl border-2 transition-all resize-none text-lg placeholder:text-neutral-600 outline-none ${isDarkMode ? 'bg-neutral-900 border-neutral-800 text-neutral-100 focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-700 focus:border-indigo-500'}`} 
              />
              <MessageSquare className={`absolute bottom-5 right-5 ${isDarkMode ? 'text-neutral-800' : 'text-slate-200'}`} />
            </div>
            <button onClick={handleNext} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg active:scale-95 transition-all">Enviar Avaliação</button>
          </div>
        );

      case AppStep.PROCESSING:
        return (
          <div className="flex flex-col items-center justify-center py-20 space-y-6 animate-pulse">
            <Loader2 className="w-16 h-16 text-indigo-600 animate-spin" />
            <h3 className={`text-xl font-semibold text-center ${isDarkMode ? 'text-neutral-300' : 'text-slate-800'}`}>Processando sua resposta...</h3>
          </div>
        );

      case AppStep.SUCCESS:
        return (
          <div className="text-center space-y-8 py-8 animate-in zoom-in duration-500">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 rounded-full"><CheckCircle2 className="w-12 h-12 text-green-500" /></div>
            <div>
              <h2 className={`text-3xl font-bold ${isDarkMode ? 'text-neutral-100' : 'text-slate-800'}`}>Feedback Enviado!</h2>
              <div className={`mt-6 p-6 rounded-3xl border ${isDarkMode ? 'bg-indigo-950/20 border-indigo-900/40' : 'bg-indigo-50/50 border-indigo-100'}`}>
                <p className={`leading-relaxed italic whitespace-pre-wrap ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900'}`}>{aiMessage}</p>
              </div>
            </div>
            <button onClick={() => { setFeedback({ professional: null, nps: null, comment: '', timestamp: '' }); setStep(AppStep.WELCOME); }} className={`w-full py-4 font-semibold flex items-center justify-center gap-2 ${isDarkMode ? 'text-neutral-500 hover:text-indigo-400' : 'text-slate-500 hover:text-indigo-600'}`}><Home className="w-4 h-4" /> Nova Avaliação</button>
          </div>
        );

      case AppStep.DASHBOARD:
        return (
          <div className={`space-y-6 py-2 h-[80vh] overflow-y-auto no-scrollbar transition-colors duration-500 px-6 sm:px-8 ${isDarkMode ? 'bg-neutral-950 text-neutral-100' : 'bg-white text-slate-900'}`}>
            <div className={`flex flex-col sticky top-0 z-20 pb-4 transition-colors duration-500 ${isDarkMode ? 'bg-neutral-950/95 backdrop-blur' : 'bg-white/95 backdrop-blur'}`}>
              <div className="flex items-center justify-between py-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className={`w-6 h-6 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
                  <h2 className="text-2xl font-bold tracking-tight">Painel de Gestão</h2>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowFilters(!showFilters)} 
                    className={`p-2 rounded-lg transition-colors border ${showFilters || filterStartDate || filterEndDate || filterProfessional ? 'bg-indigo-600 text-white border-indigo-500' : (isDarkMode ? 'bg-neutral-800 text-indigo-300 border-neutral-700' : 'bg-indigo-50 text-indigo-600 border-indigo-100')}`}
                    title="Filtros"
                  >
                    <Filter className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={generatePDFReport} 
                    disabled={filteredHistory.length === 0} 
                    className={`p-2 rounded-lg disabled:opacity-50 transition-colors border ${isDarkMode ? 'bg-neutral-800 text-neutral-100 border-neutral-700 hover:bg-neutral-700' : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100'}`}
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              </div>
              {showFilters && (
                <div className={`p-4 rounded-2xl border mb-2 space-y-5 animate-in slide-in-from-top duration-300 ${isDarkMode ? 'bg-neutral-900 border-neutral-800 shadow-2xl' : 'bg-slate-50 border-slate-100 shadow-lg'}`}>
                  <div className="space-y-2">
                    <label className={`text-[10px] font-bold uppercase flex items-center gap-1 ${isDarkMode ? 'text-neutral-500' : 'text-slate-400'}`}><Clock className="w-3 h-3" /> Períodos Rápidos</label>
                    <div className="flex gap-2">
                      {[{ id: 'today', label: 'Hoje' }, { id: '7days', label: '7 dias' }, { id: '30days', label: '30 dias' }].map(chip => (
                        <button key={chip.id} onClick={() => handlePredefinedFilter(chip.id as any)} className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${activePredefined === chip.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : (isDarkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-500' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300')}`}>{chip.label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className={`text-[10px] font-bold uppercase ${isDarkMode ? 'text-neutral-500' : 'text-slate-400'}`}>Início</label>
                      <input type="date" value={filterStartDate} onChange={(e) => { setFilterStartDate(e.target.value); setActivePredefined(null); }} className={`w-full p-2 border rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100' : 'bg-white border-slate-200 text-slate-900'}`} />
                    </div>
                    <div className="space-y-1">
                      <label className={`text-[10px] font-bold uppercase ${isDarkMode ? 'text-neutral-500' : 'text-slate-400'}`}>Fim</label>
                      <input type="date" value={filterEndDate} onChange={(e) => { setFilterEndDate(e.target.value); setActivePredefined(null); }} className={`w-full p-2 border rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100' : 'bg-white border-slate-200 text-slate-900'}`} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className={`text-[10px] font-bold uppercase flex items-center gap-1 ${isDarkMode ? 'text-neutral-500' : 'text-slate-400'}`}><Briefcase className="w-3 h-3" /> Profissional</label>
                    <select value={filterProfessional} onChange={(e) => setFilterProfessional(e.target.value)} className={`w-full p-2 border rounded-lg text-xs font-medium outline-none focus:ring-1 focus:ring-indigo-500 ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-100' : 'bg-white border-slate-200 text-slate-900'}`}>
                      <option value="">Todos os Profissionais</option>
                      {PROFESSIONALS.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </div>
                  <div className={`flex justify-between items-center pt-2 border-t ${isDarkMode ? 'border-neutral-800' : 'border-slate-100'}`}>
                    <button onClick={clearFilters} className="text-xs text-rose-500 font-bold hover:underline flex items-center gap-1"><X className="w-3 h-3" /> Limpar Filtros</button>
                    <button onClick={() => setShowFilters(false)} className="text-xs bg-indigo-600 text-white px-6 py-2 rounded-full font-bold shadow-sm active:scale-95 transition-transform">Aplicar</button>
                  </div>
                </div>
              )}
            </div>
            {filteredHistory.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <BarChart3 className={`w-12 h-12 mx-auto mb-4 ${isDarkMode ? 'opacity-10' : 'opacity-20'}`} />
                <p>Nenhuma avaliação encontrada com estes filtros.</p>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in duration-500 pb-10">
                <div className="grid grid-cols-2 gap-3">
                  <div className={`p-4 rounded-3xl border transition-colors duration-500 ${isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-indigo-50 border-indigo-100'}`}>
                    <div className={`flex items-center gap-2 mb-1 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}><Users className="w-4 h-4" /><span className="text-[10px] font-bold uppercase tracking-wider">Total</span></div>
                    <p className={`text-3xl font-bold ${isDarkMode ? 'text-neutral-100' : 'text-indigo-900'}`}>{stats.total}</p>
                  </div>
                  <div className={`p-4 rounded-3xl border transition-colors duration-500 ${isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-emerald-50 border-emerald-100'}`}>
                    <div className={`flex items-center gap-2 mb-1 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}><TrendingUp className="w-4 h-4" /><span className="text-[10px] font-bold uppercase tracking-wider">NPS</span></div>
                    <p className={`text-3xl font-bold ${isDarkMode ? 'text-neutral-100' : 'text-emerald-900'}`}>{stats.nps}</p>
                  </div>
                  <div className={`p-4 rounded-3xl border transition-colors duration-500 ${isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-amber-50 border-amber-100'}`}>
                    <div className={`flex items-center gap-2 mb-1 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}><Star className="w-4 h-4" /><span className="text-[10px] font-bold uppercase tracking-wider">Média</span></div>
                    <p className={`text-3xl font-bold ${isDarkMode ? 'text-neutral-100' : 'text-amber-900'}`}>{stats.avg}</p>
                  </div>
                  <div className={`p-4 rounded-3xl border transition-colors duration-500 ${isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-slate-50 border-slate-100'}`}>
                    <div className={`flex items-center gap-2 mb-1 ${isDarkMode ? 'text-neutral-500' : 'text-slate-500'}`}><Calendar className="w-4 h-4" /><span className="text-[10px] font-bold uppercase tracking-wider">Período</span></div>
                    <p className={`text-3xl font-bold ${isDarkMode ? 'text-neutral-400' : 'text-slate-800'}`}>{filteredHistory.length}</p>
                  </div>
                </div>
                <div className={`p-5 rounded-3xl border shadow-sm transition-colors duration-500 ${isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-100'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-sm font-bold ${isDarkMode ? 'text-neutral-200' : 'text-slate-800'}`}>Tendência do NPS</h3>
                    <span className="text-[10px] font-bold text-indigo-500 uppercase">{filterProfessional || 'Geral'}</span>
                  </div>
                  <div className="flex items-end gap-2 h-32 pt-4 px-2 overflow-x-auto no-scrollbar">
                    {trendData.length > 0 ? trendData.map((d, i) => {
                      const h = Math.max(10, ((d.nps + 100) / 200) * 100); 
                      return (
                        <div key={i} className="flex-1 min-w-[30px] flex flex-col items-center gap-2 group relative">
                          <div className={`w-full rounded-t-lg transition-all duration-500 ${d.nps >= 70 ? 'bg-emerald-500' : d.nps >= 0 ? 'bg-amber-400' : 'bg-rose-500'}`} style={{ height: `${h}%` }} />
                          <span className={`text-[8px] font-bold rotate-45 mt-2 origin-left whitespace-nowrap ${isDarkMode ? 'text-neutral-600' : 'text-slate-400'}`}>{d.day.split('/').slice(0,2).join('/')}</span>
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">NPS: {d.nps}</div>
                        </div>
                      );
                    }) : <div className="w-full flex items-center justify-center text-slate-300 text-xs py-10">Sem dados temporais</div>}
                  </div>
                </div>
                {!filterProfessional && (
                  <div className={`p-5 rounded-3xl border shadow-sm transition-colors duration-500 ${isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-100'}`}>
                    <h3 className={`text-sm font-bold mb-4 ${isDarkMode ? 'text-neutral-200' : 'text-slate-800'}`}>Por Profissional</h3>
                    <div className="space-y-3">
                      {PROFESSIONALS.map((name) => {
                        const count = stats.profCounts[name] || 0;
                        const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                        return (
                          <div key={name} className="flex items-center gap-3">
                            <span className={`text-xs font-bold w-32 truncate ${isDarkMode ? 'text-neutral-400' : 'text-slate-600'}`}>{name}</span>
                            <div className={`flex-1 h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-neutral-800' : 'bg-slate-50'}`}><div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} /></div>
                            <span className={`text-xs font-bold w-8 text-right ${isDarkMode ? 'text-neutral-500' : 'text-slate-500'}`}>{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="space-y-3">
                  <h3 className={`text-sm font-bold px-2 ${isDarkMode ? 'text-neutral-400' : 'text-slate-800'}`}>Avaliações Recentes</h3>
                  {filteredHistory.slice(-10).reverse().map((h, i) => (
                    <div key={i} className={`p-4 rounded-2xl border text-sm transition-colors duration-500 ${isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-slate-50/50 border-slate-100'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex flex-col gap-1">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white w-fit ${getNpsColor(h.nps || 0)}`}>Nota {h.nps}</span>
                          <span className={`text-[10px] font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{h.professional}</span>
                        </div>
                        <span className={`text-[10px] ${isDarkMode ? 'text-neutral-600' : 'text-slate-400'}`}>{new Date(h.timestamp).toLocaleTimeString('pt-BR')}</span>
                      </div>
                      <p className={`line-clamp-2 italic ${isDarkMode ? 'text-neutral-300' : 'text-slate-600'}`}>"{h.comment || 'Sem comentário'}"</p>
                    </div>
                  ))}
                </div>
                <button onClick={() => { if (confirm('Tem certeza que deseja apagar todos os dados?')) { localStorage.removeItem(STORAGE_KEY); setHistory([]); } }} className={`w-full py-4 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 opacity-30 hover:opacity-100 transition-opacity mt-8 ${isDarkMode ? 'text-rose-400' : 'text-rose-500'}`}><Trash2 className="w-3 h-3" /> Limpar Tudo</button>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-700 ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-slate-100'}`}>
      <div className={`w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden relative border transition-all duration-500 ${isDarkMode ? 'bg-neutral-950 border-neutral-900 shadow-indigo-950/20' : 'bg-white/95 backdrop-blur-xl border-white/50 shadow-slate-200'}`}>
        
        {/* Global Theme Toggle (Top Right) */}
        <div className="absolute top-8 right-8 z-30 flex gap-2">
           <button 
             onClick={() => setIsDarkMode(!isDarkMode)} 
             className={`p-2.5 rounded-xl transition-all duration-300 transform active:scale-90 border ${isDarkMode ? 'bg-neutral-900 text-amber-400 border-neutral-800' : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100'}`}
             title={isDarkMode ? 'Modo Claro' : 'Modo Escuro'}
           >
             {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
           </button>
        </div>

        {step !== AppStep.WELCOME && step !== AppStep.PROCESSING && step !== AppStep.SUCCESS && (
          <div className={`px-8 pt-8 flex items-center transition-colors duration-500`}>
            <button onClick={handleBack} className={`p-2 -ml-2 rounded-full transition-colors ${isDarkMode ? 'text-neutral-600 hover:bg-neutral-800' : 'text-slate-400 hover:bg-slate-100'}`}>
                <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex gap-1.5 flex-1 mx-4 mr-10">
              {!isPromptingPassword && step !== AppStep.DASHBOARD && [1, 2, 3].map((i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i <= (step as number) ? 'w-8 bg-indigo-500' : (isDarkMode ? 'w-4 bg-neutral-800' : 'w-4 bg-slate-100')}`} />
              ))}
              {isPromptingPassword && <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDarkMode ? 'bg-neutral-800' : 'bg-indigo-100'}`}><div className="h-full w-full bg-indigo-500 animate-pulse"></div></div>}
              {step === AppStep.DASHBOARD && <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDarkMode ? 'bg-neutral-800' : 'bg-indigo-600/10'}`}><div className="h-full w-1/4 bg-indigo-600 animate-pulse"></div></div>}
            </div>
          </div>
        )}

        <div className={`transition-all duration-500 ${step === AppStep.DASHBOARD ? 'p-0' : 'p-8 sm:p-12'}`}>
            {renderStepContent()}
        </div>

        <div className={`p-4 text-center border-t flex justify-center items-center gap-2 transition-colors duration-500 ${isDarkMode ? 'bg-neutral-950 border-neutral-900' : 'bg-transparent border-slate-50'}`}>
           <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-neutral-800' : 'text-slate-300'}`}>Hospital Santa Filomena</span>
           <div className={`w-1 h-1 rounded-full ${isDarkMode ? 'bg-neutral-800' : 'bg-slate-200'}`} />
           <p className={`text-[10px] font-medium uppercase tracking-widest ${isDarkMode ? 'text-neutral-800' : 'text-slate-300'}`}>RateFlow AI</p>
        </div>
      </div>
    </div>
  );
};

export default App;
