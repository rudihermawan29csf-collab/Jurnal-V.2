
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Download, PenTool, BookOpen, Plus, X, List, Edit2, Filter, ChevronDown,
  User, Users, Calendar, Layout, Search, GraduationCap, ClipboardList, Trash2, FileSpreadsheet, Heart, CheckCircle2, AlertCircle, Save, Check, UserMinus, Printer, FileText, Clock, Sparkles
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { 
  TeacherData, AppSettings, CalendarEvent, TeacherLeave, 
  TeachingMaterial, TeachingJournal, Student, UserRole, GradeRecord, HomeroomRecord, ChapterGrade, AttitudeRecord, TeacherAgenda
} from '../types';
import { CLASSES, SCHEDULE_DATA } from '../constants';

interface ClassTeacherScheduleProps {
  teacherData: TeacherData[];
  scheduleMap: Record<string, string>;
  currentUser: string;
  role: UserRole;
  appSettings: AppSettings;
  calendarEvents?: CalendarEvent[];
  teacherLeaves?: TeacherLeave[];
  students?: Student[];
  teachingMaterials?: TeachingMaterial[];
  onAddMaterial?: (material: TeachingMaterial) => void;
  onEditMaterial?: (material: TeachingMaterial) => void;
  onDeleteMaterial?: (id: string) => void;
  teachingJournals?: TeachingJournal[];
  onAddJournal?: (journal: TeachingJournal) => void;
  onEditJournal?: (journal: TeachingJournal) => void;
  onDeleteJournal?: (id: string) => void;
  studentGrades?: GradeRecord[];
  onUpdateGrade?: (grade: GradeRecord) => void;
  homeroomRecords?: HomeroomRecord[];
  onAddHomeroomRecord?: (record: HomeroomRecord) => void;
  onEditHomeroomRecord?: (record: HomeroomRecord) => void;
  onDeleteHomeroomRecord?: (id: string) => void;
  attitudeRecords?: AttitudeRecord[];
  onAddAttitudeRecord?: (record: AttitudeRecord) => void;
  onEditAttitudeRecord?: (record: AttitudeRecord) => void;
  onDeleteAttitudeRecord?: (id: string) => void;
  teacherAgendas?: TeacherAgenda[];
  onAddAgenda?: (agenda: TeacherAgenda) => void;
  onEditAgenda?: (agenda: TeacherAgenda) => void;
  onDeleteAgenda?: (id: string) => void;
  initialTab?: string;
}

type TabMode = 'CLASS' | 'TEACHER' | 'JOURNAL' | 'MONITORING' | 'GRADES' | 'HOMEROOM' | 'ATTITUDE' | 'AGENDA';

const ATTITUDE_BEHAVIORS = {
  POSITIVE: [
    { behavior: "Sangat Sopan & Santun", action: "Apresiasi lisan & poin prestasi", notes: "Menjadi teladan bagi teman sekelas" },
    { behavior: "Membantu teman kesulitan", action: "Pujian di depan kelas", notes: "Menunjukkan sikap solidaritas tinggi" },
    { behavior: "Aktif dalam diskusi", action: "Pemberian skor keaktifan", notes: "Partisipasi belajar sangat baik" },
    { behavior: "Menjaga kebersihan kelas", action: "Ucapan terima kasih", notes: "Memiliki rasa kepedulian lingkungan" },
    { behavior: "Jujur mengakui kesalahan", action: "Pujian atas kejujuran", notes: "Integritas diri sangat baik" }
  ],
  NEGATIVE: [
    { behavior: "Terlambat masuk kelas", action: "Teguran & pembinaan disiplin", notes: "Siswa diingatkan pentingnya waktu" },
    { behavior: "Tidak mengerjakan tugas", action: "Bimbingan belajar tambahan", notes: "Motivasi belajar perlu ditingkatkan" },
    { behavior: "Mengganggu teman", action: "Nasehat & mediasi", notes: "Edukasi tentang empati dan pertemanan" },
    { behavior: "Bermain HP saat pelajaran", action: "Penyitaan sementara HP", notes: "Fokus belajar perlu diperbaiki" },
    { behavior: "Berkata kurang sopan", action: "Pembinaan karakter", notes: "Edukasi tentang etika berbicara" }
  ]
};

const ACTIVITY_SUGGESTIONS = [
  "Penyampaian materi secara ceramah dan tanya jawab.",
  "Diskusi kelompok dan presentasi hasil kerja siswa.",
  "Praktikum/Simulasi materi di laboratorium/kelas.",
  "Pengerjaan latihan soal di buku tugas/LKS.",
  "Evaluasi materi melalui kuis singkat/post-test.",
  "Menonton video pembelajaran dan merangkum isi.",
  "Literasi buku paket dan pembuatan peta konsep."
];

const NOTE_SUGGESTIONS = [
  "Siswa sangat antusias and aktif bertanya.",
  "Beberapa siswa masih kesulitan memahami konsep dasar.",
  "Kondisi kelas kondusif dan tertib selama KBM.",
  "Terdapat gangguan teknis pada alat peraga/LCD.",
  "Waktu pembelajaran kurang mencukupi untuk diskusi.",
  "Siswa yang tidak hadir sudah diberikan tugas mandiri.",
  "Perlu pengulangan materi pada pertemuan berikutnya."
];

const HOMEROOM_ISSUE_SUGGESTIONS = [
  "Sering datang terlambat ke sekolah",
  "Tidak masuk tanpa keterangan (Alpha)",
  "Tidak mengerjakan tugas/PR berkali-kali",
  "Bertengkar/selisih paham dengan teman",
  "Berpakaian tidak rapi/atribut tidak lengkap",
  "Membawa barang yang dilarang (HP/Lainnya)",
  "Kurang fokus dan mengantuk saat pelajaran",
  "Siswa terlihat murung dan kurang bersosialisasi"
];

const HOMEROOM_SOLUTION_SUGGESTIONS = [
  "Bimbingan individu dan nasehat lisan",
  "Pemberian teguran tertulis dan pembinaan",
  "Panggilan Orang Tua/Wali Murid",
  "Home visit (Kunjungan ke rumah siswa)",
  "Mediasi antar siswa yang bermasalah",
  "Dirujuk ke Guru BK untuk bimbingan khusus",
  "Pemberian motivasi dan pantauan berkala",
  "Siswa membuat surat pernyataan tidak mengulangi"
];

const COMMON_ACTIONS = [
  "Teguran lisan", "Pemberian poin prestasi", "Bimbingan individu", 
  "Pemanggilan orang tua", "Nasehat keagamaan", "Penugasan khusus"
];

const COMMON_NOTES = [
  "Sudah ada perubahan perilaku", "Perlu pantauan berkelanjutan", 
  "Sudah dikomunikasikan ke orang tua", "Siswa kooperatif saat dibina"
];

const ClassTeacherSchedule: React.FC<ClassTeacherScheduleProps> = ({ 
  teacherData, 
  scheduleMap, 
  currentUser, 
  role,
  appSettings,
  students = [],
  teachingMaterials = [],
  onAddMaterial,
  onEditMaterial,
  onDeleteMaterial,
  teachingJournals = [],
  onAddJournal,
  onEditJournal,
  onDeleteJournal,
  studentGrades = [],
  onUpdateGrade,
  homeroomRecords = [],
  onAddHomeroomRecord,
  onEditHomeroomRecord,
  onDeleteHomeroomRecord,
  attitudeRecords = [],
  onAddAttitudeRecord,
  onEditAttitudeRecord,
  onDeleteAttitudeRecord,
  teacherAgendas = [],
  onAddAgenda,
  onEditAgenda,
  onDeleteAgenda,
  initialTab = 'CLASS'
}) => {
  const [activeTab, setActiveTab] = useState<TabMode>(initialTab as TabMode);

  useEffect(() => {
    if(initialTab) setActiveTab(initialTab as TabMode);
  }, [initialTab]);

  const [selectedClass, setSelectedClass] = useState<string>(() => {
    if (role === 'STUDENT' && currentUser && CLASSES.includes(currentUser)) return currentUser;
    return CLASSES[0];
  });

  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(() => {
    if (role === 'TEACHER') {
        const t = teacherData.find(t => t.name === currentUser);
        return t ? String(t.id) : "";
    }
    return "";
  });

  // UI States
  const [isJournalDownloadOpen, setIsJournalDownloadOpen] = useState(false);
  const [isMonitoringDownloadOpen, setIsMonitoringDownloadOpen] = useState(false);
  const [isGradesDownloadOpen, setIsGradesDownloadOpen] = useState(false);
  const [isHomeroomDownloadOpen, setIsHomeroomDownloadOpen] = useState(false);
  const [isAttitudeDownloadOpen, setIsAttitudeDownloadOpen] = useState(false);
  const [isAgendaDownloadOpen, setIsAgendaDownloadOpen] = useState(false);

  const attitudeDownloadRef = useRef<HTMLDivElement>(null);
  const journalDownloadRef = useRef<HTMLDivElement>(null);
  const monitoringDownloadRef = useRef<HTMLDivElement>(null);
  const gradesDownloadRef = useRef<HTMLDivElement>(null);
  const homeroomDownloadRef = useRef<HTMLDivElement>(null);
  const agendaDownloadRef = useRef<HTMLDivElement>(null);

  // Journal States
  const [journalMode, setJournalMode] = useState<'INPUT_JURNAL' | 'INPUT_MATERI'>('INPUT_JURNAL');
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [editingJournalId, setEditingJournalId] = useState<string | null>(null);
  
  // Journal Filters
  const [journalFilterClass, setJournalFilterClass] = useState('');
  const [journalDateFrom, setJournalDateFrom] = useState('');
  const [journalDateTo, setJournalDateTo] = useState('');
  const [printDate, setPrintDate] = useState(new Date().toISOString().split('T')[0]);

  const [matForm, setMatForm] = useState<{ subject: string; semester: '1' | '2'; classes: string[]; chapter: string; subChapters: string[]; }>({
    subject: '', semester: appSettings.semester === 'Genap' ? '2' : '1', classes: [], chapter: '', subChapters: ['']
  });

  const [jourForm, setJourForm] = useState<{ date: string; semester: '1' | '2'; jamKe: string; className: string; subject: string; chapter: string; subChapters: string[]; activity: string; notes: string; studentAttendance: Record<string, 'H' | 'S' | 'I' | 'A' | 'DL'>; }>({
    date: new Date().toISOString().split('T')[0],
    semester: appSettings.semester === 'Genap' ? '2' : '1',
    jamKe: '', className: '', subject: '', chapter: '', subChapters: [], activity: '', notes: '', studentAttendance: {}
  });

  // Agenda States
  const [agendaForm, setAgendaForm] = useState<{ id?: string, date: string, timeStart: string, timeEnd: string, activity: string, remarks: string }>({
    date: new Date().toISOString().split('T')[0], timeStart: '07:00', timeEnd: '08:00', activity: '', remarks: ''
  });
  const [editingAgendaId, setEditingAgendaId] = useState<string | null>(null);
  const [agendaFilterFrom, setAgendaFilterFrom] = useState('');
  const [agendaFilterTo, setAgendaFilterTo] = useState('');
  const [agendaPrintDate, setAgendaPrintDate] = useState(new Date().toISOString().split('T')[0]);

  // Monitoring States
  const [monitoringClass, setMonitoringClass] = useState(CLASSES[0]);
  const [monitoringSemester, setMonitoringSemester] = useState(appSettings.semester);

  // Grade States
  const [gradeClass, setGradeClass] = useState(CLASSES[0]);
  const [gradeSubject, setGradeSubject] = useState('');
  const [gradeSemester, setGradeSemester] = useState(appSettings.semester);
  const [numChapters, setNumChapters] = useState<number>(5);

  // Homeroom States
  const [homeroomForm, setHomeroomForm] = useState<{ date: string; className: string; studentIds: string[]; violationType: string; solution: string; notes: string; }>({
    date: new Date().toISOString().split('T')[0], className: CLASSES[0], studentIds: [], violationType: '', solution: '', notes: ''
  });
  const [editingHomeroomId, setEditingHomeroomId] = useState<string | null>(null);
  const [homeroomFilterFrom, setHomeroomFilterFrom] = useState('');
  const [homeroomFilterTo, setHomeroomFilterTo] = useState('');
  const [homeroomPrintDate, setHomeroomPrintDate] = useState(new Date().toISOString().split('T')[0]);
  const [homeroomSearchTerm, setHomeroomSearchTerm] = useState('');

  // Attitude States
  const [attitudeForm, setAttitudeForm] = useState<{ date: string; className: string; studentIds: string[]; behavior: string; actionTaken: string; notes: string; }>({
    date: new Date().toISOString().split('T')[0], className: CLASSES[0], studentIds: [], behavior: '', actionTaken: '', notes: ''
  });
  const [editingAttitudeId, setEditingAttitudeId] = useState<string | null>(null);
  const [attitudeFilterClass, setAttitudeFilterClass] = useState<string>('');
  const [attitudeFilterFrom, setAttitudeFilterFrom] = useState<string>('');
  const [attitudeFilterTo, setAttitudeFilterTo] = useState<string>('');
  const [attitudePrintDate, setAttitudePrintDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Node;
        if (attitudeDownloadRef.current && !attitudeDownloadRef.current.contains(target)) setIsAttitudeDownloadOpen(false);
        if (journalDownloadRef.current && !journalDownloadRef.current.contains(target)) setIsJournalDownloadOpen(false);
        if (monitoringDownloadRef.current && !monitoringDownloadRef.current.contains(target)) setIsMonitoringDownloadOpen(false);
        if (gradesDownloadRef.current && !gradesDownloadRef.current.contains(target)) setIsGradesDownloadOpen(false);
        if (homeroomDownloadRef.current && !homeroomDownloadRef.current.contains(target)) setIsHomeroomDownloadOpen(false);
        if (agendaDownloadRef.current && !agendaDownloadRef.current.contains(target)) setIsAgendaDownloadOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const codeToDataMap = useMemo(() => {
    const map: Record<string, { subject: string, name: string }> = {};
    teacherData.forEach(t => map[t.code] = { subject: t.subject, name: t.name });
    return map;
  }, [teacherData]);

  const teacherNames = useMemo(() => Array.from(new Set(teacherData.map(t => t.name))).sort(), [teacherData]);
  const mySubjects = useMemo(() => Array.from(new Set(teacherData.filter(t => t.name === currentUser).map(t => t.subject))).sort(), [teacherData, currentUser]);

  useEffect(() => {
    if (mySubjects.length > 0) {
      if (!gradeSubject) setGradeSubject(mySubjects[0]);
      if (!matForm.subject) setMatForm(prev => ({ ...prev, subject: mySubjects[0] }));
      if (!jourForm.subject) setJourForm(prev => ({ ...prev, subject: mySubjects[0] }));
    }
  }, [mySubjects]);

  const getDayNameFromDate = (dateString: string) => {
    const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', "JUM'AT", 'SABTU'];
    const d = new Date(dateString);
    return days[d.getDay()];
  };

  const myTeachingSlots = useMemo(() => {
    const dayName = getDayNameFromDate(jourForm.date);
    const daySchedule = SCHEDULE_DATA.find(ds => ds.day === dayName);
    if (!daySchedule) return [];

    const myCodes = teacherData.filter(t => t.name === currentUser).map(t => t.code);
    const rawSlots: { jam: number, cls: string }[] = [];

    daySchedule.rows.forEach(row => {
      if (row.jam && !isNaN(parseInt(row.jam))) {
        CLASSES.forEach(cls => {
          const key = `${dayName}-${row.jam}-${cls}`;
          if (myCodes.includes(scheduleMap[key])) {
            rawSlots.push({ jam: parseInt(row.jam), cls });
          }
        });
      }
    });

    // Grouping logic for consecutive periods
    const groupedByClass: Record<string, number[]> = {};
    rawSlots.forEach(s => {
      if (!groupedByClass[s.cls]) groupedByClass[s.cls] = [];
      groupedByClass[s.cls].push(s.jam);
    });

    const finalSlots: string[] = [];
    Object.entries(groupedByClass).forEach(([cls, jams]) => {
      jams.sort((a, b) => a - b);
      let start = jams[0];
      let prev = jams[0];

      for (let i = 1; i <= jams.length; i++) {
        if (i === jams.length || jams[i] !== prev + 1) {
          // Range found or end of list
          const jamStr = start === prev ? `${start}` : `${start}-${prev}`;
          finalSlots.push(`${dayName}|${jamStr}|${cls}`);
          if (i < jams.length) {
            start = jams[i];
            prev = jams[i];
          }
        } else {
          prev = jams[i];
        }
      }
    });

    return finalSlots;
  }, [jourForm.date, teacherData, currentUser, scheduleMap]);

  const handleJamKeSelection = (slot: string) => {
    const [day, jamRange, cls] = slot.split('|');
    // For subject info, we check the first jam in the range
    const firstJam = jamRange.split('-')[0];
    const code = scheduleMap[`${day}-${firstJam}-${cls}`];
    const info = codeToDataMap[code];
    setJourForm(prev => ({
      ...prev,
      jamKe: jamRange,
      className: cls,
      subject: info?.subject || prev.subject,
      studentAttendance: {} 
    }));
  };

  const handleAttendanceChange = (studentId: string, status: 'H' | 'S' | 'I' | 'A' | 'DL') => {
    setJourForm(prev => ({
      ...prev,
      studentAttendance: { ...prev.studentAttendance, [studentId]: status }
    }));
  };

  const saveJournal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !onAddJournal || !jourForm.className) {
      alert("Pastikan jam mengajar dan kelas sudah dipilih.");
      return;
    }
    const journalData: any = { 
      id: editingJournalId || Date.now().toString(), 
      teacherName: currentUser, 
      ...jourForm,
      subChapter: jourForm.subChapters.join(', ')
    };
    if (editingJournalId && onEditJournal) onEditJournal(journalData); else onAddJournal(journalData);
    setJourForm(prev => ({ ...prev, jamKe: '', className: '', chapter: '', subChapters: [], activity: '', notes: '', studentAttendance: {} }));
    setEditingJournalId(null);
    alert("Jurnal berhasil disimpan!");
  };

  const saveMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !onAddMaterial) return;
    if (matForm.classes.length === 0) {
      alert("Pilih minimal satu kelas!");
      return;
    }
    const materialData: TeachingMaterial = { 
      id: editingMaterialId || Date.now().toString(), 
      teacherName: currentUser, 
      subject: matForm.subject, 
      semester: matForm.semester, 
      classes: matForm.classes, 
      chapter: matForm.chapter, 
      subChapters: matForm.subChapters.filter(s => s.trim() !== '') 
    };
    if (editingMaterialId && onEditMaterial) onEditMaterial(materialData); else onAddMaterial(materialData);
    setMatForm({ ...matForm, chapter: '', subChapters: [''], classes: [] });
    setEditingMaterialId(null);
  };

  const myMaterials = useMemo(() => teachingMaterials.filter(m => m.teacherName === currentUser), [teachingMaterials, currentUser]);
  
  const filteredJournals = useMemo(() => {
    let journals = teachingJournals.filter(j => j.teacherName === currentUser);
    if (journalFilterClass) journals = journals.filter(j => j.className === journalFilterClass);
    if (journalDateFrom) journals = journals.filter(j => j.date >= journalDateFrom);
    if (journalDateTo) journals = journals.filter(j => j.date <= journalDateTo);
    return journals.sort((a,b) => b.date.localeCompare(a.date));
  }, [teachingJournals, currentUser, journalFilterClass, journalDateFrom, journalDateTo]);

  const getAttendanceDetailString = (attendanceObj: Record<string, string> | undefined) => {
    if (!attendanceObj) return 'Nihil';
    
    const s: string[] = [];
    const i: string[] = [];
    const a: string[] = [];
    const dl: string[] = [];

    Object.entries(attendanceObj).forEach(([sid, status]) => {
      const studentName = students.find(st => st.id === sid)?.name || sid;
      if (status === 'S') s.push(studentName);
      else if (status === 'I') i.push(studentName);
      else if (status === 'A') a.push(studentName);
      else if (status === 'DL') dl.push(studentName);
    });

    const parts = [];
    if (s.length > 0) parts.push(`Sakit: ${s.join(', ')}`);
    if (i.length > 0) parts.push(`Izin: ${i.join(', ')}`);
    if (a.length > 0) parts.push(`Alpha: ${a.join(', ')}`);
    if (dl.length > 0) parts.push(`DL: ${dl.join(', ')}`);

    return parts.join('; ') || 'Nihil';
  };

  const addSignatureToPDF = (doc: jsPDF, dateStr: string, roleLabel: string = "Guru Mata Pelajaran") => {
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    let finalY = (doc as any).lastAutoTable?.finalY || 20;
    finalY += 10;
    if (finalY + 40 > pageHeight) { doc.addPage(); finalY = 20; }
    const rightMargin = pageWidth - 60;
    const leftMargin = 20;
    doc.setFontSize(10);
    doc.text(`Mojokerto, ${new Date(dateStr).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}`, rightMargin, finalY, { align: 'center' });
    doc.text(`Mengetahui,`, leftMargin, finalY + 5);
    doc.text(`Kepala Sekolah`, leftMargin, finalY + 10);
    doc.text(roleLabel, rightMargin, finalY + 10, { align: 'center' });
    const currentTeacherData = teacherData.find(t => t.name === currentUser);
    doc.text(`${appSettings.headmaster || '...................'}`, leftMargin, finalY + 35);
    doc.text(`NIP. ${appSettings.headmasterNip || '-' }`, leftMargin, finalY + 40);
    doc.text(`${currentUser}`, rightMargin, finalY + 35, { align: 'center' });
    doc.text(`NIP. ${currentTeacherData?.nip || '-'}`, rightMargin, finalY + 40, { align: 'center' });
  };

  // Export Handlers for Journal
  const exportJournalPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(14);
    doc.text(`Jurnal Mengajar - ${currentUser}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Semester ${appSettings.semester} TA ${appSettings.academicYear}`, 14, 21);

    const body = filteredJournals.map((j, idx) => [
      idx + 1, j.date, j.className, j.subject || '-', j.chapter, j.activity, getAttendanceDetailString(j.studentAttendance), j.notes || '-'
    ]);

    autoTable(doc, {
      startY: 25,
      head: [['No', 'Tanggal', 'Kelas', 'Mapel', 'Materi', 'Kegiatan', 'Absensi', 'Catatan']],
      body: body,
      theme: 'grid',
      styles: { fontSize: 7, overflow: 'linebreak', cellPadding: 2 },
      columnStyles: {
        6: { cellWidth: 40 }, // Attendance column wider for names
        7: { cellWidth: 35 }  // Notes column
      }
    });

    addSignatureToPDF(doc, printDate);
    doc.save(`Jurnal_${currentUser.replace(' ', '_')}.pdf`);
  };

  const exportJournalExcel = () => {
    const data = filteredJournals.map((j, idx) => ({
      "No": idx + 1,
      "Tanggal": j.date,
      "Kelas": j.className,
      "Mapel": j.subject || '-',
      "Materi": j.chapter,
      "Kegiatan": j.activity,
      "Absensi": getAttendanceDetailString(j.studentAttendance),
      "Catatan": j.notes || '-'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jurnal");
    XLSX.writeFile(wb, `Jurnal_${currentUser.replace(' ', '_')}.xlsx`);
  };

  // Agenda Handlers
  const handleAgendaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddAgenda || !onEditAgenda || !currentUser) return;
    const agendaData: TeacherAgenda = {
      id: editingAgendaId || Date.now().toString(),
      teacherName: currentUser,
      date: agendaForm.date,
      timeStart: agendaForm.timeStart,
      timeEnd: agendaForm.timeEnd,
      activity: agendaForm.activity,
      remarks: agendaForm.remarks
    };

    if (editingAgendaId) onEditAgenda(agendaData);
    else onAddAgenda(agendaData);

    setAgendaForm({ date: new Date().toISOString().split('T')[0], timeStart: '07:00', timeEnd: '08:00', activity: '', remarks: '' });
    setEditingAgendaId(null);
    alert("Agenda berhasil disimpan!");
  };

  const onActivityChange = (val: string) => {
    let autoRemarks = 'Terlaksana';
    if (val.toLowerCase().includes('rapat')) autoRemarks = 'Selesai';
    else if (val.toLowerCase().includes('ijin') || val.toLowerCase().includes('sakit')) autoRemarks = 'Tunda';
    
    setAgendaForm({ ...agendaForm, activity: val, remarks: autoRemarks });
  };

  const filteredAgendas = useMemo(() => {
    let list = teacherAgendas.filter(a => a.teacherName === currentUser);
    if (agendaFilterFrom) list = list.filter(a => a.date >= agendaFilterFrom);
    if (agendaFilterTo) list = list.filter(a => a.date <= agendaFilterTo);
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [teacherAgendas, currentUser, agendaFilterFrom, agendaFilterTo]);

  const exportAgendaPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFontSize(14);
    doc.text(`Agenda Kegiatan Guru - ${currentUser}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Periode: ${agendaFilterFrom || '-'} s.d ${agendaFilterTo || '-'}`, 14, 21);

    const body = filteredAgendas.map((a, idx) => [
      idx + 1, a.date, `${a.timeStart} - ${a.timeEnd}`, a.activity, a.remarks
    ]);

    autoTable(doc, {
      startY: 25,
      head: [['No', 'Tanggal', 'Waktu', 'Uraian Kegiatan', 'Keterangan']],
      body: body,
      theme: 'grid',
      styles: { fontSize: 9 }
    });

    addSignatureToPDF(doc, agendaPrintDate);
    doc.save(`Agenda_${currentUser.replace(' ', '_')}.pdf`);
  };

  const exportAgendaExcel = () => {
    const data = filteredAgendas.map((a, idx) => ({
      "No": idx + 1,
      "Tanggal": a.date,
      "Waktu": `${a.timeStart} - ${a.timeEnd}`,
      "Uraian Kegiatan": a.activity,
      "Keterangan": a.remarks
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Agenda Kegiatan");
    XLSX.writeFile(wb, `Agenda_${currentUser.replace(' ', '_')}.xlsx`);
  };

  const attendanceRecap = useMemo(() => {
    const stats: Record<string, { S: number, I: number, A: number }> = {};
    const classStudents = students.filter(s => s.className === monitoringClass);
    classStudents.forEach(s => { stats[s.id] = { S: 0, I: 0, A: 0 }; });
    teachingJournals.forEach(j => {
        const journalSemesterLabel = j.semester === '1' ? 'Ganjil' : 'Genap';
        if (j.className === monitoringClass && journalSemesterLabel === monitoringSemester) {
            if (j.studentAttendance) {
                Object.entries(j.studentAttendance).forEach(([sid, status]) => {
                    if (stats[sid]) {
                        if (status === 'S') stats[sid].S++;
                        else if (status === 'I') stats[sid].I++;
                        else if (status === 'A') stats[sid].A++;
                    }
                });
            }
        }
    });
    return stats;
  }, [students, teachingJournals, monitoringClass, monitoringSemester]);

  // Export Handlers for Monitoring
  const exportMonitoringPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFontSize(14); doc.text(`Rekap Absensi Siswa Kelas ${monitoringClass}`, 14, 15);
    doc.setFontSize(10); doc.text(`Semester ${monitoringSemester} - TA ${appSettings.academicYear}`, 14, 21);
    
    const filteredStudents = students.filter(s => s.className === monitoringClass);
    const body = filteredStudents.map((s, idx) => {
      const stat = attendanceRecap[s.id] || {S:0, I:0, A:0};
      return [idx + 1, s.name, stat.S, stat.I, stat.A, stat.S + stat.I + stat.A];
    });

    autoTable(doc, {
      startY: 25,
      head: [['No', 'Nama Siswa', 'Sakit', 'Izin', 'Alpha', 'Total']],
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59] }
    });

    addSignatureToPDF(doc, new Date().toISOString().split('T')[0]);
    doc.save(`Absensi_${monitoringClass.replace(' ', '_')}.pdf`);
  };

  const exportMonitoringExcel = () => {
    const filteredStudents = students.filter(s => s.className === monitoringClass);
    const data = filteredStudents.map((s, idx) => {
      const stat = attendanceRecap[s.id] || {S:0, I:0, A:0};
      return {
        "No": idx + 1,
        "Nama Siswa": s.name,
        "Sakit": stat.S,
        "Izin": stat.I,
        "Alpha": stat.A,
        "Total": stat.S + stat.I + stat.A
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Absensi");
    XLSX.writeFile(wb, `Absensi_${monitoringClass.replace(' ', '_')}.xlsx`);
  };

  // Export Handlers for Grades
  const exportGradesPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(12); doc.text(`Daftar Nilai Siswa - ${gradeSubject}`, 14, 15);
    doc.setFontSize(10); doc.text(`Kelas ${gradeClass} - Semester ${gradeSemester}`, 14, 21);
    
    const filteredStudents = students.filter(s => s.className === gradeClass);
    
    // Create detailed headers matching UI
    const headRow1: any[] = [
      { content: 'No', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
      { content: 'Nama Siswa', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }
    ];
    const headRow2: any[] = [];

    for (let i = 1; i <= numChapters; i++) {
      headRow1.push({ content: `BAB ${i}`, colSpan: 7, styles: { halign: 'center', fillColor: [51, 65, 85] } });
      headRow2.push('F1', 'F2', 'F3', 'F4', 'F5', 'SUM', 'RR');
    }

    headRow1.push(
      { content: 'STS', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: [194, 65, 12] } },
      { content: 'SAS', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: [153, 27, 27] } },
      { content: 'NA', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: [15, 23, 42] } }
    );

    const body = filteredStudents.map((s, idx) => {
      const recordId = `${s.id}_${gradeSubject}_${gradeSemester}`;
      const record = studentGrades.find(r => r.id === recordId);
      const rowData = [idx + 1, s.name];
      
      for(let i=1; i<=numChapters; i++) {
         const ch = record?.chapters[i as 1|2|3|4|5] || {};
         rowData.push(ch.f1 ?? '-', ch.f2 ?? '-', ch.f3 ?? '-', ch.f4 ?? '-', ch.f5 ?? '-', ch.sum ?? '-', ch.avg ?? '-');
      }

      rowData.push(record?.sts ?? '-', record?.sas ?? '-', record?.finalGrade ?? '-');
      return rowData;
    });

    autoTable(doc, {
      startY: 25,
      head: [headRow1, headRow2],
      body: body,
      theme: 'grid',
      styles: { fontSize: 6, cellPadding: 1, halign: 'center' },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      columnStyles: {
        1: { halign: 'left', cellWidth: 35 } // Nama Siswa
      }
    });

    addSignatureToPDF(doc, new Date().toISOString().split('T')[0]);
    doc.save(`Nilai_${gradeClass.replace(' ', '_')}_${gradeSubject.replace(' ', '_')}.pdf`);
  };

  const exportGradesExcel = () => {
    const filteredStudents = students.filter(s => s.className === gradeClass);
    const data = filteredStudents.map((s, idx) => {
      const recordId = `${s.id}_${gradeSubject}_${gradeSemester}`;
      const record = studentGrades.find(r => r.id === recordId);
      
      const res: any = { "No": idx + 1, "Nama Siswa": s.name };
      for(let i=1; i<=numChapters; i++) {
         const ch = record?.chapters[i as 1|2|3|4|5] || {};
         res[`Bab ${i} F1`] = ch.f1 ?? 0;
         res[`Bab ${i} F2`] = ch.f2 ?? 0;
         res[`Bab ${i} F3`] = ch.f3 ?? 0;
         res[`Bab ${i} F4`] = ch.f4 ?? 0;
         res[`Bab ${i} F5`] = ch.f5 ?? 0;
         res[`Bab ${i} SUM`] = ch.sum ?? 0;
         res[`Bab ${i} Rerata`] = ch.avg ?? 0;
      }
      res["STS"] = record?.sts || 0;
      res["SAS"] = record?.sas || 0;
      res["Nilai Akhir"] = record?.finalGrade || 0;
      
      return res;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Nilai Siswa");
    XLSX.writeFile(wb, `Nilai_${gradeClass.replace(' ', '_')}_${gradeSubject.replace(' ', '_')}.xlsx`);
  };

  // Filtered Homeroom History Logic
  const filteredHomeroomHistory = useMemo(() => {
    let list = homeroomRecords.filter(r => r.teacherName === currentUser);
    if (homeroomFilterFrom) list = list.filter(r => r.date >= homeroomFilterFrom);
    if (homeroomFilterTo) list = list.filter(r => r.date <= homeroomFilterTo);
    if (homeroomSearchTerm) {
      list = list.filter(r => {
        const studentName = students.find(s => s.id === r.studentId)?.name || '';
        return studentName.toLowerCase().includes(homeroomSearchTerm.toLowerCase()) || 
               r.violationType.toLowerCase().includes(homeroomSearchTerm.toLowerCase());
      });
    }
    return list.sort((a,b) => b.date.localeCompare(a.date));
  }, [homeroomRecords, currentUser, homeroomFilterFrom, homeroomFilterTo, homeroomSearchTerm, students]);

  // Export Handlers for Homeroom
  const exportHomeroomPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFontSize(14); doc.text(`Catatan Wali Kelas - ${currentUser}`, 14, 15);
    doc.setFontSize(10); doc.text(`Periode: ${homeroomFilterFrom || '-'} s.d ${homeroomFilterTo || '-'}`, 14, 21);
    
    const body = filteredHomeroomHistory.map((r, idx) => [
      idx + 1, r.date, students.find(s => s.id === r.studentId)?.name || '-', r.violationType, r.solution
    ]);

    autoTable(doc, {
      startY: 25,
      head: [['No', 'Tanggal', 'Siswa', 'Permasalahan', 'Solusi']],
      body: body,
      theme: 'grid',
      styles: { fontSize: 9 }
    });

    addSignatureToPDF(doc, homeroomPrintDate, "Wali Kelas");
    doc.save(`Catatan_Wali_Kelas_${currentUser.replace(' ', '_')}.pdf`);
  };

  const exportHomeroomExcel = () => {
    const data = filteredHomeroomHistory.map((r, idx) => ({
      "No": idx + 1, "Tanggal": r.date,
      "Nama Siswa": students.find(s => s.id === r.studentId)?.name || '-',
      "Permasalahan": r.violationType, "Solusi": r.solution
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Catatan Wali Kelas");
    XLSX.writeFile(wb, `Catatan_Wali_Kelas_${currentUser.replace(' ', '_')}.xlsx`);
  };

  // Filtered Attitude Records
  const filteredAttitudeHistory = useMemo(() => {
    let list = attitudeRecords.filter(r => r.teacherName === currentUser);
    if (attitudeFilterClass) list = list.filter(r => r.className === attitudeFilterClass);
    if (attitudeFilterFrom) list = list.filter(r => r.date >= attitudeFilterFrom);
    if (attitudeFilterTo) list = list.filter(r => r.date <= attitudeFilterTo);
    return list.sort((a,b) => b.date.localeCompare(a.date));
  }, [attitudeRecords, currentUser, attitudeFilterClass, attitudeFilterFrom, attitudeFilterTo]);

  // Export Handlers for Attitude
  const exportAttitudePDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFontSize(14); doc.text(`Jurnal Penilaian Sikap - ${currentUser}`, 14, 15);
    doc.setFontSize(10); doc.text(`Semester ${appSettings.semester} TA ${appSettings.academicYear}`, 14, 21);
    
    const body = filteredAttitudeHistory.map((r, idx) => [
      idx + 1, r.date, r.className, students.find(s => s.id === r.studentId)?.name || '-', r.behavior, r.actionTaken, r.notes || '-'
    ]);

    autoTable(doc, {
      startY: 25,
      head: [['No', 'Tanggal', 'Kelas', 'Siswa', 'Perilaku', 'Tindak Lanjut', 'Keterangan']],
      body: body,
      theme: 'grid',
      styles: { fontSize: 8 }
    });

    addSignatureToPDF(doc, attitudePrintDate, "Guru / Pembina");
    doc.save(`Jurnal_Sikap_${currentUser.replace(' ', '_')}.pdf`);
  };

  const exportAttitudeExcel = () => {
    const data = filteredAttitudeHistory.map((r, idx) => ({
      "No": idx + 1,
      "Tanggal": r.date,
      "Kelas": r.className,
      "Nama Siswa": students.find(s => s.id === r.studentId)?.name || '-',
      "Kejadian / Perilaku": r.behavior,
      "Tindak Lanjut": r.actionTaken,
      "Keterangan": r.notes || '-'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Penilaian Sikap");
    XLSX.writeFile(wb, `Jurnal_Sikap_${currentUser.replace(' ', '_')}.xlsx`);
  };

  const handleHomeroomSubmit = (e: React.FormEvent) => {
    e.preventDefault(); if (!onAddHomeroomRecord || !onEditHomeroomRecord || !currentUser) return;
    if (homeroomForm.studentIds.length === 0) { alert("Pilih minimal satu siswa!"); return; }
    if (editingHomeroomId) {
        onEditHomeroomRecord({ id: editingHomeroomId, teacherName: currentUser, date: homeroomForm.date, className: homeroomForm.className, studentId: homeroomForm.studentIds[0], violationType: homeroomForm.violationType, solution: homeroomForm.solution, notes: homeroomForm.notes });
        setEditingHomeroomId(null);
    } else {
        homeroomForm.studentIds.forEach(sid => onAddHomeroomRecord({ id: Date.now().toString() + Math.random().toString(36).substring(2, 5), teacherName: currentUser, date: homeroomForm.date, className: homeroomForm.className, studentId: sid, violationType: homeroomForm.violationType, solution: homeroomForm.solution, notes: homeroomForm.notes }));
    }
    setHomeroomForm({ ...homeroomForm, studentIds: [], violationType: '', solution: '', notes: '' });
  };

  const handleAttitudeSubmit = (e: React.FormEvent) => {
    e.preventDefault(); if (!onAddAttitudeRecord || !onEditAttitudeRecord || !currentUser) return;
    if (attitudeForm.studentIds.length === 0) { alert("Pilih minimal satu siswa!"); return; }
    if (editingAttitudeId) {
        onEditAttitudeRecord({ id: editingAttitudeId, teacherName: currentUser, date: attitudeForm.date, className: attitudeForm.className, studentId: attitudeForm.studentIds[0], behavior: attitudeForm.behavior, actionTaken: attitudeForm.actionTaken, notes: attitudeForm.notes });
        setEditingAttitudeId(null);
    } else {
        attitudeForm.studentIds.forEach(sid => onAddAttitudeRecord({ id: Date.now().toString() + Math.random().toString(36).substring(2, 5), teacherName: currentUser, date: attitudeForm.date, className: attitudeForm.className, studentId: sid, behavior: attitudeForm.behavior, actionTaken: attitudeForm.actionTaken, notes: attitudeForm.notes }));
    }
    setAttitudeForm({ ...attitudeForm, studentIds: [], behavior: '', actionTaken: '', notes: '' });
  };

  const handleBehaviorAutoSelect = (behavior: string) => {
    const allSugg = [...ATTITUDE_BEHAVIORS.POSITIVE, ...ATTITUDE_BEHAVIORS.NEGATIVE];
    const suggestion = allSugg.find(s => s.behavior === behavior);
    if (suggestion) {
        setAttitudeForm(prev => ({ ...prev, behavior: suggestion.behavior, actionTaken: suggestion.action, notes: suggestion.notes }));
    } else {
        setAttitudeForm(prev => ({ ...prev, behavior }));
    }
  };

  const getScoreColor = (val: number | undefined) => {
    if (val === undefined || isNaN(val) || val === 0) return 'bg-transparent';
    if (val < 71) return 'bg-red-100 text-red-700';
    if (val <= 85) return 'bg-yellow-100 text-yellow-700';
    return 'bg-green-100 text-green-700';
  };

  // Renders
  const renderJournalTab = () => {
    const classStudents = students.filter(s => s.className === jourForm.className);
    const currentChapter = myMaterials.find(m => m.chapter === jourForm.chapter);

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex gap-4 mb-4 border-b border-gray-200 pb-2 overflow-x-auto">
            <button onClick={() => setJournalMode('INPUT_JURNAL')} className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors whitespace-nowrap ${journalMode === 'INPUT_JURNAL' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}><BookOpen size={18} className="inline mr-2"/> Jurnal Harian</button>
            <button onClick={() => setJournalMode('INPUT_MATERI')} className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors whitespace-nowrap ${journalMode === 'INPUT_MATERI' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}><List size={18} className="inline mr-2"/> Bank Materi</button>
        </div>

        {journalMode === 'INPUT_MATERI' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-fit">
              <h3 className="font-bold text-gray-800 mb-4">{editingMaterialId ? 'Edit Materi' : 'Tambah Materi Baru'}</h3>
              <form onSubmit={saveMaterial} className="space-y-4">
                <div><label className="block text-xs font-bold text-gray-600 mb-1">Mata Pelajaran</label><select value={matForm.subject} onChange={(e) => setMatForm({...matForm, subject: e.target.value})} className="w-full border rounded px-3 py-2 text-sm" required>{mySubjects.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Pilih Kelas (Bisa Lebih dari Satu)</label>
                  <div className="grid grid-cols-3 gap-2 border p-3 rounded-lg bg-gray-50 max-h-40 overflow-y-auto custom-scrollbar">
                    {CLASSES.map(cls => (
                      <label key={cls} className="flex items-center gap-2 cursor-pointer hover:bg-white p-1 rounded group transition-colors">
                        <input 
                          type="checkbox" 
                          checked={matForm.classes.includes(cls)}
                          onChange={() => setMatForm({...matForm, classes: matForm.classes.includes(cls) ? matForm.classes.filter(c => c !== cls) : [...matForm.classes, cls]})}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-[10px] font-bold text-gray-700 group-hover:text-indigo-600">{cls}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div><label className="block text-xs font-bold text-gray-600 mb-1">Judul Bab / Kompetensi Dasar</label><input type="text" value={matForm.chapter} onChange={(e) => setMatForm({...matForm, chapter: e.target.value})} className="w-full border rounded px-3 py-2 text-sm" required placeholder="Contoh: Bab 1 - Bilangan Bulat" /></div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1 flex justify-between">
                    Sub Bab / Materi
                    <button type="button" onClick={() => setMatForm({...matForm, subChapters: [...matForm.subChapters, '']})} className="text-indigo-600 hover:underline">+ Tambah Baris</button>
                  </label>
                  <div className="space-y-2">
                    {matForm.subChapters.map((sub, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input 
                          type="text" 
                          value={sub} 
                          onChange={(e) => {
                            const newSubs = [...matForm.subChapters];
                            newSubs[idx] = e.target.value;
                            setMatForm({...matForm, subChapters: newSubs});
                          }}
                          placeholder={`Sub Materi ${idx+1}`}
                          className="flex-1 border rounded px-3 py-1.5 text-xs"
                          required
                        />
                        {matForm.subChapters.length > 1 && (
                          <button type="button" onClick={() => setMatForm({...matForm, subChapters: matForm.subChapters.filter((_, i) => i !== idx)})} className="text-red-500"><X size={16}/></button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                    {editingMaterialId && <button type="button" onClick={() => {setEditingMaterialId(null); setMatForm({...matForm, chapter: '', subChapters: [''], classes: []});}} className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold">Batal</button>}
                    <button type="submit" className="flex-[2] py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-colors">Simpan Materi</button>
                </div>
              </form>
            </div>
            <div className="lg:col-span-2 overflow-x-auto">
              <table className="min-w-full bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase w-10">No</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Mapel / Kelas</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Bab</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Sub Materi</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase w-24">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {myMaterials.map((m, idx) => (
                    <tr key={m.id} className="hover:bg-gray-50 group">
                      <td className="px-4 py-3 text-sm text-gray-500">{idx+1}</td>
                      <td className="px-4 py-3 text-sm font-bold text-indigo-700">
                        <p>{m.subject}</p>
                        <p className="text-[10px] text-emerald-600">{m.classes.join(', ')}</p>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{m.chapter}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        <ul className="list-disc list-inside">
                          {m.subChapters.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => {setEditingMaterialId(m.id); setMatForm({subject: m.subject || '', semester: m.semester, classes: m.classes, chapter: m.chapter, subChapters: m.subChapters});}} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={16}/></button>
                          <button onClick={() => onDeleteMaterial && onDeleteMaterial(m.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {myMaterials.length === 0 && <tr><td colSpan={5} className="py-10 text-center text-gray-400 italic">Belum ada materi tersimpan.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {journalMode === 'INPUT_JURNAL' && (
          <div className="space-y-8">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm max-w-4xl mx-auto">
                <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-4"><PenTool size={20} className="text-indigo-600"/> {editingJournalId ? 'Edit Jurnal Mengajar' : 'Input Jurnal Harian'}</h3>
                <form onSubmit={saveJournal} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div><label className="block text-xs font-bold text-gray-600 mb-1">Tanggal</label><input type="date" value={jourForm.date} onChange={(e) => setJourForm({...jourForm, date: e.target.value})} className="w-full border rounded px-3 py-2 text-sm" required /></div>
                        <div><label className="block text-xs font-bold text-gray-600 mb-1">Pilih Jam & Kelas</label>
                          <div className="max-h-32 overflow-y-auto border p-2 rounded bg-gray-50 custom-scrollbar space-y-1">
                            {myTeachingSlots.map(slot => (<button key={slot} type="button" onClick={() => handleJamKeSelection(slot)} className={`w-full text-left text-[10px] p-2 rounded border font-medium transition-all ${jourForm.jamKe === slot.split('|')[1] && jourForm.className === slot.split('|')[2] ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300'}`}>Jam ke-{slot.split('|')[1]} - {slot.split('|')[2]}</button>))}
                            {myTeachingSlots.length === 0 && <p className="text-[10px] text-gray-400 italic text-center p-2">Tidak ada jadwal hari ini.</p>}
                          </div>
                        </div>
                        <div><label className="block text-xs font-bold text-gray-600 mb-1">Mata Pelajaran</label><input type="text" value={jourForm.subject} readOnly className="w-full border rounded px-3 py-2 text-sm bg-gray-100 font-bold text-indigo-700" /></div>
                        <div><label className="block text-xs font-bold text-gray-600 mb-1">Bab / Kompetensi Dasar (Sesuai Kelas Terpilih)</label>
                          <select value={jourForm.chapter} onChange={(e) => setJourForm({...jourForm, chapter: e.target.value, subChapters: []})} className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" required>
                            <option value="">-- Pilih Materi --</option>
                            {myMaterials.filter(m => m.subject === jourForm.subject && m.classes.includes(jourForm.className)).map(m => <option key={m.id} value={m.chapter}>{m.chapter}</option>)}
                          </select>
                          {jourForm.className && myMaterials.filter(m => m.subject === jourForm.subject && m.classes.includes(jourForm.className)).length === 0 && (
                            <p className="text-[10px] text-red-500 mt-1 italic font-medium">Materi untuk kelas {jourForm.className} belum diinput di Bank Materi.</p>
                          )}
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <div><label className="block text-xs font-bold text-gray-600 mb-1">Sub Materi (Bisa pilih banyak)</label>
                          <div className="max-h-40 overflow-y-auto border p-3 rounded bg-gray-50 custom-scrollbar space-y-2">
                             {currentChapter ? currentChapter.subChapters.map((sub, i) => (
                               <label key={i} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1 rounded group">
                                 <input 
                                   type="checkbox" 
                                   checked={jourForm.subChapters.includes(sub)}
                                   onChange={() => setJourForm({...jourForm, subChapters: jourForm.subChapters.includes(sub) ? jourForm.subChapters.filter(s => s !== sub) : [...jourForm.subChapters, sub]})}
                                   className="rounded text-indigo-600 focus:ring-indigo-500"
                                 />
                                 <span className="text-xs text-gray-700 group-hover:text-indigo-700 transition-colors">{sub}</span>
                               </label>
                             )) : <p className="text-[10px] text-gray-400 italic">Pilih Bab terlebih dahulu</p>}
                          </div>
                        </div>
                        
                        {/* Kegiatan Pembelajaran with Suggestions */}
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1 flex items-center gap-2">
                            Kegiatan Pembelajaran <Sparkles size={12} className="text-indigo-500"/>
                          </label>
                          <textarea 
                            value={jourForm.activity} 
                            onChange={(e) => setJourForm({...jourForm, activity: e.target.value})} 
                            className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 mb-2" 
                            rows={3} 
                            required 
                            placeholder="Ringkasan penyampaian materi..." 
                          />
                          <div className="flex flex-wrap gap-1">
                            <span className="text-[9px] font-bold text-gray-400 uppercase w-full mb-1">Cepat Pilih:</span>
                            {ACTIVITY_SUGGESTIONS.map((s, idx) => (
                              <button 
                                key={idx} 
                                type="button" 
                                onClick={() => setJourForm({...jourForm, activity: s})}
                                className="text-[9px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100 hover:bg-indigo-100 transition-colors"
                              >
                                {s.substring(0, 30)}...
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Catatan Tambahan with Suggestions */}
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1 flex items-center gap-2">
                            Catatan Tambahan <Sparkles size={12} className="text-emerald-500"/>
                          </label>
                          <textarea 
                            value={jourForm.notes} 
                            onChange={(e) => setJourForm({...jourForm, notes: e.target.value})} 
                            className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 mb-2" 
                            rows={2} 
                            placeholder="Siswa bermasalah / kendala lainnya..." 
                          />
                          <div className="flex flex-wrap gap-1">
                            <span className="text-[9px] font-bold text-gray-400 uppercase w-full mb-1">Cepat Pilih:</span>
                            {NOTE_SUGGESTIONS.map((s, idx) => (
                              <button 
                                key={idx} 
                                type="button" 
                                onClick={() => setJourForm({...jourForm, notes: s})}
                                className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded border border-emerald-100 hover:bg-emerald-100 transition-colors"
                              >
                                {s.substring(0, 30)}...
                              </button>
                            ))}
                          </div>
                        </div>
                    </div>
                  </div>

                  {/* Integrated Attendance Checklist */}
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-bold text-gray-800 flex items-center gap-2"><Users size={18} className="text-orange-600"/> Absensi Siswa {jourForm.className && `[${jourForm.className}]`}</h4>
                      {jourForm.className && <span className="text-[10px] font-bold text-gray-500">{classStudents.length} Siswa</span>}
                    </div>
                    {jourForm.className ? (
                      <div className="max-h-60 overflow-y-auto border rounded bg-white custom-scrollbar">
                        <table className="min-w-full divide-y divide-gray-100">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr><th className="px-3 py-2 text-left text-[10px] font-bold text-gray-500">Nama Siswa</th><th className="px-3 py-2 text-center text-[10px] font-bold text-gray-500">H / S / I / A / DL</th></tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {classStudents.map(student => (
                              <tr key={student.id}>
                                <td className="px-3 py-1.5 text-xs font-medium text-gray-700">{student.name}</td>
                                <td className="px-3 py-1.5 flex justify-center gap-1">
                                  {['H', 'S', 'I', 'A', 'DL'].map(status => (
                                    <button key={status} type="button" onClick={() => handleAttendanceChange(student.id, status as any)} className={`w-7 h-7 rounded text-[10px] font-bold transition-all border ${jourForm.studentAttendance[student.id] === status ? (status === 'H' ? 'bg-green-600 text-white' : status === 'S' ? 'bg-blue-600 text-white' : status === 'I' ? 'bg-orange-600 text-white' : status === 'A' ? 'bg-red-600 text-white' : 'bg-gray-700 text-white') : 'bg-white text-gray-400 hover:border-indigo-300'}`}>{status}</button>
                                  ))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : <div className="py-8 text-center text-gray-400 italic text-sm">Pilih Jam & Kelas di panel kiri terlebih dahulu</div>}
                  </div>
                  
                  <div className="flex gap-3 justify-end">
                    {editingJournalId && <button type="button" onClick={() => {setEditingJournalId(null); setJourForm({...jourForm, activity: '', notes: '', subChapters: [], studentAttendance: {}});}} className="px-6 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold">Batal</button>}
                    <button type="submit" className="px-10 py-3 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center gap-2"><Save size={18}/> Simpan Jurnal & Absensi</button>
                  </div>
                </form>
            </div>

            {/* Results Table Section */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b">
                   <h3 className="font-bold text-gray-800 flex items-center gap-2"><ClipboardList size={20} className="text-emerald-600"/> Riwayat Hasil Input Jurnal</h3>
                   <div className="flex flex-wrap gap-2 items-end">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-gray-500">FILTER TANGGAL</span>
                        <div className="flex gap-2">
                           <input type="date" value={journalDateFrom} onChange={(e) => setJournalDateFrom(e.target.value)} className="border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500" />
                           <span className="text-gray-400">-</span>
                           <input type="date" value={journalDateTo} onChange={(e) => setJournalDateTo(e.target.value)} className="border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500" />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-gray-500">FILTER KELAS</span>
                        <select value={journalFilterClass} onChange={(e) => setJournalFilterClass(e.target.value)} className="border rounded px-2 py-1 text-xs bg-white">
                           <option value="">Semua Kelas</option>
                           {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-red-500">TANGGAL CETAK</span>
                        <input type="date" value={printDate} onChange={(e) => setPrintDate(e.target.value)} className="border border-red-200 rounded px-2 py-1 text-xs bg-red-50 focus:ring-1 focus:ring-red-500" />
                      </div>
                      <div className="relative" ref={journalDownloadRef}>
                        <button onClick={() => setIsJournalDownloadOpen(!isJournalDownloadOpen)} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors">
                          <Download size={14}/> Export <ChevronDown size={14}/>
                        </button>
                        {isJournalDownloadOpen && (
                          <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-xl z-20 overflow-hidden animate-fade-in">
                            <button onClick={exportJournalPDF} className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"><FileText size={14} className="text-red-500"/> Download PDF</button>
                            <button onClick={exportJournalExcel} className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"><FileSpreadsheet size={14} className="text-green-600"/> Download Excel</button>
                            <button onClick={() => window.print()} className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 border-t"><Printer size={14}/> Cetak / Print</button>
                          </div>
                        )}
                      </div>
                   </div>
                </div>

                <div className="overflow-x-auto">
                   <table className="min-w-full divide-y divide-gray-200 border rounded-lg">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase w-10">No</th>
                          <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Waktu/Kelas</th>
                          <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Mata Pelajaran / Materi</th>
                          <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Kegiatan</th>
                          <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Absensi (Nama Siswa)</th>
                          <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Catatan</th>
                          <th className="px-3 py-3 text-center text-[10px] font-bold text-gray-500 uppercase w-16">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {filteredJournals.map((j, idx) => {
                          const absText = getAttendanceDetailString(j.studentAttendance);
                          return (
                            <tr key={j.id} className="hover:bg-indigo-50/20 transition-colors">
                              <td className="px-3 py-2 text-xs text-gray-500">{idx + 1}</td>
                              <td className="px-3 py-2 text-xs whitespace-nowrap">
                                <p className="font-bold text-gray-800">{j.date}</p>
                                <p className="text-[10px] text-indigo-600 font-bold">Jam {j.jamKe} - {j.className}</p>
                              </td>
                              <td className="px-3 py-2 text-xs">
                                <p className="font-bold text-emerald-700">{j.subject}</p>
                                <p className="text-gray-600 line-clamp-1">{j.chapter}</p>
                              </td>
                              <td className="px-3 py-2 text-xs max-w-xs"><p className="line-clamp-2 italic text-gray-600">{j.activity}</p></td>
                              <td className="px-3 py-2 text-xs max-w-[150px]">
                                <span className={`px-2 py-0.5 rounded-lg font-medium text-[9px] block ${absText === 'Nihil' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{absText}</span>
                              </td>
                              <td className="px-3 py-2 text-xs max-w-[150px]"><p className="line-clamp-2 text-gray-500">{j.notes || '-'}</p></td>
                              <td className="px-3 py-2 text-center">
                                <div className="flex justify-center gap-1">
                                  <button 
                                    onClick={() => {
                                      setEditingJournalId(j.id);
                                      setJourForm({
                                        date: j.date, semester: j.semester, jamKe: j.jamKe, className: j.className, subject: j.subject || '', chapter: j.chapter,
                                        subChapters: typeof j.subChapter === 'string' ? j.subChapter.split(', ') : [],
                                        activity: j.activity, notes: j.notes, studentAttendance: j.studentAttendance || {}
                                      });
                                      window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }} 
                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                  ><Edit2 size={14}/></button>
                                  <button onClick={() => onDeleteJournal && onDeleteJournal(j.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 size={14}/></button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredJournals.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-gray-400 italic">Tidak ada data jurnal ditemukan.</td></tr>}
                      </tbody>
                   </table>
                </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAgendaTab = () => {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-fit">
            <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2 border-b pb-4"><Clock size={20} className="text-indigo-600"/> {editingAgendaId ? 'Edit Agenda' : 'Input Agenda Kegiatan'}</h3>
            <form onSubmit={handleAgendaSubmit} className="space-y-4">
              <div><label className="block text-xs font-bold text-gray-600 mb-1">Tanggal</label><input type="date" value={agendaForm.date} onChange={(e) => setAgendaForm({...agendaForm, date: e.target.value})} className="w-full border rounded px-3 py-2 text-sm" required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-gray-600 mb-1">Jam Mulai</label><input type="time" value={agendaForm.timeStart} onChange={(e) => setAgendaForm({...agendaForm, timeStart: e.target.value})} className="w-full border rounded px-3 py-2 text-sm" required /></div>
                <div><label className="block text-xs font-bold text-gray-600 mb-1">Jam Selesai</label><input type="time" value={agendaForm.timeEnd} onChange={(e) => setAgendaForm({...agendaForm, timeEnd: e.target.value})} className="w-full border rounded px-3 py-2 text-sm" required /></div>
              </div>
              <div><label className="block text-xs font-bold text-gray-600 mb-1">Uraian Kegiatan</label><textarea value={agendaForm.activity} onChange={(e) => onActivityChange(e.target.value)} className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" rows={3} required placeholder="Contoh: Mengajar di kelas VII A, Rapat koordinasi..." /></div>
              <div><label className="block text-xs font-bold text-gray-600 mb-1">Keterangan (Otomatis)</label><input type="text" value={agendaForm.remarks} onChange={(e) => setAgendaForm({...agendaForm, remarks: e.target.value})} className="w-full border rounded px-3 py-2 text-sm bg-gray-50" placeholder="Terlaksana / Selesai / Sesuai jadwal..." /></div>
              <div className="flex gap-2 pt-2">{editingAgendaId && <button type="button" onClick={() => {setEditingAgendaId(null); setAgendaForm({date: new Date().toISOString().split('T')[0], timeStart: '07:00', timeEnd: '08:00', activity: '', remarks: ''});}} className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold">Batal</button>}<button type="submit" className="flex-[2] py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-colors shadow-sm">{editingAgendaId ? 'Update Agenda' : 'Simpan Agenda'}</button></div>
            </form>
          </div>
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-end gap-4">
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-gray-500">DARI TANGGAL</span>
                  <input type="date" value={agendaFilterFrom} onChange={(e) => setAgendaFilterFrom(e.target.value)} className="border rounded px-2 py-1 text-xs" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-gray-500">SAMPAI TANGGAL</span>
                  <input type="date" value={agendaFilterTo} onChange={(e) => setAgendaFilterTo(e.target.value)} className="border rounded px-2 py-1 text-xs" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-red-500">TANGGAL CETAK</span>
                  <input type="date" value={agendaPrintDate} onChange={(e) => setAgendaPrintDate(e.target.value)} className="border border-red-200 rounded px-2 py-1 text-xs bg-red-50" />
                </div>
              </div>
              <div className="relative" ref={agendaDownloadRef}>
                <button onClick={() => setIsAgendaDownloadOpen(!isAgendaDownloadOpen)} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors">
                  <Download size={14}/> Export <ChevronDown size={14}/>
                </button>
                {isAgendaDownloadOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-xl z-20 overflow-hidden animate-fade-in">
                    <button onClick={exportAgendaPDF} className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"><FileText size={14} className="text-red-500"/> Download PDF</button>
                    <button onClick={exportAgendaExcel} className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"><FileSpreadsheet size={14} className="text-green-600"/> Download Excel</button>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50">
                    <tr><th className="px-3 py-3 text-left font-bold text-gray-600 w-24">Tanggal</th><th className="px-3 py-3 text-left font-bold text-gray-600 w-24">Waktu</th><th className="px-3 py-3 text-left font-bold text-gray-600">Uraian Kegiatan</th><th className="px-3 py-3 text-left font-bold text-gray-600 w-24">Keterangan</th><th className="px-3 py-3 text-center font-bold text-gray-600 w-16">Aksi</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredAgendas.map(a => (
                      <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-2 text-gray-800">{a.date}</td>
                        <td className="px-3 py-2 font-mono text-indigo-700">{a.timeStart} - {a.timeEnd}</td>
                        <td className="px-3 py-2 text-gray-800 font-medium">{a.activity}</td>
                        <td className="px-3 py-2"><span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px]">{a.remarks}</span></td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex justify-center gap-1">
                            <button onClick={() => {setEditingAgendaId(a.id); setAgendaForm({date: a.date, timeStart: a.timeStart, timeEnd: a.timeEnd, activity: a.activity, remarks: a.remarks}); window.scrollTo({top:0, behavior:'smooth'});}} className="text-blue-500 hover:bg-blue-50 p-1 rounded"><Edit2 size={14}/></button>
                            <button onClick={() => onDeleteAgenda && onDeleteAgenda(a.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={14}/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredAgendas.length === 0 && <tr><td colSpan={5} className="px-3 py-10 text-center text-gray-400 italic">Belum ada riwayat agenda kegiatan.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAttendanceMonitoring = () => {
    const filteredStudents = students.filter(s => s.className === monitoringClass);
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
             <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-6">
                <div className="flex gap-4 items-end">
                    <div><label className="block text-xs font-bold text-gray-600 mb-1">Kelas Pantauan</label><select value={monitoringClass} onChange={(e) => setMonitoringClass(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">{CLASSES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                    <div><label className="block text-xs font-bold text-gray-600 mb-1">Semester</label><select value={monitoringSemester} onChange={(e) => setMonitoringSemester(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm"><option value="Ganjil">Ganjil</option><option value="Genap">Genap</option></select></div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative" ref={monitoringDownloadRef}>
                    <button onClick={() => setIsMonitoringDownloadOpen(!isMonitoringDownloadOpen)} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors">
                      <Download size={16}/> Export <ChevronDown size={16}/>
                    </button>
                    {isMonitoringDownloadOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-xl z-20 overflow-hidden animate-fade-in">
                        <button onClick={exportMonitoringPDF} className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"><FileText size={14} className="text-red-500"/> PDF</button>
                        <button onClick={exportMonitoringExcel} className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"><FileSpreadsheet size={14} className="text-green-600"/> Excel</button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-center px-4 border-r border-gray-200">
                      <p className="text-[10px] font-bold text-gray-500 uppercase">Siswa Aktif</p>
                      <p className="text-xl font-bold text-indigo-600">{filteredStudents.length}</p>
                    </div>
                    <div className="text-center px-4">
                      <p className="text-[10px] font-bold text-gray-500 uppercase">Total Absen (S/I/A)</p>
                      <p className="text-xl font-bold text-red-600">{Object.values(attendanceRecap).reduce((sum: number, s: any) => sum + s.S + s.I + s.A, 0)}</p>
                    </div>
                  </div>
                </div>
             </div>
             <div className="overflow-x-auto border rounded-lg shadow-inner bg-white">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-slate-800 text-white"><tr><th className="px-4 py-3 text-left font-bold w-12 border-r border-slate-600">No</th><th className="px-4 py-3 text-left font-bold border-r border-slate-600">Nama Siswa</th><th className="px-4 py-3 text-center font-bold text-blue-300 w-24 border-r border-slate-600">Sakit (S)</th><th className="px-4 py-3 text-center font-bold text-orange-300 w-24 border-r border-slate-600">Izin (I)</th><th className="px-4 py-3 text-center font-bold text-red-400 w-24 border-r border-slate-600">Alpha (A)</th><th className="px-4 py-3 text-center font-bold text-yellow-300 w-24">Total</th></tr></thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredStudents.map((student, idx) => {
                            const stats = attendanceRecap[student.id] || {S:0, I:0, A:0};
                            const total = stats.S + stats.I + stats.A;
                            return (<tr key={student.id} className="hover:bg-indigo-50/50 transition-colors"><td className="px-4 py-2 text-gray-500 border-r">{idx + 1}</td><td className="px-4 py-2 font-medium border-r">{student.name}</td><td className="px-4 py-2 text-center text-blue-700 font-bold border-r">{stats.S > 0 ? stats.S : '-'}</td><td className="px-4 py-2 text-center text-orange-700 font-bold border-r">{stats.I > 0 ? stats.I : '-'}</td><td className="px-4 py-2 text-center text-red-700 font-bold border-r">{stats.A > 0 ? stats.A : '-'}</td><td className="px-4 py-2 text-center font-extrabold bg-gray-50">{total > 0 ? total : '-'}</td></tr>);
                        })}
                        {filteredStudents.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-gray-400 italic">Tidak ada data siswa untuk kelas ini.</td></tr>}
                    </tbody>
                </table>
             </div>
        </div>
      </div>
    );
  };

  const renderGradesTab = () => {
    const filteredStudents = students.filter(s => s.className === gradeClass);
    const handleGradeChange = (studentId: string, field: string, value: string, chapterIdx?: number) => {
        if (!onUpdateGrade) return;
        const recordId = `${studentId}_${gradeSubject}_${gradeSemester}`;
        const existingRecord = studentGrades.find(r => r.id === recordId) || { id: recordId, studentId, teacherName: currentUser, subject: gradeSubject, className: gradeClass, semester: gradeSemester, academicYear: appSettings.academicYear, chapters: { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} } };
        const numVal = parseFloat(value); const newRecord = { ...existingRecord };
        
        if (chapterIdx) {
            const chIdx = chapterIdx as 1|2|3|4|5; 
            const ch = { ...newRecord.chapters[chIdx] };
            (ch as any)[field] = isNaN(numVal) ? undefined : numVal;
            
            // Sertakan ch.sum ke dalam scoreFields untuk perhitungan Rata-Rata (RR) Bab
            const scoreFields = [ch.f1, ch.f2, ch.f3, ch.f4, ch.f5, ch.sum].filter((n) => typeof n === 'number' && !isNaN(n)) as number[];
            
            if (scoreFields.length > 0) { 
                const sumScores = scoreFields.reduce((a, b) => a + b, 0); 
                ch.avg = parseFloat((sumScores / scoreFields.length).toFixed(2)); 
            } else { 
                ch.avg = undefined; 
            }
            newRecord.chapters[chIdx] = ch;
        } else { (newRecord as any)[field] = isNaN(numVal) ? undefined : numVal; }

        // Recalculate Final Grade considering only visible chapters
        const activeChapterIndices = Array.from({length: numChapters}, (_, i) => (i + 1) as 1|2|3|4|5);
        const chapterAvgs = activeChapterIndices
            .map(idx => newRecord.chapters[idx]?.avg)
            .filter(n => typeof n === 'number') as number[];
            
        const sts = newRecord.sts || 0; 
        const sas = newRecord.sas || 0;
        
        if (chapterAvgs.length > 0 || sts > 0 || sas > 0) { 
            const avgRR = chapterAvgs.length > 0 ? chapterAvgs.reduce((a, b) => a + b, 0) / chapterAvgs.length : 0;
            newRecord.finalGrade = parseFloat(((avgRR + sts + sas) / 3).toFixed(2)); 
        }
        onUpdateGrade(newRecord as GradeRecord);
    };

    return (
        <div className="space-y-6 animate-fade-in">
             <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between gap-4 items-end">
                <div className="flex flex-wrap gap-4 items-end">
                    <div><label className="block text-xs font-bold text-gray-600 mb-1">Semester</label>
                      <select value={gradeSemester} onChange={(e) => setGradeSemester(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm">
                        <option value="Ganjil">Ganjil</option>
                        <option value="Genap">Genap</option>
                      </select>
                    </div>
                    <div><label className="block text-xs font-bold text-gray-600 mb-1">Mapel</label><select value={gradeSubject} onChange={(e) => setGradeSubject(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm min-w-[200px]">{mySubjects.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                    <div><label className="block text-xs font-bold text-gray-600 mb-1">Kelas</label><select value={gradeClass} onChange={(e) => setGradeClass(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm w-32">{CLASSES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                    <div><label className="block text-xs font-bold text-gray-600 mb-1">Jumlah Bab</label>
                      <select value={numChapters} onChange={(e) => setNumChapters(parseInt(e.target.value))} className="border border-gray-300 rounded px-3 py-2 text-sm bg-yellow-50 font-bold">
                        {[1,2,3,4,5].map(v => <option key={v} value={v}>{v} Bab</option>)}
                      </select>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative" ref={gradesDownloadRef}>
                    <button onClick={() => setIsGradesDownloadOpen(!isGradesDownloadOpen)} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors">
                      <Download size={16}/> Export <ChevronDown size={16}/>
                    </button>
                    {isGradesDownloadOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-xl z-20 overflow-hidden animate-fade-in">
                        <button onClick={exportGradesPDF} className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"><FileText size={14} className="text-red-500"/> PDF</button>
                        <button onClick={exportGradesExcel} className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"><FileSpreadsheet size={14} className="text-green-600"/> Excel</button>
                      </div>
                    )}
                  </div>
                </div>
             </div>
             <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto custom-scrollbar">
                <table className="min-w-full divide-y divide-gray-200 text-[10px]">
                    <thead className="bg-slate-800 text-white">
                        <tr>
                            <th rowSpan={2} className="px-2 py-2 w-8 text-center border-r border-slate-600 sticky left-0 z-20 bg-slate-800">No</th>
                            <th rowSpan={2} className="px-2 py-2 w-48 text-left border-r border-slate-600 sticky left-8 z-20 bg-slate-800">Nama Siswa</th>
                            {Array.from({length: numChapters}, (_, i) => i + 1).map(i => (<th key={i} colSpan={7} className={`px-1 py-1 text-center border-r border-slate-600 bg-slate-700`}>BAB {i}</th>))}
                            <th rowSpan={2} className="px-2 py-2 w-16 text-center border-r border-slate-600 bg-orange-700">STS</th>
                            <th rowSpan={2} className="px-2 py-2 w-16 text-center border-r border-slate-600 bg-orange-800">SAS</th>
                            <th rowSpan={2} className="px-2 py-2 w-20 text-center font-bold bg-slate-900 text-yellow-300">NILAI AKHIR</th>
                        </tr>
                        <tr>{Array.from({length: numChapters}, (_, i) => i + 1).map(i => (<React.Fragment key={i}><th className="px-1 py-1 w-12 text-center border-r border-slate-600 bg-slate-700">F1</th><th className="px-1 py-1 w-12 text-center border-r border-slate-600 bg-slate-700">F2</th><th className="px-1 py-1 w-12 text-center border-r border-slate-600 bg-slate-700">F3</th><th className="px-1 py-1 w-12 text-center border-r border-slate-600 bg-slate-700">F4</th><th className="px-1 py-1 w-12 text-center border-r border-slate-600 bg-slate-700">F5</th><th className="px-1 py-1 w-12 text-center border-r border-slate-600 bg-slate-600 font-bold">SUM</th><th className="px-1 py-1 w-12 text-center border-r border-slate-600 bg-slate-900 text-yellow-300 font-bold">RR</th></React.Fragment>))}</tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredStudents.map((student, idx) => {
                            const recordId = `${student.id}_${gradeSubject}_${gradeSemester}`; 
                            const record = (studentGrades.find(r => r.id === recordId) || { chapters: {1:{},2:{},3:{},4:{},5:{}} }) as GradeRecord;
                            return (
                                <tr key={student.id} className="hover:bg-gray-50">
                                    <td className="px-2 py-2 text-center text-gray-500 border-r sticky left-0 z-10 bg-white">{idx + 1}</td>
                                    <td className="px-2 py-2 font-medium truncate border-r sticky left-8 z-10 bg-white" title={student.name}>{student.name}</td>
                                    {Array.from({length: numChapters}, (_, i) => (i + 1) as 1|2|3|4|5).map(chIdx => {
                                        const chData = record?.chapters?.[chIdx] || {};
                                        return (
                                            <React.Fragment key={chIdx}>
                                                {['f1', 'f2', 'f3', 'f4', 'f5'].map(field => {
                                                  const val = (chData as any)?.[field];
                                                  return (
                                                    <td key={field} className={`p-1 border-r ${getScoreColor(val)}`}>
                                                      <input type="number" className="w-10 text-center border-none bg-transparent rounded text-[10px] p-0.5" value={val ?? ''} onChange={(e) => handleGradeChange(student.id, field, e.target.value, chIdx)} />
                                                    </td>
                                                  );
                                                })}
                                                <td className={`p-1 border-r ${getScoreColor(chData?.sum)}`}><input type="number" className="w-10 text-center border-none bg-transparent font-semibold text-[10px] p-0.5" value={chData?.sum ?? ''} onChange={(e) => handleGradeChange(student.id, 'sum', e.target.value, chIdx)} /></td>
                                                <td className={`p-1 border-r ${getScoreColor(chData?.avg)}`}><input type="number" className="w-10 text-center border-none bg-transparent font-bold text-[10px] p-0.5" value={chData?.avg ?? ''} readOnly tabIndex={-1} /></td>
                                            </React.Fragment>
                                        )
                                    })}
                                    <td className={`p-1 border-r ${getScoreColor(record?.sts)}`}><input type="number" className="w-full text-center border-none bg-transparent rounded text-xs p-1" value={record?.sts ?? ''} onChange={(e) => handleGradeChange(student.id, 'sts', e.target.value)} /></td>
                                    <td className={`p-1 border-r ${getScoreColor(record?.sas)}`}><input type="number" className="w-full text-center border-none bg-transparent rounded text-xs p-1" value={record?.sas ?? ''} onChange={(e) => handleGradeChange(student.id, 'sas', e.target.value)} /></td>
                                    <td className={`p-1 font-bold text-center border-l-2 border-slate-300 ${getScoreColor(record?.finalGrade)}`}><input type="number" className="w-full text-center border-none bg-transparent font-bold text-xs p-1" value={record?.finalGrade ?? ''} readOnly /></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
             </div>
        </div>
    );
  };

  const renderHomeroomTab = () => {
    const studentsInClass = students.filter(s => s.className === homeroomForm.className);
    return (
      <div className="space-y-6 animate-fade-in">
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-fit">
               <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2"><ClipboardList className="text-indigo-600"/> {editingHomeroomId ? 'Edit Catatan' : 'Input Catatan Wali Kelas'}</h3>
               <form onSubmit={handleHomeroomSubmit} className="space-y-4">
                  <div><label className="block text-xs font-bold text-gray-600 mb-1">Tanggal</label><input type="date" value={homeroomForm.date} onChange={(e) => setHomeroomForm({...homeroomForm, date: e.target.value})} className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" required /></div>
                  <div><label className="block text-xs font-bold text-gray-600 mb-1">Kelas Binaan</label><select value={homeroomForm.className} onChange={(e) => setHomeroomForm({...homeroomForm, className: e.target.value, studentIds: []})} className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">{CLASSES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Nama Siswa</label>
                    <div className="max-h-40 overflow-y-auto border rounded p-2 bg-gray-50 space-y-1 custom-scrollbar">
                      {studentsInClass.map(s => (
                        <label key={s.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1 rounded group">
                          <input type="checkbox" checked={homeroomForm.studentIds.includes(s.id)} onChange={() => setHomeroomForm(prev => ({...prev, studentIds: prev.studentIds.includes(s.id) ? prev.studentIds.filter(id => id !== s.id) : [...prev.studentIds, s.id]}))} className="rounded text-indigo-600 focus:ring-indigo-500"/>
                          <span className="text-xs text-gray-700 group-hover:text-indigo-600 transition-colors">{s.name}</span>
                        </label>
                      ))}
                      {studentsInClass.length === 0 && <p className="text-[10px] text-gray-400 italic p-2">Pilih kelas binaan terlebih dahulu</p>}
                    </div>
                  </div>
                  
                  {/* Kasus / Permasalahan with Suggestions */}
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1 flex items-center gap-2">Kasus / Permasalahan <Sparkles size={12} className="text-indigo-500"/></label>
                    <textarea 
                      value={homeroomForm.violationType} 
                      onChange={(e) => setHomeroomForm({...homeroomForm, violationType: e.target.value})} 
                      className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 mb-2" 
                      rows={2} 
                      required 
                      placeholder="Input manual atau pilih saran di bawah..."
                    />
                    <div className="flex flex-wrap gap-1">
                      {HOMEROOM_ISSUE_SUGGESTIONS.map((s, idx) => (
                        <button 
                          key={idx} 
                          type="button" 
                          onClick={() => setHomeroomForm({...homeroomForm, violationType: s})}
                          className="text-[9px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100 hover:bg-indigo-100 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tindak Lanjut / Solusi with Suggestions */}
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1 flex items-center gap-2">Tindak Lanjut / Solusi <Sparkles size={12} className="text-emerald-500"/></label>
                    <textarea 
                      value={homeroomForm.solution} 
                      onChange={(e) => setHomeroomForm({...homeroomForm, solution: e.target.value})} 
                      className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 mb-2" 
                      rows={2} 
                      required 
                      placeholder="Input manual atau pilih saran di bawah..."
                    />
                    <div className="flex flex-wrap gap-1">
                      {HOMEROOM_SOLUTION_SUGGESTIONS.map((s, idx) => (
                        <button 
                          key={idx} 
                          type="button" 
                          onClick={() => setHomeroomForm({...homeroomForm, solution: s})}
                          className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded border border-emerald-100 hover:bg-emerald-100 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-all shadow-md active:scale-95 flex items-center justify-center gap-2">
                    <Save size={18}/> Simpan Catatan
                  </button>
               </form>
            </div>
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2"><ClipboardList size={18} className="text-indigo-600"/> Riwayat Catatan Wali Kelas</h3>
                <div className="flex flex-wrap gap-2 items-center">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">DARI TANGGAL</span>
                    <input type="date" value={homeroomFilterFrom} onChange={(e) => setHomeroomFilterFrom(e.target.value)} className="border rounded px-2 py-1 text-xs bg-white focus:ring-1 focus:ring-indigo-500" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">SAMPAI TANGGAL</span>
                    <input type="date" value={homeroomFilterTo} onChange={(e) => setHomeroomFilterTo(e.target.value)} className="border rounded px-2 py-1 text-xs bg-white focus:ring-1 focus:ring-indigo-500" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-red-500 uppercase">TANGGAL CETAK</span>
                    <input type="date" value={homeroomPrintDate} onChange={(e) => setHomeroomPrintDate(e.target.value)} className="border border-red-200 rounded px-2 py-1 text-xs bg-red-50 focus:ring-1 focus:ring-red-500" />
                  </div>
                  <div className="relative mt-auto" ref={homeroomDownloadRef}>
                    <button onClick={() => setIsHomeroomDownloadOpen(!isHomeroomDownloadOpen)} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors">
                      <Download size={14}/> Export <ChevronDown size={14}/>
                    </button>
                    {isHomeroomDownloadOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-xl z-20 overflow-hidden animate-fade-in">
                        <button onClick={exportHomeroomPDF} className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"><FileText size={14} className="text-red-500"/> Download PDF</button>
                        <button onClick={exportHomeroomExcel} className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"><FileSpreadsheet size={14} className="text-green-600"/> Download Excel</button>
                      </div>
                    )}
                  </div>
                  <div className="relative mt-auto">
                    <Search className="absolute left-2 top-1.5 text-gray-400" size={14}/>
                    <input 
                      type="text" 
                      placeholder="Cari..." 
                      value={homeroomSearchTerm}
                      onChange={(e) => setHomeroomSearchTerm(e.target.value)}
                      className="pl-7 pr-3 py-1.5 border rounded-lg text-xs bg-gray-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 w-24 md:w-32" 
                    />
                  </div>
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-bold text-gray-600 w-24">Tanggal</th>
                        <th className="px-4 py-3 text-left font-bold text-gray-600">Siswa</th>
                        <th className="px-4 py-3 text-left font-bold text-gray-600">Masalah</th>
                        <th className="px-4 py-3 text-left font-bold text-gray-600">Solusi / Tindak Lanjut</th>
                        <th className="px-4 py-3 text-center font-bold text-gray-600 w-16">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredHomeroomHistory.map(rec => (
                        <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{rec.date}</td>
                          <td className="px-4 py-2 font-bold text-indigo-700">{students.find(s => s.id === rec.studentId)?.name || 'N/A'}</td>
                          <td className="px-4 py-2 text-gray-600 font-medium">{rec.violationType}</td>
                          <td className="px-4 py-2 text-gray-500 italic">{rec.solution || '-'}</td>
                          <td className="px-4 py-2 text-center">
                            <div className="flex justify-center gap-1">
                              <button onClick={() => {setEditingHomeroomId(rec.id); setHomeroomForm({date: rec.date, className: rec.className, studentIds: [rec.studentId], violationType: rec.violationType, solution: rec.solution, notes: rec.notes}); window.scrollTo({top:0, behavior:'smooth'});}} className="text-blue-500 hover:bg-blue-50 p-1 rounded transition-colors"><Edit2 size={14}/></button>
                              <button onClick={() => onDeleteHomeroomRecord && onDeleteHomeroomRecord(rec.id)} className="text-red-500 hover:bg-red-50 p-1 rounded transition-colors"><Trash2 size={14}/></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredHomeroomHistory.length === 0 && (
                        <tr><td colSpan={5} className="py-10 text-center text-gray-400 italic">Tidak ada catatan ditemukan.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
         </div>
      </div>
    );
  };

  const renderAttitudeTab = () => {
    const classStudents = students.filter(s => s.className === attitudeForm.className);
    return (
        <div className="space-y-6 animate-fade-in">
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-fit">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Heart size={20} className="text-pink-500"/> {editingAttitudeId ? 'Edit Sikap' : 'Input Jurnal Sikap'}</h3>
                    <form onSubmit={handleAttitudeSubmit} className="space-y-4">
                        <div><label className="block text-xs font-bold text-gray-600 mb-1">Tanggal</label><input type="date" value={attitudeForm.date} onChange={(e) => setAttitudeForm({...attitudeForm, date: e.target.value})} className="w-full border rounded px-3 py-2 text-sm" required /></div>
                        <div><label className="block text-xs font-bold text-gray-600 mb-1">Kelas</label><select value={attitudeForm.className} onChange={(e) => setAttitudeForm({...attitudeForm, className: e.target.value, studentIds: []})} className="w-full border rounded px-3 py-2 text-sm">{CLASSES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                        <div><div className="flex justify-between items-center mb-1"><label className="block text-xs font-bold text-gray-600">Nama Siswa</label><button type="button" onClick={() => setAttitudeForm(prev => ({...prev, studentIds: prev.studentIds.length === classStudents.length ? [] : classStudents.map(s => s.id)}))} className="text-[10px] text-indigo-600 hover:underline">Pilih Semua</button></div>
                            <div className="max-h-40 overflow-y-auto border rounded p-2 bg-gray-50 space-y-1 custom-scrollbar">
                                {classStudents.map(s => (<label key={s.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1 rounded"><input type="checkbox" checked={attitudeForm.studentIds.includes(s.id)} onChange={() => setAttitudeForm(prev => ({...prev, studentIds: prev.studentIds.includes(s.id) ? prev.studentIds.filter(id => id !== s.id) : [...prev.studentIds, s.id]}))} className="rounded text-indigo-600 focus:ring-indigo-500"/><span className="text-xs text-gray-700">{s.name}</span></label>))}
                            </div>
                        </div>
                        <div><label className="block text-xs font-bold text-gray-600 mb-1">Kejadian / Perilaku</label><input list="all-behavior-suggestions" type="text" value={attitudeForm.behavior} onChange={(e) => handleBehaviorAutoSelect(e.target.value)} className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 mb-2" placeholder="Ketik atau pilih..." required /><datalist id="all-behavior-suggestions">{[...ATTITUDE_BEHAVIORS.POSITIVE, ...ATTITUDE_BEHAVIORS.NEGATIVE].map((s, i) => <option key={i} value={s.behavior} />)}</datalist>
                            <div className="mb-2"><span className="text-[9px] font-bold text-green-600 uppercase flex items-center gap-1 mb-1"><CheckCircle2 size={10}/> Positif (Apresiasi):</span><div className="flex flex-wrap gap-1">{ATTITUDE_BEHAVIORS.POSITIVE.map((s, i) => (<button key={i} type="button" onClick={() => handleBehaviorAutoSelect(s.behavior)} className="text-[10px] bg-green-50 text-green-700 px-2 py-1 rounded border border-green-200 hover:bg-green-100 transition-colors">{s.behavior}</button>))}</div></div>
                            <div className="mb-2"><span className="text-[9px] font-bold text-red-600 uppercase flex items-center gap-1 mb-1"><AlertCircle size={10}/> Negatif (Pembinaan):</span><div className="flex flex-wrap gap-1">{ATTITUDE_BEHAVIORS.NEGATIVE.map((s, i) => (<button key={i} type="button" onClick={() => handleBehaviorAutoSelect(s.behavior)} className="text-[10px] bg-red-50 text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-100 transition-colors">{s.behavior}</button>))}</div></div>
                        </div>
                        <div><label className="block text-xs font-bold text-gray-600 mb-1">Tindak Lanjut</label><textarea value={attitudeForm.actionTaken} onChange={(e) => setAttitudeForm({...attitudeForm, actionTaken: e.target.value})} className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 mb-1" rows={2} required />
                            <div className="flex flex-wrap gap-1">{COMMON_ACTIONS.map((a, i) => (<button key={i} type="button" onClick={() => setAttitudeForm({...attitudeForm, actionTaken: a})} className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-200">{a}</button>))}</div>
                        </div>
                        <div><label className="block text-xs font-bold text-gray-600 mb-1">Keterangan</label><textarea value={attitudeForm.notes} onChange={(e) => setAttitudeForm({...attitudeForm, notes: e.target.value})} className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 mb-1" rows={2} />
                            <div className="flex flex-wrap gap-1">{COMMON_NOTES.map((n, i) => (<button key={i} type="button" onClick={() => setAttitudeForm({...attitudeForm, notes: n})} className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-200">{n}</button>))}</div>
                        </div>
                        <div className="flex gap-2 pt-2">{editingAttitudeId && <button type="button" onClick={() => {setEditingAttitudeId(null); setAttitudeForm({date: new Date().toISOString().split('T')[0], className: CLASSES[0], studentIds: [], behavior: '', actionTaken: '', notes: ''});}} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold text-sm">Batal</button>}<button type="submit" className="flex-[2] py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 shadow-sm transition-all">{editingAttitudeId ? 'Update' : 'Simpan'}</button></div>
                    </form>
                </div>
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <h3 className="font-bold text-gray-800">Riwayat Penilaian Sikap</h3>
                        <div className="flex flex-wrap gap-2 items-center">
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-gray-500 uppercase">DARI TANGGAL</span>
                                <input type="date" value={attitudeFilterFrom} onChange={(e) => setAttitudeFilterFrom(e.target.value)} className="border rounded px-2 py-1 text-xs bg-white" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-gray-500 uppercase">SAMPAI TANGGAL</span>
                                <input type="date" value={attitudeFilterTo} onChange={(e) => setAttitudeFilterTo(e.target.value)} className="border rounded px-2 py-1 text-xs bg-white" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-red-500 uppercase">TANGGAL CETAK</span>
                                <input type="date" value={attitudePrintDate} onChange={(e) => setAttitudePrintDate(e.target.value)} className="border border-red-200 rounded px-2 py-1 text-xs bg-red-50" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-gray-500 uppercase">KELAS</span>
                                <select value={attitudeFilterClass} onChange={(e) => setAttitudeFilterClass(e.target.value)} className="border rounded px-2 py-1 text-xs bg-white focus:ring-1 focus:ring-indigo-500"><option value="">Semua</option>{CLASSES.map(c => <option key={c} value={c}>{c}</option>)}</select>
                            </div>
                            <div className="relative mt-auto" ref={attitudeDownloadRef}>
                                <button onClick={() => setIsAttitudeDownloadOpen(!isAttitudeDownloadOpen)} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors">
                                    <Download size={14}/> Export <ChevronDown size={14}/>
                                </button>
                                {isAttitudeDownloadOpen && (
                                    <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-xl z-20 overflow-hidden animate-fade-in">
                                        <button onClick={exportAttitudePDF} className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"><FileText size={14} className="text-red-500"/> Download PDF</button>
                                        <button onClick={exportAttitudeExcel} className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"><FileSpreadsheet size={14} className="text-green-600"/> Download Excel</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="min-w-full divide-y divide-gray-200 text-xs">
                                <thead className="bg-gray-50"><tr><th className="px-3 py-3 text-left font-bold text-gray-600 w-8">No</th><th className="px-3 py-3 text-left font-bold text-gray-600 w-24">Tanggal</th><th className="px-3 py-3 text-left font-bold text-gray-600">Siswa</th><th className="px-3 py-3 text-left font-bold text-gray-600">Kejadian</th><th className="px-3 py-3 text-left font-bold text-gray-600">Tindak Lanjut</th><th className="px-3 py-3 text-left font-bold text-gray-600">Keterangan</th><th className="px-3 py-3 text-center font-bold text-gray-600 w-16">Aksi</th></tr></thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredAttitudeHistory.map((r, idx) => {
                                        const isNegative = ATTITUDE_BEHAVIORS.NEGATIVE.some(n => n.behavior === r.behavior);
                                        return (
                                            <tr key={r.id} className="hover:bg-gray-50 transition-colors"><td className="px-3 py-2 text-gray-500 text-center">{idx + 1}</td><td className="px-3 py-2 whitespace-nowrap">{r.date} <span className="text-indigo-600 font-bold ml-1">[{r.className}]</span></td><td className="px-3 py-2 font-medium">{students.find(s => s.id === r.studentId)?.name || 'N/A'}</td><td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded-full font-medium ${isNegative ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{r.behavior}</span></td><td className="px-3 py-2 text-gray-600 italic">"{r.actionTaken}"</td><td className="px-3 py-2 text-gray-500 truncate max-w-[150px]" title={r.notes}>{r.notes || '-'}</td><td className="px-3 py-2 text-center"><div className="flex justify-center gap-1"><button onClick={() => {setEditingAttitudeId(r.id); setAttitudeForm({date: r.date, className: r.className, studentIds: [r.studentId], behavior: r.behavior, actionTaken: r.actionTaken, notes: r.notes});}} className="text-blue-500 hover:bg-blue-50 p-1 rounded"><Edit2 size={14}/></button><button onClick={() => onDeleteAttitudeRecord && onDeleteAttitudeRecord(r.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={14}/></button></div></td></tr>
                                        );
                                    })}
                                    {filteredAttitudeHistory.length === 0 && (
                                        <tr><td colSpan={7} className="px-3 py-10 text-center text-gray-400 italic">Belum ada riwayat penilaian sikap.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
             </div>
        </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-h-[600px] flex flex-col animate-fade-in">
      <div className="p-6 flex-1 overflow-y-auto">
         {activeTab === 'CLASS' && (
            <div className="space-y-6 animate-fade-in">
               <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2"><span className="text-sm font-bold text-gray-600">Pilih Kelas:</span><select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">{CLASSES.map(cls => <option key={cls} value={cls}>{cls}</option>)}</select></div>
                  <button onClick={() => {}} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-sm transition-colors"><Download size={16} /> Download PDF</button>
               </div>
               <div className="overflow-x-auto border rounded-xl shadow-sm custom-scrollbar">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                     <thead className="bg-slate-800 text-white"><tr><th className="px-4 py-3 text-center w-24">Jam</th><th className="px-4 py-3 text-center w-32">Waktu</th><th className="px-4 py-3 text-left">Mata Pelajaran</th><th className="px-4 py-3 text-left">Guru</th></tr></thead>
                     <tbody className="bg-white divide-y divide-gray-200">{SCHEDULE_DATA.flatMap(day => [<tr key={`header-${day.day}`} className="bg-gray-100"><td colSpan={4} className="px-4 py-2 font-bold text-gray-700 border-y border-gray-200">{day.day}</td></tr>, ...day.rows.map((row) => { if(row.activity) { return (<tr key={`${day.day}-${row.jam}`} className="bg-orange-50"><td className="px-4 py-3 text-center font-bold text-gray-500">{row.jam}</td><td className="px-4 py-3 text-center font-mono text-xs text-gray-500">{row.waktu}</td><td colSpan={2} className="px-4 py-3 text-center font-bold text-orange-800">{row.activity}</td></tr>); } const key = `${day.day}-${row.jam}-${selectedClass}`; const code = scheduleMap[key]; const info = code ? codeToDataMap[code] : null; return (<tr key={`${day.day}-${row.jam}`} className="hover:bg-gray-50 transition-colors"><td className="px-4 py-3 text-center font-bold text-gray-600">{row.jam}</td><td className="px-4 py-3 text-center font-mono text-xs text-gray-500">{row.waktu}</td><td className="px-4 py-3 font-medium text-gray-900">{info?.subject || '-'}</td><td className="px-4 py-3 text-gray-600">{info?.name || '-'}</td></tr>); })])}</tbody>
                  </table>
               </div>
            </div>
         )}
         {activeTab === 'TEACHER' && (
            <div className="space-y-6 animate-fade-in">
               <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2"><span className="text-sm font-bold text-gray-600">Pilih Guru:</span><select value={selectedTeacherId} onChange={(e) => setSelectedTeacherId(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm max-w-xs focus:ring-2 focus:ring-indigo-500"><option value="">-- Pilih Guru --</option>{teacherNames.map(name => { const t = teacherData.find(td => td.name === name); return t ? <option key={name} value={String(t.id)}>{name}</option> : null; })}</select></div>
                  <button onClick={() => {}} disabled={!selectedTeacherId} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-sm disabled:bg-gray-300 transition-colors"><Download size={16} /> Download PDF</button>
               </div>
               {selectedTeacherId && (
                 <div className="overflow-x-auto border rounded-xl shadow-sm custom-scrollbar">
                   <table className="min-w-full divide-y divide-gray-200 text-sm">
                     <thead className="bg-emerald-800 text-white"><tr><th className="px-4 py-3 text-center w-24">Jam</th><th className="px-4 py-3 text-center w-32">Waktu</th><th className="px-4 py-3 text-left">Aktivitas / Kelas</th></tr></thead>
                     <tbody className="bg-white divide-y divide-gray-200">
                       {SCHEDULE_DATA.flatMap(day => {
                         const teacher = teacherData.find(t => String(t.id) === selectedTeacherId);
                         const myCodes = teacherData.filter(t => t.name === teacher?.name).map(t => t.code);
                         return [<tr key={`day-${day.day}`} className="bg-gray-100"><td colSpan={3} className="font-bold text-gray-700 px-4 py-2">{day.day}</td></tr>, ...day.rows.map(row => {
                           let teachingLabel = '-';
                           if (row.activity) { teachingLabel = row.activity; } 
                           else {
                             const classesFound: string[] = [];
                             CLASSES.forEach(cls => {
                               const key = `${day.day}-${row.jam}-${cls}`;
                               const code = scheduleMap[key];
                               if (code && myCodes.includes(code)) {
                                 const info = codeToDataMap[code];
                                 classesFound.push(`${cls} (${info?.subject})`);
                               }
                             });
                             if (classesFound.length > 0) teachingLabel = classesFound.join(', ');
                           }
                           return (<tr key={`${day.day}-${row.jam}`} className={`hover:bg-gray-50 transition-colors ${row.activity ? 'bg-orange-50/30' : ''}`}><td className="px-4 py-3 text-center font-bold text-gray-400">{row.jam}</td><td className="px-4 py-3 text-center font-mono text-xs text-gray-500">{row.waktu}</td><td className={`px-4 py-3 ${teachingLabel !== '-' ? 'font-bold text-indigo-700' : 'text-gray-300'}`}>{teachingLabel}</td></tr>);
                         })];
                       })}
                     </tbody>
                   </table>
                 </div>
               )}
            </div>
         )}
         {activeTab === 'JOURNAL' && renderJournalTab()}
         {activeTab === 'AGENDA' && renderAgendaTab()}
         {activeTab === 'ATTITUDE' && renderAttitudeTab()}
         {activeTab === 'MONITORING' && renderAttendanceMonitoring()}
         {activeTab === 'GRADES' && renderGradesTab()}
         {activeTab === 'HOMEROOM' && renderHomeroomTab()}
      </div>
    </div>
  );
};

export default ClassTeacherSchedule;
