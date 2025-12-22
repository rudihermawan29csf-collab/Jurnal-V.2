import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Filter, ChevronDown, AlertTriangle, MonitorCheck, Save, Download, FileText, FileSpreadsheet, Upload, FileUp } from 'lucide-react';
import { TeacherData, ClassHours } from '../types';
import { SCHEDULE_DATA, CLASSES, COLOR_PALETTE } from '../constants';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface ScheduleTableProps {
  teacherData: TeacherData[];
  unavailableConstraints?: Record<string, string[]>;
  scheduleMap: Record<string, string>;
  setScheduleMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSave: () => void;
}

const ScheduleTable: React.FC<ScheduleTableProps> = ({ 
  teacherData, 
  unavailableConstraints = {},
  scheduleMap,
  setScheduleMap,
  onSave
}) => {
  const [activeDayIndex, setActiveDayIndex] = useState(0);

  // Filter state
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Download/Upload Refs
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
        setIsDownloadMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Generate unique codes list for Filter
  const allCodes = useMemo(() => {
    return Array.from(new Set(teacherData.map(t => t.code))).sort();
  }, [teacherData]);

  const classEligibleCodes = useMemo(() => {
    const map: Record<string, {code: string, name: string}[]> = {};
    CLASSES.forEach((cls: string) => {
      const [grade, letter] = cls.split(' ');
      const eligible = teacherData.filter((t: TeacherData) => {
        let hoursObj: ClassHours | undefined;
        if (grade === 'VII') hoursObj = t.hoursVII;
        else if (grade === 'VIII') hoursObj = t.hoursVIII;
        else if (grade === 'IX') hoursObj = t.hoursIX;
        if (!hoursObj) return false;
        const hours = hoursObj[letter];
        return typeof hours === 'number' && hours > 0;
      }).map((t: TeacherData) => ({ code: t.code, name: t.name }));
      map[cls] = eligible.sort((a, b) => a.code.localeCompare(b.code));
    });
    return map;
  }, [teacherData]);

  const codeColorMap = useMemo(() => {
    const uniqueNames: string[] = Array.from(new Set(teacherData.map(t => t.name)));
    const nameToColor: Record<string, string> = {};
    uniqueNames.forEach((name, index) => {
      nameToColor[name] = COLOR_PALETTE[index % COLOR_PALETTE.length];
    });
    const codeMap: Record<string, string> = {};
    teacherData.forEach(t => {
      codeMap[t.code] = nameToColor[t.name];
    });
    return codeMap;
  }, [teacherData]);

  const getHexColor = (tailwindClassStr: string) => {
    if (tailwindClassStr.includes('red')) return '#fee2e2';
    if (tailwindClassStr.includes('orange')) return '#ffedd5';
    if (tailwindClassStr.includes('amber')) return '#fef3c7';
    if (tailwindClassStr.includes('yellow')) return '#fef9c3';
    if (tailwindClassStr.includes('lime')) return '#ecfccb';
    if (tailwindClassStr.includes('green')) return '#dcfce7';
    if (tailwindClassStr.includes('emerald')) return '#d1fae5';
    if (tailwindClassStr.includes('teal')) return '#ccfbf1';
    if (tailwindClassStr.includes('cyan')) return '#cffafe';
    if (tailwindClassStr.includes('sky')) return '#e0f2fe';
    if (tailwindClassStr.includes('blue')) return '#dbeafe';
    if (tailwindClassStr.includes('indigo')) return '#e0e7ff';
    if (tailwindClassStr.includes('violet')) return '#ede9fe';
    if (tailwindClassStr.includes('purple')) return '#f3e8ff';
    if (tailwindClassStr.includes('fuchsia')) return '#fae8ff';
    if (tailwindClassStr.includes('pink')) return '#fce7f3';
    if (tailwindClassStr.includes('rose')) return '#ffe4e6';
    if (tailwindClassStr.includes('stone')) return '#e7e5e4';
    return '#f3f4f6';
  };

  const codeToTeacherMap = useMemo(() => {
    const map: Record<string, string> = {};
    teacherData.forEach(t => { map[t.code] = t.name; });
    return map;
  }, [teacherData]);

  const teacherUsage = useMemo(() => {
    const usage: Record<string, Record<string, number>> = {};
    teacherData.forEach(t => {
      usage[t.code] = {};
      CLASSES.forEach(c => usage[t.code][c] = 0);
    });
    Object.entries(scheduleMap).forEach(([key, code]) => {
      if (!code || typeof code !== 'string') return;
      const foundClass = CLASSES.find(c => key.endsWith(c));
      if (foundClass) {
         if (!usage[code]) usage[code] = {};
         usage[code][foundClass] = (usage[code][foundClass] || 0) + 1;
      }
    });
    return usage;
  }, [scheduleMap, teacherData]);

  const getHoursStatus = (teacher: TeacherData, fullClassName: string) => {
    const [grade, letter] = fullClassName.split(' ');
    let targetHours = 0;
    if (grade === 'VII') targetHours = teacher.hoursVII?.[letter] || 0;
    else if (grade === 'VIII') targetHours = teacher.hoursVIII?.[letter] || 0;
    else if (grade === 'IX') targetHours = teacher.hoursIX?.[letter] || 0;
    const used = teacherUsage[teacher.code]?.[fullClassName] || 0;
    return { target: targetHours, used, remaining: targetHours - used };
  };

  const activeSchedule = SCHEDULE_DATA[activeDayIndex];

  const handleCellChange = (jam: string, cls: string, code: string) => {
    const key = `${activeSchedule.day}-${jam}-${cls}`;
    setScheduleMap(prev => {
      if (!code) {
        const newState = { ...prev };
        delete newState[key];
        return newState;
      }
      return { ...prev, [key]: code };
    });
  };

  // --- DOWNLOAD TEMPLATE HANDLER ---
  const handleDownloadTemplate = () => {
    const data: any[] = [];
    SCHEDULE_DATA.forEach(day => {
      day.rows.forEach(row => {
        if (row.activity) return; // Skip non-teaching rows in template
        const rowData: any = {
          'Hari': day.day,
          'Jam': row.jam,
          'Waktu': row.waktu,
        };
        CLASSES.forEach(cls => {
          const key = `${day.day}-${row.jam}-${cls}`;
          rowData[cls] = scheduleMap[key] || '';
        });
        data.push(rowData);
      });
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Jadwal");
    XLSX.writeFile(wb, "Template_Jadwal_Pelajaran.xlsx");
  };

  // --- UPLOAD HANDLER ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];

      const newScheduleMap: Record<string, string> = { ...scheduleMap };

      data.forEach(row => {
        const hari = row['Hari'];
        const jam = row['Jam'];
        if (!hari || !jam) return;

        CLASSES.forEach(cls => {
          if (row[cls] !== undefined) {
            const code = String(row[cls]).trim().toUpperCase();
            const key = `${hari}-${jam}-${cls}`;
            if (code === '' || code === 'KOSONG' || code === '-') {
              delete newScheduleMap[key];
            } else {
              // Optional: Validasi apakah kode ada di teacherData
              newScheduleMap[key] = code;
            }
          }
        });
      });

      setScheduleMap(newScheduleMap);
      alert("Jadwal berhasil diupdate dari file!");
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(14);
    doc.text('Master Jadwal Pelajaran - SMPN 3 Pacet', 14, 15);
    doc.setFontSize(10);
    doc.text('Semester Genap Tahun Ajaran 2025/2026', 14, 21);
    let finalY = 25;
    SCHEDULE_DATA.forEach(day => {
        if (finalY > 250) { doc.addPage(); finalY = 15; }
        doc.setFontSize(12);
        doc.setTextColor(79, 70, 229);
        doc.text(`HARI: ${day.day}`, 14, finalY + 5);
        const head = [['Jam', 'Waktu', ...CLASSES]];
        const body = day.rows.map(row => {
            if (row.activity) {
                return [row.jam, row.waktu, { content: row.activity, colSpan: CLASSES.length, styles: { halign: 'center', fillColor: [255, 237, 213], textColor: [154, 52, 18] } }];
            }
            const cells = CLASSES.map(cls => scheduleMap[`${day.day}-${row.jam}-${cls}`] || '');
            return [row.jam, row.waktu, ...cells];
        });
        autoTable(doc, {
            startY: finalY + 8,
            head: head,
            body: body as any,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 1, halign: 'center' },
            headStyles: { fillColor: [55, 65, 81], textColor: 255 },
            columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 22 } }
        });
        finalY = (doc as any).lastAutoTable.finalY + 10;
    });
    doc.save('Master_Jadwal_Pelajaran.pdf');
    setIsDownloadMenuOpen(false);
  };

  const handleDownloadExcel = () => {
    const data: any[] = [];
    SCHEDULE_DATA.forEach(day => {
        day.rows.forEach(row => {
            const rowData: any = { 'Hari': day.day, 'Jam': row.jam, 'Waktu': row.waktu };
            if (row.activity) {
                rowData['Kegiatan'] = row.activity;
                CLASSES.forEach(cls => rowData[cls] = row.activity);
            } else {
                CLASSES.forEach(cls => { rowData[cls] = scheduleMap[`${day.day}-${row.jam}-${cls}`] || ''; });
            }
            data.push(rowData);
        });
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jadwal Master");
    XLSX.writeFile(wb, "Master_Jadwal_Pelajaran.xlsx");
    setIsDownloadMenuOpen(false);
  };

  const conflicts = useMemo(() => {
    let crossClassCount = 0;
    let sameTeacherDiffSubjectCount = 0;
    const day = activeSchedule.day;
    activeSchedule.rows.forEach(row => {
      if(row.activity) return;
      CLASSES.forEach(cls => {
        const code = scheduleMap[`${day}-${row.jam}-${cls}`];
        if(!code) return;
        const teacherName = codeToTeacherMap[code];
        const hasConflict = CLASSES.some(otherCls => {
          if (otherCls === cls) return false;
          const otherCode = scheduleMap[`${day}-${row.jam}-${otherCls}`];
          if (!otherCode) return false;
          return codeToTeacherMap[otherCode] === teacherName;
        });
        if (hasConflict) crossClassCount++;
      });
    });
    CLASSES.forEach(cls => {
      const teachersInClass = new Map<string, string>();
      activeSchedule.rows.forEach(row => {
        if(row.activity) return;
        const code = scheduleMap[`${day}-${row.jam}-${cls}`];
        if(code) {
          const tName = codeToTeacherMap[code];
          if(teachersInClass.has(tName)) {
            if(teachersInClass.get(tName) !== code) sameTeacherDiffSubjectCount++;
          } else { teachersInClass.set(tName, code); }
        }
      });
    });
    return { crossClassCount, sameTeacherDiffSubjectCount };
  }, [scheduleMap, activeSchedule, codeToTeacherMap]);

  return (
    <div className="flex flex-col gap-8">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full animate-fade-in">
        <div className="flex flex-col md:flex-row border-b border-gray-200 bg-gray-50 items-center justify-between gap-2 md:gap-0">
          <div className="flex overflow-x-auto w-full md:w-auto custom-scrollbar">
            {SCHEDULE_DATA.map((d, idx) => (
              <button
                key={d.day}
                onClick={() => setActiveDayIndex(idx)}
                className={`px-6 py-4 text-sm font-bold tracking-wide whitespace-nowrap transition-colors ${
                  idx === activeDayIndex ? 'bg-white text-indigo-600 border-t-2 border-t-indigo-600 border-r border-gray-200 -mb-px' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border-r border-gray-200'
                }`}
              >
                {d.day}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 p-2 pr-4 w-full md:w-auto">
              <button onClick={onSave} className="flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm mr-2"><Save size={16} /><span className="hidden md:inline">Simpan</span></button>

              {/* Upload Button */}
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm mr-2"
              >
                <Upload size={16} />
                <span className="hidden md:inline">Upload Jadwal</span>
              </button>

              <div className="relative" ref={downloadMenuRef}>
                 <button onClick={() => setIsDownloadMenuOpen(!isDownloadMenuOpen)} className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border bg-white border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors shadow-sm mr-2">
                   <Download size={16} /><span className="hidden md:inline">Download</span><ChevronDown size={14} className={`transition-transform ${isDownloadMenuOpen ? 'rotate-180' : ''}`} />
                 </button>
                 {isDownloadMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden animate-fade-in">
                       <button onClick={handleDownloadTemplate} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 text-left border-b border-gray-100"><FileSpreadsheet size={16} className="text-emerald-600" /> Download Template</button>
                       <button onClick={handleDownloadPDF} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 text-left border-b border-gray-100"><FileText size={16} className="text-red-500" /> Master PDF</button>
                       <button onClick={handleDownloadExcel} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 text-left"><FileSpreadsheet size={16} className="text-green-600" /> Master Excel</button>
                    </div>
                 )}
              </div>

              <div className="relative" ref={filterRef}>
                <button onClick={() => setIsFilterOpen(!isFilterOpen)} className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border transition-all ${selectedCodes.length > 0 ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}><Filter size={16} /><span className="hidden md:inline">Filter</span>{selectedCodes.length > 0 && <span className="ml-1 bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">{selectedCodes.length}</span>}<ChevronDown size={14} className={`transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} /></button>
                {isFilterOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden animate-fade-in">
                        <div className="p-2 border-b border-gray-100 flex justify-between items-center bg-gray-50"><span className="text-xs font-bold text-gray-500">Filter Mapel</span>{selectedCodes.length > 0 && <button onClick={() => setSelectedCodes([])} className="text-[10px] text-red-500 hover:underline">Reset</button>}</div>
                        <div className="max-h-60 overflow-y-auto p-2 space-y-1 custom-scrollbar">{allCodes.map(code => (<label key={code} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"><input type="checkbox" checked={selectedCodes.includes(code)} onChange={() => setSelectedCodes(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code])} className="rounded text-indigo-600 focus:ring-indigo-500"/><span className="text-sm text-gray-700 font-mono">{code}</span></label>))}</div>
                    </div>
                )}
              </div>
          </div>
        </div>

        {(conflicts.crossClassCount > 0 || conflicts.sameTeacherDiffSubjectCount > 0) && (
            <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center justify-center gap-2 text-sm text-red-700 font-medium animate-pulse"><AlertTriangle size={18} /><span>Perhatian: Ditemukan {conflicts.crossClassCount > 0 && ` ${conflicts.crossClassCount} bentrok jadwal`} {(conflicts.crossClassCount > 0 && conflicts.sameTeacherDiffSubjectCount > 0) && ' dan '} {conflicts.sameTeacherDiffSubjectCount > 0 && ` ${conflicts.sameTeacherDiffSubjectCount} guru mengajar >1 mapel di kelas sama`}!</span></div>
        )}

        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-12 border-r border-gray-200 bg-gray-50">Jam</th>
                <th className="px-3 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-24 border-r border-gray-200 bg-gray-50">Waktu</th>
                {CLASSES.map(cls => (<th key={cls} className="px-2 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider min-w-[120px] border-r border-gray-200 bg-gray-50">{cls}</th>))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {activeSchedule.rows.map((row, rowIdx) => {
                if (row.activity) {
                  return (
                    <tr key={`activity-${rowIdx}`} className="bg-orange-50/50"><td className="px-3 py-3 text-center font-bold text-gray-500 border-r border-gray-100 text-xs">{row.jam}</td><td className="px-3 py-3 text-center text-gray-500 font-mono text-[10px] border-r border-gray-100">{row.waktu}</td><td colSpan={CLASSES.length} className="px-4 py-3 text-center text-sm font-bold text-orange-800 tracking-wide uppercase">{row.activity}</td></tr>
                  );
                }
                return (
                  <tr key={row.jam} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-3 text-center font-bold text-gray-700 border-r border-gray-100 text-sm">{row.jam}</td>
                    <td className="px-3 py-3 text-center text-gray-500 font-mono text-[10px] border-r border-gray-100 whitespace-nowrap">{row.waktu}</td>
                    {CLASSES.map(cls => {
                      const currentCode = scheduleMap[`${activeSchedule.day}-${row.jam}-${cls}`] || "";
                      const currentTeacherName = currentCode ? codeToTeacherMap[currentCode] : "";
                      let isConflict = false;
                      if (currentTeacherName) {
                        CLASSES.forEach(otherCls => {
                            if (otherCls === cls) return;
                            if (codeToTeacherMap[scheduleMap[`${activeSchedule.day}-${row.jam}-${otherCls}`]] === currentTeacherName) isConflict = true;
                        });
                      }
                      const colorClass = currentCode ? (isConflict ? 'bg-red-500 text-white' : codeColorMap[currentCode]) : '';
                      const isDimmed = selectedCodes.length > 0 && currentCode && !selectedCodes.includes(currentCode);
                      return (
                        <td key={cls} className="p-1 border-r border-gray-100 relative h-12 min-w-[120px]">
                           <div className={`w-full h-full relative rounded flex items-center justify-center ${colorClass} ${isDimmed ? 'opacity-20' : ''}`}>
                             <span className="text-xs font-bold z-0 pointer-events-none truncate px-1">{currentCode}</span>
                             {isConflict && <div className="absolute top-0 right-0 p-0.5 text-white bg-red-600 rounded-bl"><AlertTriangle size={10} /></div>}
                             <select value={currentCode} onChange={(e) => handleCellChange(row.jam, cls, e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-xs">
                               <option value="">- Kosong -</option>
                               {classEligibleCodes[cls]?.map(item => {
                                 const { remaining } = getHoursStatus(teacherData.find(t => t.code === item.code)!, cls);
                                 if (remaining <= 0 && currentCode !== item.code) return null;
                                 if (unavailableConstraints[item.code]?.includes(activeSchedule.day) && currentCode !== item.code) return null;
                                 return (<option key={item.code} value={item.code} style={{ backgroundColor: getHexColor(codeColorMap[item.code] || 'bg-gray-100') }}>{item.code} (Sisa: {remaining}) - {item.name}</option>);
                               })}
                             </select>
                           </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in-up">
         <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between"><h3 className="font-bold text-slate-800 flex items-center gap-2"><MonitorCheck size={20} className="text-slate-600" />Monitoring Beban Mengajar (Sisa Jam)</h3></div>
         <div className="overflow-x-auto max-h-[300px]">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
               <thead className="bg-white sticky top-0 shadow-sm"><tr><th className="px-4 py-3 text-left font-bold text-gray-500 w-12 bg-gray-50">No</th><th className="px-4 py-3 text-left font-bold text-gray-500 w-64 bg-gray-50">Nama Guru</th><th className="px-4 py-3 text-center font-bold text-gray-500 w-24 bg-gray-50">Kode</th>{CLASSES.map(cls => (<th key={cls} className="px-2 py-3 text-center font-bold text-gray-500 bg-gray-50 text-xs">{cls}</th>))}</tr></thead>
               <tbody className="divide-y divide-gray-200">
                  {teacherData.map((teacher) => (
                     <tr key={teacher.id} className="hover:bg-slate-50"><td className="px-4 py-2 text-gray-400">{teacher.no}</td><td className="px-4 py-2 font-medium text-gray-800">{teacher.name}</td><td className="px-4 py-2 text-center"><span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-bold border ${codeColorMap[teacher.code]}`}>{teacher.code}</span></td>{CLASSES.map(cls => { const { remaining, target } = getHoursStatus(teacher, cls); let color = "text-gray-400"; if (target > 0) { if (remaining > 0) color = "text-slate-800 font-bold"; else if (remaining === 0) color = "text-green-600 font-bold bg-green-50 rounded px-1"; else color = "text-red-600 font-bold bg-red-50 rounded px-1"; } return (<td key={cls} className="px-2 py-2 text-center text-xs border-l border-gray-100"><span className={color}>{remaining}</span></td>); })}</tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};

export default ScheduleTable;