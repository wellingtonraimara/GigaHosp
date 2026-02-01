
import React, { useState, useEffect, useMemo } from 'react';
import { 
  MessageSquare, ChevronRight, CheckCircle2, ArrowLeft, 
  Loader2, Home, Star, BarChart3, Download, Users, 
  TrendingUp, Calendar, Trash2, Lock, ShieldCheck, UserRound,
  Filter, X, Briefcase
} from 'lucide-react';
import { AppStep, FeedbackData } from './types';
import { analyzeFeedback } from './geminiService';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const STORAGE_KEY = 'hospital_santa_filomena_stats';
const DASHBOARD_PASSWORD = '102530';
const PROFESSIONALS = ["Dr. Elvy Soares", "Dr. Julio Cesar"];

const ProfessionalBtn: React.FC<{ 
  name: string; 
  isSelected: boolean; 
  onClick: () => void 
}> = ({ name, isSelected, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-4 p-6 rounded-3xl transition-all duration-300 border-2 transform ${
      isSelected 
      ? 'bg-indigo-50 border-indigo-500 scale-105 shadow-xl' 
      : 'bg-white border-slate-100 hover:border-indigo-200 hover:bg-slate-50 active:scale-95'
    }`}
  >
    <div className={`p-4 rounded-full ${isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
      <UserRound className="w-8 h-8" />
    </div>
    <span className={`text-sm font-bold ${isSelected ? 'text-indigo-700' : 'text-slate-600'}`}>{name}</span>
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

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setHistory(JSON.parse(saved));
  }, []);

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

  // Trend Data for Chart (Group by day)
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

    const periodText = filtersUsed.length > 0 
      ? `Filtros: ${filtersUsed.join(' | ')}`
      : `Data de Emissão: ${today}`;
    doc.text(periodText, 105, 38, { align: 'center' });

    doc.setDrawColor(230);
    doc.line(20, 45, 190, 45);

    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('RESUMO EXECUTIVO', 20, 55);
    
    const tableData = [
      ['Total de Avaliações', stats.total.toString()],
      ['Nota Média Geral', `${stats.avg} / 10`],
      ['NPS (Net Promoter Score)', `${stats.nps}`],
      ['Promotores (9-10)', stats.promoters.toString()],
      ['Detratores (0-6)', stats.detractors.toString()],
    ];

    (doc as any).autoTable({
      startY: 60,
      head: [['Métrica', 'Valor']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [63, 81, 181] }
    });

    const profData = Object.entries(stats.profCounts).map(([name, count]) => [name, count]);
    if (profData.length > 0) {
      doc.text('ATENDIMENTOS POR PROFISSIONAL', 20, (doc as any).lastAutoTable.finalY + 15);
      (doc as any).autoTable({
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['Profissional', 'Total de Avaliações']],
        body: profData,
      });
    }

    const comments = filteredHistory
      .filter(h => h.comment.length > 0)
      .map(h => [new Date(h.timestamp).toLocaleTimeString('pt-BR'), h.professional, h.nps, h.comment]);

    if (comments.length > 0) {
      doc.text('COMENTÁRIOS DOS PACIENTES', 20, (doc as any).lastAutoTable.finalY + 15);
      (doc as any).autoTable({
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['Horário', 'Profissional', 'Nota', 'Comentário']],
        body: comments,
        columnStyles: { 3: { cellWidth: 100 } }
      });
    }

    doc.save(`Relatorio_Atendimento_${today.replace(/\//g, '-')}.pdf`);
  };

  const renderStepContent = () => {
    if (isPromptingPassword) {
      return (
        <div className="space-y-8 py-4 animate-in fade-in zoom-in duration-300">
          <div className="text-center">
            <div className="inline-flex p-4 bg-indigo-50 rounded-full mb-4">
              <Lock className="w-8 h-8 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Acesso Restrito</h2>
            <p className="text-slate-500 mt-2">Insira a senha administrativa para continuar.</p>
          </div>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <input
              type="password"
              value={passwordValue}
              autoFocus
              onChange={(e) => { setPasswordValue(e.target.value); setPasswordError(false); }}
              placeholder="Senha de acesso"
              className={`w-full p-5 bg-slate-50 border-2 rounded-2xl text-center text-2xl tracking-[0.5em] font-mono focus:outline-none transition-all ${passwordError ? 'border-rose-400 bg-rose-50' : 'border-slate-100 focus:border-indigo-500'}`}
            />
            {passwordError && <p className="text-rose-500 text-xs font-bold text-center mt-2 animate-bounce">Senha Incorreta</p>}
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={handleBack} className="py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-colors">Cancelar</button>
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
              <div className="relative bg-white p-6 rounded-full shadow-2xl">
                <Star className="w-12 h-12 text-indigo-600 fill-indigo-100" />
              </div>
            </div>
            <div>
              <h1 className="text-4xl font-bold text-slate-800 tracking-tight">Como foi seu atendimento?</h1>
              <p className="mt-3 text-slate-500 text-lg">Hospital Santa Filomena - Sua saúde em boas mãos.</p>
            </div>
            <div className="space-y-3">
              <button onClick={handleNext} className="group relative w-full inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-200 bg-indigo-600 rounded-2xl hover:bg-indigo-700 shadow-xl active:scale-95">
                Começar Avaliação
                <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button onClick={() => setIsPromptingPassword(true)} className="w-full py-3 text-slate-400 font-medium hover:text-indigo-600 flex items-center justify-center gap-2 transition-colors group">
                <Lock className="w-4 h-4" /> Painel Administrativo
              </button>
            </div>
          </div>
        );

      case AppStep.PROFESSIONAL:
        return (
          <div className="space-y-8 py-4 animate-in slide-in-from-right duration-500">
            <h2 className="text-2xl font-bold text-slate-800 text-center">Qual profissional realizou o atendimento?</h2>
            <div className="grid grid-cols-2 gap-4">
              {PROFESSIONALS.map(name => (
                <ProfessionalBtn 
                  key={name}
                  name={name} 
                  isSelected={feedback.professional === name} 
                  onClick={() => setFeedback({ ...feedback, professional: name })} 
                />
              ))}
            </div>
            <button 
              disabled={!feedback.professional}
              onClick={handleNext}
              className={`w-full py-4 rounded-2xl font-bold transition-all ${feedback.professional ? 'bg-indigo-600 text-white shadow-lg active:scale-95' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
            >
              Continuar
            </button>
          </div>
        );

      case AppStep.NPS:
        return (
          <div className="space-y-8 py-4 animate-in slide-in-from-right duration-500">
            <h2 className="text-2xl font-bold text-slate-800 text-center leading-tight">Dê uma nota geral para o atendimento de 0 a 10</h2>
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
            <div className="flex justify-between text-[11px] font-bold text-slate-400 uppercase tracking-widest px-6"><span>Nada Provável</span><span>Muito Provável</span></div>
            <button disabled={feedback.nps === null} onClick={handleNext} className={`w-full py-4 rounded-2xl font-bold transition-all ${feedback.nps !== null ? 'bg-indigo-600 text-white shadow-lg active:scale-95' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>Continuar</button>
          </div>
        );

      case AppStep.COMMENT:
        return (
          <div className="space-y-6 py-4 animate-in slide-in-from-right duration-500">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-800">Quer contar mais?</h2>
              <p className="text-slate-500 mt-1">Seu comentário é opcional, mas ajuda muito!</p>
            </div>
            <div className="relative">
              <textarea value={feedback.comment} onChange={(e) => setFeedback({ ...feedback, comment: e.target.value })} placeholder="Escreva aqui sua experiência..." className="w-full h-40 p-5 rounded-3xl border-2 border-slate-100 focus:border-indigo-500 focus:ring-0 transition-all resize-none text-slate-700 text-lg placeholder:text-slate-300 bg-slate-50/50" />
              <MessageSquare className="absolute bottom-5 right-5 text-slate-200" />
            </div>
            <button onClick={handleNext} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg active:scale-95 transition-all">Enviar Avaliação</button>
          </div>
        );

      case AppStep.PROCESSING:
        return (
          <div className="flex flex-col items-center justify-center py-20 space-y-6 animate-pulse">
            <Loader2 className="w-16 h-16 text-indigo-600 animate-spin" />
            <h3 className="text-xl font-semibold text-slate-800 text-center">Processando sua resposta...</h3>
          </div>
        );

      case AppStep.SUCCESS:
        return (
          <div className="text-center space-y-8 py-8 animate-in zoom-in duration-500">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 rounded-full"><CheckCircle2 className="w-12 h-12 text-green-500" /></div>
            <div>
              <h2 className="text-3xl font-bold text-slate-800">Feedback Enviado!</h2>
              <div className="mt-6 p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100">
                <p className="text-indigo-900 leading-relaxed italic whitespace-pre-wrap">{aiMessage}</p>
              </div>
            </div>
            <button onClick={() => { setFeedback({ professional: null, nps: null, comment: '', timestamp: '' }); setStep(AppStep.WELCOME); }} className="w-full py-4 text-slate-500 font-semibold hover:text-indigo-600 flex items-center justify-center gap-2"><Home className="w-4 h-4" /> Nova Avaliação</button>
          </div>
        );

      case AppStep.DASHBOARD:
        return (
          <div className="space-y-6 py-2 animate-in slide-in-from-bottom duration-500 h-[80vh] overflow-y-auto no-scrollbar">
            {/* Header Sticky */}
            <div className="flex flex-col sticky top-0 bg-white/95 backdrop-blur z-10 pb-4">
              <div className="flex items-center justify-between pb-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-6 h-6 text-indigo-600" />
                  <h2 className="text-2xl font-bold text-slate-800">Painel de Gestão</h2>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowFilters(!showFilters)} 
                    className={`p-2 rounded-lg transition-colors ${showFilters || filterStartDate || filterEndDate || filterProfessional ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'}`}
                    title="Filtros"
                  >
                    <Filter className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={generatePDFReport} 
                    disabled={filteredHistory.length === 0} 
                    className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Filters Overlay/Section */}
              {showFilters && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-2 space-y-4 animate-in slide-in-from-top duration-300">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Início</label>
                      <input 
                        type="date" 
                        value={filterStartDate}
                        onChange={(e) => setFilterStartDate(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Fim</label>
                      <input 
                        type="date" 
                        value={filterEndDate}
                        onChange={(e) => setFilterEndDate(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs" 
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                      <Briefcase className="w-3 h-3" /> Profissional
                    </label>
                    <select 
                      value={filterProfessional}
                      onChange={(e) => setFilterProfessional(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                    >
                      <option value="">Todos os Profissionais</option>
                      {PROFESSIONALS.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <button 
                      onClick={() => { setFilterStartDate(''); setFilterEndDate(''); setFilterProfessional(''); }} 
                      className="text-xs text-rose-500 font-bold hover:underline flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Limpar Filtros
                    </button>
                    <button 
                      onClick={() => setShowFilters(false)} 
                      className="text-xs bg-indigo-600 text-white px-5 py-1.5 rounded-full font-bold shadow-sm"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {filteredHistory.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <BarChart3 className="w-12 h-12 mx-auto opacity-20 mb-4" />
                <p>Nenhuma avaliação encontrada com estes filtros.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-indigo-50 p-4 rounded-3xl border border-indigo-100">
                    <div className="flex items-center gap-2 text-indigo-600 mb-1"><Users className="w-4 h-4" /><span className="text-[10px] font-bold uppercase tracking-wider">Total</span></div>
                    <p className="text-3xl font-bold text-indigo-900">{stats.total}</p>
                  </div>
                  <div className="bg-emerald-50 p-4 rounded-3xl border border-emerald-100">
                    <div className="flex items-center gap-2 text-emerald-600 mb-1"><TrendingUp className="w-4 h-4" /><span className="text-[10px] font-bold uppercase tracking-wider">NPS</span></div>
                    <p className="text-3xl font-bold text-emerald-900">{stats.nps}</p>
                  </div>
                  <div className="bg-amber-50 p-4 rounded-3xl border border-amber-100">
                    <div className="flex items-center gap-2 text-amber-600 mb-1"><Star className="w-4 h-4" /><span className="text-[10px] font-bold uppercase tracking-wider">Média</span></div>
                    <p className="text-3xl font-bold text-amber-900">{stats.avg}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                    <div className="flex items-center gap-2 text-slate-500 mb-1"><Calendar className="w-4 h-4" /><span className="text-[10px] font-bold uppercase tracking-wider">Período</span></div>
                    <p className="text-3xl font-bold text-slate-800">{filteredHistory.length}</p>
                  </div>
                </div>

                {/* NPS Trend Chart */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-800">Tendência do NPS</h3>
                    <span className="text-[10px] font-bold text-indigo-500 uppercase">{filterProfessional || 'Todos'}</span>
                  </div>
                  <div className="flex items-end gap-2 h-32 pt-4 px-2 overflow-x-auto no-scrollbar">
                    {trendData.length > 0 ? trendData.map((d, i) => {
                      const h = Math.max(10, ((d.nps + 100) / 200) * 100); 
                      return (
                        <div key={i} className="flex-1 min-w-[30px] flex flex-col items-center gap-2 group relative">
                          <div 
                            className={`w-full rounded-t-lg transition-all duration-500 ${d.nps >= 70 ? 'bg-emerald-500' : d.nps >= 0 ? 'bg-amber-400' : 'bg-rose-500'}`}
                            style={{ height: `${h}%` }}
                          />
                          <span className="text-[8px] font-bold text-slate-400 rotate-45 mt-2 origin-left whitespace-nowrap">{d.day.split('/').slice(0,2).join('/')}</span>
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                            NPS: {d.nps}
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="w-full flex items-center justify-center text-slate-300 text-xs">Dados insuficientes para tendência</div>
                    )}
                  </div>
                </div>

                {!filterProfessional && (
                  <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 mb-4">Atendimentos por Profissional</h3>
                    <div className="space-y-3">
                      {PROFESSIONALS.map((name) => {
                        const count = stats.profCounts[name] || 0;
                        const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                        return (
                          <div key={name} className="flex items-center gap-3">
                            <span className="text-xs font-bold text-slate-600 w-32 truncate">{name}</span>
                            <div className="flex-1 h-2 bg-slate-50 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs font-bold text-slate-500 w-8 text-right">{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-800 px-2">Avaliações Recentes</h3>
                  {filteredHistory.slice(-5).reverse().map((h, i) => (
                    <div key={i} className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 text-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex flex-col gap-1">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white w-fit ${getNpsColor(h.nps || 0)}`}>Nota {h.nps}</span>
                          <span className="text-[10px] font-bold text-indigo-600">{h.professional}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">{new Date(h.timestamp).toLocaleTimeString('pt-BR')}</span>
                      </div>
                      <p className="text-slate-600 line-clamp-2 italic">"{h.comment || 'Sem comentário'}"</p>
                    </div>
                  ))}
                </div>

                <button onClick={() => { if (confirm('Tem certeza que deseja apagar todos os dados?')) { localStorage.removeItem(STORAGE_KEY); setHistory([]); } }} className="w-full py-4 text-rose-500 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 opacity-50 hover:opacity-100 transition-opacity mt-8"><Trash2 className="w-3 h-3" /> Limpar Histórico</button>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white/95 backdrop-blur-xl rounded-[40px] shadow-2xl overflow-hidden relative border border-white/50">
        {step !== AppStep.WELCOME && step !== AppStep.PROCESSING && step !== AppStep.SUCCESS && (
          <div className="px-8 pt-8 flex items-center justify-between">
            <button onClick={handleBack} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors"><ArrowLeft className="w-5 h-5" /></button>
            <div className="flex gap-1.5 flex-1 mx-4">
              {!isPromptingPassword && step !== AppStep.DASHBOARD && [1, 2, 3].map((i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i <= step ? 'w-8 bg-indigo-500' : 'w-4 bg-slate-100'}`} />
              ))}
              {isPromptingPassword && <div className="h-1.5 w-full bg-indigo-100 rounded-full overflow-hidden"><div className="h-full w-full bg-indigo-500 animate-pulse"></div></div>}
              {step === AppStep.DASHBOARD && <div className="h-1.5 w-full bg-indigo-600/10 rounded-full overflow-hidden"><div className="h-full w-1/4 bg-indigo-600 animate-pulse"></div></div>}
            </div>
            <div className="w-8" />
          </div>
        )}
        <div className="p-8 sm:p-12">{renderStepContent()}</div>
        <div className="p-4 text-center border-t border-slate-50 flex justify-center items-center gap-2">
           <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Hospital Santa Filomena</span>
           <div className="w-1 h-1 bg-slate-200 rounded-full" />
           <p className="text-[10px] text-slate-300 font-medium uppercase tracking-widest">RateFlow AI</p>
        </div>
      </div>
    </div>
  );
};

export default App;
