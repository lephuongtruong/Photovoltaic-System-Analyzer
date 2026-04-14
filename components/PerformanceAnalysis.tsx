
import React, { useState, useMemo, useEffect, useContext } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, Legend, Cell } from 'recharts';
import * as XLSX from 'xlsx';
import { LanguageContext } from '../App';
import { DEFAULT_REGIONAL_DATA } from '../constants';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ModelType } from '../types';

const PerformanceAnalysis: React.FC = () => {
  const { t, lang, user, selectedSimulation, setSelectedSimulation } = useContext(LanguageContext);
  
  const [regionalData, setRegionalData] = useState(() => {
    const saved = localStorage.getItem('solar_regional_data');
    return saved ? JSON.parse(saved) : DEFAULT_REGIONAL_DATA;
  });

  const [analysisMode, setAnalysisMode] = useState<'simulation' | 'actual'>('simulation');
  const [selectedRegion, setSelectedRegion] = useState<string>("TP.HCM");
  const [panelArea, setPanelArea] = useState<number>(250000); 
  const [efficiency, setEfficiency] = useState<number>(0.18);
  const [actualData, setActualData] = useState<any[]>([]);
  const [projectName, setProjectName] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{type: 'success' | 'error', msg: string} | null>(null);

  const plantCapacity = useMemo(() => panelArea * efficiency, [panelArea, efficiency]);
  const simParams = { tempCoeff: 0.0045, noct: 45 };

  // Handle loading from history
  useEffect(() => {
    if (selectedSimulation && selectedSimulation.modelType === ModelType.ANALYSIS) {
      const { inputs, results: savedResults } = selectedSimulation;
      if (inputs.analysisMode) setAnalysisMode(inputs.analysisMode);
      if (inputs.selectedRegion) setSelectedRegion(inputs.selectedRegion);
      if (inputs.panelArea) setPanelArea(inputs.panelArea);
      if (inputs.efficiency) setEfficiency(inputs.efficiency);
      if (inputs.actualData) setActualData(inputs.actualData);
      
      setSelectedSimulation(null);
    }
  }, [selectedSimulation, setSelectedSimulation]);

  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('solar_regional_data');
      if (saved) setRegionalData(JSON.parse(saved));
    };
    const interval = setInterval(handleStorageChange, 2000);
    return () => clearInterval(interval);
  }, []);

  const calculateSimulation = useMemo(() => {
    const region = regionalData[selectedRegion] || Object.values(regionalData)[0];
    if (!region || !region.months) return [];

    return region.months.map((m: any, idx: number) => {
      const ghi_wh = m.ghi_daily * 1000;
      const n = (idx * 30) + 15;
      const delta = 23.45 * Math.sin((360 / 365) * (284 + n) * (Math.PI / 180));
      const phiRad = region.lat * (Math.PI / 180);
      const deltaRad = delta * (Math.PI / 180);
      const cosWs = -Math.tan(phiRad) * Math.tan(deltaRad);
      const ws = Math.acos(Math.max(-1, Math.min(1, cosWs)));
      const wsDeg = ws * (180 / Math.PI);

      let totalDayE = 0;

      for (let t = 0; t < 24; t++) {
        const omega = 15 * (t + 0.5 - 12);
        if (Math.abs(omega) <= wsDeg) {
          const r = (Math.PI / 24) * (Math.cos(omega * Math.PI / 180) - Math.cos(ws)) / (Math.sin(ws) - ws * Math.cos(ws));
          const It = ghi_wh * Math.max(0, r);
          const Tc = m.temp + (It / 800) * (simParams.noct - 20);
          const Et = (It * panelArea * efficiency * (1 - simParams.tempCoeff * (Tc - 25))) / 1000;
          totalDayE += Et;
        }
      }

      const monthlyE = totalDayE * 30;
      const y_f = monthlyE / plantCapacity / 30;
      const y_r = m.ghi_daily;
      
      return {
        month: `${lang === 'vi' ? 'T' : 'M'}${idx + 1}`,
        e_ac: monthlyE,
        h_i: m.ghi_daily * 30,
        y_f: Number(y_f.toFixed(2)),
        y_r: Number(y_r.toFixed(2)),
        pr: Number(((y_f / y_r) * 100).toFixed(2)),
        ghi_daily: m.ghi_daily
      };
    });
  }, [selectedRegion, regionalData, panelArea, efficiency, plantCapacity, lang]);

  const displayData = analysisMode === 'simulation' ? calculateSimulation : actualData;

  const metrics = useMemo(() => {
    if (!displayData || displayData.length === 0) return null;
    const totalE = displayData.reduce((acc, d) => acc + d.e_ac, 0);
    const avgPR = displayData.reduce((acc, d) => acc + d.pr, 0) / displayData.length;
    const avgYf = displayData.reduce((acc, d) => acc + d.y_f, 0) / displayData.length;
    const avgYr = displayData.reduce((acc, d) => acc + d.y_r, 0) / displayData.length;
    const cuf = (totalE / (plantCapacity * displayData.length * 30 * 24)) * 100;
    const sample = displayData[0];
    return { totalE, avgPR, avgYf, avgYr, cuf, sample };
  }, [displayData, plantCapacity]);

  const handleActualFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws) as any[];
        
        const processed = raw.map(row => {
          const e_ac = Number(row["AC Energy (kWh)"] || row["Sản lượng AC Thực tế (kWh)"]);
          const h_i_month = Number(row["GHI Radiation (kWh/m2/month)"] || row["Bức xạ GHI Thực tế (kWh/m2/tháng)"]);
          const ghi_daily = h_i_month / 30;
          const y_f = e_ac / plantCapacity / 30;
          const y_r = ghi_daily;
          return {
            month: row["Month"] || row["Tháng"], e_ac, h_i: h_i_month,
            ghi_daily: Number(ghi_daily.toFixed(2)),
            y_f: Number(y_f.toFixed(2)),
            y_r: Number(y_r.toFixed(2)),
            pr: Number(((y_f / y_r) * 100).toFixed(2))
          };
        });
        setActualData(processed);
        setAnalysisMode('actual');
      } catch (err) { alert(t.importErrorActual); }
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveSimulation = async () => {
    if (!user) {
      setSaveStatus({ type: 'error', msg: t.loginToSave });
      return;
    }
    if (!projectName.trim()) {
      setSaveStatus({ type: 'error', msg: t.enterProjectName });
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);

    try {
      const simulationData = {
        userId: user.uid,
        modelType: ModelType.ANALYSIS,
        projectName: projectName.trim(),
        timestamp: serverTimestamp(),
        inputs: {
          analysisMode,
          selectedRegion,
          panelArea,
          efficiency,
          actualData: analysisMode === 'actual' ? actualData : []
        },
        results: {
          displayData,
          metrics
        }
      };

      await addDoc(collection(db, 'simulations'), simulationData);
      setSaveStatus({ type: 'success', msg: t.projectSaved });
      setProjectName("");
    } catch (error) {
      console.error("Error saving simulation:", error);
      setSaveStatus({ type: 'error', msg: t.error });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const downloadSampleActual = () => {
    const data = [
      ["Month", "AC Energy (kWh)", "GHI Radiation (kWh/m2/month)", "Avg Ambient Temp (°C)"],
      ["M1", 5000, 150, 27], ["M2", 5500, 160, 28], ["M3", 6000, 180, 29]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Actual_Data");
    XLSX.writeFile(wb, "Actual_Data_Sample.xlsx");
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h3 className="text-xl font-black text-blue-900 uppercase flex items-center gap-3">
              <i className="fas fa-chart-line text-blue-500"></i> {t.titlePa}
            </h3>
            <p className="text-xs text-gray-400 mt-1 uppercase font-bold tracking-tighter">{t.iecPa}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
             <div className="flex bg-gray-100 p-1 rounded-2xl shadow-inner">
                <button onClick={() => setAnalysisMode('simulation')} className={`px-5 py-2 rounded-xl text-[10px] font-black transition-all ${analysisMode === 'simulation' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}>{t.simPa}</button>
                <button onClick={() => setAnalysisMode('actual')} className={`px-5 py-2 rounded-xl text-[10px] font-black transition-all ${analysisMode === 'actual' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}>{t.actualPa}</button>
             </div>
             {analysisMode === 'actual' && (
               <label className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-md cursor-pointer transition-all uppercase">
                  <i className="fas fa-upload mr-1"></i> {t.importPa}
                  <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleActualFileUpload} />
               </label>
             )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 mt-8 pt-8 border-t border-gray-50">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.areaPa}</label>
            <input type="number" value={panelArea} onChange={e => setPanelArea(Number(e.target.value))} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold text-blue-900 outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.effPa}</label>
            <input type="number" step="0.01" value={efficiency} onChange={e => setEfficiency(Number(e.target.value))} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold text-blue-900 outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{t.capacityPa}</label>
            <div className="w-full p-4 bg-blue-50 border border-blue-100 rounded-2xl font-black text-blue-700 shadow-inner flex justify-between items-center">
              <span>{plantCapacity.toLocaleString('en-US', {useGrouping: false})} kWp</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.regionPa}</label>
            {analysisMode === 'simulation' ? (
              <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold text-blue-900 outline-none">
                {Object.keys(regionalData).map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            ) : (
              <div className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold text-gray-500 italic flex items-center gap-2">
                 {actualData.length > 0 ? t.dataLoadedPa : t.noDataPa}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-6 mt-10 p-6 bg-gray-50 rounded-3xl">
          <div className="flex flex-col md:flex-row items-center gap-3">
            <div className="relative min-w-[200px]">
              <input 
                type="text"
                placeholder={t.enterProjectName}
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-sm outline-none"
              />
            </div>
            <button 
              onClick={handleSaveSimulation}
              disabled={isSaving}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
                isSaving ? 'bg-gray-100 text-gray-400' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg'
              }`}
            >
              {isSaving ? <i className="fas fa-spinner animate-spin"></i> : <i className="fas fa-save"></i>}
              {t.saveProject}
            </button>
          </div>
        </div>

        {saveStatus && (
          <div className={`mt-4 p-4 rounded-2xl text-xs font-bold animate-slideDown flex items-center gap-3 ${
            saveStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
          }`}>
            <i className={`fas ${saveStatus.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
            {saveStatus.msg}
          </div>
        )}
      </section>

      {metrics && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-slideUp">
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{t.prActualPa}</span>
              <div className="text-3xl font-black text-blue-600 mt-2">{metrics.avgPR.toFixed(1)}%</div>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">{t.yieldActualPa} (Yf)</span>
              <div className="text-3xl font-black text-orange-600 mt-2">{metrics.avgYf.toFixed(2)} <span className="text-xs">{t.finalUnitPa}</span></div>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{t.cufRatioPa}</span>
              <div className="text-3xl font-black text-emerald-600 mt-2">{metrics.cuf.toFixed(2)}%</div>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.totalEnergyLabelPa}</span>
              <div className="text-2xl font-black text-gray-800 mt-2">{(metrics.totalE / 1000).toFixed(1)} <span className="text-xs">MWh</span></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl">
              <h4 className="text-[10px] font-black text-gray-400 uppercase mb-8 tracking-widest text-center">{t.chartTitle1Pa}</h4>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={displayData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: 700}} />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fontSize: 10}} unit=" kWh" />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fontSize: 10}} unit="%" domain={[0, 100]} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                    <Legend verticalAlign="top" height={36} />
                    <Bar yAxisId="left" dataKey="e_ac" name={lang === 'vi' ? "Sản lượng AC" : "AC Yield"} fill="#3b82f6" radius={[6, 6, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="pr" name="Performance Ratio" stroke="#ef4444" strokeWidth={3} dot={{r: 4}} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl">
              <h4 className="text-[10px] font-black text-gray-400 uppercase mb-8 tracking-widest text-center">{t.chartTitle2Pa}</h4>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={displayData} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: 700}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} unit={` ${t.finalUnitPa}`} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none'}} />
                    <Legend verticalAlign="top" height={36} />
                    <Bar dataKey="y_r" name="Reference Yield (Yr)" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="y_f" name="Final Yield (Yf)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
            <h3 className="text-lg font-black text-blue-900 uppercase mb-8 flex items-center gap-3 border-b pb-4">
              <i className="fas fa-microscope text-blue-500"></i> {t.step1Pa}
            </h3>

            <div className="space-y-12">
               <div>
                <p className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px] shadow-lg">0</span>
                  {t.iecStep0Pa}
                </p>
                <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 font-mono text-[13px] text-indigo-900 leading-relaxed">
                  Pnom = A * η <br/>
                  Pnom = {panelArea.toLocaleString('en-US', {useGrouping: false})} m² * {efficiency} <br/>
                  <span className="font-bold">➔ Pnom = {plantCapacity.toLocaleString('en-US', {useGrouping: false})} kWp</span>
                </div>
              </div>

              <div>
                <p className="text-xs font-black text-orange-600 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center text-[11px] shadow-lg">1</span>
                  {t.iecStep1Pa} {metrics.sample.month})
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div className="bg-orange-50/50 p-6 rounded-2xl border border-orange-100 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-2 opacity-10 text-4xl"><i className="fas fa-bolt"></i></div>
                      <p className="text-[10px] font-black text-orange-800 uppercase mb-4">{t.yieldFinalPa} (Yf)</p>
                      <div className="bg-white/60 p-3 rounded mb-2 text-[11px] font-mono italic">{t.formulaYfPa}</div>
                      <code className="text-[12px] font-mono block text-orange-700">
                        Yf = {metrics.sample.e_ac.toLocaleString('en-US', {useGrouping: false, maximumFractionDigits: 0})} / {plantCapacity.toLocaleString('en-US', {useGrouping: false, maximumFractionDigits: 0})} / 30 <br/>
                        <span className="font-bold text-lg text-orange-900">➔ {metrics.sample.y_f} {t.finalUnitPa}</span>
                      </code>
                   </div>
                   <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-2 opacity-10 text-4xl"><i className="fas fa-sun"></i></div>
                      <p className="text-[10px] font-black text-slate-800 uppercase mb-4">{t.yieldRefPa} (Yr)</p>
                      <div className="bg-white/60 p-3 rounded mb-2 text-[11px] font-mono italic">{t.formulaYrPa}</div>
                      <code className="text-[12px] font-mono block text-slate-700">
                        Yr = {metrics.sample.ghi_daily.toFixed(2)} kWh/m² / 1 kW/m² <br/>
                        <span className="font-bold text-lg text-slate-900">➔ {metrics.sample.y_r} {t.finalUnitPa}</span>
                      </code>
                   </div>
                   <div className="bg-green-50/50 p-6 rounded-2xl border border-green-100 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-2 opacity-10 text-4xl"><i className="fas fa-percent"></i></div>
                      <p className="text-[10px] font-black text-green-800 uppercase mb-4">Performance Ratio (PR)</p>
                      <div className="bg-white/60 p-3 rounded mb-2 text-[11px] font-mono italic">{t.formulaPRPa}</div>
                      <code className="text-[12px] font-mono block text-green-700">
                        PR = ({metrics.sample.y_f} / {metrics.sample.y_r}) * 100 <br/>
                        <span className="font-bold text-lg text-green-900">➔ {metrics.sample.pr}%</span>
                      </code>
                   </div>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
      
      {analysisMode === 'actual' && actualData.length === 0 && (
        <div className="bg-white rounded-3xl border-2 border-dashed border-gray-200 p-20 text-center animate-pulse">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="fas fa-file-excel text-3xl text-gray-300"></i>
          </div>
          <h4 className="text-xl font-black text-gray-400 uppercase tracking-widest">{t.pleaseUploadPa}</h4>
          <p className="text-sm text-gray-400 mt-2 max-w-md mx-auto">{t.uploadDescPa}</p>
          <button onClick={downloadSampleActual} className="mt-8 text-blue-600 font-bold text-xs uppercase underline">{lang === 'vi' ? 'Tải file mẫu tại đây' : 'Download sample file here'}</button>
        </div>
      )}
    </div>
  );
};

export default PerformanceAnalysis;
