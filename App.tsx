
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ProcessStatus, RegistroProducao, Parada } from './types';
import { extractDataFromImage } from './services/geminiService';
import { saveRecord } from './services/supabaseService';

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [status, setStatus] = useState<ProcessStatus>(ProcessStatus.IDLE);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const [editingData, setEditingData] = useState<RegistroProducao | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const startCamera = useCallback(async () => {
    const tryConstraints = async (constraints: MediaStreamConstraints) => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        return true;
      } catch (err) {
        return false;
      }
    };

    const success = await tryConstraints({
      video: { 
        facingMode: 'environment',
        width: { ideal: 1080 },
        height: { ideal: 1920 },
        aspectRatio: { ideal: 0.5625 } 
      }
    });

    if (!success) {
      const fallbackSuccess = await tryConstraints({ video: { facingMode: 'environment' } });
      if (!fallbackSuccess) setLastError("Câmera bloqueada ou indisponível.");
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [startCamera]);

  const calculateMinutes = (start: string, end: string): number => {
    if (!start || !end) return 0;
    try {
      const parseTime = (t: string) => {
        const parts = t.split(':').map(Number);
        if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
        return parts[0] * 60 + parts[1];
      };

      const startTotal = parseTime(start);
      const endTotal = parseTime(end);

      if (startTotal === null || endTotal === null) return 0;
      
      let diff = endTotal - startTotal;
      if (diff < 0) diff += 1440; // Virada de dia
      return diff;
    } catch {
      return 0;
    }
  };

  const handleCaptureAndProcess = async () => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return;

    try {
      setIsProcessing(true);
      setLastError(null);
      setStatus(ProcessStatus.CAPTURING);

      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Erro gráfico.");
      ctx.drawImage(video, 0, 0);
      
      const base64Image = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];

      setStatus(ProcessStatus.PROCESSING);
      const data = await extractDataFromImage(base64Image);
      
      setEditingData(data);
      setIsModalOpen(true);
      setStatus(ProcessStatus.IDLE);
    } catch (err: any) {
      console.error(err);
      setStatus(ProcessStatus.ERROR);
      setLastError(err.message || "Erro no escaneamento.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmSave = async () => {
    if (!editingData) return;
    try {
      setStatus(ProcessStatus.SAVING);
      await saveRecord(editingData);
      setStatus(ProcessStatus.SUCCESS);
      setIsModalOpen(false);
      setEditingData(null);
      setTimeout(() => setStatus(ProcessStatus.IDLE), 3000);
    } catch (err: any) {
      setLastError("Erro ao sincronizar com Supabase.");
      setStatus(ProcessStatus.ERROR);
    }
  };

  const updateField = (field: keyof RegistroProducao, value: any) => {
    if (!editingData) return;
    setEditingData({ ...editingData, [field]: value });
  };

  const updateParada = (index: number, field: keyof Parada, value: any) => {
    if (!editingData) return;
    const newParadas = [...editingData.paradas];
    const currentParada = { ...newParadas[index], [field]: value };
    
    // CALCULO AUTOMATICO: Sempre que inicio ou termino mudar, recalcula total_min
    if (field === 'inicio' || field === 'termino') {
      const minutes = calculateMinutes(currentParada.inicio, currentParada.termino);
      currentParada.total_min = minutes;
    }
    
    newParadas[index] = currentParada;
    setEditingData({ ...editingData, paradas: newParadas });
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500/30 overflow-x-hidden">
      
      <header className="w-full bg-slate-900 border-b border-slate-800 p-5 flex justify-between items-center z-20">
        <div>
          <h1 className="text-lg font-black text-blue-400 italic tracking-tighter uppercase">Factory<span className="text-white not-italic font-light">Scan</span></h1>
          <p className="text-[9px] text-slate-500 font-mono tracking-widest uppercase">Escaneamento Vertical</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${status === ProcessStatus.ERROR ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`} />
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Ativo</span>
        </div>
      </header>

      <main className="w-full flex-1 flex flex-col p-4 gap-6 max-w-lg mx-auto">
        
        <div className="relative w-full h-[65vh] md:h-[70vh] bg-black rounded-[3rem] border-4 border-slate-900 shadow-2xl overflow-hidden">
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
          
          <div className="absolute inset-8 border border-white/5 rounded-2xl pointer-events-none">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-full h-[85%] border-2 border-dashed border-blue-500/20 rounded-xl"></div>
            </div>
            <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-blue-500 rounded-tl-xl shadow-[0_0_20px_rgba(59,130,246,0.2)]"></div>
            <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-blue-500 rounded-tr-xl"></div>
            <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-blue-500 rounded-bl-xl"></div>
            <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-blue-500 rounded-br-xl"></div>
          </div>

          {isProcessing && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-sm">
               <div className="w-full h-[4px] bg-blue-400 shadow-[0_0_30px_#60a5fa] absolute animate-[scan_2s_ease-in-out_infinite]"></div>
               <div className="bg-slate-900/90 p-8 rounded-[2rem] border border-blue-500/30 flex flex-col items-center gap-4 text-center">
                  <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <div>
                    <span className="text-xs font-black uppercase text-blue-400 tracking-[0.2em] block">Sincronizando IA</span>
                    <span className="text-[9px] text-slate-500 mt-1 block">Processando horários precisos...</span>
                  </div>
               </div>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <div className="w-full mt-auto mb-4">
          <button
            onClick={handleCaptureAndProcess}
            disabled={isProcessing}
            className={`w-full py-6 rounded-[2rem] text-xl font-black tracking-widest uppercase transition-all shadow-2xl active:scale-95 ${
              isProcessing 
                ? 'bg-slate-800 text-slate-600 grayscale' 
                : 'bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 text-white border-b-4 border-blue-900'
            }`}
          >
            {isProcessing ? 'Escaneando...' : 'Capturar Folha'}
          </button>
          {lastError && <p className="mt-4 text-red-500 text-[10px] font-black text-center uppercase tracking-widest px-4">{lastError}</p>}
        </div>
      </main>

      {/* MODAL DE REVISÃO */}
      {isModalOpen && editingData && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col animate-in fade-in slide-in-from-bottom duration-300">
          <header className="p-6 border-b border-slate-800 bg-slate-900 flex justify-between items-center sticky top-0 shadow-2xl z-30">
            <div>
              <h2 className="text-xl font-black text-amber-500 italic uppercase">Revisão Industrial</h2>
              <p className="text-[10px] text-slate-500 tracking-widest font-bold uppercase">Conferência de Turno e Horários</p>
            </div>
            <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors text-xl">✕</button>
          </header>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            
            {/* Campos Superiores com Turno */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl col-span-1">
                <label className="text-[9px] font-black text-slate-500 uppercase block mb-1 ml-1">Turno</label>
                <select 
                  value={editingData.turno} 
                  onChange={(e) => updateField('turno', e.target.value)}
                  className="w-full bg-transparent text-sm font-bold text-amber-500 outline-none appearance-none"
                >
                  <option value="">-</option>
                  <option value="1">1º Turno</option>
                  <option value="2">2º Turno</option>
                  <option value="3">3º Turno</option>
                </select>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl col-span-2">
                <label className="text-[9px] font-black text-slate-500 uppercase block mb-1 ml-1">Data</label>
                <input type="date" value={editingData.data_registro} onChange={(e) => updateField('data_registro', e.target.value)} className="w-full bg-transparent text-sm font-bold text-white outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl">
                <label className="text-[9px] font-black text-slate-500 uppercase block mb-1 ml-1">Lote</label>
                <input type="text" value={editingData.lote} onChange={(e) => updateField('lote', e.target.value)} className="w-full bg-transparent text-sm font-bold text-white outline-none" />
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl">
                <label className="text-[9px] font-black text-slate-500 uppercase block mb-1 ml-1">Linha</label>
                <input type="text" value={editingData.linha_producao} onChange={(e) => updateField('linha_producao', e.target.value)} className="w-full bg-transparent text-sm font-bold text-white outline-none" />
              </div>
            </div>

            {/* Tabela de Paradas */}
            <section className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Eventos de Parada</label>
                <span className="text-[9px] text-amber-500 font-black uppercase bg-amber-500/10 px-2 py-1 rounded-full border border-amber-500/20">Cálculo Reativo Ativo</span>
              </div>
              
              <div className="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-slate-800/80 text-slate-400 uppercase font-black border-b border-slate-800">
                      <tr>
                        <th className="px-3 py-5 text-center w-14">Cód</th>
                        <th className="px-3 py-5 text-center text-amber-500 w-20">Início</th>
                        <th className="px-3 py-5 text-center text-amber-500 w-20">Fim</th>
                        <th className="px-3 py-5 text-center w-20">Min</th>
                        <th className="px-4 py-5 min-w-[150px]">Equipamento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {editingData.paradas.map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/20 transition-colors">
                          <td className="p-2">
                            <input type="text" value={p.cod} onChange={(e) => updateParada(idx, 'cod', e.target.value)} className="w-full bg-slate-800/40 border border-transparent rounded-xl py-3 text-center text-white font-mono outline-none" />
                          </td>
                          <td className="p-2">
                            <input 
                              type="text" 
                              value={p.inicio} 
                              onChange={(e) => updateParada(idx, 'inicio', e.target.value)} 
                              className="w-full bg-amber-500/5 border border-amber-500/20 rounded-xl py-3 text-center text-amber-400 font-black text-sm outline-none focus:bg-amber-500/10"
                            />
                          </td>
                          <td className="p-2">
                            <input 
                              type="text" 
                              value={p.termino} 
                              onChange={(e) => updateParada(idx, 'termino', e.target.value)} 
                              className="w-full bg-amber-500/5 border border-amber-500/20 rounded-xl py-3 text-center text-amber-400 font-black text-sm outline-none focus:bg-amber-500/10"
                            />
                          </td>
                          <td className="p-2">
                            <input 
                              type="number" 
                              value={p.total_min} 
                              onChange={(e) => updateParada(idx, 'total_min', parseInt(e.target.value) || 0)} 
                              className="w-full bg-slate-800/60 border border-transparent rounded-xl py-3 text-center font-mono text-blue-400 font-black text-sm outline-none"
                            />
                          </td>
                          <td className="p-2">
                            <input type="text" value={p.equipamento} onChange={(e) => updateParada(idx, 'equipamento', e.target.value)} className="w-full bg-slate-800/40 border border-transparent rounded-xl px-4 py-3 text-white font-bold outline-none" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <div className="space-y-2 pb-16">
              <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Anotações do Operador</label>
              <textarea rows={3} value={editingData.observacoes} onChange={(e) => updateField('observacoes', e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-[1.5rem] p-5 text-sm outline-none focus:border-blue-500 transition-all text-slate-300" placeholder="..." />
            </div>
          </div>

          <footer className="p-6 bg-slate-900 border-t border-slate-800 flex flex-col gap-3 sticky bottom-0 z-40 shadow-[0_-15px_40px_rgba(0,0,0,0.6)]">
             <button onClick={handleConfirmSave} disabled={status === ProcessStatus.SAVING} className="w-full py-6 rounded-[1.5rem] bg-blue-600 text-white font-black uppercase tracking-[0.2em] shadow-2xl hover:bg-blue-500 active:scale-95 transition-all flex items-center justify-center gap-2">
                {status === ProcessStatus.SAVING ? 'Enviando...' : 'Confirmar e Sincronizar'}
              </button>
              <button onClick={() => setIsModalOpen(false)} className="w-full py-4 rounded-[1.5rem] bg-slate-800 text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:text-white transition-colors">Voltar para Câmera</button>
          </footer>
        </div>
      )}

      <style>{`
        @keyframes scan { 0% { top: 0%; opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1) brightness(0.8); cursor: pointer; }
        input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        * { -webkit-tap-highlight-color: transparent; outline: none; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
      `}</style>
    </div>
  );
}
