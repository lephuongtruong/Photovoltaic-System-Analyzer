
import React, { useState, useMemo, useEffect, useContext } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, Legend } from 'recharts';
import * as XLSX from 'xlsx';
import { LanguageContext } from '../App';

const DEFAULT_REGIONAL_DATA = {
  "Hồ Chí Minh": { lat: 10.8, months: [
    { ghi_daily: 5.2, temp: 27 }, { ghi_daily: 5.8, temp: 28 }, { ghi_daily: 6.1, temp: 29 },
    { ghi_daily: 5.9, temp: 30 }, { ghi_daily: 5.1, temp: 29 }, { ghi_daily: 4.5, temp: 28 },
    { ghi_daily: 4.4, temp: 27 }, { ghi_daily: 4.6, temp: 27 }, { ghi_daily: 4.2, temp: 27 },
    { ghi_daily: 4.1, temp: 27 }, { ghi_daily: 4.3, temp: 27 }, { ghi_daily: 4.8, temp: 27 }
  ]}
};

const PerformanceAnalysis: React.FC = () => {
  const { lang } = useContext(LanguageContext);
  
  const strings = {
    vi: {
      title: "Phân tích hiệu quả hệ thống",
      iec: "Tuân thủ tiêu chuẩn IEC 61724-1",
      sample: "Mẫu File",
      import: "Import Dữ liệu",
      sim: "MÔ PHỎNG",
      actual: "THỰC TẾ",
      area: "Diện tích Pin A (m2)",
      eff: "Hiệu suất η (0.0 - 1.0)",
      capacity: "Công suất Pnom (kWp)",
      region: "Khu vực / Nguồn dữ liệu",
      dataLoaded: "Dữ liệu đã tải",
      noData: "Chưa có dữ liệu",
      pleaseUpload: "Vui lòng tải lên dữ liệu thực tế",
      uploadDesc: "Sử dụng nút 'Import Dữ liệu' bên trên để tải lên file Excel chứa sản lượng và bức xạ thực tế.",
      totalE: "Tổng Sản Lượng",
      yieldRef: "Yr (Ref Yield)",
      yieldFinal: "Yf (Final Yield)",
      chartTitle1: "Biểu đồ Sản lượng (kWh) & Chỉ số PR (%)",
      chartTitle2: "Đối sánh Yield: Yf (Final) vs Yr (Reference) - IEC 61724",
      step0: "Bước 0: Xác định công suất danh định (Pnom)",
      step1: "Bước 1: Tính toán Sản lượng",
      step2: "Bước 2: Quy chuẩn chỉ số IEC 61724 (Thế số thực tế)"
    },
    en: {
      title: "Performance Analysis",
      iec: "IEC 61724-1 Standard Compliant",
      sample: "Sample File",
      import: "Import Data",
      sim: "SIMULATION",
      actual: "ACTUAL",
      area: "Panel Area A (m2)",
      eff: "Efficiency η (0.0 - 1.0)",
      capacity: "Capacity Pnom (kWp)",
      region: "Region / Data Source",
      dataLoaded: "Data Loaded",
      noData: "No Data",
      pleaseUpload: "Please upload actual data",
      uploadDesc: "Use the 'Import Data' button above to upload an Excel file containing actual yield and radiation.",
      totalE: "Total Energy Yield",
      yieldRef: "Yr (Ref Yield)",
      yieldFinal: "Yf (Final Yield)",
      chartTitle1: "Energy Yield (kWh) & PR Index (%)",
      chartTitle2: "Yield Comparison: Yf (Final) vs Yr (Reference) - IEC 61724",
      step0: "Step 0: Nominal Power (Pnom)",
      step1: "Step 1: Yield Calculation",
      step2: "Step 2: IEC 61724 Metrics (Numerical Substitution)"
    }
  }[lang];

  const [regionalData, setRegionalData] = useState(() => {
    const saved = localStorage.getItem('solar_regional_data');
    return saved ? JSON.parse(saved) : DEFAULT_REGIONAL_DATA;
  });

  const [analysisMode, setAnalysisMode] = useState<'simulation' | 'actual'>('simulation');
  const [selectedRegion, setSelectedRegion] = useState<string>("Hồ Chí Minh");
  const [panelArea, setPanelArea] = useState<number>(250000); 
  const [efficiency, setEfficiency] = useState<number>(0.18);
  const [actualData, setActualData] = useState<any[]>([]);

  const plantCapacity = useMemo(() => panelArea * efficiency, [panelArea, efficiency]);
  const simParams = { tempCoeff: 0.0045, noct: 45 };

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
    if (!region) return [];

    return region.months.map((m: any, idx: number) => {
      const ghi_wh = m.ghi_daily * 1000;
      const n = (idx * 30) + 15;
      const delta = 23.45 * Math.sin((360 / 365) * (284 + n) * (Math.PI / 180));
      const phiRad = region.lat * (Math.PI / 180);
      const deltaRad = delta * (Math.PI / 180);
      const cosWs = -Math.tan(phiRad) * Math.tan(deltaRad);
      const ws = Math.acos(Math.max(-1, Math.min(1, cosWs)));
      const wsDeg = ws * (180 / Math.PI);

      let totalDayE = 0; let sumTc = 0; let hoursWithSun = 0; let sumIt = 0;

      for (let t = 0; t < 24; t++) {
        const omega = 15 * (t + 0.5 - 12);
        if (Math.abs(omega) <= wsDeg) {
          const r = (Math.PI / 24) * (Math.cos(omega * Math.PI / 180) - Math.cos(ws)) / (Math.sin(ws) - ws * Math.cos(ws));
          const It = ghi_wh * Math.max(0, r);
          const Tc = m.temp + (It / 800) * (simParams.noct - 20);
          const Et = (It * panelArea * efficiency * (1 - simParams.tempCoeff * (Tc - 25))) / 1000;
          totalDayE += Et; sumTc += Tc; sumIt += It; hoursWithSun++;
        }
      }

      const monthlyE = totalDayE * 30;
      const y_f = monthlyE / plantCapacity / 30;
      const y_r = m.ghi_daily / 1;
      
      return {
        month: `${lang === 'vi' ? 'T' : 'M'}${idx + 1}`,
        e_ac: monthlyE,
        h_i: m.ghi_daily * 30,
        y_f: Number(y_f.toFixed(2)),
        y_r: Number(y_r.toFixed(2)),
        pr: Number(((y_f / y_r) * 100).toFixed(2)),
        avg_tc: sumTc / (hoursWithSun || 1),
        avg_it: sumIt / (hoursWithSun || 1),
        ta: m.temp,
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
          const e_ac = Number(row["Sản lượng AC Thực tế (kWh)"]);
          const h_i_month = Number(row["Bức xạ GHI Thực tế (kWh/m2/tháng)"]);
          const ta = Number(row["Nhiệt độ môi trường TB (°C)"]) || 25;
          const ghi_daily = h_i_month / 30;
          const y_f = e_ac / plantCapacity / 30;
          const y_r = ghi_daily / 1;
          return {
            month: row["Tháng"], e_ac, h_i: h_i_month, ta,
            ghi_daily: Number(ghi_daily.toFixed(2)),
            y_f: Number(y_f.toFixed(2)),
            y_r: Number(y_r.toFixed(2)),
            pr: Number(((y_f / y_r) * 100).toFixed(2))
          };
        });
        setActualData(processed);
        setAnalysisMode('actual');
      } catch (err) { alert("Error importing actual file!"); }
    };
    reader.readAsBinaryString(file);
  };

  const downloadSampleActual = () => {
    const data = [
      ["Tháng", "Sản lượng AC Thực tế (kWh)", "Bức xạ GHI Thực tế (kWh/m2/tháng)", "Nhiệt độ môi trường TB (°C)"],
      ["T1", 5000, 150, 27], ["T2", 5500, 160, 28], ["T3", 6000, 180, 29]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Actual_Data");
    XLSX.writeFile(wb, "Mau_Du_Lieu_Thuc_Te.xlsx");
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h3 className="text-xl font-black text-blue-900 uppercase flex items-center gap-3">
              <i className="fas fa-chart-line text-blue-500"></i> {strings.title}
            </h3>
            <p className="text-xs text-gray-400 mt-1 uppercase font-bold tracking-tighter">{strings.iec}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
             {analysisMode === 'actual' && (
               <div className="flex gap-3 animate-fadeIn">
                 <button onClick={downloadSampleActual} className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-xl text-[10px] font-black border border-gray-200 uppercase transition-all">
                   <i className="fas fa-file-download mr-1"></i> {strings.sample}
                 </button>
                 <label className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-4 py-2 rounded-xl text-[10px] font-black border border-blue-200 uppercase cursor-pointer transition-all">
                    <i className="fas fa-upload mr-1"></i> {strings.import}
                    <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleActualFileUpload} />
                 </label>
               </div>
             )}
             
             <div className="flex bg-gray-100 p-1 rounded-2xl shadow-inner ml-2">
                <button onClick={() => setAnalysisMode('simulation')} className={`px-5 py-2 rounded-xl text-[10px] font-black transition-all ${analysisMode === 'simulation' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}>{strings.sim}</button>
                <button onClick={() => setAnalysisMode('actual')} className={`px-5 py-2 rounded-xl text-[10px] font-black transition-all ${analysisMode === 'actual' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}>{strings.actual}</button>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 mt-8 pt-8 border-t border-gray-50">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{strings.area}</label>
            <input type="number" value={panelArea} onChange={e => setPanelArea(Number(e.target.value))} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold text-blue-900 outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{strings.eff}</label>
            <input type="number" step="0.01" value={efficiency} onChange={e => setEfficiency(Number(e.target.value))} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold text-blue-900 outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{strings.capacity}</label>
            <div className="w-full p-4 bg-blue-50 border border-blue-100 rounded-2xl font-black text-blue-700 shadow-inner flex justify-between items-center">
              <span>{plantCapacity.toLocaleString()} kWp</span>
              <span className="text-[8px] bg-blue-200 px-2 py-1 rounded-md">AUTO</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{strings.region}</label>
            {analysisMode === 'simulation' ? (
              <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold text-blue-900 outline-none">
                {Object.keys(regionalData).map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            ) : (
              <div className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl font-bold text-gray-500 italic flex items-center gap-2">
                <i className="fas fa-file-import text-xs"></i> {actualData.length > 0 ? strings.dataLoaded : strings.noData}
              </div>
            )}
          </div>
        </div>
      </section>

      {metrics && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <span className="text-[10px] font-black text-gray-400 uppercase block">Performance Ratio (PR)</span>
              <div className="text-3xl font-black text-blue-600">{metrics.avgPR.toFixed(1)}%</div>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <span className="text-[10px] font-black text-gray-400 uppercase block">Yield (Yf)</span>
              <div className="text-3xl font-black text-orange-600">{metrics.avgYf.toFixed(2)} <span className="text-xs">h/d</span></div>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <span className="text-[10px] font-black text-gray-400 uppercase block">CUF (Capacity Util.)</span>
              <div className="text-3xl font-black text-green-600">{metrics.cuf.toFixed(2)}%</div>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <span className="text-[10px] font-black text-gray-400 uppercase block">{strings.totalE} ({analysisMode === 'actual' ? 'Actual' : 'Sim'})</span>
              <div className="text-2xl font-black text-gray-800">{(metrics.totalE / 1000).toFixed(1)} <span className="text-xs">MWh</span></div>
            </div>
          </div>

          <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
            <h3 className="text-lg font-black text-blue-900 uppercase mb-8 flex items-center gap-3 border-b pb-4">
              <i className="fas fa-microscope text-blue-500"></i> {strings.step2}
            </h3>

            <div className="space-y-12">
               <div className="animate-slideUp">
                <p className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px] shadow-lg">0</span>
                  {strings.step0}
                </p>
                <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 font-mono text-[13px] text-indigo-900">
                  Pnom = A * η = {panelArea.toLocaleString()} * {efficiency} = <span className="font-bold">{plantCapacity.toLocaleString()} kWp</span>
                </div>
              </div>

              <div>
                <p className="text-xs font-black text-orange-600 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center text-[11px] shadow-lg">1</span>
                  Công thức quy chuẩn Yield & PR
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div className="bg-orange-50/50 p-6 rounded-2xl border border-orange-100 shadow-sm">
                      <p className="text-[10px] font-black text-orange-800 uppercase mb-4">{strings.yieldFinal} (Yf)</p>
                      <div className="bg-white p-3 rounded mb-2 text-[11px] font-mono">Yf = E_ac / Pnom / 30</div>
                      <code className="text-[12px] font-mono block text-orange-700">
                        Yf = {metrics.sample.e_ac.toFixed(0)} / {plantCapacity.toFixed(0)} / 30 <br/>
                        <span className="font-bold">➔ {metrics.sample.y_f} h/d</span>
                      </code>
                   </div>
                   <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 shadow-sm">
                      <p className="text-[10px] font-black text-slate-800 uppercase mb-4">{strings.yieldRef} (Yr)</p>
                      <div className="bg-white p-3 rounded mb-2 text-[11px] font-mono">Yr = GHI_daily / 1kW/m²</div>
                      <code className="text-[12px] font-mono block text-slate-700">
                        Yr = {metrics.sample.ghi_daily.toFixed(2)} / 1 <br/>
                        <span className="font-bold">➔ {metrics.sample.y_r} h/d</span>
                      </code>
                   </div>
                   <div className="bg-green-50/50 p-6 rounded-2xl border border-green-100 shadow-sm">
                      <p className="text-[10px] font-black text-green-800 uppercase mb-4">Performance Ratio (PR)</p>
                      <div className="bg-white p-3 rounded mb-2 text-[11px] font-mono">PR = (Yf / Yr) * 100%</div>
                      <code className="text-[12px] font-mono block text-green-700">
                        PR = ({metrics.sample.y_f} / {metrics.sample.y_r}) * 100 <br/>
                        <span className="font-bold">➔ {metrics.sample.pr}%</span>
                      </code>
                   </div>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default PerformanceAnalysis;
