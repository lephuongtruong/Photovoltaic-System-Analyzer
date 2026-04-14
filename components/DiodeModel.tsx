
import React, { useState, useMemo, useEffect, useContext } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line, Legend, AreaChart, Area, ReferenceDot, ReferenceLine } from 'recharts';
import { LanguageContext } from '../App';
import { VIETNAM_PROVINCES, DEFAULT_REGIONAL_DATA } from '../constants';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ModelType } from '../types';

interface DiodeParams {
  isc: number; // Short circuit current (A)
  voc: number; // Open circuit voltage (V)
  imp: number; // Current at MPP (A)
  vmp: number; // Voltage at MPP (V)
  ns: number;  // Number of cells in series
  np: number;  // Number of parallel strings (Half-cell support)
  alphaIsc: number; // Temp coeff of Isc (A/C)
  betaVoc: number;  // Temp coeff of Voc (V/C)
  gammaPmp: number; // Temp coeff of Pmax (%/C)
  rs: number;  // Series resistance (Ohm)
  rsh: number; // Shunt resistance (Ohm)
  n: number;   // Ideality factor
  noct: number; // Nominal Operating Cell Temp (C)
}

const DiodeModel: React.FC = () => {
  const { lang, t, user, selectedSimulation, setSelectedSimulation } = useContext(LanguageContext);
  const [selectedProvince, setSelectedProvince] = useState<string>("Tây Ninh");
  const [loading, setLoading] = useState(false);
  const [regionalData, setRegionalData] = useState<any>(() => {
    const saved = localStorage.getItem('pv_regional_data');
    const data = saved ? JSON.parse(saved) : DEFAULT_REGIONAL_DATA;
    // Sync with VIETNAM_PROVINCES to ensure new provinces are included
    const syncedData = { ...DEFAULT_REGIONAL_DATA };
    Object.keys(VIETNAM_PROVINCES).forEach(name => {
      if (data[name]) syncedData[name] = data[name];
    });
    return syncedData;
  });
  
  // System Inputs
  const [systemInputs, setSystemInputs] = useState({
    totalInstalledKw: 10,
    moduleWp: 450,
    systemLoss: 15
  });

  // 1-Diode Parameters (Default values for a typical 450W panel)
  const [params, setParams] = useState<DiodeParams>({
    isc: 11.5,
    voc: 49.5,
    imp: 10.85,
    vmp: 41.5,
    ns: 66,
    np: 4,
    alphaIsc: 0.005,
    betaVoc: -0.13,
    gammaPmp: -0.35,
    rs: 0.15, // Reduced for better Pmax match
    rsh: 1000, // Increased for better Pmax match
    n: 0.98, // Adjusted for better Pmax match
    noct: 45
  });

  const [selectedMonth, setSelectedMonth] = useState(0);
  const [ivConditions, setIvConditions] = useState({ g: 1000, ta: 25 });
  const [isTuning, setIsTuning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [projectName, setProjectName] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<{type: 'success' | 'error', msg: string} | null>(null);
  const [calcResults, setCalcResults] = useState<{
    nModules: number;
    actualDcWp: number;
    monthlyResults: any[];
    annualTotal: number;
  } | null>(null);

  // Handle loading from history
  useEffect(() => {
    if (selectedSimulation && selectedSimulation.modelType === ModelType.DIODE) {
      const { inputs, results: savedResults } = selectedSimulation;
      if (inputs.province) setSelectedProvince(inputs.province);
      if (inputs.systemInputs) setSystemInputs(inputs.systemInputs);
      if (inputs.params) setParams(inputs.params);
      if (inputs.selectedMonth !== undefined) setSelectedMonth(inputs.selectedMonth);
      
      if (savedResults) {
        setCalcResults(savedResults);
      }
      
      // Clear selection after loading
      setSelectedSimulation(null);
    }
  }, [selectedSimulation, setSelectedSimulation]);

  // Sync moduleWp with STC parameters
  useEffect(() => {
    const theoreticalWp = params.vmp * params.imp;
    if (theoreticalWp > 0) {
      setSystemInputs(prev => ({
        ...prev,
        moduleWp: parseFloat(theoreticalWp.toFixed(2))
      }));
    }
  }, [params.vmp, params.imp]);

  const fetchNasaData = async () => {
    setLoading(true);
    const province = VIETNAM_PROVINCES[selectedProvince] || VIETNAM_PROVINCES["Tây Ninh"];
    const lat = province.lat;
    const lon = province.lon;
    
    try {
      const url = `https://power.larc.nasa.gov/api/temporal/hourly/point?parameters=ALLSKY_SFC_SW_DWN,T2M&community=RE&longitude=${lon}&latitude=${lat}&start=20230101&end=20231231&format=JSON`;
      const res = await fetch(url);
      const data = await res.json();
      
      const ghiData = data.properties.parameter.ALLSKY_SFC_SW_DWN;
      const tempData = data.properties.parameter.T2M;
      
      const newRegionalData = { ...regionalData };
      const provinceData = { ...newRegionalData[selectedProvince] };
      
      const monthlyData = Array(12).fill(null).map(() => ({
        ghi_daily: 0,
        temp: 0,
        hourlyProfile: Array(24).fill(null).map(() => ({ ghi: 0, temp: 0 })),
        days: 0
      }));

      Object.keys(ghiData).forEach(key => {
        const year = key.substring(0, 4);
        const month = parseInt(key.substring(4, 6)) - 1;
        const day = key.substring(6, 8);
        const hour = parseInt(key.substring(8, 10));
        
        const ghi = ghiData[key];
        const temp = tempData[key];
        
        if (ghi !== -999 && temp !== -999) {
          monthlyData[month].hourlyProfile[hour].ghi += ghi;
          monthlyData[month].hourlyProfile[hour].temp += temp;
          if (hour === 0) monthlyData[month].days += 1;
        }
      });

      monthlyData.forEach(m => {
        if (m.days > 0) {
          m.hourlyProfile.forEach(h => {
            h.ghi /= m.days;
            h.temp /= m.days;
          });
          m.ghi_daily = m.hourlyProfile.reduce((sum, h) => sum + h.ghi, 0) / 1000;
          m.temp = m.hourlyProfile.reduce((sum, h) => sum + h.temp, 0) / 24;
        }
      });

      provinceData.months = monthlyData;
      provinceData.hasNasa = true;
      newRegionalData[selectedProvince] = provinceData;
      
      setRegionalData(newRegionalData);
      localStorage.setItem('pv_regional_data', JSON.stringify(newRegionalData));
    } catch (error) {
      console.error("NASA API Error", error);
    } finally {
      setLoading(false);
    }
  };

  // 1-Diode Calculation Logic
  const calculatePower = (G: number, Ta: number) => {
    if (G <= 0) return 0;

    const k = 1.380649e-23; // Boltzmann constant
    const q = 1.60217663e-19; // Electron charge
    const Tref = 25 + 273.15; // Reference temp (K)
    const Gref = 1000; // Reference irradiance (W/m2)
    const Eg = 1.12 * q; // Band gap of Silicon (J)

    // Estimate Cell Temperature using NOCT
    const Tc_C = Ta + (G / 800) * (params.noct - 20);
    const Tc = Tc_C + 273.15; // K

    const a_ref = params.n * params.ns * (k * Tref) / q;
    if (a_ref === 0 || isNaN(a_ref)) return 0;

    const I0_ref = (params.isc - (params.voc - params.isc * params.rs) / params.rsh) / (Math.exp(params.voc / a_ref) - Math.exp(params.isc * params.rs / a_ref));
    const Iph_ref = I0_ref * (Math.exp(params.voc / a_ref) - 1) + params.voc / params.rsh;

    // Photocurrent at Tc
    const Iph = (G / Gref) * (Iph_ref + params.alphaIsc * (Tc - Tref));
    // Reverse saturation current at Tc
    const I0 = I0_ref * Math.pow(Tc / Tref, 3) * Math.exp((Eg / (params.n * k)) * (1 / Tref - 1 / Tc));

    const Vt = (k * Tc) / q;
    const a = params.n * params.ns * Vt;

    if (a === 0 || isNaN(a) || isNaN(Iph) || isNaN(I0)) return 0;

    // Find MPP using a more robust search
    let maxP = 0;
    const solveI = (V: number) => {
      let I = params.imp * (G / Gref); // Initial guess
      for (let i = 0; i < 20; i++) {
        const expTerm = Math.exp((V + I * params.rs) / a);
        const f = Iph - I0 * (expTerm - 1) - (V + I * params.rs) / params.rsh - I;
        const df = -I0 * (params.rs / a) * expTerm - params.rs / params.rsh - 1;
        const step = f / df;
        I = I - step;
        if (Math.abs(step) < 1e-8) break;
      }
      return Math.max(0, I);
    };

    // Golden Section Search for MPP
    let v_low = 0;
    let v_high = params.voc * (1 + (params.betaVoc / params.voc) * (Tc - Tref));
    if (v_high < 0) v_high = 0;
    
    // Safety check for STC to ensure exact match
    if (Math.abs(Tc - Tref) < 0.01 && Math.abs(G - Gref) < 0.01) {
      const I_vmp = solveI(params.vmp);
      // If our tuning is correct, I_vmp should be params.imp
      // We check a small range around Vmp just in case
      maxP = params.vmp * I_vmp;
    }

    const phi = (Math.sqrt(5) - 1) / 2;
    let v1 = v_high - phi * (v_high - v_low);
    let v2 = v_low + phi * (v_high - v_low);
    
    for (let i = 0; i < 40; i++) {
      const p1 = v1 * solveI(v1);
      const p2 = v2 * solveI(v2);
      if (p1 < p2) {
        v_low = v1;
        v1 = v2;
        v2 = v_low + phi * (v_high - v_low);
        if (p2 > maxP) maxP = p2;
      } else {
        v_high = v2;
        v2 = v1;
        v1 = v_high - phi * (v_high - v_low);
        if (p1 > maxP) maxP = p1;
      }
    }

    return maxP;
  };

  const saveSimulation = async (results: any) => {
    if (!user) return;
    
    const finalName = projectName.trim() || `${t.diodeModel} - ${selectedProvince}`;

    setIsSaving(true);
    setSaveStatus(null);
    try {
      await addDoc(collection(db, 'simulations'), {
        userId: user.uid,
        modelType: ModelType.DIODE,
        projectName: finalName,
        timestamp: serverTimestamp(),
        inputs: {
          province: selectedProvince,
          systemInputs,
          params,
          selectedMonth
        },
        results: results,
        metadata: {
          location: selectedProvince,
          description: `1-Diode Simulation for ${selectedProvince}`
        }
      });
      setSaveStatus({ type: 'success', msg: t.projectSaved });
      setProjectName(""); // Reset after save
    } catch (error) {
      console.error("Error saving simulation:", error);
      setSaveStatus({ type: 'error', msg: lang === 'vi' ? 'Lỗi khi lưu dự án. Vui lòng thử lại.' : 'Error saving project. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCalculate = () => {
    const currentProvinceData = regionalData[selectedProvince] || Object.values(regionalData)[0] || DEFAULT_REGIONAL_DATA["Tây Ninh"];
    if (!currentProvinceData || !currentProvinceData.months) return;

    // Logic tính số lượng tấm pin
    const pTotalWp = systemInputs.totalInstalledKw * 1000;
    const nModules = Math.ceil(pTotalWp / systemInputs.moduleWp);
    const actualDcWp = nModules * systemInputs.moduleWp;

    const daysInMonths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let annualTotal = 0;

    const monthlyResults = currentProvinceData.months.map((m: any, idx: number) => {
      const hourlyYield = m.hourlyProfile.map((h: any) => calculatePower(h.ghi, h.temp));
      // Tổng sản lượng hệ thống = sản lượng 1 tấm * số lượng tấm * (1 - hệ số tổn thất)
      const lossFactor = (1 - systemInputs.systemLoss / 100);
      const dailyTotal = (hourlyYield.reduce((sum: number, p: number) => sum + p, 0) * nModules * lossFactor) / 1000; // kWh/day
      const monthlyTotal = dailyTotal * daysInMonths[idx];
      annualTotal += monthlyTotal;

      return {
        month: idx + 1,
        yield: dailyTotal,
        monthlyYield: monthlyTotal,
        ghi: m.ghi_daily,
        temp: m.temp,
        hourly: hourlyYield.map((p: number) => p * nModules * lossFactor) // Công suất hệ thống theo giờ (W) sau tổn thất
      };
    });

    const results = {
      nModules,
      actualDcWp,
      monthlyResults,
      annualTotal
    };
    setCalcResults(results);
  };

  const autoTuneParams = () => {
    setIsTuning(true);
    setTimeout(() => {
      const k = 1.380649e-23;
      const q = 1.60217663e-19;
      const Tref = 298.15;
      const Vt = (k * Tref) / q;
      
      let bestRs = params.rs;
      let bestN = params.n;
      let minError = Infinity;

      // Search for n that satisfies the MPP condition
      // For each n, we solve for Rs that makes the curve pass through (Vmp, Imp)
      for (let n = 0.5; n <= 2.5; n += 0.001) {
        const a = n * params.ns * Vt;
        
        // Solve for Rs numerically such that I(Vmp) = Imp
        // f(Rs) = I0(Rs) * [exp(Voc/a) - exp((Vmp + Imp*Rs)/a)] + (Voc - Vmp - Imp*Rs)/Rsh - Imp = 0
        let rs = 0.1; 
        let converged = false;
        for (let iter = 0; iter < 40; iter++) {
          const expVoc = Math.exp(params.voc / a);
          const expIscRs = Math.exp(params.isc * rs / a);
          const expMpp = Math.exp((params.vmp + params.imp * rs) / a);
          
          const num = params.isc - (params.voc - params.isc * rs) / params.rsh;
          const den = expVoc - expIscRs;
          const I0 = num / den;
          
          const dN = params.isc / params.rsh;
          const dD = - (params.isc / a) * expIscRs;
          const dI0 = (dN * den - num * dD) / (den * den);
          
          const f = I0 * (expVoc - expMpp) + (params.voc - params.vmp - params.imp * rs) / params.rsh - params.imp;
          const df = dI0 * (expVoc - expMpp) + I0 * (- (params.imp / a) * expMpp) - params.imp / params.rsh;
          
          const step = f / df;
          rs = rs - step;
          if (Math.abs(step) < 1e-12) {
            converged = true;
            break;
          }
        }

        if (!converged || rs < 0 || rs > (params.voc / params.imp)) continue;

        // Now we have Rs for this n. Check if it's the MPP (dP/dV = 0)
        const expVoc = Math.exp(params.voc / a);
        const expIscRs = Math.exp(params.isc * rs / a);
        const I0 = (params.isc - (params.voc - params.isc * rs) / params.rsh) / (expVoc - expIscRs);
        const expTerm = Math.exp((params.vmp + params.imp * rs) / a);
        
        const di_dv = (- (I0 / a) * expTerm - (1 / params.rsh)) / (1 + (I0 * rs / a) * expTerm + (rs / params.rsh));
        const dP_dV = params.imp + params.vmp * di_dv;

        const error = Math.abs(dP_dV);
        if (error < minError) {
          minError = error;
          bestRs = rs;
          bestN = n;
        }
      }

      setParams(prev => ({
        ...prev,
        rs: parseFloat(bestRs.toFixed(8)),
        n: parseFloat(bestN.toFixed(8))
      }));
      setIsTuning(false);
    }, 500);
  };

  const chartData = useMemo(() => {
    if (!calcResults) return [];
    return calcResults.monthlyResults.map((r: any) => ({
      name: `T${r.month}`,
      yield: parseFloat(r.yield.toFixed(2)),
      ghi: parseFloat(r.ghi.toFixed(2))
    }));
  }, [calcResults]);

  const hourlyChartData = useMemo(() => {
    if (!calcResults) return [];
    const currentProvinceData = regionalData[selectedProvince] || Object.values(regionalData)[0] || DEFAULT_REGIONAL_DATA["Tây Ninh"];
    return calcResults.monthlyResults[selectedMonth].hourly.map((p: number, h: number) => {
      const ghi = currentProvinceData.months[selectedMonth].hourlyProfile[h].ghi;
      const ta = currentProvinceData.months[selectedMonth].hourlyProfile[h].temp;
      const tc = ta + (ghi / 800) * (params.noct - 20);
      return {
        hour: h,
        power: parseFloat(p.toFixed(1)),
        ghi: parseFloat(ghi.toFixed(1)),
        temp: parseFloat(ta.toFixed(1)),
        cellTemp: parseFloat(tc.toFixed(1))
      };
    });
  }, [calcResults, selectedMonth, selectedProvince, regionalData, params.noct]);

  const calculationDetails = useMemo(() => {
    if (!calcResults) return null;
    const currentProvinceData = regionalData[selectedProvince] || Object.values(regionalData)[0] || DEFAULT_REGIONAL_DATA["Tây Ninh"];
    const monthData = currentProvinceData.months[selectedMonth];
    
    // Find peak hour
    let peakHour = 12;
    let maxGhi = 0;
    monthData.hourlyProfile.forEach((h: any, idx: number) => {
      if (h.ghi > maxGhi) {
        maxGhi = h.ghi;
        peakHour = idx;
      }
    });

    const G = monthData.hourlyProfile[peakHour].ghi;
    const Ta = monthData.hourlyProfile[peakHour].temp;
    
    if (G <= 0) return null;

    const k = 1.380649e-23;
    const q = 1.60217663e-19;
    const Tref = 298.15;
    const Gref = 1000;
    const Eg = 1.12 * q;

    const Tc_C = Ta + (G / 800) * (params.noct - 20);
    const Tc = Tc_C + 273.15;

    const a_ref = params.n * params.ns * (k * Tref) / q;
    const I0_ref = (params.isc - (params.voc - params.isc * params.rs) / params.rsh) / (Math.exp(params.voc / a_ref) - Math.exp(params.isc * params.rs / a_ref));
    const Iph_ref = I0_ref * (Math.exp(params.voc / a_ref) - 1) + params.voc / params.rsh;

    const Iph = (G / Gref) * (Iph_ref + params.alphaIsc * (Tc - Tref));
    const I0 = I0_ref * Math.pow(Tc / Tref, 3) * Math.exp((Eg / (params.n * k)) * (1 / Tref - 1 / Tc));

    return {
      peakHour,
      G,
      Ta,
      Tc_C,
      Iph,
      I0,
      I0_ref,
      Ppv: calculatePower(G, Ta)
    };
  }, [calcResults, selectedMonth, selectedProvince, regionalData, params, calculatePower]);

  const ivCurveData = useMemo(() => {
    const { g: G, ta: Tc_C } = ivConditions; // Using Tc directly for IV curve simulation
    if (G <= 0) return [];

    const k = 1.380649e-23;
    const q = 1.60217663e-19;
    const Tref = 298.15;
    const Gref = 1000;
    const Eg = 1.12 * q;

    const Tc = Tc_C + 273.15;
    const a_ref = params.n * params.ns * (k * Tref) / q;
    
    // Safety guard for a_ref
    if (a_ref === 0 || isNaN(a_ref)) return [];

    const I0_ref = (params.isc - (params.voc - params.isc * params.rs) / params.rsh) / (Math.exp(params.voc / a_ref) - Math.exp(params.isc * params.rs / a_ref));
    const Iph_ref = I0_ref * (Math.exp(params.voc / a_ref) - 1) + params.voc / params.rsh;

    const Iph = (G / Gref) * (Iph_ref + params.alphaIsc * (Tc - Tref));
    const I0 = I0_ref * Math.pow(Tc / Tref, 3) * Math.exp((Eg / (params.n * k)) * (1 / Tref - 1 / Tc));
    const Vt = (k * Tc) / q;
    const a = params.n * params.ns * Vt;

    if (a === 0 || isNaN(a) || isNaN(Iph) || isNaN(I0)) return [];

    const solveI = (V: number) => {
      let I = params.imp; // Good starting point
      for (let i = 0; i < 40; i++) { // Even higher iterations for convergence
        const expTerm = Math.exp((V + I * params.rs) / a);
        const f = Iph - I0 * (expTerm - 1) - (V + I * params.rs) / params.rsh - I;
        const df = -I0 * (params.rs / a) * expTerm - params.rs / params.rsh - 1;
        const step = f / df;
        I = I - step;
        if (Math.abs(step) < 1e-8) break;
      }
      return Math.max(0, I);
    };

    const data = [];
    const voc_est = params.voc * (1 + (params.betaVoc / params.voc) * (Tc - Tref));
    const vmp_est = params.vmp * (1 + (params.gammaPmp / 100) * (Tc - Tref)); // Rough estimate for sampling
    
    const steps = 300; // Even higher resolution
    for (let i = 0; i <= steps; i++) {
      const V = (voc_est * 1.15 * i) / steps;
      const I = solveI(V);
      if (I < 0.0001 && V > voc_est) break;
      data.push({
        v: parseFloat(V.toFixed(2)),
        i: parseFloat(I.toFixed(4)),
        p: parseFloat((V * I).toFixed(2))
      });
    }

    // Ensure Vmp is explicitly in the data to avoid discretization error at STC
    if (Math.abs(Tc - Tref) < 0.1 && Math.abs(G - Gref) < 0.1) {
      const I_vmp = solveI(params.vmp);
      data.push({
        v: params.vmp,
        i: parseFloat(I_vmp.toFixed(4)),
        p: parseFloat((params.vmp * I_vmp).toFixed(4))
      });
      data.sort((a, b) => a.v - b.v);
    }

    return data;
  }, [ivConditions, params]);

  const ivMpp = useMemo(() => {
    if (ivCurveData.length === 0) return null;
    return ivCurveData.reduce((max, p) => p.p > max.p ? p : max, ivCurveData[0]);
  }, [ivCurveData]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header & Controls */}
      <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-2xl font-black text-blue-900 uppercase tracking-tight mb-2">
            {t.diodeModel}
          </h2>
          <p className="text-gray-500 text-sm">{t.diodeDesc}</p>
        </div>
        <div className="flex flex-wrap gap-4 justify-center">
          <select 
            value={selectedProvince}
            onChange={(e) => setSelectedProvince(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-2xl px-6 py-3 font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          >
            {Object.keys(VIETNAM_PROVINCES).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button 
            onClick={fetchNasaData}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-black transition-all shadow-lg shadow-blue-200 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <i className="fas fa-spinner animate-spin"></i> : <i className="fas fa-cloud-download-alt"></i>}
            {t.nasaDataBtn}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Parameters Input */}
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100">
            <h3 className="text-lg font-black text-blue-900 mb-6 flex items-center gap-2">
              <i className="fas fa-solar-panel text-blue-500"></i> {t.systemParams}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-black text-gray-400 uppercase mb-1 block">{t.totalPower}</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={systemInputs.totalInstalledKw || ''} 
                    onChange={(e) => setSystemInputs({...systemInputs, totalInstalledKw: parseFloat(e.target.value) || 0})} 
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 pr-12 font-bold text-blue-900 outline-none focus:border-blue-500 transition-all" 
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-blue-400">kWp</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-black text-gray-400 uppercase mb-1 block">{t.modulePower}</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={systemInputs.moduleWp || ''} 
                    onChange={(e) => setSystemInputs({...systemInputs, moduleWp: parseFloat(e.target.value) || 0})} 
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 pr-12 font-bold text-blue-900 outline-none focus:border-blue-500 transition-all" 
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-blue-400">Wp</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-black text-gray-400 uppercase mb-1 block">{t.lossFactor}</label>
                <div className="flex items-center gap-4">
                  <input 
                    type="range" 
                    min="0" 
                    max="40" 
                    step="1"
                    value={systemInputs.systemLoss} 
                    onChange={(e) => setSystemInputs({...systemInputs, systemLoss: parseFloat(e.target.value) || 0})} 
                    className="flex-1 accent-blue-600" 
                  />
                  <input 
                    type="number" 
                    value={systemInputs.systemLoss} 
                    onChange={(e) => setSystemInputs({...systemInputs, systemLoss: parseFloat(e.target.value) || 0})} 
                    className="w-20 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 font-bold text-blue-900 text-center" 
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-50 flex justify-between items-center">
                <span className="text-[10px] font-black text-gray-400 uppercase">{t.moduleCount}</span>
                <span className="text-sm font-black text-blue-900">
                  {systemInputs.moduleWp > 0 
                    ? Math.ceil((systemInputs.totalInstalledKw * 1000) / systemInputs.moduleWp) 
                    : 0}
                </span>
              </div>

              <button 
                onClick={autoTuneParams}
                disabled={isTuning}
                className="w-full mt-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold py-3 rounded-2xl border border-emerald-100 transition-all flex items-center justify-center gap-2 text-xs"
              >
                {isTuning ? (
                  <><i className="fas fa-spinner fa-spin"></i> {t.optimizing}</>
                ) : (
                  <><i className="fas fa-magic"></i> {t.optimizeBtn}</>
                )}
              </button>
              <p className="text-[10px] text-gray-400 mt-2 text-center italic">
                {t.optimizeHint}
              </p>
              <button 
                onClick={handleCalculate}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-2xl font-black transition-all shadow-lg shadow-blue-200 mt-4"
              >
                {t.calculateBtn}
              </button>
              {calcResults && (
                <div className="mt-3 space-y-2">
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder={t.enterProjectName}
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-sm outline-none"
                    />
                    <i className="fas fa-edit absolute right-4 top-1/2 -translate-y-1/2 text-gray-300"></i>
                  </div>
                  <button 
                    onClick={() => saveSimulation(calcResults)}
                    disabled={isSaving || !user}
                    className={`w-full py-3 rounded-2xl font-black transition-all shadow-lg flex items-center justify-center gap-2 ${
                      !user 
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
                    }`}
                  >
                    {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                    {!user ? t.loginToSave : t.saveProject}
                  </button>
                  {saveStatus && (
                    <div className={`text-[10px] font-bold text-center p-2 rounded-xl ${saveStatus.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                      {saveStatus.msg}
                    </div>
                  )}
                </div>
              )}
            </div>

            {calcResults && (
              <div className="mt-6 p-6 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-emerald-700 uppercase">{t.moduleCount}</span>
                  <span className="text-lg font-black text-emerald-900">{calcResults.nModules}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-emerald-700 uppercase">{t.actualDcPower}</span>
                  <span className="text-lg font-black text-emerald-900">{(calcResults.actualDcWp / 1000).toFixed(2)} kWp</span>
                </div>
                <div className="pt-3 border-t border-emerald-200 flex justify-between items-center">
                  <span className="text-xs font-bold text-emerald-700 uppercase">{t.annualYield}</span>
                  <div className="text-right">
                    <span className="text-xl font-black text-emerald-900">{(calcResults.annualTotal || 0).toLocaleString('en-US', {useGrouping: false, maximumFractionDigits: 0})}</span>
                    <span className="text-[10px] font-bold text-emerald-600 ml-1">kWh/{lang === 'vi' ? 'năm' : 'year'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {calcResults && (
            <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100">
              <h3 className="text-lg font-black text-blue-900 mb-6 flex items-center gap-2">
                <i className="fas fa-sun text-yellow-500"></i> {t.radiationData} ({selectedProvince})
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-yellow-50 rounded-2xl border border-yellow-100">
                    <p className="text-[10px] font-black text-yellow-800 uppercase mb-1">{t.avgYearly}</p>
                    <p className="text-xl font-black text-yellow-900">
                      {(calcResults.monthlyResults.reduce((sum, r) => sum + r.ghi, 0) / 12).toFixed(2)}
                      <span className="text-xs ml-1">kWh/m²</span>
                    </p>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100">
                    <p className="text-[10px] font-black text-orange-800 uppercase mb-1">{t.totalYearly}</p>
                    <p className="text-xl font-black text-orange-900">
                      {(calcResults.monthlyResults.reduce((sum, r) => sum + r.ghi * 30.42, 0)).toFixed(0)}
                      <span className="text-xs ml-1">kWh/m²</span>
                    </p>
                  </div>
                </div>
                
                <div className="overflow-hidden rounded-2xl border border-gray-100">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-400 uppercase font-black">
                      <tr>
                        <th className="px-4 py-2">{t.month}</th>
                        <th className="px-4 py-2 text-right">{t.ghi}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {calcResults.monthlyResults.map((r: any) => (
                        <tr key={r.month} className={selectedMonth === r.month - 1 ? "bg-blue-50" : ""}>
                          <td className="px-4 py-2 font-bold text-gray-600">{lang === 'vi' ? 'Tháng' : 'Month'} {r.month}</td>
                          <td className="px-4 py-2 text-right font-black text-blue-900">{r.ghi.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100">
            <h3 className="text-lg font-black text-blue-900 mb-6 flex items-center gap-2">
              <i className="fas fa-cog text-blue-500"></i> {t.stcParams}
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase mb-1 block">Isc (A)</label>
                  <input type="number" value={params.isc || ''} onChange={(e) => setParams({...params, isc: parseFloat(e.target.value) || 0})} className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 font-bold text-blue-900" />
                </div>
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase mb-1 block">Voc (V)</label>
                  <input type="number" value={params.voc || ''} onChange={(e) => setParams({...params, voc: parseFloat(e.target.value) || 0})} className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 font-bold text-blue-900" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase mb-1 block">Imp (A)</label>
                  <input type="number" value={params.imp || ''} onChange={(e) => setParams({...params, imp: parseFloat(e.target.value) || 0})} className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 font-bold text-blue-900" />
                </div>
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase mb-1 block">Vmp (V)</label>
                  <input type="number" value={params.vmp || ''} onChange={(e) => setParams({...params, vmp: parseFloat(e.target.value) || 0})} className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 font-bold text-blue-900" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase mb-1 block">{lang === 'vi' ? 'Số cell nối tiếp (Ns)' : 'Cells in series (Ns)'}</label>
                  <input type="number" value={params.ns || ''} onChange={(e) => setParams({...params, ns: parseFloat(e.target.value) || 0})} className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 font-bold text-blue-900" />
                </div>
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase mb-1 block">{lang === 'vi' ? 'Số dãy song song (Np)' : 'Parallel strings (Np)'}</label>
                  <input type="number" value={params.np || ''} onChange={(e) => setParams({...params, np: parseFloat(e.target.value) || 0})} className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 font-bold text-blue-900" />
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-gray-400 uppercase">{t.theoreticalPmax}</span>
                <span className="text-sm font-black text-blue-600">
                  {(params.vmp * params.imp).toFixed(2)} W
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-gray-400 uppercase">{t.moduleCount}</span>
                <span className="text-sm font-black text-blue-900">
                  {systemInputs.moduleWp > 0 
                    ? Math.ceil((systemInputs.totalInstalledKw * 1000) / systemInputs.moduleWp) 
                    : 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-gray-400 uppercase">{t.simulatedPmax}</span>
                <span className="text-sm font-black text-emerald-600">
                  {ivCurveData.length > 0 ? (ivCurveData.reduce((max, p) => p.p > max ? p.p : max, 0)).toFixed(2) : 0} W
                </span>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-center">
                <span className="text-[10px] font-black text-gray-400 uppercase">{t.totalCells}</span>
                <span className="text-sm font-black text-blue-900">{params.ns * params.np}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase mb-1 block">Rs (Ω)</label>
                  <input type="number" step="0.01" value={params.rs || ''} onChange={(e) => setParams({...params, rs: parseFloat(e.target.value) || 0})} className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 font-bold text-blue-900" />
                </div>
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase mb-1 block">Rsh (Ω)</label>
                  <input type="number" value={params.rsh || ''} onChange={(e) => setParams({...params, rsh: parseFloat(e.target.value) || 0})} className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 font-bold text-blue-900" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase mb-1 block">α Isc (A/°C)</label>
                  <input type="number" step="0.001" value={params.alphaIsc || ''} onChange={(e) => setParams({...params, alphaIsc: parseFloat(e.target.value) || 0})} className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 font-bold text-blue-900" />
                </div>
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase mb-1 block">β Voc (V/°C)</label>
                  <input type="number" step="0.01" value={params.betaVoc || ''} onChange={(e) => setParams({...params, betaVoc: parseFloat(e.target.value) || 0})} className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 font-bold text-blue-900" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase mb-1 block">NOCT (°C)</label>
                  <input type="number" value={params.noct || ''} onChange={(e) => setParams({...params, noct: parseFloat(e.target.value) || 0})} className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 font-bold text-blue-900" />
                </div>
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase mb-1 block">γ Pmax (%/°C)</label>
                  <input type="number" step="0.01" value={params.gammaPmp || ''} onChange={(e) => setParams({...params, gammaPmp: parseFloat(e.target.value) || 0})} className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 font-bold text-blue-900" />
                </div>
              </div>
              <div>
                <label className="text-xs font-black text-gray-400 uppercase mb-1 block">{t.idealityFactor}</label>
                <input type="number" step="0.1" value={params.n || ''} onChange={(e) => setParams({...params, n: parseFloat(e.target.value) || 0})} className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 font-bold text-blue-900" />
              </div>
            </div>
            
            <div className="mt-8 p-6 bg-blue-50 rounded-2xl border border-blue-100">
              <h4 className="text-xs font-black text-blue-800 uppercase mb-3">{t.formulaTitle}</h4>
              <div className="font-serif text-sm text-blue-900 italic space-y-2">
                <p>I = Iph - I0[exp((V+IRs)/a) - 1] - (V+IRs)/Rsh</p>
                <p>Epv = Ppv * t * nModules * {lang === 'vi' ? 'hệ số tổn thất' : 'loss factor'}</p>
                <p className="text-[10px] opacity-70">{lang === 'vi' ? 'Trong đó' : 'Where'} a = n * Ns * k * Tc / q</p>
                <p className="text-[10px] opacity-70">t: {lang === 'vi' ? 'Thời gian (1h)' : 'Time (1h)'}</p>
                <p className="text-[10px] opacity-70">Ppv: {lang === 'vi' ? 'Công suất 1 tấm pin (W)' : 'Panel power (W)'}</p>
                <p className="text-[10px] opacity-70">nModules: {lang === 'vi' ? 'Số lượng tấm pin' : 'Number of panels'}</p>
              </div>
            </div>
          </div>
        </div>

      {/* Charts */}
        <div className="lg:col-span-2 space-y-8">
          {/* Monthly Yield Chart */}
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100">
            <h3 className="text-lg font-black text-blue-900 mb-6">{t.dailyYieldChart}</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 600}} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}}
                  />
                  <Legend verticalAlign="top" align="right" iconType="circle" />
                  <Bar yAxisId="left" dataKey="yield" name={lang === 'vi' ? 'Sản lượng (kWh)' : 'Yield (kWh)'} fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={30} />
                  <Line yAxisId="right" type="monotone" dataKey="ghi" name={lang === 'vi' ? 'Bức xạ (kWh/m2)' : 'Radiation (kWh/m2)'} stroke="#f59e0b" strokeWidth={3} dot={{r: 4}} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Hourly Profile Chart */}
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-blue-900">{t.hourlyChart}</h3>
              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-sm font-bold"
              >
                {Array(12).fill(0).map((_, i) => <option key={i} value={i}>{lang === 'vi' ? 'Tháng' : 'Month'} {i+1}</option>)}
              </select>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyChartData}>
                  <defs>
                    <linearGradient id="colorPower" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white p-4 rounded-2xl shadow-xl border border-gray-100 text-xs space-y-1">
                            <p className="font-black text-blue-900 mb-2">{t.hour}: {label}:00</p>
                            <p className="text-blue-600">{t.power}: <span className="font-bold">{payload[0].value} W</span></p>
                            <p className="text-orange-500">{t.radiation}: <span className="font-bold">{payload[1].value} W/m²</span></p>
                            <p className="text-gray-500">{t.ambientTemp}: <span className="font-bold">{payload[0].payload.temp} °C</span></p>
                            <p className="text-red-500">{t.cellTemp}: <span className="font-bold">{payload[0].payload.cellTemp} °C</span></p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area type="monotone" dataKey="power" name={lang === 'vi' ? 'Công suất (W)' : 'Power (W)'} stroke="#3b82f6" fillOpacity={1} fill="url(#colorPower)" strokeWidth={3} />
                  <Line type="monotone" dataKey="ghi" name={lang === 'vi' ? 'Bức xạ (W/m2)' : 'Radiation (W/m2)'} stroke="#f59e0b" strokeDasharray="5 5" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed Calculation Steps */}
          {calculationDetails && (
            <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100">
              <h3 className="text-lg font-black text-blue-900 mb-6 flex items-center gap-2">
                <i className="fas fa-calculator text-blue-500"></i> {t.calculationDetails} ({t.peakHour} {calculationDetails.peakHour}:00)
              </h3>
              <div className="space-y-6 text-sm">
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="font-bold text-blue-800 mb-2">{t.cellTempFormula}</p>
                  <p className="font-mono text-xs text-gray-600 mb-1">Tc = Ta + (G/800) * (NOCT - 20)</p>
                  <p className="font-mono text-xs text-blue-600">
                    Tc = {calculationDetails.Ta.toFixed(1)} + ({calculationDetails.G.toFixed(1)}/800) * ({params.noct} - 20) = <span className="font-black">{calculationDetails.Tc_C.toFixed(2)} °C</span>
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="font-bold text-blue-800 mb-2">{t.iphFormula}</p>
                  <p className="font-mono text-xs text-gray-600 mb-1">Iph = (G/Gref) * [Isc + α * (Tc - Tref)]</p>
                  <p className="font-mono text-xs text-blue-600">
                    Iph = ({calculationDetails.G.toFixed(1)}/1000) * [{params.isc} + {params.alphaIsc} * ({(calculationDetails.Tc_C + 273.15).toFixed(2)} - 298.15)] = <span className="font-black">{calculationDetails.Iph.toFixed(4)} A</span>
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="font-bold text-blue-800 mb-2">{t.i0Formula}</p>
                  <p className="font-mono text-xs text-gray-600 mb-1">I0 = I0,ref * (Tc/Tref)³ * exp[(Eg/nk) * (1/Tref - 1/Tc)]</p>
                  <p className="font-mono text-xs text-blue-600">
                    I0_ref = {calculationDetails.I0_ref.toExponential(2)} A
                  </p>
                  <p className="font-mono text-xs text-blue-600">
                    I0 = <span className="font-black">{calculationDetails.I0.toExponential(4)} A</span>
                  </p>
                </div>

                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <p className="font-bold text-blue-800 mb-2">{t.ivMppFormula}</p>
                  <p className="font-mono text-xs text-gray-600 mb-1">I = Iph - I0[exp((V+IRs)/a) - 1] - (V+IRs)/Rsh</p>
                  <p className="text-xs text-blue-700 italic">
                    {t.newtonRaphsonDesc} ({calcResults?.nModules}).
                  </p>
                </div>

                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <p className="font-bold text-emerald-800 mb-2">{t.yieldFormula}</p>
                  <p className="font-mono text-xs text-gray-600 mb-1">{t.yieldFormulaDesc}</p>
                  <p className="font-mono text-xs text-emerald-600">
                    Epv = {calculationDetails.Ppv.toFixed(2)} * 1 * {calcResults?.nModules} * {(1 - systemInputs.systemLoss / 100).toFixed(2)} = <span className="font-black">{(calculationDetails.Ppv * calcResults?.nModules * (1 - systemInputs.systemLoss / 100)).toFixed(2)} Wh</span>
                  </p>
                  <p className="text-[10px] text-emerald-700 mt-1 italic">
                    {t.yieldFormulaNote}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* I-V Curve Simulation */}
          <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-lg font-black text-blue-900 flex items-center gap-2">
                <i className="fas fa-chart-line text-blue-500"></i> {t.ivPvSimulation}
              </h3>
              <button 
                onClick={() => setIvConditions({ g: 1000, ta: 25 })}
                className="text-[10px] font-black text-blue-600 hover:text-blue-800 underline uppercase"
              >
                {t.resetStc}
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">{t.irradianceG}</label>
                  <input 
                    type="range" min="0" max="1200" step="50"
                    value={ivConditions.g} 
                    onChange={(e) => setIvConditions({...ivConditions, g: parseInt(e.target.value)})} 
                    className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="text-right font-black text-blue-900 text-xs mt-1">{ivConditions.g} W/m²</div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">{t.cellTempTc}</label>
                  <input 
                    type="range" min="-10" max="80" step="1"
                    value={ivConditions.ta} 
                    onChange={(e) => setIvConditions({...ivConditions, ta: parseInt(e.target.value)})} 
                    className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-red-600"
                  />
                  <div className="text-right font-black text-red-900 text-xs mt-1">{ivConditions.ta} °C</div>
                </div>
              </div>

              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={ivCurveData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="v" 
                      type="number" 
                      domain={[0, 'auto']} 
                      label={{ value: t.voltageV, position: 'insideBottomRight', offset: -5, fontSize: 10 }}
                      tick={{fontSize: 10}}
                    />
                    <YAxis 
                      yAxisId="left" 
                      label={{ value: t.currentA, angle: -90, position: 'insideLeft', fontSize: 10 }}
                      tick={{fontSize: 10}}
                    />
                    <YAxis 
                      yAxisId="right" 
                      orientation="right" 
                      label={{ value: t.powerW, angle: 90, position: 'insideRight', fontSize: 10 }}
                      tick={{fontSize: 10}}
                    />
                    <Tooltip 
                      contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '10px'}}
                      formatter={(value: any, name: string) => [value, name === 'i' ? t.currentA : t.powerW]}
                    />
                    <Line yAxisId="left" type="monotone" dataKey="i" stroke="#3b82f6" strokeWidth={3} dot={false} name="i" />
                    <Line yAxisId="right" type="monotone" dataKey="p" stroke="#ef4444" strokeWidth={2} dot={false} name="p" />
                    
                    {ivMpp && (
                      <>
                        {/* MPP Crosshair */}
                        <ReferenceLine yAxisId="left" x={ivMpp.v} stroke="#94a3b8" strokeDasharray="3 3" />
                        <ReferenceLine yAxisId="left" y={ivMpp.i} stroke="#3b82f6" strokeDasharray="3 3" opacity={0.5} />
                        <ReferenceLine yAxisId="right" y={ivMpp.p} stroke="#ef4444" strokeDasharray="3 3" opacity={0.5} />
                        
                        {/* MPP Dots */}
                        <ReferenceDot 
                          yAxisId="left" 
                          x={ivMpp.v} 
                          y={ivMpp.i} 
                          r={6} 
                          fill="#3b82f6" 
                          stroke="#fff" 
                          strokeWidth={2}
                        />
                        <ReferenceDot 
                          yAxisId="right" 
                          x={ivMpp.v} 
                          y={ivMpp.p} 
                          r={6} 
                          fill="#ef4444" 
                          stroke="#fff" 
                          strokeWidth={2}
                        />
                      </>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 text-[10px] font-bold uppercase">
                <div className="flex items-center gap-2"><span className="w-3 h-1 bg-blue-500 rounded-full"></span> {t.ivCurve}</div>
                <div className="flex items-center gap-2"><span className="w-3 h-1 bg-red-500 rounded-full"></span> {t.pvCurve}</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 bg-gray-400 rounded-full"></span> {t.mppPoint}</div>
              </div>

              {ivMpp && (
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100 text-center">
                    <p className="text-[10px] font-black text-blue-800 uppercase mb-1">Vmp (Sim)</p>
                    <p className="text-sm font-black text-blue-900">{ivMpp.v.toFixed(2)} V</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100 text-center">
                    <p className="text-[10px] font-black text-blue-800 uppercase mb-1">Imp (Sim)</p>
                    <p className="text-sm font-black text-blue-900">{ivMpp.i.toFixed(2)} A</p>
                  </div>
                  <div className="p-3 bg-red-50 rounded-2xl border border-red-100 text-center">
                    <p className="text-[10px] font-black text-red-800 uppercase mb-1">Pmax (Sim)</p>
                    <p className="text-sm font-black text-red-900">{ivMpp.p.toFixed(2)} W</p>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiodeModel;
