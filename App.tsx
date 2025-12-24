
import React, { useState, useEffect, useRef, useCallback } from 'react';
import TeacherTable from './components/TeacherTable';
import ScheduleTable from './components/ScheduleTable';
import GeminiAssistant from './components/GeminiAssistant';
import ClassTeacherSchedule from './components/ClassTeacherSchedule';
import LoginPage from './components/LoginPage';
import SettingsPanel from './components/SettingsPanel';
import { ViewMode, TeacherData, UserRole, AppSettings, AuthSettings, CalendarEvent, TeacherLeave, TeachingMaterial, TeachingJournal, Student, GradeRecord, HomeroomRecord, AttitudeRecord, TeacherAgenda } from './types';
import { TEACHER_DATA as INITIAL_DATA, INITIAL_STUDENTS, DEFAULT_SCHEDULE_MAP } from './constants';
import { Table as TableIcon, Search, Calendar, Ban, CalendarClock, Settings, Menu, LogOut, ChevronDown, BookOpen, Users, GraduationCap, ClipboardList, User, Cloud, CloudOff, RefreshCw, AlertCircle, Heart, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import { sheetApi } from './services/sheetApi';

const App: React.FC = () => {
  // --- AUTH STATE ---
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [currentUser, setCurrentUser] = useState<string>(''); 

  // --- SYNC STATE ---
  const [isCloudConfigured, setIsCloudConfigured] = useState(sheetApi.isConfigured());
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // New: Indikator sedang menyimpan
  const [lastSyncTime, setLastSyncTime] = useState<string>('-');
  const [syncError, setSyncError] = useState<string | null>(null);

  // Debounce Ref for Cloud Saving
  const saveTimeouts = useRef<Record<string, any>>({});

  // --- DATA STATES ---
  const [appSettings, setAppSettings] = useState<AppSettings>({
    academicYear: '2025/2026',
    semester: 'Genap',
    lastUpdated: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Logo_Tut_Wuri_Handayani.png/800px-Logo_Tut_Wuri_Handayani.png',
    headmaster: 'Didik Sulistyo, M.M.Pd',
    headmasterNip: '196605181989011002'
  });
  const [authSettings, setAuthSettings] = useState<AuthSettings>({ adminPassword: '', teacherPasswords: {}, classPasswords: {} });
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.TABLE);
  const [searchTerm, setSearchTerm] = useState('');
  const [teachers, setTeachers] = useState<TeacherData[]>(INITIAL_DATA);
  const [scheduleMap, setScheduleMap] = useState<Record<string, string>>(DEFAULT_SCHEDULE_MAP);
  const [unavailableConstraints, setUnavailableConstraints] = useState<Record<string, string[]>>({});
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [teacherLeaves, setTeacherLeaves] = useState<TeacherLeave[]>([]);
  const [students, setStudents] = useState<Student[]>(INITIAL_STUDENTS);
  const [teachingMaterials, setTeachingMaterials] = useState<TeachingMaterial[]>([]);
  const [teachingJournals, setTeachingJournals] = useState<TeachingJournal[]>([]);
  const [studentGrades, setStudentGrades] = useState<GradeRecord[]>([]);
  const [homeroomRecords, setHomeroomRecords] = useState<HomeroomRecord[]>([]);
  const [attitudeRecords, setAttitudeRecords] = useState<AttitudeRecord[]>([]);
  const [teacherAgendas, setTeacherAgendas] = useState<TeacherAgenda[]>([]);

  // UI STATES
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // --- PERSISTENCE HANDLERS ---
  const syncData = useCallback((key: string, value: any) => {
    // 1. Save to Local Storage (Immediate)
    localStorage.setItem(key, JSON.stringify(value));

    // 2. Save to Cloud (Debounced)
    if (isCloudConfigured) {
      setIsSaving(true); // Set status saving
      if (saveTimeouts.current[key]) {
        clearTimeout(saveTimeouts.current[key]);
      }
      
      // Debounce 0.5 detik
      saveTimeouts.current[key] = setTimeout(() => {
        sheetApi.save(key, value)
          .then(() => {
             // Cek apakah masih ada timeout lain yang berjalan
             const anyPending = Object.values(saveTimeouts.current).some((t: any) => t && t['_idleTimeout'] !== -1); 
             // Note: _idleTimeout check is internal node/browser specific, simple heuristic:
             // Kita set timer saving false setelah 1 detik idle
             setTimeout(() => setIsSaving(false), 500);
          })
          .catch(err => {
            console.error(`Failed to sync ${key}:`, err);
            setIsSaving(false);
          });
      }, 500);
    }
  }, [isCloudConfigured]);

  const handleRefreshData = useCallback(async (showNotification = true) => {
    if (!sheetApi.isConfigured()) return;
    
    setIsSyncing(true);
    setSyncError(null);
    const cloudData = await sheetApi.fetchAll();
    setIsSyncing(false);

    if (cloudData) {
        // SAFETY CHECK: Deteksi jika data cloud BENAR-BENAR kosong (Fresh Sheet)
        // Kita cek teacherData DAN students. Jika keduanya kosong, kemungkinan sheet baru/reset.
        const isCloudTeacherEmpty = !cloudData.teacherData || (Array.isArray(cloudData.teacherData) && cloudData.teacherData.length === 0);
        const isCloudStudentEmpty = !cloudData.students || (Array.isArray(cloudData.students) && cloudData.students.length === 0);
        const isLocalTeacherPopulated = teachers.length > 5; // Minimal ada data default

        // Logic Baru:
        // Jika Fetch Manual (Tombol): Selalu tanya jika data cloud terlihat kosong tapi lokal penuh.
        // Jika Silent Fetch (Startup/Focus): Percaya Cloud, KECUALI cloud benar-benar kosong total.
        
        if (isCloudTeacherEmpty && isCloudStudentEmpty && isLocalTeacherPopulated) {
           if (showNotification) {
             const confirmOverwrite = window.confirm(
               "PERINGATAN: Data di Cloud tampak KOSONG (Reset).\n\n" +
               "Apakah Anda yakin ingin menimpa data di aplikasi ini dengan data kosong dari Cloud?\n\n" +
               "Klik 'OK' untuk MENIMPA (Data lokal hilang).\n" +
               "Klik 'Cancel' untuk MEMBATALKAN (Pertahankan data lokal)."
             );
             if (!confirmOverwrite) return;
           } else {
             // Silent fetch pada data kosong total -> Abort untuk keamanan data lokal
             console.warn("Silent sync aborted: Cloud appears empty/reset.");
             return; 
           }
        }

        // Apply Data from Cloud (Source of Truth)
        if(cloudData.teacherData) setTeachers(cloudData.teacherData);
        if(cloudData.scheduleMap) setScheduleMap(cloudData.scheduleMap);
        if(cloudData.appSettings) setAppSettings(cloudData.appSettings);
        if(cloudData.authSettings) setAuthSettings(cloudData.authSettings);
        if(cloudData.unavailableConstraints) setUnavailableConstraints(cloudData.unavailableConstraints);
        if(cloudData.calendarEvents) setCalendarEvents(cloudData.calendarEvents);
        if(cloudData.teacherLeaves) setTeacherLeaves(cloudData.teacherLeaves);
        if(cloudData.students) setStudents(cloudData.students);
        if(cloudData.teachingMaterials) setTeachingMaterials(cloudData.teachingMaterials);
        if(cloudData.teachingJournals) setTeachingJournals(cloudData.teachingJournals);
        if(cloudData.studentGrades) setStudentGrades(cloudData.studentGrades);
        if(cloudData.homeroomRecords) setHomeroomRecords(cloudData.homeroomRecords);
        if(cloudData.attitudeRecords) setAttitudeRecords(cloudData.attitudeRecords);
        if(cloudData.teacherAgendas) setTeacherAgendas(cloudData.teacherAgendas);
        
        setLastSyncTime(new Date().toLocaleTimeString());
        if (showNotification) alert("Data berhasil disinkronkan dengan Cloud.");
    } else {
        setSyncError("Gagal terhubung ke Cloud.");
        if (showNotification) alert("Gagal mengambil data. Cek koneksi internet.");
    }
  }, [teachers.length]);

  // --- INITIAL DATA FETCH ---
  useEffect(() => {
    const loadInitialData = async () => {
      // 1. Ambil dari LocalStorage (Data Lokal) agar UI langsung muncul
      const keys = ['appSettings', 'teacherData', 'scheduleMap', 'authSettings', 'unavailableConstraints', 'calendarEvents', 'teacherLeaves', 'students', 'teachingMaterials', 'teachingJournals', 'studentGrades', 'homeroomRecords', 'attitudeRecords', 'teacherAgendas'];
      
      keys.forEach(key => {
        const val = localStorage.getItem(key);
        if (val) {
          const parsed = JSON.parse(val);
          if (key === 'appSettings') setAppSettings(parsed);
          if (key === 'teacherData') setTeachers(parsed);
          if (key === 'scheduleMap') setScheduleMap(parsed);
          if (key === 'authSettings') setAuthSettings(parsed);
          if (key === 'unavailableConstraints') setUnavailableConstraints(parsed);
          if (key === 'calendarEvents') setCalendarEvents(parsed);
          if (key === 'teacherLeaves') setTeacherLeaves(parsed);
          if (key === 'students') setStudents(parsed);
          if (key === 'teachingMaterials') setTeachingMaterials(parsed);
          if (key === 'teachingJournals') setTeachingJournals(parsed);
          if (key === 'studentGrades') setStudentGrades(parsed);
          if (key === 'homeroomRecords') setHomeroomRecords(parsed);
          if (key === 'attitudeRecords') setAttitudeRecords(parsed);
          if (key === 'teacherAgendas') setTeacherAgendas(parsed);
        }
      });

      // 2. Cek Konfigurasi Cloud & AMBIL DATA TERBARU
      if (sheetApi.isConfigured()) {
        setIsCloudConfigured(true);
        // Fetch silent saat startup untuk memastikan data sinkron antar device
        handleRefreshData(false);
      }
    };
    loadInitialData();
  }, [handleRefreshData]);

  // --- AUTO REFRESH ON FOCUS ---
  // Fitur ini memastikan jika user pindah tab (Laptop B) lalu kembali, data di-refresh
  useEffect(() => {
    const onFocus = () => {
        if (isCloudConfigured) {
            console.log("App focused, checking for updates...");
            handleRefreshData(false);
        }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [isCloudConfigured, handleRefreshData]);

  // --- DATA CHANGE LISTENERS (Auto Save) ---
  // Gunakan useEffect untuk mendeteksi perubahan state dan menyimpannya
  useEffect(() => { syncData('appSettings', appSettings); }, [appSettings, syncData]);
  useEffect(() => { syncData('authSettings', authSettings); }, [authSettings, syncData]);
  useEffect(() => { syncData('teacherData', teachers); }, [teachers, syncData]);
  useEffect(() => { syncData('unavailableConstraints', unavailableConstraints); }, [unavailableConstraints, syncData]);
  useEffect(() => { syncData('calendarEvents', calendarEvents); }, [calendarEvents, syncData]);
  useEffect(() => { syncData('teacherLeaves', teacherLeaves); }, [teacherLeaves, syncData]);
  useEffect(() => { syncData('students', students); }, [students, syncData]);
  useEffect(() => { syncData('teachingMaterials', teachingMaterials); }, [teachingMaterials, syncData]);
  useEffect(() => { syncData('teachingJournals', teachingJournals); }, [teachingJournals, syncData]);
  useEffect(() => { syncData('studentGrades', studentGrades); }, [studentGrades, syncData]);
  useEffect(() => { syncData('homeroomRecords', homeroomRecords); }, [homeroomRecords, syncData]);
  useEffect(() => { syncData('attitudeRecords', attitudeRecords); }, [attitudeRecords, syncData]);
  useEffect(() => { syncData('teacherAgendas', teacherAgendas); }, [teacherAgendas, syncData]);

  const handleSaveSchedule = () => {
    syncData('scheduleMap', scheduleMap);
    alert("Jadwal disimpan ke Lokal & Cloud!");
  };

  // --- EVENT LISTENERS UI ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- HANDLERS ---
  const handleLogin = (role: UserRole, username?: string) => {
    setUserRole(role);
    if (username) setCurrentUser(username);
    setViewMode(role === 'ADMIN' ? ViewMode.TABLE : ViewMode.CLASS_SCHEDULE);
    
    // Refresh data saat login untuk memastikan user mendapat data terbaru
    if (sheetApi.isConfigured()) {
        handleRefreshData(false);
    }
  };

  const handleLogout = () => { setUserRole(null); setCurrentUser(''); setIsMenuOpen(false); };

  if (!userRole) return <LoginPage onLogin={handleLogin} authSettings={authSettings} teacherData={teachers} />;

  const navOptions = [
    ...(userRole === 'ADMIN' ? [
        { mode: ViewMode.TABLE, label: 'Data Tugas Guru', icon: <TableIcon size={18} /> },
        { mode: ViewMode.SCHEDULE, label: 'Edit Jadwal', icon: <Calendar size={18} /> },
        { mode: ViewMode.CLASS_SCHEDULE, label: 'Lihat Jadwal Kelas', icon: <CalendarClock size={18} /> },
        { mode: ViewMode.TEACHER_SCHEDULE, label: 'Lihat Jadwal Guru', icon: <User size={18} /> },
        { mode: ViewMode.JOURNAL, label: 'Jurnal (Admin)', icon: <BookOpen size={18} /> },
        { mode: ViewMode.SETTINGS, label: 'Pengaturan', icon: <Settings size={18} /> },
    ] : []),
    ...(userRole === 'TEACHER' ? [
        { mode: ViewMode.CLASS_SCHEDULE, label: 'Jadwal Kelas', icon: <Calendar size={18} /> },
        { mode: ViewMode.TEACHER_SCHEDULE, label: 'Jadwal Guru', icon: <User size={18} /> },
        { mode: ViewMode.JOURNAL, label: 'Jurnal Mengajar', icon: <BookOpen size={18} /> },
        { mode: ViewMode.AGENDA, label: 'Agenda Kegiatan', icon: <FileText size={18} /> },
        { mode: ViewMode.ATTITUDE, label: 'Penilaian Sikap', icon: <Heart size={18} /> },
        { mode: ViewMode.MONITORING, label: 'Absensi', icon: <Users size={18} /> },
        { mode: ViewMode.GRADES, label: 'Nilai Siswa', icon: <GraduationCap size={18} /> },
        { mode: ViewMode.HOMEROOM, label: 'Catatan Wali Kelas', icon: <ClipboardList size={18} /> },
    ] : [])
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-24">
            <div className="flex items-center gap-4">
              <img src={appSettings.logoUrl} alt="Logo" className="h-20 w-auto object-contain" onError={e => e.currentTarget.src = "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Logo_Tut_Wuri_Handayani.png/800px-Logo_Tut_Wuri_Handayani.png"} />
              <div>
                <h1 className="text-lg font-extrabold text-gray-900 leading-none">Sistem Pembagian Tugas</h1>
                <h2 className="text-base font-bold text-indigo-700 leading-tight mt-1">SMPN 3 Pacet</h2>
                <div className="flex flex-col mt-1">
                   <p className="text-[10px] text-gray-500 font-bold uppercase">Semester {appSettings.semester} • TA {appSettings.academicYear}</p>
                   {isCloudConfigured ? (
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-1 mt-1 text-[10px] font-bold ${syncError ? 'text-red-500' : 'text-green-600'}`}>
                           {syncError ? <AlertCircle size={10}/> : <Cloud size={10} />}
                           <span>{isSyncing ? 'Mengambil Data...' : syncError ? 'Gagal Sync' : 'Terhubung Cloud'}</span>
                        </div>
                        {isSaving && (
                           <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-orange-500 animate-pulse">
                              <Loader2 size={10} className="animate-spin" />
                              <span>Menyimpan...</span>
                           </div>
                        )}
                      </div>
                   ) : (
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-400 font-bold"><CloudOff size={10} /><span>Lokal Only</span></div>
                   )}
                </div>
              </div>
            </div>
            
            <div className="relative" ref={menuRef}>
               <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center gap-3 px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-all shadow-sm group">
                  <div className="hidden md:block text-right">
                    <p className="text-xs font-bold text-gray-800">Navigasi</p>
                    <p className="text-[10px] text-gray-500 capitalize">{userRole === 'ADMIN' ? 'Admin' : currentUser}</p>
                  </div>
                  <div className="bg-indigo-600 text-white p-2 rounded-lg"><Menu size={20} /></div>
               </button>

               {isMenuOpen && (
                 <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50">
                    <div className="p-2 space-y-1">
                       {navOptions.map((opt, idx) => (
                         <button key={idx} onClick={() => { setViewMode(opt.mode); setIsMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-3 text-sm font-bold rounded-lg transition-colors ${viewMode === opt.mode ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                           {opt.icon} {opt.label}
                         </button>
                       ))}
                    </div>
                    {isCloudConfigured && (
                       <div className="p-2 border-t border-gray-100 bg-gray-50/50">
                          <button onClick={() => { handleRefreshData(); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-green-700 hover:bg-green-100 rounded-lg">
                             <RefreshCw size={18} className={isSyncing ? "animate-spin" : ""} /> Update Data Cloud
                          </button>
                          <p className="text-[9px] text-center text-gray-400 mt-1">Terakhir: {lastSyncTime}</p>
                       </div>
                    )}
                    <div className="p-2 border-t border-gray-100 bg-red-50">
                       <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-100 rounded-lg"><LogOut size={18} /> Keluar</button>
                    </div>
                 </div>
               )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {viewMode === ViewMode.TABLE && (
           <div className="mb-6 max-w-md"><div className="relative"><Search className="absolute inset-y-0 left-0 pl-3 flex items-center h-full text-gray-400" size={20} /><input type="text" placeholder="Cari data..." className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div></div>
        )}

        <div className="animate-fade-in">
          {viewMode === ViewMode.TABLE && userRole === 'ADMIN' && <TeacherTable data={teachers} searchTerm={searchTerm} onAdd={t => setTeachers([...teachers, t])} onEdit={t => setTeachers(teachers.map(x => x.id === t.id ? t : x))} onDelete={id => setTeachers(teachers.filter(x => x.id !== id))} appSettings={appSettings} />}
          {viewMode === ViewMode.SCHEDULE && userRole === 'ADMIN' && <ScheduleTable teacherData={teachers} unavailableConstraints={unavailableConstraints} scheduleMap={scheduleMap} setScheduleMap={setScheduleMap} onSave={handleSaveSchedule} />}
          {(viewMode === ViewMode.CLASS_SCHEDULE || viewMode === ViewMode.TEACHER_SCHEDULE || viewMode === ViewMode.JOURNAL || viewMode === ViewMode.MONITORING || viewMode === ViewMode.GRADES || viewMode === ViewMode.HOMEROOM || viewMode === ViewMode.ATTITUDE || viewMode === ViewMode.AGENDA) && (
             <ClassTeacherSchedule 
                teacherData={teachers} 
                scheduleMap={scheduleMap} 
                currentUser={currentUser} 
                role={userRole} 
                appSettings={appSettings} 
                students={students} 
                teachingMaterials={teachingMaterials} 
                onAddMaterial={m => setTeachingMaterials([...teachingMaterials, m])} 
                onEditMaterial={m => setTeachingMaterials(teachingMaterials.map(x => x.id === m.id ? m : x))} 
                onDeleteMaterial={id => setTeachingMaterials(teachingMaterials.filter(x => x.id !== id))} 
                teachingJournals={teachingJournals} 
                onAddJournal={j => setTeachingJournals([...teachingJournals, j])} 
                onEditJournal={j => setTeachingJournals(teachingJournals.map(x => x.id === j.id ? j : x))} 
                onDeleteJournal={id => setTeachingJournals(teachingJournals.filter(x => x.id !== id))} 
                studentGrades={studentGrades} 
                onUpdateGrade={g => setStudentGrades(prev => prev.find(x => x.id === g.id) ? prev.map(x => x.id === g.id ? g : x) : [...prev, g])} 
                homeroomRecords={homeroomRecords} 
                onAddHomeroomRecord={r => setHomeroomRecords([...homeroomRecords, r])} 
                onEditHomeroomRecord={r => setHomeroomRecords(homeroomRecords.map(x => x.id === r.id ? r : x))} 
                onDeleteHomeroomRecord={id => setHomeroomRecords(homeroomRecords.filter(x => x.id !== id))} 
                attitudeRecords={attitudeRecords}
                onAddAttitudeRecord={r => setAttitudeRecords([...attitudeRecords, r])}
                onEditAttitudeRecord={r => setAttitudeRecords(attitudeRecords.map(x => x.id === r.id ? r : x))}
                onDeleteAttitudeRecord={id => setAttitudeRecords(attitudeRecords.filter(x => x.id !== id))}
                teacherAgendas={teacherAgendas}
                onAddAgenda={a => setTeacherAgendas([...teacherAgendas, a])}
                onEditAgenda={a => setTeacherAgendas(teacherAgendas.map(x => x.id === a.id ? a : x))}
                onDeleteAgenda={id => setTeacherAgendas(teacherAgendas.filter(x => x.id !== id))}
                initialTab={viewMode === ViewMode.JOURNAL ? 'JOURNAL' : viewMode === ViewMode.MONITORING ? 'MONITORING' : viewMode === ViewMode.GRADES ? 'GRADES' : viewMode === ViewMode.HOMEROOM ? 'HOMEROOM' : viewMode === ViewMode.ATTITUDE ? 'ATTITUDE' : viewMode === ViewMode.TEACHER_SCHEDULE ? 'TEACHER' : viewMode === ViewMode.AGENDA ? 'AGENDA' : 'CLASS'} 
             />
          )}
          {viewMode === ViewMode.SETTINGS && userRole === 'ADMIN' && <SettingsPanel settings={appSettings} onSave={setAppSettings} authSettings={authSettings} onSaveAuth={setAuthSettings} teacherData={teachers} teacherLeaves={teacherLeaves} onToggleLeave={l => setTeacherLeaves([...teacherLeaves, {...l, id: Date.now().toString()}])} onEditLeave={l => setTeacherLeaves(teacherLeaves.map(x => x.id === l.id ? l : x))} onDeleteLeave={id => setTeacherLeaves(teacherLeaves.filter(x => x.id !== id))} calendarEvents={calendarEvents} onUpdateCalendar={setCalendarEvents} unavailableConstraints={unavailableConstraints} onToggleConstraint={(c, d) => setUnavailableConstraints(prev => ({ ...prev, [c]: (prev[c] || []).includes(d) ? prev[c].filter(x => x !== d) : [...(prev[c] || []), d] }))} students={students} onAddStudent={s => setStudents([...students, s])} onEditStudent={s => setStudents(students.map(x => x.id === s.id ? s : x))} onDeleteStudent={id => setStudents(students.filter(x => x.id !== id))} onBulkAddStudents={s => setStudents([...students, ...s])} />}
        </div>
      </main>

      {userRole === 'ADMIN' && <GeminiAssistant teacherData={teachers} />}
    </div>
  );
};

export default App;
