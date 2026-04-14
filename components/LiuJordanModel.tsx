
import React, { useState, useMemo, useEffect, useContext, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line, Legend } from 'recharts';
import * as XLSX from 'xlsx';
import { LanguageContext } from '../App';
import { VIETNAM_PROVINCES, LIU_JORDAN_DEFAULT_DATA as DEFAULT_REGIONAL_DATA } from '../constants';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ModelType } from '../types';

const LiuJordanModel: React.FC = () => {
  const { t, lang, user, selectedSimulation, setSelectedSimulation } = useContext(LanguageContext);
  const [isSaving, setIsSaving] = useState(false);
  const [projectName, setProjectName] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<{type: 'success' | 'error', msg: string} | null>(null);
  
  const [regionalData, setRegionalData] = useState(() => {
    const saved = localStorage.getItem('solar_regional_data_lj');
    const data = saved ? JSON.parse(saved) : DEFAULT_REGIONAL_DATA;
    // Sync with VIETNAM_PROVINCES to ensure new provinces are included
    const syncedData = { ...DEFAULT_REGIONAL_DATA };
    Object.keys(VIETNAM_PROVINCES).forEach(name => {
      if (data[name]) syncedData[name] = data[name];
    });
    return syncedData;
  });

  const [selectedRegion, setSelectedRegion] = useState<string>("Hà Nội");
  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number>(0);
  const [selectedDay, setSelectedDay] = useState<number>(15);
  const [calcMode, setCalcMode] = useState<'daily' | 'monthly'>('monthly');
  
  const [inputs, setInputs] = useState({ 
    Hg_month: 68.80, 
    latitude: 21.03, 
    area: 100, 
    efficiency: 0.18, 
    n: 15, 
    ambientTemp: 25, 
    noct: 45, 
    beta: 0.0045, 
    pr: 0.8,
    systemLoss: 0.86 
  });
  const [results, setResults] = useState<any>(null);

  const monthCumulativeDays = useMemo(() => [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334], []);
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  // Handle loading from history
  useEffect(() => {
    if (selectedSimulation && selectedSimulation.modelType === ModelType.LIU_JORDAN) {
      const { inputs, results: savedResults } = selectedSimulation;
      if (inputs.region) setSelectedRegion(inputs.region);
      if (inputs.selectedMonthIdx !== undefined) setSelectedMonthIdx(inputs.selectedMonthIdx);
      if (inputs.selectedDay !== undefined) setSelectedDay(inputs.selectedDay);
      if (inputs.calcMode) setCalcMode(inputs.calcMode);
      if (inputs.inputs) setInputs(inputs.inputs);
      
      if (savedResults) {
        setResults(savedResults);
      }
      
      setSelectedSimulation(null);
    }
  }, [selectedSimulation, setSelectedSimulation]);

  const saveSimulation = useCallback(async (results: any) => {
    if (!user) return;

    const finalName = projectName.trim() || `${t.liuJordan} - ${selectedRegion}`;

    setIsSaving(true);
    setSaveStatus(null);
    try {
      await addDoc(collection(db, 'simulations'), {
        userId: user.uid,
        modelType: ModelType.LIU_JORDAN,
        projectName: finalName,
        timestamp: serverTimestamp(),
        inputs: {
          region: selectedRegion,
          inputs,
          calcMode,
          selectedMonthIdx,
          selectedDay
        },
        results: results,
        metadata: {
          location: selectedRegion,
          description: `Liu-Jordan Model Simulation for ${selectedRegion}`
        }
      });
      setSaveStatus({ type: 'success', msg: t.projectSaved });
      setProjectName("");
    } catch (error) {
      console.error("Error saving simulation:", error);
      setSaveStatus({ type: 'error', msg: lang === 'vi' ? 'Lỗi khi lưu dự án. Vui lòng thử lại.' : 'Error saving project. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  }, [user, selectedRegion, inputs, calcMode, t, projectName, lang]);

  const handleCalculate = useCallback(() => {
    const region = regionalData[selectedRegion] || regionalData[Object.keys(regionalData)[0]];
    if (!region || !region.months) return;

    const { latitude, area, efficiency, ambientTemp, noct, beta, pr, systemLoss } = inputs;
    const Hg_month = region.months[selectedMonthIdx].rad;
    const Hg_daily_avg = Hg_month / daysInMonth[selectedMonthIdx];
    const phiRad = latitude * Math.PI / 180;

    if (calcMode === 'daily') {
      const dayOfYear = monthCumulativeDays[selectedMonthIdx] + selectedDay;
      const delta = 23.45 * Math.sin((360 / 365) * (284 + dayOfYear) * (Math.PI / 180));
      const deltaRad = delta * Math.PI / 180;
      const cosWs = -Math.tan(phiRad) * Math.tan(deltaRad);
      const wsRad = Math.acos(Math.max(-1, Math.min(1, cosWs)));
      const wsDeg = wsRad * 180 / Math.PI;

      let totalE_Temp_Day = 0, totalE_PR_Day = 0, noonTc = 0, noonRt = 0;
      const hourlyData = [];

      for (let t = 0; t < 24; t++) {
        const omega = 15 * (t + 0.5 - 12);
        let Et_temp = 0, Et_pr = 0;
        if (Math.abs(omega) <= wsDeg) {
          const omegaRad = omega * (Math.PI / 180);
          const rt = (Math.PI / 24) * (Math.cos(omegaRad) - Math.cos(wsRad)) / (Math.sin(wsRad) - wsRad * Math.cos(wsRad));
          const It = (Hg_daily_avg * 1000) * Math.max(0, rt); 
          const Tc = ambientTemp + (It / 800) * (noct - 20);
          if (t === 12) { noonTc = Tc; noonRt = rt; }
          Et_temp = (It * area * efficiency * (1 - beta * (Tc - 25)) * systemLoss) / 1000;
          Et_pr = (It * area * efficiency * pr) / 1000;
          totalE_Temp_Day += Et_temp;
          totalE_PR_Day += Et_pr;
        }
        hourlyData.push({ label: `${t}h`, Yield_Temp: Et_temp, Yield_PR: Et_pr });
      }
      const results = { Hg_daily: Hg_daily_avg, delta, wsDeg, noonTc, noonRt, yield_Temp: totalE_Temp_Day, yield_PR: totalE_PR_Day, breakdown: hourlyData, mode: 'daily', usedSystemLoss: systemLoss, n_day: dayOfYear, phiDeg: latitude };
      setResults(results);
    } else {
      let totalMonthE_Temp = 0, totalMonthE_PR = 0;
      const dailyData = [];
      const numDays = daysInMonth[selectedMonthIdx];

      for (let d = 1; d <= numDays; d++) {
        const dayOfYear = monthCumulativeDays[selectedMonthIdx] + d;
        const delta = 23.45 * Math.sin((360 / 365) * (284 + dayOfYear) * (Math.PI / 180));
        const deltaRad = delta * Math.PI / 180;
        const cosWs = -Math.tan(phiRad) * Math.tan(deltaRad);
        const wsRad = Math.acos(Math.max(-1, Math.min(1, cosWs)));
        const wsDeg = wsRad * 180 / Math.PI;

        let dayE_Temp = 0, dayE_PR = 0;
        for (let t = 0; t < 24; t++) {
          const omega = 15 * (t + 0.5 - 12);
          if (Math.abs(omega) <= wsDeg) {
            const omegaRad = omega * (Math.PI / 180);
            const rt = (Math.PI / 24) * (Math.cos(omegaRad) - Math.cos(wsRad)) / (Math.sin(wsRad) - wsRad * Math.cos(wsRad));
            const It = (Hg_daily_avg * 1000) * Math.max(0, rt); 
            const Tc = ambientTemp + (It / 800) * (noct - 20);
            dayE_Temp += (It * area * efficiency * (1 - beta * (Tc - 25)) * systemLoss) / 1000;
            dayE_PR += (It * area * efficiency * pr) / 1000;
          }
        }
        totalMonthE_Temp += dayE_Temp;
        totalMonthE_PR += dayE_PR;
        dailyData.push({ label: `${d}`, Yield_Temp: dayE_Temp, Yield_PR: dayE_PR });
      }

      const midDay = monthCumulativeDays[selectedMonthIdx] + 15;
      const deltaMid = 23.45 * Math.sin((360 / 365) * (284 + midDay) * (Math.PI / 180));
      const wsMid = Math.acos(Math.max(-1, Math.min(1, -Math.tan(phiRad) * Math.tan(deltaMid * Math.PI / 180))));
      const rtMid = (Math.PI / 24) * (Math.cos(0) - Math.cos(wsMid)) / (Math.sin(wsMid) - wsMid * Math.cos(wsMid));

      const results = { Hg_daily: Hg_daily_avg, delta: deltaMid, wsDeg: wsMid * 180 / Math.PI, noonTc: ambientTemp + ((Hg_daily_avg * 1000 * rtMid)/800)*(noct-20), noonRt: rtMid, yield_Temp: totalMonthE_Temp, yield_PR: totalMonthE_PR, breakdown: dailyData, mode: 'monthly', usedSystemLoss: systemLoss, n_day: midDay, phiDeg: latitude };
      setResults(results);
    }
  }, [inputs, selectedMonthIdx, regionalData, selectedRegion, selectedDay, calcMode, daysInMonth, monthCumulativeDays, saveSimulation]);

  useEffect(() => {
    const region = regionalData[selectedRegion] || Object.values(regionalData)[0];
    if (region && region.months) {
      const monthData = region.months[selectedMonthIdx];
      const dayInYear = monthCumulativeDays[selectedMonthIdx] + selectedDay;
      setInputs(prev => ({ ...prev, Hg_month: monthData.rad, latitude: region.lat, ambientTemp: monthData.temp, n: dayInYear }));
    }
  }, [selectedRegion, selectedMonthIdx, selectedDay, regionalData, monthCumulativeDays]);

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawData = XLSX.utils.sheet_to_json(ws) as any[];
        const newRegionalData: any = {};
        rawData.forEach((row: any) => {
          const locName = row.Location_Name;
          if (!locName) return;
          const months = [];
          const monthShorts = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          for (let i = 0; i < 12; i++) {
            const radKey = `${monthShorts[i]}_Rad`;
            const tempKey = `${monthShorts[i]}_Temp`;
            months.push({ rad: parseFloat(row[radKey]) || 0, temp: parseFloat(row[tempKey]) || 25 });
          }
          newRegionalData[locName] = { lat: VIETNAM_PROVINCES[locName]?.lat || 15.0, lon: VIETNAM_PROVINCES[locName]?.lon || 108.0, months: months };
        });
        if (Object.keys(newRegionalData).length > 0) {
          setRegionalData(newRegionalData);
          localStorage.setItem('solar_regional_data_lj', JSON.stringify(newRegionalData));
          setSelectedRegion(Object.keys(newRegionalData)[0]);
          alert(t.importSuccessLj);
        }
      } catch (err) { alert(t.importErrorLj); }
    };
    reader.readAsBinaryString(file);
  };

  const handleDownloadSample = () => {
    const headers = [
      "Location_Name", "Jan_Rad", "Feb_Rad", "Mar_Rad", "Apr_Rad", "May_Rad", "Jun_Rad", "Jul_Rad", "Aug_Rad", "Sep_Rad", "Oct_Rad", "Nov_Rad", "Dec_Rad",
      "Jan_Temp", "Feb_Temp", "Mar_Temp", "Apr_Temp", "May_Temp", "Jun_Temp", "Jul_Temp", "Aug_Temp", "Sep_Temp", "Oct_Temp", "Nov_Temp", "Dec_Temp"
    ];
    const data = [
      headers,
      ["Ha_Noi", 68.8, 93.9, 104.8, 145.5, 152.1, 177.7, 169.8, 145.6, 137.0, 118.8, 85.5, 98.5, 17.6, 18.9, 21.7, 25.4, 28.5, 29.8, 29.9, 29.4, 28.5, 26.0, 22.9, 19.3]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Climate_Template");
    XLSX.writeFile(wb, "Solar_Climate_Template.xlsx");
  };

  const handleClearData = () => {
    if (window.confirm(t.confirmClearLj)) {
      setRegionalData(DEFAULT_REGIONAL_DATA);
      localStorage.removeItem('solar_regional_data_lj');
      setSelectedRegion("Ha_Noi");
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={handleDownloadSample} className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-4 py-2 rounded-xl text-[10px] font-black transition-all flex items-center gap-2">
              <i className="fas fa-file-download"></i> {t.downloadSample}
            </button>
            <label className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-md cursor-pointer transition-all flex items-center gap-2">
              <i className="fas fa-file-import"></i> {t.importClimate}
              <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} />
            </label>
            <button onClick={handleClearData} className="bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 rounded-xl text-[10px] font-black transition-all flex items-center gap-2">
              <i className="fas fa-trash-alt"></i> {t.clearData}
            </button>
            <div className="w-px h-6 bg-gray-200 hidden md:block mx-2"></div>
            <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)} className="bg-blue-900 text-white border-none rounded-2xl px-6 py-3 font-bold shadow-lg outline-none hover:bg-blue-800 transition-all min-w-[150px]">
              {Object.keys(VIETNAM_PROVINCES).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 bg-gray-50/30 rounded-3xl p-6">
            <h4 className="text-[12px] font-black text-blue-900 uppercase tracking-widest mb-6 text-center border-b pb-2">{t.chartClimateLj}</h4>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={(regionalData[selectedRegion] || Object.values(regionalData)[0])?.months?.map((m: any, i: number) => ({ month: `${lang === 'vi' ? 'T' : 'M'}${i+1}`, rad: m.rad, temp: m.temp })) || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: 700}} />
                <YAxis yAxisId="left" unit=" kWh" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                <YAxis yAxisId="right" orientation="right" unit=" °C" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '16px', border: 'none'}} />
                <Legend verticalAlign="top" height={36} />
                <Bar yAxisId="left" name={t.thRadLj} dataKey="rad" fill="#fbbf24" radius={[6, 6, 0, 0]} />
                <Line yAxisId="right" name={t.thTempLj} type="monotone" dataKey="temp" stroke="#ef4444" strokeWidth={3} dot={{r: 4}} />
              </ComposedChart>
            </ResponsiveContainer>
           </div>
           <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-inner max-h-[300px] overflow-y-auto">
             <table className="w-full text-xs">
              <thead className="bg-gray-50 text-[10px] uppercase font-black text-gray-400 sticky top-0 z-10">
                <tr><th className="py-2 px-4 text-left">{t.thMonthLj}</th><th className="py-2 px-4 text-right">{t.thRadLj}</th><th className="py-2 px-4 text-right">{t.thTempLj}</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(regionalData[selectedRegion] || Object.values(regionalData)[0])?.months?.map((m: any, i: number) => (
                  <tr key={i} className={`hover:bg-blue-50 cursor-pointer transition-colors ${selectedMonthIdx === i ? 'bg-blue-50 border-l-4 border-blue-600 font-bold' : ''}`} onClick={() => setSelectedMonthIdx(i)}>
                    <td className="py-2 px-4">{i + 1}</td>
                    <td className="py-2 px-4 text-right text-orange-600">{m.rad.toFixed(1)}</td>
                    <td className="py-2 px-4 text-right text-red-500">{m.temp.toFixed(1)}°C</td>
                  </tr>
                ))}
              </tbody>
            </table>
           </div>
        </div>
      </section>

      <section className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
        <div className="flex justify-between items-center mb-6">
          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.systemInputs}</h4>
          <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner">
            <button onClick={() => setCalcMode('daily')} className={`px-5 py-1.5 rounded-lg text-[9px] font-black transition-all uppercase ${calcMode === 'daily' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}>{t.daily}</button>
            <button onClick={() => setCalcMode('monthly')} className={`px-5 py-1.5 rounded-lg text-[9px] font-black transition-all uppercase ${calcMode === 'monthly' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}>{t.monthly}</button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-orange-400 uppercase">{t.ghiLabelLj}</label>
            <div className="w-full p-4 bg-orange-50 border border-orange-200 rounded-2xl font-black text-orange-900 shadow-inner flex justify-between items-center">
              <span>{(regionalData[selectedRegion] || Object.values(regionalData)[0])?.months?.[selectedMonthIdx]?.rad.toFixed(1)}</span>
              <span className="text-[9px] opacity-60">AUTO</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-blue-400 uppercase">{t.dayOfMonthLj}</label>
            <input type="number" min="1" max="31" value={selectedDay} onChange={e => setSelectedDay(Number(e.target.value))} className="w-full p-4 bg-blue-50 border border-blue-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase">{t.areaLabelLj}</label>
            <input type="number" value={inputs.area} onChange={e => setInputs({...inputs, area: Number(e.target.value)})} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase">{t.efficiencyLabelLj}</label>
            <input type="number" step="0.01" value={inputs.efficiency} onChange={e => setInputs({...inputs, efficiency: Number(e.target.value)})} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-indigo-400 uppercase">{t.ambientTempLabelLj}</label>
            <input type="number" value={inputs.ambientTemp} onChange={e => setInputs({...inputs, ambientTemp: Number(e.target.value)})} className="w-full p-4 bg-indigo-50 border border-indigo-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-indigo-400 uppercase">{t.noctTempLabelLj}</label>
            <input type="number" value={inputs.noct} onChange={e => setInputs({...inputs, noct: Number(e.target.value)})} className="w-full p-4 bg-indigo-50 border border-indigo-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-red-400 uppercase">{t.betaCoeffLabelLj}</label>
            <input type="number" step="0.0001" value={inputs.beta} onChange={e => setInputs({...inputs, beta: Number(e.target.value)})} className="w-full p-4 bg-red-50 border border-red-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-emerald-400 uppercase">{t.prFactorLabelLj}</label>
            <input type="number" step="0.01" value={inputs.pr} onChange={e => setInputs({...inputs, pr: Number(e.target.value)})} className="w-full p-4 bg-emerald-50 border border-emerald-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-purple-400 uppercase">{t.systemLossLabelLj}</label>
            <input type="number" step="0.01" value={inputs.systemLoss} onChange={e => setInputs({...inputs, systemLoss: Number(e.target.value)})} className="w-full p-4 bg-purple-50 border border-purple-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="mt-8 flex flex-col items-center gap-4">
          <button onClick={handleCalculate} className="bg-blue-600 hover:bg-blue-700 text-white font-black px-16 py-4 rounded-2xl shadow-xl uppercase text-xs tracking-widest transition-all transform hover:scale-105 active:scale-95">
            {t.runCalculation}
          </button>
          {results && (
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
                onClick={() => saveSimulation(results)}
                disabled={isSaving || !user}
                className={`px-12 py-4 rounded-2xl font-black transition-all shadow-lg flex items-center justify-center gap-2 uppercase text-xs tracking-widest ${
                  !user 
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
                }`}
              >
                {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                {!user ? t.loginToSave : t.saveProject}
              </button>
            </div>
          )}
          {saveStatus && (
            <div className={`mt-2 text-[10px] font-bold text-center p-2 rounded-xl max-w-xs mx-auto ${saveStatus.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
              {saveStatus.msg}
            </div>
          )}
        </div>
      </section>

      {results && (
        <div className="space-y-8 animate-fadeIn">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <section className="bg-blue-900 rounded-[40px] shadow-2xl p-10 text-white relative overflow-hidden text-center flex flex-col justify-center">
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-400/10 rounded-full blur-3xl"></div>
              <span className="text-xs opacity-60 uppercase tracking-widest font-black mb-4">{t.estimationResults} ({results.mode === 'daily' ? t.daily : t.monthly})</span>
              <div className="text-6xl font-black text-orange-400 drop-shadow-lg">{results.yield_Temp.toFixed(1)} <span className="text-xl font-normal text-white">kWh</span></div>
              <div className="grid grid-cols-2 gap-6 mt-12">
                <div className="bg-white/10 p-6 rounded-3xl border border-white/5 backdrop-blur-sm shadow-inner text-center">
                  <span className="text-[10px] uppercase opacity-60 block mb-2 font-black">{t.yieldPrModel}</span>
                  <div className="text-2xl font-black text-emerald-300">{results.yield_PR.toFixed(1)} <span className="text-xs">kWh</span></div>
                </div>
                <div className="bg-white/10 p-6 rounded-3xl border border-white/5 backdrop-blur-sm shadow-inner text-center">
                  <span className="text-[10px] uppercase opacity-60 block mb-2 font-black">{t.avgDailyGhiLj}</span>
                  <div className="text-2xl font-black text-blue-300">{results.Hg_daily.toFixed(2)} <span className="text-xs">kWh/m²</span></div>
                </div>
              </div>
            </section>
            <section className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
              <h3 className="text-[12px] font-black text-blue-900 uppercase mb-8 tracking-widest text-center border-b pb-2">
                {results.mode === 'daily' ? t.chartYieldDailyLj : t.chartYieldMonthlyLj}
              </h3>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={results.breakdown}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                    <YAxis unit=" kWh" axisLine={false} tickLine={false} tick={{fontSize: 9}} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none'}} />
                    <Legend verticalAlign="top" height={36} wrapperStyle={{fontSize: '10px'}} />
                    <Bar dataKey="Yield_Temp" name={t.yieldTempModel} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Yield_PR" name={t.yieldPrModel} fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
            <h3 className="text-lg font-black text-blue-900 uppercase mb-8 flex items-center gap-3 border-b pb-4">
              <i className="fas fa-globe-americas text-blue-500"></i> {t.astronomicalDetails}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-black text-orange-600 uppercase mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center font-black">1</span>
                    {t.step1Declination}
                  </p>
                  <div className="bg-orange-50/50 p-6 rounded-2xl border border-orange-100 font-mono text-[13px] text-orange-900 leading-relaxed">
                    δ = 23.45 * sin( (360/365) * (284 + n) ) <br/>
                    δ = 23.45 * sin( (360/365) * (284 + {results.n_day}) ) <br/>
                    <span className="font-bold">➔ δ = {results.delta.toFixed(2)}°</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-black text-blue-600 uppercase mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-black">2</span>
                    {t.step2Sunset}
                  </p>
                  <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 font-mono text-[13px] text-blue-900 leading-relaxed">
                    cos(ωs) = -tan(φ) * tan(δ) <br/>
                    cos(ωs) = -tan({results.phiDeg}°) * tan({results.delta.toFixed(2)}°) <br/>
                    <span className="font-bold">➔ ωs = {results.wsDeg.toFixed(2)}°</span>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                 <div>
                  <p className="text-xs font-black text-indigo-600 uppercase mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black">3</span>
                    {t.step3HourlyRatio} ({t.noonNoteLj})
                  </p>
                  <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 font-mono text-[13px] text-indigo-900 leading-relaxed">
                    rt = (π/24) * (cos(ω) - cos(ωs)) / (sin(ωs) - ωs*cos(ωs)) <br/>
                    rt = (π/24) * (cos(0°) - cos({results.wsDeg.toFixed(1)}°)) / ... <br/>
                    <span className="font-bold text-lg">➔ rt = {results.noonRt.toFixed(4)}</span> <br/>
                    It = Hg_daily * rt = {results.Hg_daily.toFixed(2)} * {results.noonRt.toFixed(4)} <br/>
                    <span className="font-bold">➔ It = {(results.Hg_daily * results.noonRt).toFixed(4)} kWh/m²/h</span> <br/>
                    Tc = Ta + (It / 800) * (NOCT - 20) <br/>
                    <span className="font-bold text-blue-800">➔ {t.cellTempTcLabel} Tc ≈ {results.noonTc.toFixed(2)} °C</span> <br/>
                    Et = (It * Area * Eff * TempFactor * systemLoss) <br/>
                    <span className="font-bold text-green-700">➔ {results.mode === 'daily' ? t.yieldDaySummaryLj : t.yieldMonthSummaryLj} = {results.yield_Temp.toFixed(1)} kWh ({t.usingLossLj}: {results.usedSystemLoss})</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default LiuJordanModel;
