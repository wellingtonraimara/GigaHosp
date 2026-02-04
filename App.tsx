
import React, { useState, useEffect, useMemo } from 'react';
import { 
  MessageSquare, ChevronRight, CheckCircle2, ArrowLeft, 
  Loader2, Home, Star, BarChart3, Download, Users, 
  TrendingUp, Calendar, Trash2, Lock, ShieldCheck, UserRound,
  Filter, X, Briefcase, Clock, Moon, Sun, AlertTriangle, Cloud, Check, FileText
} from 'lucide-react';
import { AppStep, FeedbackData } from './types';
import { analyzeFeedback } from './geminiService';
import { dataService } from './dataService';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const DASHBOARD_PASSWORD = '102530';
const RESET_PASSWORD = '102530';
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

interface DashboardStats {
  total: number;
  avg: string;
  nps: number;
  promoters: number;
  detractors: number;
  profCounts: Record<string, number>;
}

const ProfessionalBtn: React.FC<{ 
  name: string; 
  isSelected: boolean; 
  isDarkMode: boolean;
  onClick: () => void 
}> = ({ name, isSelected, isDarkMode, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-3 p-4 sm:p-6 rounded-[2rem] transition-all duration-500 border-2 transform ${
      isSelected 
      ? (isDarkMode ? 'bg-indigo-500/20 border-indigo-500 scale-105 shadow-[0_0_20px_rgba(99,102,241,0.3)]' : 'bg-indigo-50 border-indigo-500 scale-105 shadow-xl shadow-indigo-100') 
      : (isDarkMode ? 'bg-neutral-900/50 backdrop-blur-md border-neutral-800 hover:border-indigo-500/30' : 'bg-white/80 backdrop-blur-md border-slate-100 hover:border-indigo-200 shadow-sm')
    } active:scale-95`}
  >
    <div className={`p-3 sm:p-4 rounded-full transition-colors duration-300 ${isSelected ? 'bg-indigo-500 text-white' : (isDarkMode ? 'bg-neutral-800 text-neutral-500' : 'bg-slate-50 text-slate-400')}`}>
      <UserRound className="w-6 h-6 sm:w-8 h-8" />
    </div>
    <span className={`text-xs sm:text-sm font-bold leading-tight transition-colors duration-300 ${isSelected ? (isDarkMode ? 'text-indigo-300' : 'text-indigo-700') : (isDarkMode ? 'text-neutral-400' : 'text-slate-600')}`}>{name}</span>
  </button>
);

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.WELCOME);
  const [history, setHistory] = useState<FeedbackData[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
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

  const [isPromptingReset, setIsPromptingReset] = useState(false);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState(false);

  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterProfessional, setFilterProfessional] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadTarget, setDownloadTarget] = useState<string>('all');
  const [activePredefined, setActivePredefined] = useState<'today' | '7days' | '30days' | null>(null);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = typeof localStorage !== 'undefined' ? localStorage.getItem('theme') : 'light';
    return savedTheme === 'dark';
  });

  useEffect(() => {
    const loadData = async () => {
      setIsLoadingData(true);
      const data = await dataService.getAllFeedbacks();
      setHistory(data);
      setIsLoadingData(false);
    };
    loadData();
  }, [step]);

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
    if (isPromptingReset) {
      setIsPromptingReset(false);
      setResetPasswordValue('');
      setResetPasswordError(false);
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

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetPasswordValue === RESET_PASSWORD) {
      await dataService.clearAllData();
      setHistory([]);
      setIsPromptingReset(false);
      setResetPasswordValue('');
      setResetPasswordError(false);
    } else {
      setResetPasswordError(true);
      setResetPasswordValue('');
    }
  };

  const handlePredefinedFilter = (range: 'today' | '7days' | '30days') => {
    const end = new Date();
    const start = new Date();
    if (range === 'today') { } 
    else if (range === '7days') start.setDate(end.getDate() - 7);
    else if (range === '30days') start.setDate(end.getDate() - 30);
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
    try {
      setStep(AppStep.PROCESSING);
      const result = await analyzeFeedback(feedback);
      setAiMessage(result);
      const finalFeedback = { ...feedback, timestamp: new Date().toISOString() };
      await dataService.saveFeedback(finalFeedback);
      setStep(AppStep.SUCCESS);
    } catch (error) {
      console.error("Erro crítico no envio:", error);
      setAiMessage(`Obrigado por sua avaliação! Valorizamos muito o seu feedback.\n\nAtenciosamente, Hospital Santa Filomena`);
      setStep(AppStep.SUCCESS);
    }
  };

  const getNpsColor = (n: number) => {
    if (n <= 2) return 'bg-rose-500';
    if (n <= 4) return 'bg-orange-500';
    if (n <= 6) return 'bg-amber-400';
    if (n <= 8) return 'bg-lime-500';
    return 'bg-emerald-500';
  };

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

  const stats = useMemo<DashboardStats>(() => {
    const total = filteredHistory.length;
    if (total === 0) return { total: 0, avg: '0', nps: 0, promoters: 0, detractors: 0, profCounts: {} };
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

  const generatePDFReport = () => {
    const doc = new jsPDF();
    const today = new Date().toLocaleDateString('pt-BR');
    
    const exportData = downloadTarget === 'all' 
      ? filteredHistory 
      : filteredHistory.filter(h => h.professional === downloadTarget);
    
    if (exportData.length === 0) {
      alert("Não há dados para exportar com esta seleção.");
      return;
    }

    const reportSum = exportData.reduce((acc, curr) => acc + (curr.nps || 0), 0);
    const reportAvg = (reportSum / exportData.length).toFixed(1);
    const reportPromoters = exportData.filter(h => (h.nps || 0) >= 9).length;
    const reportDetractors = exportData.filter(h => (h.nps || 0) <= 6).length;
    const reportNps = Math.round(((reportPromoters / exportData.length) - (reportDetractors / exportData.length)) * 100);

    doc.setFillColor(63, 81, 181);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setFontSize(24);
    doc.setTextColor(255, 255, 255);
    doc.text('HOSPITAL SANTA FILOMENA', 105, 20, { align: 'center' });
    doc.setFontSize(14);
    doc.text('Relatório Gerencial de Atendimento', 105, 30, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`Emissão: ${today}`, 196, 50, { align: 'right' });
    doc.text(`Alvo: ${downloadTarget === 'all' ? 'Todos os Profissionais' : downloadTarget}`, 14, 50);

    doc.setDrawColor(230, 230, 230);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 55, 182, 30, 3, 3, 'FD');
    doc.setFontSize(12);
    doc.text('Resumo do Período', 20, 65);
    
    (doc as any).autoTable({
      startY: 70,
      margin: { left: 20 },
      head: [['Métrica', 'Consolidado']],
      body: [
        ['Total de Avaliações', exportData.length.toString()],
        ['Nota Média Geral', `${reportAvg} / 10`],
        ['Net Promoter Score (NPS)', reportNps.toString()]
      ],
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 1 }
    });

    const tableRows = exportData.map(h => [
      new Date(h.timestamp).toLocaleDateString('pt-BR'),
      h.professional,
      h.nps,
      h.comment || '-'
    ]);
    
    doc.setFontSize(14);
    doc.setTextColor(63, 81, 181);
    doc.text('Detalhamento de Feedbacks', 14, (doc as any).lastAutoTable.finalY + 15);
    
    (doc as any).autoTable({
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['Data', 'Profissional', 'Nota', 'Comentário']],
      body: tableRows,
      theme: 'striped',
      headStyles: { fillColor: [63, 81, 181], textColor: [255, 255, 255] },
      columnStyles: { 3: { cellWidth: 80 } },
      styles: { fontSize: 8 }
    });
    
    const filename = `Relatorio_${downloadTarget.replace(/\s+/g, '_')}_${today.replace(/\//g, '-')}.pdf`;
    doc.save(filename);
    setShowDownloadModal(false);
  };

  const renderStepContent = () => {
    if (isPromptingPassword) {
      return (
        <div className="space-y-6 sm:space-y-8 py-4 animate-in fade-in zoom-in duration-500">
          <div className="text-center">
            <div className={`inline-flex p-4 sm:p-5 rounded-full mb-6 ${isDarkMode ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
              <Lock className="w-8 h-8 sm:w-10 h-10" />
            </div>
            <h2 className={`text-2xl sm:text-3xl font-bold ${isDarkMode ? 'text-neutral-100' : 'text-slate-800'}`}>Acesso Restrito</h2>
            <p className={`${isDarkMode ? 'text-neutral-400' : 'text-slate-500'} mt-2 text-sm sm:text-base`}>Insira a senha para acessar o dashboard.</p>
          </div>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <input
              type="password"
              value={passwordValue}
              autoFocus
              onChange={(e) => { setPasswordValue(e.target.value); setPasswordError(false); }}
              placeholder="••••••"
              className={`w-full p-5 sm:p-6 border-2 rounded-[2rem] text-center text-2xl sm:text-3xl tracking-[0.5em] font-mono focus:outline-none transition-all ${isDarkMode ? 'bg-neutral-900 border-neutral-800 text-neutral-100 focus:border-indigo-500' : 'bg-slate-50 border-slate-100 focus:border-indigo-500 text-slate-800'} ${passwordError ? 'border-rose-400 bg-rose-50' : ''}`}
            />
            {passwordError && <p className="text-rose-500 text-xs font-bold text-center mt-2 animate-bounce">Senha Incorreta</p>}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <button type="button" onClick={handleBack} className={`py-4 sm:py-5 rounded-[1.5rem] font-bold transition-all text-sm sm:text-base ${isDarkMode ? 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Voltar</button>
              <button type="submit" className="py-4 sm:py-5 bg-indigo-600 text-white rounded-[1.5rem] font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 active:scale-95 transition-all text-sm sm:text-base">Entrar</button>
            </div>
          </form>
        </div>
      );
    }

    if (isPromptingReset) {
      return (
        <div className="space-y-6 sm:space-y-8 py-4 animate-in fade-in zoom-in duration-500">
          <div className="text-center">
            <div className={`inline-flex p-4 sm:p-5 rounded-full mb-6 ${isDarkMode ? 'bg-rose-900/40 text-rose-400' : 'bg-rose-50 text-rose-600'}`}>
              <AlertTriangle className="w-8 h-8 sm:w-10 h-10" />
            </div>
            <h2 className={`text-2xl sm:text-3xl font-bold ${isDarkMode ? 'text-neutral-100' : 'text-slate-800'}`}>Limpar Dados</h2>
            <p className={`${isDarkMode ? 'text-neutral-400' : 'text-slate-500'} mt-2 text-sm sm:text-base`}>Esta ação é irreversível.</p>
          </div>
          <form onSubmit={handleResetSubmit} className="space-y-4">
            <input
              type="password"
              value={resetPasswordValue}
              autoFocus
              onChange={(e) => { setResetPasswordValue(e.target.value); setResetPasswordError(false); }}
              placeholder="••••••"
              className={`w-full p-5 sm:p-6 border-2 rounded-[2rem] text-center text-2xl sm:text-3xl tracking-[0.5em] font-mono focus:outline-none transition-all ${isDarkMode ? 'bg-neutral-900 border-neutral-800 text-neutral-100 focus:border-rose-500' : 'bg-slate-50 border-slate-100 focus:border-rose-500 text-slate-800'}`}
            />
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <button type="button" onClick={handleBack} className={`py-4 sm:py-5 rounded-[1.5rem] font-bold transition-all text-sm sm:text-base ${isDarkMode ? 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Cancelar</button>
              <button type="submit" className="py-4 sm:py-5 bg-rose-600 text-white rounded-[1.5rem] font-bold shadow-lg shadow-rose-600/20 hover:bg-rose-700 active:scale-95 transition-all text-sm sm:text-base">Apagar Tudo</button>
            </div>
          </form>
        </div>
      );
    }

    switch (step) {
      case AppStep.WELCOME:
        return (
          <div className="text-center space-y-8 sm:space-y-10 py-6 sm:py-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="relative inline-block">
              <div className="absolute -inset-4 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-full blur-2xl opacity-20 animate-pulse"></div>
              <div className={`relative p-6 sm:p-8 rounded-full shadow-2xl ${isDarkMode ? 'bg-neutral-900 border border-neutral-800' : 'bg-white'}`}>
                <Star className={`w-10 h-10 sm:w-14 h-14 ${isDarkMode ? 'text-indigo-400 fill-indigo-900/30' : 'text-indigo-600 fill-indigo-50'}`} />
              </div>
            </div>
            <div>
              <h1 className={`text-3xl sm:text-4xl font-black tracking-tight leading-tight ${isDarkMode ? 'text-neutral-100' : 'text-slate-900'}`}>Avaliação de Atendimento</h1>
              <p className={`mt-3 sm:mt-4 text-lg sm:text-xl font-medium ${isDarkMode ? 'text-neutral-400' : 'text-slate-500'}`}>Hospital Santa Filomena</p>
            </div>
            <div className="space-y-4 w-full max-w-xs mx-auto">
              <button onClick={handleNext} className="group relative w-full inline-flex items-center justify-center px-6 sm:px-8 py-4 sm:py-5 font-bold text-white transition-all duration-300 bg-indigo-600 rounded-[2rem] hover:bg-indigo-700 shadow-xl shadow-indigo-600/25 active:scale-95">
                Avaliar Agora
                <ChevronRight className="ml-2 w-5 h-5 sm:w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </button>
              <button onClick={() => setIsPromptingPassword(true)} className={`w-full py-3 font-semibold flex items-center justify-center gap-2 transition-all group text-sm sm:text-base ${isDarkMode ? 'text-neutral-500 hover:text-indigo-400' : 'text-slate-400 hover:text-indigo-600'}`}>
                <Lock className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" /> Painel Gestão
              </button>
            </div>
          </div>
        );

      case AppStep.PROFESSIONAL:
        return (
          <div className="space-y-6 sm:space-y-8 py-4 animate-in slide-in-from-right duration-500 flex flex-col h-full max-h-[65vh]">
            <div className="text-center space-y-1 sm:space-y-2">
              <h2 className={`text-2xl sm:text-3xl font-black ${isDarkMode ? 'text-neutral-100' : 'text-slate-900'}`}>Quem te atendeu?</h2>
              <p className={`${isDarkMode ? 'text-neutral-500' : 'text-slate-500'} font-medium text-sm sm:text-base`}>Selecione o profissional abaixo</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 overflow-y-auto px-1 py-4 no-scrollbar">
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
              className={`w-full py-4 sm:py-5 mt-4 rounded-[2rem] font-bold transition-all shrink-0 text-sm sm:text-base ${feedback.professional ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20 active:scale-95' : (isDarkMode ? 'bg-neutral-800 text-neutral-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed')}`}
            >
              Próximo Passo
            </button>
          </div>
        );

      case AppStep.NPS:
        return (
          <div className="space-y-8 sm:space-y-10 py-6 animate-in slide-in-from-right duration-500">
            <div className="text-center space-y-1 sm:space-y-2">
              <h2 className={`text-2xl sm:text-3xl font-black leading-tight ${isDarkMode ? 'text-neutral-100' : 'text-slate-900'}`}>Como foi sua experiência?</h2>
            </div>
            <div className="flex flex-wrap justify-center gap-3 sm:gap-6 px-2">
              {EMOJIS.map((emoji) => {
                const isSelected = feedback.nps !== null && emoji.range.includes(feedback.nps);
                return (
                  <button 
                    key={emoji.char}
                    onClick={() => setFeedback({ ...feedback, nps: emoji.default })}
                    className={`flex flex-col items-center gap-2 p-2 sm:p-3 rounded-2xl transition-all duration-300 transform ${isSelected ? 'scale-125' : 'opacity-40 hover:opacity-100'}`}
                  >
                    <span className="text-3xl sm:text-4xl">{emoji.char}</span>
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
                    className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full text-white font-bold text-sm sm:text-base transition-all transform ${getNpsColor(num)} ${feedback.nps === num ? 'scale-125 ring-4 ring-indigo-500/30 shadow-lg' : 'opacity-90 hover:opacity-100'}`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
            <button disabled={feedback.nps === null} onClick={handleNext} className={`w-full py-4 sm:py-5 rounded-[2rem] font-bold transition-all text-sm sm:text-base ${feedback.nps !== null ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20 active:scale-95' : (isDarkMode ? 'bg-neutral-800 text-neutral-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed')}`}>Confirmar Nota</button>
          </div>
        );

      case AppStep.COMMENT:
        return (
          <div className="space-y-6 sm:space-y-8 py-6 animate-in slide-in-from-right duration-500">
            <div className="text-center space-y-1 sm:space-y-2">
              <h2 className={`text-2xl sm:text-3xl font-black ${isDarkMode ? 'text-neutral-100' : 'text-slate-900'}`}>Algo a adicionar?</h2>
            </div>
            <textarea 
              value={feedback.comment} 
              onChange={(e) => setFeedback({ ...feedback, comment: e.target.value })} 
              placeholder="Conte-nos como foi..." 
              className={`w-full h-36 sm:h-44 p-5 sm:p-6 rounded-[2rem] border-2 transition-all resize-none text-base sm:text-lg leading-relaxed outline-none ${isDarkMode ? 'bg-neutral-900/50 border-neutral-800 text-neutral-100 focus:border-indigo-500/50' : 'bg-slate-50/50 border-slate-100 text-slate-700 focus:border-indigo-500/50'}`} 
            />
            <button onClick={handleNext} className="w-full py-4 sm:py-5 bg-indigo-600 text-white rounded-[2rem] font-bold shadow-xl shadow-indigo-600/20 active:scale-95 transition-all text-sm sm:text-base">Enviar Feedback</button>
          </div>
        );

      case AppStep.PROCESSING:
        return (
          <div className="flex flex-col items-center justify-center py-16 sm:py-24 space-y-6 sm:space-y-8 animate-in fade-in zoom-in duration-500">
            <Loader2 className="w-16 h-16 sm:w-20 h-20 text-indigo-600 animate-spin" />
            <h3 className={`text-xl sm:text-2xl font-black ${isDarkMode ? 'text-neutral-100' : 'text-slate-900'}`}>Quase pronto...</h3>
          </div>
        );

      case AppStep.SUCCESS:
        return (
          <div className="text-center space-y-8 sm:space-y-10 py-6 sm:py-10 animate-in zoom-in duration-700">
            <CheckCircle2 className="w-12 h-12 sm:w-16 h-16 text-emerald-500 mx-auto" />
            <div className="space-y-4">
              <h2 className={`text-3xl sm:text-4xl font-black ${isDarkMode ? 'text-neutral-100' : 'text-slate-900'}`}>Obrigado!</h2>
              <p className={`text-base sm:text-lg leading-relaxed italic ${isDarkMode ? 'text-indigo-300' : 'text-indigo-900'}`}>{aiMessage}</p>
            </div>
            <button 
              onClick={() => { setFeedback({ professional: null, nps: null, comment: '', timestamp: '' }); setStep(AppStep.WELCOME); }} 
              className="w-full py-4 sm:py-5 font-bold flex items-center justify-center gap-3 transition-all text-slate-500 hover:text-indigo-600"
            >
              <Home className="w-4 h-4 sm:w-5 h-5" /> Início
            </button>
          </div>
        );

      case AppStep.DASHBOARD:
        return (
          <div className={`space-y-6 sm:space-y-8 py-4 h-[82vh] overflow-y-auto no-scrollbar px-4 sm:px-10 ${isDarkMode ? 'bg-black text-neutral-100' : 'bg-white text-slate-900'}`}>
            <div className={`flex items-center justify-between py-4 sm:py-6 sticky top-0 z-30 transition-all ${isDarkMode ? 'bg-black/80 backdrop-blur-md' : 'bg-white/80 backdrop-blur-md'}`}>
              <div className="flex items-center gap-2 sm:gap-3">
                <ShieldCheck className="w-6 h-6 text-indigo-600" />
                <div>
                  <h2 className="text-xl sm:text-2xl font-black">Analytics</h2>
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase">
                      <Cloud className="w-2.5 h-2.5" /> 
                      <Check className="w-2 h-2 -ml-0.5" />
                      Global
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowFilters(!showFilters)} 
                  className={`p-2.5 sm:p-3 rounded-xl border transition-all ${showFilters ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}
                >
                  <Filter className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setShowDownloadModal(true)} 
                  disabled={filteredHistory.length === 0}
                  className="p-2.5 sm:p-3 rounded-xl border bg-indigo-50 text-indigo-600 border-indigo-100 disabled:opacity-30"
                >
                  <Download className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* PAINEL DE FILTROS ESTILO IMAGEM */}
            {showFilters && (
              <div className={`p-8 rounded-[2.5rem] border shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500 space-y-8 ${isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-100'}`}>
                
                {/* Períodos Rápidos */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Clock className="w-5 h-5" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Períodos Rápidos</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {['Hoje', '7 dias', '30 dias'].map((label, idx) => {
                      const id = idx === 0 ? 'today' : idx === 1 ? '7days' : '30days';
                      return (
                        <button 
                          key={id}
                          onClick={() => handlePredefinedFilter(id as any)}
                          className={`py-4 px-2 rounded-2xl border text-[13px] font-medium transition-all ${activePredefined === id ? 'bg-white border-slate-200 text-indigo-600 shadow-sm' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Datas Início e Fim */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Início</label>
                    <div className="relative">
                      <input 
                        type="date" 
                        value={filterStartDate}
                        onChange={(e) => { setFilterStartDate(e.target.value); setActivePredefined(null); }}
                        className="w-full p-4 pr-10 border border-slate-100 rounded-2xl text-[13px] outline-none bg-white focus:border-indigo-100 transition-all text-slate-600" 
                      />
                      <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Fim</label>
                    <div className="relative">
                      <input 
                        type="date" 
                        value={filterEndDate}
                        onChange={(e) => { setFilterEndDate(e.target.value); setActivePredefined(null); }}
                        className="w-full p-4 pr-10 border border-slate-100 rounded-2xl text-[13px] outline-none bg-white focus:border-indigo-100 transition-all text-slate-600" 
                      />
                      <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Profissional */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Briefcase className="w-5 h-5" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Profissional</span>
                  </div>
                  <div className="relative">
                    <select 
                      value={filterProfessional}
                      onChange={(e) => setFilterProfessional(e.target.value)}
                      className="w-full p-4 rounded-2xl border border-slate-100 text-[14px] font-bold outline-none bg-white appearance-none focus:border-indigo-100 transition-all text-slate-800"
                    >
                      <option value="">Todos os Médicos</option>
                      {PROFESSIONALS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                       <ChevronRight className="w-4 h-4 text-slate-400 rotate-90" />
                    </div>
                  </div>
                </div>

                {/* Rodapé do Filtro */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                  <button 
                    onClick={clearFilters}
                    className="flex items-center gap-2 text-rose-500 font-bold text-sm hover:opacity-70 transition-all"
                  >
                    <X className="w-4 h-4" />
                    Limpar
                  </button>
                  <button 
                    onClick={() => setShowFilters(false)}
                    className="bg-indigo-600 text-white px-10 py-4 rounded-[1.5rem] font-bold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all text-sm"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            )}

            {/* Modal de Download Personalizado */}
            {showDownloadModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                <div className={`w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border ${isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-white'}`}>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 rounded-xl">
                        <FileText className="w-6 h-6 text-indigo-600" />
                      </div>
                      <h3 className="text-xl font-black">Exportar</h3>
                    </div>
                    <button onClick={() => setShowDownloadModal(false)} className="text-slate-300 hover:text-slate-500">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Escopo do Relatório</label>
                      <div className="grid grid-cols-1 gap-2">
                        <button 
                          onClick={() => setDownloadTarget('all')}
                          className={`w-full py-4 px-6 rounded-2xl text-left border-2 transition-all flex items-center justify-between ${downloadTarget === 'all' ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 hover:border-indigo-100'}`}
                        >
                          <span className="font-bold">Todos os Médicos</span>
                          {downloadTarget === 'all' && <Check className="w-5 h-5 text-indigo-600" />}
                        </button>
                        
                        <div className="relative">
                          <select 
                            value={downloadTarget !== 'all' ? downloadTarget : ''}
                            onChange={(e) => setDownloadTarget(e.target.value)}
                            className={`w-full py-4 px-6 rounded-2xl border-2 font-bold outline-none appearance-none transition-all ${downloadTarget !== 'all' ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 hover:border-indigo-100'}`}
                          >
                            <option value="" disabled>Selecionar Profissional...</option>
                            {PROFESSIONALS.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                          <Briefcase className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-400 italic">
                      * O relatório considerará os filtros de data aplicados no dashboard.
                    </p>

                    <button 
                      onClick={generatePDFReport}
                      className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black shadow-xl shadow-indigo-600/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                    >
                      <Download className="w-5 h-5" />
                      Gerar Documento PDF
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {[
                { label: 'Avaliações', val: stats?.total, icon: Users, color: 'text-indigo-600' },
                { label: 'NPS Global', val: stats?.nps, icon: TrendingUp, color: 'text-emerald-600' },
                { label: 'Nota Média', val: stats?.avg, icon: Star, color: 'text-amber-600' },
                { label: 'Período', val: filteredHistory.length, icon: Calendar, color: 'text-slate-400' }
              ].map((card, i) => (
                <div key={i} className={`p-4 sm:p-6 rounded-[1.5rem] border ${isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-slate-50 border-slate-100'}`}>
                  <div className={`flex items-center gap-1.5 mb-2 ${card.color}`}><card.icon className="w-4 h-4" /><span className="text-[8px] font-black uppercase tracking-widest">{card.label}</span></div>
                  <p className="text-2xl sm:text-4xl font-black">{card.val}</p>
                </div>
              ))}
            </div>

            <div className="space-y-4 pb-10">
              <h3 className="text-base font-black px-2">Feedbacks Recentes</h3>
              {filteredHistory.length === 0 ? (
                <p className="text-center text-slate-400 py-10 text-sm">Nenhum feedback encontrado com os filtros atuais.</p>
              ) : (
                filteredHistory.slice(-5).reverse().map((h, i) => (
                  <div key={i} className={`p-4 rounded-[1.5rem] border ${isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-slate-50/50 border-slate-100'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black text-white ${getNpsColor(h.nps || 0)}`}>NOTA {h.nps}</span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600">{h.professional}</span>
                      </div>
                      <span className="text-[8px] font-bold text-slate-300">{new Date(h.timestamp).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <p className="text-sm italic">"{h.comment || 'Sem comentários.'}"</p>
                  </div>
                ))
              )}
              <button onClick={() => setIsPromptingReset(true)} className="w-full py-5 text-[9px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 opacity-30 hover:opacity-100 transition-all hover:text-rose-500"><Trash2 className="w-4 h-4" /> Resetar Dados</button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-3 sm:p-4 transition-colors duration-700 ${isDarkMode ? 'bg-[#050505]' : 'bg-slate-50'}`}>
      <div className={`w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden relative border transition-all duration-700 ${isDarkMode ? 'bg-neutral-950 border-neutral-900' : 'bg-white border-white'}`}>
        
        <div className="absolute top-6 right-8 z-50">
           <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 rounded-xl border bg-white text-indigo-600 shadow-sm">
             {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
           </button>
        </div>

        {step !== AppStep.WELCOME && step !== AppStep.PROCESSING && step !== AppStep.SUCCESS && (
          <div className="px-6 pt-8 flex items-center">
            <button onClick={handleBack} className="p-2.5 rounded-xl text-slate-300 hover:text-slate-500 transition-all">
                <ArrowLeft className="w-6 h-6" />
            </button>
          </div>
        )}

        <div className={step === AppStep.DASHBOARD ? 'p-0' : 'p-6 sm:p-14'}>
            {renderStepContent()}
        </div>

        <div className={`p-4 text-center border-t flex justify-center items-center gap-3 ${isDarkMode ? 'bg-black/50 border-neutral-900' : 'bg-slate-50/30 border-slate-100'}`}>
           <span className="text-[8px] font-black uppercase tracking-[0.4em] text-slate-300">Hospital Santa Filomena</span>
        </div>
      </div>
    </div>
  );
};

export default App;
