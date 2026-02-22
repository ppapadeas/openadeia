import { useState, useEffect, useCallback } from "react";

// ─── NOK Rules Engine Data ────────────────────────────────────────
const NOK_RULES = {
  "vod": {
    id: "vod",
    label: "Βεβαίωση Όρων Δόμησης",
    shortLabel: "ΒΟΔ",
    category: "info",
    color: "#3B82F6",
    requiredStudies: [],
    requiredDocuments: [
      { id: "topio", label: "Τοπογραφικό Διάγραμμα", type: "study", signer: "surveyor" },
      { id: "kaek", label: "Κωδικός ΚΑΕΚ Ακινήτου", type: "info", signer: null },
      { id: "title_deed", label: "Τίτλος Ιδιοκτησίας", type: "legal", signer: null },
      { id: "identity", label: "Ταυτότητα Ιδιοκτήτη", type: "id", signer: null },
      { id: "aitisi", label: "Αίτηση (Έντυπο e-Άδειες)", type: "form", signer: "owner" },
    ],
    requiredApprovals: ["ΥΔΟΜ"],
    estimatedDays: 15,
    fees: { tee: true, municipality: false },
    nokArticles: ["Ν.4067/2012 Άρθρο 26"],
  },
  "cat1": {
    id: "cat1",
    label: "Έγκριση Εργασιών Μικρής Κλίμακας",
    shortLabel: "Κατ.1",
    category: "minor",
    color: "#F59E0B",
    requiredStudies: [
      { id: "arch_cat1", label: "Αρχιτεκτονική Μελέτη (απλοποιημένη)", signer: "architect" },
    ],
    requiredDocuments: [
      { id: "topio", label: "Τοπογραφικό Διάγραμμα", type: "study", signer: "surveyor" },
      { id: "photos", label: "Φωτογραφική Τεκμηρίωση", type: "media", signer: null },
      { id: "title_deed", label: "Τίτλος Ιδιοκτησίας", type: "legal", signer: null },
      { id: "identity", label: "Ταυτότητα Ιδιοκτήτη", type: "id", signer: null },
      { id: "tax_cert", label: "Φορολογική Ενημερότητα", type: "tax", signer: null },
      { id: "ika_cert", label: "Ασφαλιστική Ενημερότητα", type: "insurance", signer: null },
      { id: "aitisi", label: "Αίτηση (Έντυπο e-Άδειες)", type: "form", signer: "owner" },
      { id: "yp_dilosi", label: "Υπεύθυνη Δήλωση Ιδιοκτήτη", type: "form", signer: "owner" },
    ],
    requiredApprovals: ["ΥΔΟΜ"],
    estimatedDays: 30,
    fees: { tee: true, municipality: true },
    nokArticles: ["Ν.4067/2012 Άρθρο 29", "Ν.4495/2017"],
  },
  "cat2": {
    id: "cat2",
    label: "Οικοδομική Άδεια (Κατ. 2)",
    shortLabel: "Κατ.2",
    category: "major",
    color: "#EF4444",
    requiredStudies: [
      { id: "arch", label: "Αρχιτεκτονική Μελέτη", signer: "architect" },
      { id: "static", label: "Στατική Μελέτη", signer: "civil_eng" },
      { id: "emech", label: "Η/Μ Μελέτη", signer: "mech_eng" },
      { id: "energy", label: "Μελέτη Ενεργειακής Απόδοσης (ΚΕΝΑΚ)", signer: "energy_eng" },
      { id: "fire", label: "Μελέτη Πυροπροστασίας", signer: "fire_eng" },
      { id: "env", label: "Περιβαλλοντική Μελέτη (εφόσον απαιτείται)", signer: "env_eng" },
    ],
    requiredDocuments: [
      { id: "topio", label: "Τοπογραφικό Διάγραμμα", type: "study", signer: "surveyor" },
      { id: "diag_kal", label: "Διάγραμμα Κάλυψης", type: "study", signer: "architect" },
      { id: "title_deed", label: "Τίτλος Ιδιοκτησίας", type: "legal", signer: null },
      { id: "identity", label: "Ταυτότητα Ιδιοκτήτη", type: "id", signer: null },
      { id: "kaek", label: "Κωδικός ΚΑΕΚ Ακινήτου", type: "info", signer: null },
      { id: "tax_cert", label: "Φορολογική Ενημερότητα", type: "tax", signer: null },
      { id: "ika_cert", label: "Ασφαλιστική Ενημερότητα", type: "insurance", signer: null },
      { id: "symvasi", label: "Σύμβαση Μηχανικού-Ιδιοκτήτη", type: "legal", signer: "both" },
      { id: "amea", label: "Μελέτη Προσβασιμότητας ΑμεΑ", type: "study", signer: "architect" },
      { id: "aitisi", label: "Αίτηση (Έντυπο e-Άδειες)", type: "form", signer: "owner" },
      { id: "yp_dilosi", label: "Υπεύθυνη Δήλωση Ιδιοκτήτη", type: "form", signer: "owner" },
      { id: "yp_eng", label: "Υπεύθυνη Δήλωση Μηχανικού", type: "form", signer: "engineer" },
    ],
    requiredApprovals: ["ΥΔΟΜ", "Πυροσβεστική", "Δασαρχείο (εφόσον)", "Αρχαιολογία (εφόσον)"],
    estimatedDays: 60,
    fees: { tee: true, municipality: true, efka: true },
    nokArticles: ["Ν.4067/2012 Άρθρα 3-7, 26-28", "Ν.4495/2017"],
  },
  "cat3": {
    id: "cat3",
    label: "Οικοδομική Άδεια (Κατ. 3)",
    shortLabel: "Κατ.3",
    category: "complex",
    color: "#7C3AED",
    requiredStudies: [
      { id: "arch", label: "Αρχιτεκτονική Μελέτη", signer: "architect" },
      { id: "static", label: "Στατική Μελέτη", signer: "civil_eng" },
      { id: "emech", label: "Η/Μ Μελέτη", signer: "mech_eng" },
      { id: "energy", label: "Μελέτη Ενεργειακής Απόδοσης (ΚΕΝΑΚ)", signer: "energy_eng" },
      { id: "fire", label: "Μελέτη Πυροπροστασίας", signer: "fire_eng" },
      { id: "env", label: "Περιβαλλοντική Μελέτη", signer: "env_eng" },
      { id: "acoustic", label: "Ακουστική Μελέτη", signer: "acoustic_eng" },
      { id: "geotechnical", label: "Γεωτεχνική Μελέτη", signer: "geotechnical_eng" },
    ],
    requiredDocuments: [
      { id: "topio", label: "Τοπογραφικό Διάγραμμα", type: "study", signer: "surveyor" },
      { id: "diag_kal", label: "Διάγραμμα Κάλυψης", type: "study", signer: "architect" },
      { id: "title_deed", label: "Τίτλος Ιδιοκτησίας", type: "legal", signer: null },
      { id: "identity", label: "Ταυτότητα Ιδιοκτήτη", type: "id", signer: null },
      { id: "kaek", label: "Κωδικός ΚΑΕΚ Ακινήτου", type: "info", signer: null },
      { id: "tax_cert", label: "Φορολογική Ενημερότητα", type: "tax", signer: null },
      { id: "ika_cert", label: "Ασφαλιστική Ενημερότητα", type: "insurance", signer: null },
      { id: "symvasi", label: "Σύμβαση Μηχανικού-Ιδιοκτήτη", type: "legal", signer: "both" },
      { id: "amea", label: "Μελέτη Προσβασιμότητας ΑμεΑ", type: "study", signer: "architect" },
      { id: "eea", label: "Έγκριση Εισαγγελέα (για ειδικά κτίρια)", type: "approval", signer: null },
      { id: "aitisi", label: "Αίτηση (Έντυπο e-Άδειες)", type: "form", signer: "owner" },
      { id: "yp_dilosi", label: "Υπεύθυνη Δήλωση Ιδιοκτήτη", type: "form", signer: "owner" },
      { id: "yp_eng", label: "Υπεύθυνη Δήλωση Μηχανικού", type: "form", signer: "engineer" },
    ],
    requiredApprovals: ["ΥΔΟΜ", "Πυροσβεστική", "Δασαρχείο", "Αρχαιολογία", "Συμβούλιο Αρχιτεκτονικής"],
    estimatedDays: 90,
    fees: { tee: true, municipality: true, efka: true, special: true },
    nokArticles: ["Ν.4067/2012", "Ν.4495/2017", "Ν.4759/2020"],
  }
};

const WORKFLOW_STAGES = [
  { id: "init", label: "Καταχώρηση", icon: "📋" },
  { id: "data_collection", label: "Συλλογή Στοιχείων", icon: "📄" },
  { id: "studies", label: "Μελέτες", icon: "📐" },
  { id: "signatures", label: "Υπογραφές", icon: "✍️" },
  { id: "submission", label: "Υποβολή", icon: "📤" },
  { id: "review", label: "Έλεγχος ΥΔΟΜ", icon: "🏛️" },
  { id: "approved", label: "Έγκριση", icon: "✅" },
];

// ─── Demo Data ────────────────────────────────────────────────────
const DEMO_PROJECTS = [
  {
    id: "PRJ-2026-001",
    type: "cat2",
    title: "Νέα Κατοικία — Αβία Μεσσηνίας",
    client: { name: "Γεώργιος Παπαδόπουλος", email: "g.papadopoulos@email.gr", phone: "6971234567", afm: "012345678" },
    property: { kaek: "22-05-14-01-00123", address: "Αρχοντικό Αβίας, Μεσσηνία", area: 180 },
    stage: "studies",
    progress: 45,
    createdAt: "2026-01-15",
    deadline: "2026-03-15",
    documents: {
      topio: "uploaded", diag_kal: "pending", title_deed: "uploaded", identity: "uploaded",
      kaek: "uploaded", tax_cert: "pending", ika_cert: "pending", symvasi: "signed",
      amea: "pending", aitisi: "signed", yp_dilosi: "signed", yp_eng: "signed"
    },
    studies: {
      arch: "in_progress", static: "not_started", emech: "not_started",
      energy: "not_started", fire: "not_started", env: "na"
    },
    logs: [
      { date: "2026-01-15", action: "Δημιουργία φακέλου", user: "Πιέρρος Π." },
      { date: "2026-01-16", action: "Αποστολή email πελάτη για δικαιολογητικά", user: "Σύστημα" },
      { date: "2026-01-20", action: "Λήψη τίτλου ιδιοκτησίας", user: "Πιέρρος Π." },
      { date: "2026-01-25", action: "Ανάρτηση τοπογραφικού", user: "Κ. Σταυρίδης (Τοπογράφος)" },
      { date: "2026-02-01", action: "Έναρξη αρχιτεκτονικής μελέτης", user: "Πιέρρος Π." },
    ]
  },
  {
    id: "PRJ-2026-002",
    type: "vod",
    title: "ΒΟΔ — Οικόπεδο Καλαμάτα",
    client: { name: "Μαρία Κωστοπούλου", email: "m.kostopoulou@email.gr", phone: "6982345678", afm: "098765432" },
    property: { kaek: "22-04-01-03-00456", address: "Καλαμάτα, Μεσσηνία", area: 450 },
    stage: "review",
    progress: 80,
    createdAt: "2026-02-01",
    deadline: "2026-02-16",
    documents: { topio: "uploaded", kaek: "uploaded", title_deed: "uploaded", identity: "uploaded", aitisi: "signed" },
    studies: {},
    logs: [
      { date: "2026-02-01", action: "Δημιουργία φακέλου ΒΟΔ", user: "Πιέρρος Π." },
      { date: "2026-02-03", action: "Υποβολή στο e-Άδειες", user: "Σύστημα" },
      { date: "2026-02-05", action: "Σε έλεγχο ΥΔΟΜ", user: "Σύστημα" },
    ]
  },
  {
    id: "PRJ-2026-003",
    type: "cat1",
    title: "Περίφραξη & Διαμόρφωση — Πεταλίδι",
    client: { name: "Αντώνης Νικολάου", email: "a.nikolaou@email.gr", phone: "6993456789", afm: "111222333" },
    property: { kaek: "22-05-06-02-00789", address: "Πεταλίδι, Μεσσηνία", area: 1200 },
    stage: "signatures",
    progress: 65,
    createdAt: "2026-01-28",
    deadline: "2026-02-28",
    documents: {
      topio: "uploaded", photos: "uploaded", title_deed: "uploaded", identity: "uploaded",
      tax_cert: "uploaded", ika_cert: "pending", aitisi: "signed", yp_dilosi: "pending"
    },
    studies: { arch_cat1: "completed" },
    logs: [
      { date: "2026-01-28", action: "Δημιουργία φακέλου", user: "Πιέρρος Π." },
      { date: "2026-02-05", action: "Ολοκλήρωση αρχιτεκτονικής", user: "Πιέρρος Π." },
      { date: "2026-02-10", action: "Αναμονή υπογραφών", user: "Σύστημα" },
    ]
  }
];

// ─── Utility Components ───────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const styles = {
    uploaded: { bg: "rgba(16,185,129,0.12)", color: "#059669", label: "Ανέβηκε" },
    signed: { bg: "rgba(16,185,129,0.12)", color: "#059669", label: "Υπεγράφη" },
    completed: { bg: "rgba(16,185,129,0.12)", color: "#059669", label: "Ολοκληρώθηκε" },
    in_progress: { bg: "rgba(59,130,246,0.12)", color: "#2563EB", label: "Σε εξέλιξη" },
    pending: { bg: "rgba(245,158,11,0.12)", color: "#D97706", label: "Εκκρεμεί" },
    not_started: { bg: "rgba(107,114,128,0.1)", color: "#6B7280", label: "Δεν ξεκίνησε" },
    na: { bg: "rgba(107,114,128,0.06)", color: "#9CA3AF", label: "Δεν απαιτείται" },
  };
  const s = styles[status] || styles.pending;
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 11,
      fontWeight: 600, background: s.bg, color: s.color, letterSpacing: "0.02em",
    }}>{s.label}</span>
  );
};

const ProgressRing = ({ progress, size = 54, stroke = 4, color }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (progress / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(200,200,210,0.2)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.8s ease" }} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        style={{ transform: "rotate(90deg)", transformOrigin: "center", fontSize: 13, fontWeight: 700, fill: color }}>
        {progress}%
      </text>
    </svg>
  );
};

// ─── Main App ─────────────────────────────────────────────────────
export default function EAdeiesManager() {
  const [view, setView] = useState("dashboard");
  const [selectedProject, setSelectedProject] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newForm, setNewForm] = useState({ type: "vod", title: "", clientName: "", clientEmail: "", kaek: "", address: "" });
  const [projects, setProjects] = useState(DEMO_PROJECTS);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [toastMsg, setToastMsg] = useState(null);

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }, []);

  const openProject = (p) => { setSelectedProject(p); setView("project"); setActiveTab("overview"); };
  const goHome = () => { setView("dashboard"); setSelectedProject(null); };

  const handleNewProject = () => {
    const rule = NOK_RULES[newForm.type];
    const newP = {
      id: `PRJ-2026-${String(projects.length + 1).padStart(3, "0")}`,
      type: newForm.type,
      title: newForm.title || `${rule.label} — ${newForm.address}`,
      client: { name: newForm.clientName, email: newForm.clientEmail, phone: "", afm: "" },
      property: { kaek: newForm.kaek, address: newForm.address, area: 0 },
      stage: "init",
      progress: 5,
      createdAt: new Date().toISOString().split("T")[0],
      deadline: "",
      documents: Object.fromEntries([...rule.requiredDocuments.map(d => [d.id, "pending"])]),
      studies: Object.fromEntries([...rule.requiredStudies.map(s => [s.id, "not_started"])]),
      logs: [{ date: new Date().toISOString().split("T")[0], action: "Δημιουργία φακέλου", user: "Πιέρρος Π." }]
    };
    setProjects([newP, ...projects]);
    setShowNewModal(false);
    setNewForm({ type: "vod", title: "", clientName: "", clientEmail: "", kaek: "", address: "" });
    openProject(newP);
    showToast("Νέος φάκελος δημιουργήθηκε!");
  };

  const sendEmail = () => {
    if (selectedProject) {
      const updated = { ...selectedProject, logs: [...selectedProject.logs, { date: new Date().toISOString().split("T")[0], action: `Email σε ${emailTo}: "${emailSubject}"`, user: "Σύστημα" }] };
      setSelectedProject(updated);
      setProjects(projects.map(p => p.id === updated.id ? updated : p));
    }
    setEmailModalOpen(false);
    setEmailTo(""); setEmailSubject(""); setEmailBody("");
    showToast("Email εστάλη επιτυχώς!");
  };

  const prepEmail = (to, subject, body) => {
    setEmailTo(to); setEmailSubject(subject); setEmailBody(body); setEmailModalOpen(true);
  };

  // ─── Styles ───────────────────────────────────────────────────
  const fontUrl = "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;600&display=swap";
  const root = {
    fontFamily: "'DM Sans', sans-serif", background: "#0B0E14", color: "#E2E4E9",
    minHeight: "100vh", display: "flex", fontSize: 14, lineHeight: 1.5, position: "relative",
  };
  const sidebar = {
    width: sidebarCollapsed ? 60 : 240, minHeight: "100vh", background: "#10141C",
    borderRight: "1px solid rgba(255,255,255,0.06)", transition: "width 0.3s ease",
    display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0,
  };
  const main = { flex: 1, minWidth: 0, display: "flex", flexDirection: "column" };
  const topbar = {
    height: 56, display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0 28px", borderBottom: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(16,20,28,0.8)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 10,
  };
  const btnPrimary = {
    background: "linear-gradient(135deg, #3B82F6, #2563EB)", color: "#fff", border: "none",
    padding: "8px 20px", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13,
    fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8, letterSpacing: "0.01em",
  };
  const card = {
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 12, padding: 20, transition: "border-color 0.2s, background 0.2s",
  };
  const input = {
    width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, padding: "10px 14px", color: "#E2E4E9", fontSize: 13, fontFamily: "inherit",
    outline: "none", boxSizing: "border-box",
  };
  const modal = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
  };
  const modalBox = {
    background: "#151922", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16,
    padding: 32, width: "90%", maxWidth: 560, maxHeight: "85vh", overflowY: "auto",
  };
  const select = { ...input, appearance: "none", cursor: "pointer" };

  // ─── Render: Dashboard ──────────────────────────────────────────
  const renderDashboard = () => {
    const stats = [
      { label: "Ενεργοί Φάκελοι", value: projects.length, color: "#3B82F6", icon: "📁" },
      { label: "Σε Αναμονή", value: projects.filter(p => ["init","data_collection"].includes(p.stage)).length, color: "#F59E0B", icon: "⏳" },
      { label: "Σε Έλεγχο", value: projects.filter(p => p.stage === "review").length, color: "#8B5CF6", icon: "🏛️" },
      { label: "Εγκεκριμένα", value: projects.filter(p => p.stage === "approved").length, color: "#10B981", icon: "✅" },
    ];
    return (
      <div style={{ padding: 28 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>Πίνακας Ελέγχου</h1>
          <p style={{ color: "#6B7280", margin: "4px 0 0", fontSize: 13 }}>Forma Architecture — Διαχείριση Αδειοδοτικών Φακέλων</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 28 }}>
          {stats.map((s, i) => (
            <div key={i} style={{ ...card, display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ fontSize: 28 }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: 26, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2, fontWeight: 500 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, color: "#9CA3AF" }}>Φάκελοι Έργων</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {projects.map(p => {
            const rule = NOK_RULES[p.type];
            const stageObj = WORKFLOW_STAGES.find(s => s.id === p.stage);
            return (
              <div key={p.id} onClick={() => openProject(p)}
                style={{ ...card, cursor: "pointer", display: "flex", alignItems: "center", gap: 20 }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = rule.color + "60"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}>
                <ProgressRing progress={p.progress} color={rule.color} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ background: rule.color + "20", color: rule.color, padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: "0.05em" }}>
                      {rule.shortLabel}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{p.title}</span>
                  </div>
                  <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#6B7280" }}>
                    <span>👤 {p.client.name}</span>
                    <span>📍 {p.property.address}</span>
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 4 }}>
                    {stageObj?.icon} {stageObj?.label}
                  </div>
                  <div style={{ fontSize: 11, color: "#6B7280" }}>
                    {p.id} · {p.createdAt}
                  </div>
                </div>
                <span style={{ color: "#4B5563", fontSize: 18, marginLeft: 8 }}>›</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ─── Render: Project Detail ─────────────────────────────────────
  const renderProject = () => {
    if (!selectedProject) return null;
    const p = selectedProject;
    const rule = NOK_RULES[p.type];
    const stageIdx = WORKFLOW_STAGES.findIndex(s => s.id === p.stage);

    const tabs = [
      { id: "overview", label: "Επισκόπηση", icon: "📊" },
      { id: "documents", label: "Δικαιολογητικά", icon: "📄" },
      { id: "studies", label: "Μελέτες", icon: "📐" },
      { id: "timeline", label: "Ιστορικό", icon: "📜" },
      { id: "nok", label: "ΝΟΚ Info", icon: "⚖️" },
    ];

    return (
      <div style={{ padding: 28 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button onClick={goHome} style={{ background: "rgba(255,255,255,0.06)", border: "none", color: "#9CA3AF", width: 34, height: 34, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ background: rule.color + "20", color: rule.color, padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{rule.shortLabel}</span>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{p.title}</h1>
            </div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>{p.id} · {p.client.name} · {p.property.address}</div>
          </div>
          <button onClick={() => prepEmail(p.client.email, `Ενημέρωση φακέλου ${p.id}`, `Αγαπητέ/ή ${p.client.name},\n\nΣας ενημερώνουμε για την πρόοδο του φακέλου σας ${p.id}.\n\nΜε εκτίμηση,\nForma Architecture`)}
            style={{ ...btnPrimary, background: "rgba(255,255,255,0.06)", color: "#E2E4E9" }}>
            ✉️ Email Πελάτη
          </button>
        </div>

        {/* Workflow Pipeline */}
        <div style={{ ...card, marginBottom: 20, padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, overflowX: "auto" }}>
            {WORKFLOW_STAGES.map((s, i) => {
              const isActive = i === stageIdx;
              const isDone = i < stageIdx;
              const color = isDone ? "#10B981" : isActive ? rule.color : "#2A2F3A";
              return (
                <div key={s.id} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1,
                    opacity: isDone || isActive ? 1 : 0.4,
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                      background: isDone ? "#10B981" : isActive ? rule.color : "rgba(255,255,255,0.06)",
                      color: isDone || isActive ? "#fff" : "#6B7280", fontSize: 14,
                      boxShadow: isActive ? `0 0 16px ${rule.color}40` : "none",
                    }}>
                      {isDone ? "✓" : s.icon}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: isDone || isActive ? "#E2E4E9" : "#4B5563", textAlign: "center", whiteSpace: "nowrap" }}>{s.label}</span>
                  </div>
                  {i < WORKFLOW_STAGES.length - 1 && (
                    <div style={{ height: 2, flex: "0 0 20px", background: isDone ? "#10B981" : "rgba(255,255,255,0.08)", borderRadius: 1, margin: "0 2px", marginBottom: 18 }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, marginBottom: 20, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 3 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{
                flex: 1, padding: "8px 12px", border: "none", borderRadius: 8, cursor: "pointer",
                fontFamily: "inherit", fontSize: 12, fontWeight: 600,
                background: activeTab === t.id ? "rgba(255,255,255,0.08)" : "transparent",
                color: activeTab === t.id ? "#E2E4E9" : "#6B7280",
              }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={card}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "#9CA3AF", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Πελάτης</h3>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{p.client.name}</div>
              <div style={{ fontSize: 12, color: "#6B7280", display: "flex", flexDirection: "column", gap: 4 }}>
                <span>📧 {p.client.email}</span>
                <span>📱 {p.client.phone || "—"}</span>
                <span>🏛 ΑΦΜ: {p.client.afm || "—"}</span>
              </div>
              <button onClick={() => prepEmail(p.client.email, `Αίτημα δικαιολογητικών — ${p.id}`,
                `Αγαπητέ/ή ${p.client.name},\n\nΓια τον φάκελο ${p.id} (${rule.label}), παρακαλώ αποστείλετε τα ακόλουθα δικαιολογητικά:\n\n${rule.requiredDocuments.filter(d => p.documents[d.id] === "pending").map(d => `• ${d.label}`).join("\n")}\n\nΜε εκτίμηση,\nΠιέρρος Παπαδέας\nForma Architecture\nΑΜ ΤΕΕ 163860`)}
                style={{ ...btnPrimary, marginTop: 12, fontSize: 12, padding: "6px 14px", width: "100%" }}>
                ✉️ Αίτημα Δικαιολογητικών
              </button>
            </div>
            <div style={card}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "#9CA3AF", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Ακίνητο</h3>
              <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <div><span style={{ color: "#6B7280" }}>KAEK:</span> <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#3B82F6" }}>{p.property.kaek}</span></div>
                <div><span style={{ color: "#6B7280" }}>Διεύθυνση:</span> {p.property.address}</div>
                <div><span style={{ color: "#6B7280" }}>Εμβαδόν:</span> {p.property.area} τ.μ.</div>
              </div>
            </div>
            <div style={{ ...card, gridColumn: "1 / -1" }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "#9CA3AF", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Σύνοψη Προόδου</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {[
                  { label: "Δικαιολογητικά", done: Object.values(p.documents).filter(v => v === "uploaded" || v === "signed").length, total: Object.keys(p.documents).length, color: "#10B981" },
                  { label: "Μελέτες", done: Object.values(p.studies).filter(v => v === "completed").length, total: Object.values(p.studies).filter(v => v !== "na").length, color: "#3B82F6" },
                  { label: "Εγκρίσεις", done: 0, total: rule.requiredApprovals.length, color: "#8B5CF6" },
                ].map((m, i) => (
                  <div key={i} style={{ textAlign: "center" }}>
                    <ProgressRing progress={m.total ? Math.round((m.done / m.total) * 100) : 0} size={60} color={m.color} />
                    <div style={{ fontSize: 11, color: "#6B7280", marginTop: 6 }}>{m.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{m.done}/{m.total}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "documents" && (
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "#9CA3AF", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>Δικαιολογητικά & Έγγραφα</h3>
              <span style={{ fontSize: 11, color: "#6B7280" }}>
                {Object.values(p.documents).filter(v => v === "uploaded" || v === "signed").length}/{Object.keys(p.documents).length} ολοκληρωμένα
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {rule.requiredDocuments.map(d => (
                <div key={d.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 16 }}>{d.type === "study" ? "📐" : d.type === "legal" ? "📜" : d.type === "form" ? "📝" : d.type === "id" ? "🪪" : d.type === "tax" ? "🏦" : "📎"}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{d.label}</div>
                      {d.signer && <div style={{ fontSize: 10, color: "#6B7280" }}>Υπογραφή: {d.signer === "owner" ? "Ιδιοκτήτης" : d.signer === "surveyor" ? "Τοπογράφος" : d.signer === "engineer" ? "Μηχανικός" : d.signer === "both" ? "Μηχανικός & Ιδιοκτήτης" : d.signer}</div>}
                    </div>
                  </div>
                  <StatusBadge status={p.documents[d.id] || "pending"} />
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "studies" && (
          <div style={card}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "#9CA3AF", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Απαιτούμενες Μελέτες — {rule.label}</h3>
            {rule.requiredStudies.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#6B7280" }}>Δεν απαιτούνται μελέτες για αυτόν τον τύπο πράξης.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {rule.requiredStudies.map(s => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.04)" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{s.label}</div>
                      <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>Υπογράφων: {s.signer.replace("_", " ")}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <StatusBadge status={p.studies[s.id] || "not_started"} />
                      {p.studies[s.id] !== "completed" && (
                        <button onClick={() => {
                          const signerEmail = s.signer === "architect" ? "" : "";
                          prepEmail(signerEmail, `Ανάθεση μελέτης: ${s.label} — ${p.id}`,
                            `Αφορά τον φάκελο: ${p.id}\nΈργο: ${p.title}\n\nΠαρακαλώ για εκπόνηση: ${s.label}\n\nΜε εκτίμηση,\nΠιέρρος Παπαδέας\nForma Architecture\nΑΜ ΤΕΕ 163860`);
                        }} style={{ background: "rgba(59,130,246,0.12)", color: "#3B82F6", border: "none", padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>
                          ✉️ Ανάθεση
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "timeline" && (
          <div style={card}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "#9CA3AF", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Ιστορικό Ενεργειών</h3>
            <div style={{ position: "relative", paddingLeft: 28 }}>
              <div style={{ position: "absolute", left: 8, top: 4, bottom: 4, width: 2, background: "rgba(255,255,255,0.06)" }} />
              {p.logs.slice().reverse().map((l, i) => (
                <div key={i} style={{ position: "relative", marginBottom: 16, paddingBottom: 16, borderBottom: i < p.logs.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                  <div style={{ position: "absolute", left: -22, top: 2, width: 10, height: 10, borderRadius: "50%", background: i === 0 ? rule.color : "rgba(255,255,255,0.15)", border: "2px solid #10141C" }} />
                  <div style={{ fontSize: 11, color: "#6B7280", fontFamily: "'JetBrains Mono', monospace" }}>{l.date}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{l.action}</div>
                  <div style={{ fontSize: 11, color: "#4B5563", marginTop: 2 }}>— {l.user}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "nok" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={card}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "#9CA3AF", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Νομικό Πλαίσιο ΝΟΚ</h3>
              <div style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 8 }}>Εφαρμοστέα νομοθεσία: <span style={{ color: "#E2E4E9", fontWeight: 600 }}>{rule.nokArticles.join(", ")}</span></div>
              <div style={{ fontSize: 13, color: "#9CA3AF" }}>Εκτιμώμενος χρόνος: <span style={{ color: rule.color, fontWeight: 700 }}>{rule.estimatedDays} ημέρες</span></div>
            </div>
            <div style={card}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "#9CA3AF", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Απαιτούμενες Εγκρίσεις</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {rule.requiredApprovals.map((a, i) => (
                  <span key={i} style={{ background: "rgba(139,92,246,0.1)", color: "#A78BFA", padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid rgba(139,92,246,0.15)" }}>{a}</span>
                ))}
              </div>
            </div>
            <div style={card}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "#9CA3AF", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Τέλη & Εισφορές</h3>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {Object.entries(rule.fees).filter(([,v]) => v).map(([k]) => (
                  <span key={k} style={{ background: "rgba(245,158,11,0.1)", color: "#F59E0B", padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "1px solid rgba(245,158,11,0.15)" }}>
                    {k === "tee" ? "Αμοιβή ΤΕΕ" : k === "municipality" ? "Τέλη Δήμου" : k === "efka" ? "ΕΦΚΑ" : "Ειδικά Τέλη"}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Main Render ────────────────────────────────────────────────
  return (
    <>
      <link href={fontUrl} rel="stylesheet" />
      <div style={root}>
        {/* Sidebar */}
        <div style={sidebar}>
          <div style={{ padding: sidebarCollapsed ? "16px 8px" : "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #3B82F6, #8B5CF6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff", flexShrink: 0 }}>F</div>
            {!sidebarCollapsed && <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.02em" }}>e-Άδειες Manager</div>}
          </div>
          <div style={{ padding: sidebarCollapsed ? "12px 8px" : "12px 14px", flex: 1 }}>
            {[
              { id: "dashboard", icon: "📊", label: "Dashboard" },
            ].map(item => (
              <div key={item.id} onClick={() => { setView(item.id); setSelectedProject(null); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 10px", borderRadius: 8,
                  cursor: "pointer", marginBottom: 2, fontSize: 13, fontWeight: 500,
                  background: view === item.id ? "rgba(59,130,246,0.1)" : "transparent",
                  color: view === item.id ? "#3B82F6" : "#6B7280",
                }}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {!sidebarCollapsed && item.label}
              </div>
            ))}
            {!sidebarCollapsed && (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#4B5563", padding: "16px 10px 6px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Φάκελοι</div>
                {projects.map(p => {
                  const rule = NOK_RULES[p.type];
                  return (
                    <div key={p.id} onClick={() => openProject(p)}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8,
                        cursor: "pointer", marginBottom: 1, fontSize: 12,
                        background: selectedProject?.id === p.id ? "rgba(255,255,255,0.06)" : "transparent",
                        color: selectedProject?.id === p.id ? "#E2E4E9" : "#6B7280",
                      }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: rule.color, flexShrink: 0 }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
          {!sidebarCollapsed && (
            <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 10, color: "#4B5563" }}>
              ΑΜ ΤΕΕ 163860 · Forma Architecture
            </div>
          )}
        </div>

        {/* Main content */}
        <div style={main}>
          <div style={topbar}>
            <div style={{ fontSize: 13, color: "#6B7280" }}>
              {view === "dashboard" ? "Dashboard" : selectedProject?.id || ""}
            </div>
            <button onClick={() => setShowNewModal(true)} style={btnPrimary}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Νέος Φάκελος
            </button>
          </div>
          {view === "dashboard" && renderDashboard()}
          {view === "project" && renderProject()}
        </div>

        {/* New Project Modal */}
        {showNewModal && (
          <div style={modal} onClick={() => setShowNewModal(false)}>
            <div style={modalBox} onClick={e => e.stopPropagation()}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 20px" }}>Νέος Αδειοδοτικός Φάκελος</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600, display: "block", marginBottom: 6 }}>Τύπος Πράξης</label>
                  <select style={select} value={newForm.type} onChange={e => setNewForm({...newForm, type: e.target.value})}>
                    {Object.values(NOK_RULES).map(r => (
                      <option key={r.id} value={r.id} style={{ background: "#151922" }}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ background: `${NOK_RULES[newForm.type].color}10`, border: `1px solid ${NOK_RULES[newForm.type].color}20`, borderRadius: 8, padding: 12, fontSize: 11, color: "#9CA3AF" }}>
                  <strong style={{ color: NOK_RULES[newForm.type].color }}>ΝΟΚ:</strong> {NOK_RULES[newForm.type].nokArticles.join(", ")} · Εκτ. χρόνος: {NOK_RULES[newForm.type].estimatedDays} ημέρες · Μελέτες: {NOK_RULES[newForm.type].requiredStudies.length} · Δικαιολογητικά: {NOK_RULES[newForm.type].requiredDocuments.length}
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600, display: "block", marginBottom: 6 }}>Τίτλος Έργου</label>
                  <input style={input} placeholder="π.χ. Νέα Κατοικία — Καλαμάτα" value={newForm.title} onChange={e => setNewForm({...newForm, title: e.target.value})} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600, display: "block", marginBottom: 6 }}>Όνομα Πελάτη</label>
                    <input style={input} placeholder="Ονοματεπώνυμο" value={newForm.clientName} onChange={e => setNewForm({...newForm, clientName: e.target.value})} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600, display: "block", marginBottom: 6 }}>Email Πελάτη</label>
                    <input style={input} type="email" placeholder="email@example.gr" value={newForm.clientEmail} onChange={e => setNewForm({...newForm, clientEmail: e.target.value})} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600, display: "block", marginBottom: 6 }}>ΚΑΕΚ Ακινήτου</label>
                    <input style={input} placeholder="22-XX-XX-XX-XXXXX" value={newForm.kaek} onChange={e => setNewForm({...newForm, kaek: e.target.value})} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600, display: "block", marginBottom: 6 }}>Διεύθυνση/Περιοχή</label>
                    <input style={input} placeholder="π.χ. Αρχοντικό Αβίας" value={newForm.address} onChange={e => setNewForm({...newForm, address: e.target.value})} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button onClick={handleNewProject} style={{ ...btnPrimary, flex: 1, justifyContent: "center" }}>Δημιουργία Φακέλου</button>
                  <button onClick={() => setShowNewModal(false)} style={{ ...btnPrimary, flex: 0, background: "rgba(255,255,255,0.06)", color: "#9CA3AF" }}>Ακύρωση</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Email Modal */}
        {emailModalOpen && (
          <div style={modal} onClick={() => setEmailModalOpen(false)}>
            <div style={modalBox} onClick={e => e.stopPropagation()}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 20px" }}>✉️ Αποστολή Email</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600, display: "block", marginBottom: 6 }}>Προς</label>
                  <input style={input} value={emailTo} onChange={e => setEmailTo(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600, display: "block", marginBottom: 6 }}>Θέμα</label>
                  <input style={input} value={emailSubject} onChange={e => setEmailSubject(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600, display: "block", marginBottom: 6 }}>Μήνυμα</label>
                  <textarea style={{ ...input, minHeight: 140, resize: "vertical" }} value={emailBody} onChange={e => setEmailBody(e.target.value)} />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={sendEmail} style={{ ...btnPrimary, flex: 1, justifyContent: "center" }}>📤 Αποστολή</button>
                  <button onClick={() => setEmailModalOpen(false)} style={{ ...btnPrimary, background: "rgba(255,255,255,0.06)", color: "#9CA3AF" }}>Ακύρωση</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toastMsg && (
          <div style={{
            position: "fixed", bottom: 24, right: 24, background: "#10B981", color: "#fff",
            padding: "12px 24px", borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
            boxShadow: "0 8px 32px rgba(16,185,129,0.3)", zIndex: 200,
            animation: "slideIn 0.3s ease",
          }}>
            ✅ {toastMsg}
          </div>
        )}
      </div>
      <style>{`
        @keyframes slideIn {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
      `}</style>
    </>
  );
}
