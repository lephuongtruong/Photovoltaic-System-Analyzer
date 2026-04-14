import React, { useState, useEffect, useContext } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { LanguageContext } from '../App';
import { SimulationRecord, ModelType } from '../types';
import { motion, AnimatePresence } from 'motion/react';

const SimulationHistory: React.FC = () => {
  const { t, user, lang, setSelectedSimulation, setActiveTab } = useContext(LanguageContext);
  const [history, setHistory] = useState<SimulationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setHistory([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'simulations'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records: SimulationRecord[] = [];
      snapshot.forEach((doc) => {
        records.push({ id: doc.id, ...doc.data() } as SimulationRecord);
      });
      setHistory(records);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching history:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleLoad = (record: SimulationRecord) => {
    setSelectedSimulation(record);
    setActiveTab(record.modelType);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t.confirmDelete)) return;
    try {
      await deleteDoc(doc(db, 'simulations', id));
    } catch (error) {
      console.error("Error deleting record:", error);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-white rounded-[40px] shadow-sm border border-gray-100">
        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-3xl text-blue-500 mb-6">
          <i className="fas fa-lock"></i>
        </div>
        <h3 className="text-2xl font-black text-blue-900 mb-2">
          {lang === 'vi' ? 'Yêu cầu đăng nhập' : 'Login Required'}
        </h3>
        <p className="text-gray-500 text-center max-w-md">
          {lang === 'vi' 
            ? 'Vui lòng đăng nhập để xem và lưu lịch sử mô phỏng của bạn.' 
            : 'Please login to view and save your simulation history.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-blue-900 uppercase tracking-tight">{t.history}</h2>
          <p className="text-gray-500">{lang === 'vi' ? 'Quản lý các bản mô phỏng đã thực hiện' : 'Manage your past simulations'}</p>
        </div>
        <div className="bg-blue-50 px-4 py-2 rounded-2xl border border-blue-100">
          <span className="text-blue-700 font-bold">{history.length}</span>
          <span className="text-blue-500 text-xs ml-2 uppercase font-black">{lang === 'vi' ? 'Bản ghi' : 'Records'}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-20">
          <i className="fas fa-circle-notch animate-spin text-4xl text-blue-500"></i>
        </div>
      ) : history.length === 0 ? (
        <div className="bg-white p-20 rounded-[40px] text-center border border-dashed border-gray-300">
          <i className="fas fa-history text-5xl text-gray-200 mb-6 block"></i>
          <p className="text-gray-400 font-medium">
            {lang === 'vi' ? 'Chưa có lịch sử mô phỏng nào.' : 'No simulation history found.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <AnimatePresence mode="popLayout">
            {history.map((record) => (
              <motion.div
                key={record.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${
                    record.modelType === ModelType.DIODE ? 'bg-blue-600' :
                    record.modelType === ModelType.TEMPERATURE ? 'bg-orange-500' :
                    record.modelType === ModelType.PR ? 'bg-indigo-500' : 
                    record.modelType === ModelType.ANALYSIS ? 'bg-emerald-500' : 'bg-violet-500'
                  }`}>
                    <i className={`fas ${
                      record.modelType === ModelType.DIODE ? 'fa-microchip' :
                      record.modelType === ModelType.TEMPERATURE ? 'fa-thermometer-half' :
                      record.modelType === ModelType.PR ? 'fa-chart-bar' : 
                      record.modelType === ModelType.ANALYSIS ? 'fa-chart-line' : 'fa-calculator'
                    }`}></i>
                  </div>
                  <div>
                    <h4 className="font-black text-blue-900 uppercase text-sm tracking-tight">
                      {record.projectName || (record.modelType === ModelType.DIODE ? t.diodeModel :
                       record.modelType === ModelType.TEMPERATURE ? t.tempModel :
                       record.modelType === ModelType.PR ? t.prModel : 
                       record.modelType === ModelType.ANALYSIS ? t.analysis : t.liuJordan)}
                    </h4>
                    <p className="text-xs text-gray-400">
                      {record.modelType === ModelType.DIODE ? t.diodeModel :
                       record.modelType === ModelType.TEMPERATURE ? t.tempModel :
                       record.modelType === ModelType.PR ? t.prModel : 
                       record.modelType === ModelType.ANALYSIS ? t.analysis : t.liuJordan} • {record.timestamp ? record.timestamp.toDate().toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US') : 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 items-center">
                  <div className="px-4 py-2 bg-gray-50 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase leading-none mb-1">
                      {t.annualYield}
                    </p>
                    <p className="font-black text-blue-700">
                      {(() => {
                        const res = record.results;
                        if (!res) return '0';
                        // Handle new full result objects
                        const val = res.totalMonthly ?? res.totalValue ?? res.annualTotal ?? res.yield_Temp ?? res.metrics?.totalE ?? 0;
                        return typeof val === 'number' ? val.toLocaleString('en-US', {useGrouping: false}) : '0';
                      })()} <span className="text-[10px]">kWh</span>
                    </p>
                  </div>
                  
                  <div className="px-4 py-2 bg-gray-50 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase leading-none mb-1">
                      {t.capacity}
                    </p>
                    <p className="font-black text-gray-700">
                      {record.inputs.pTotalKw || record.inputs.totalPower || (record.inputs.panelArea * record.inputs.efficiency) || 'N/A'} <span className="text-[10px]">kWp</span>
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleLoad(record)}
                      className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all flex items-center justify-center gap-2 text-xs font-bold"
                    >
                      <i className="fas fa-external-link-alt"></i> {t.loadProject}
                    </button>
                    <button
                      onClick={() => handleDelete(record.id!)}
                      className="w-10 h-10 rounded-xl bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center"
                    >
                      <i className="fas fa-trash-alt"></i>
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default SimulationHistory;
