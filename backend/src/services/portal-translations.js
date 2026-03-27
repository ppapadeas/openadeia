/**
 * Translation strings for portal PDF generation and email notifications.
 * Supports Greek (el) and English (en).
 */
const translations = {
  el: {
    // Email - Welcome
    'email.welcome.subject': 'OpenAdeia — Πύλη Πελάτη: {projectName}',
    'email.welcome.greeting': 'Καλωσήρθατε, {name}!',
    'email.welcome.intro': 'Σας έχει δημιουργηθεί μια πύλη για το έργο <strong>{projectName}</strong>.',
    'email.welcome.whatYouCanDo': 'Μέσω αυτής μπορείτε να:',
    'email.welcome.bullet1': 'Συμπληρώσετε τα στοιχεία σας',
    'email.welcome.bullet2': 'Ανεβάσετε τα απαραίτητα έγγραφα',
    'email.welcome.bullet3': 'Υπογράψετε ψηφιακά τα απαιτούμενα',
    'email.welcome.bullet4': 'Παρακολουθείτε την πρόοδο του φακέλου σας',
    'email.welcome.cta': 'Πρόσβαση στην πύλη',
    'email.welcome.linkWarning': 'Ο παραπάνω σύνδεσμος είναι μοναδικός για εσάς. Μην τον μοιραστείτε.',
    'email.welcome.defaultName': 'Αγαπητέ πελάτη',

    // Email - Step submitted (to engineer)
    'email.stepSubmitted.subject': '[{projectName}] Νέα υποβολή: {stepTitle}',
    'email.stepSubmitted.body': 'Ο πελάτης <strong>{clientName}</strong> υπέβαλε το βήμα <strong>{stepTitle}</strong> στο έργο <strong>{projectName}</strong>.',
    'email.stepSubmitted.cta': 'Δείτε το έργο',

    // Email - Step reviewed (to client)
    'email.stepReviewed.subjectApproved': 'Βήμα εγκρίθηκε: {stepTitle}',
    'email.stepReviewed.subjectRevision': 'Απαιτείται διόρθωση: {stepTitle}',
    'email.stepReviewed.heading': 'Ενημέρωση βήματος',
    'email.stepReviewed.bodyApproved': 'Το βήμα <strong>{stepTitle}</strong> εγκρίθηκε στο έργο <strong>{projectName}</strong>.',
    'email.stepReviewed.bodyRevision': 'Το βήμα <strong>{stepTitle}</strong> χρειάζεται διόρθωση στο έργο <strong>{projectName}</strong>.',
    'email.stepReviewed.revisionNotes': 'Σχόλιο μηχανικού:',
    'email.stepReviewed.cta': 'Πρόσβαση στην πύλη',

    // PDF - Assignment
    'pdf.assignmentTitle': 'ΔΗΛΩΣΗ ΑΝΑΘΕΣΕΩΝ',
    'pdf.projectInfoSection': 'ΣΤΟΙΧΕΙΑ ΕΡΓΟΥ',
    'pdf.project': 'Έργο:',
    'pdf.projectAddress': 'Διεύθυνση έργου:',
    'pdf.kaek': 'ΚΑΕΚ:',
    'pdf.municipality': 'Δήμος:',
    'pdf.ownerInfoSection': 'ΣΤΟΙΧΕΙΑ ΙΔΙΟΚΤΗΤΗ',
    'pdf.fullName': 'Ονοματεπώνυμο:',
    'pdf.fatherName': 'Πατρώνυμο:',
    'pdf.afm': 'ΑΦΜ:',
    'pdf.idNumber': 'Αρ. Ταυτότητας:',
    'pdf.addressLabel': 'Διεύθυνση:',
    'pdf.phone': 'Τηλέφωνο:',
    'pdf.declarationSection': 'ΔΗΛΩΣΗ',
    'pdf.declarationText': 'Ο υπογράφων {owner}, κάτοικος {address}, προκειμένου να κατασκευάσω {project}, ανέθεσα τη μελέτη και επίβλεψη των έργων στους παρακάτω μηχανικούς:',
    'pdf.roleColumn': 'Ρόλος',
    'pdf.engineerColumn': 'Μηχανικός',
    'pdf.noAssignments': 'Δεν έχουν οριστεί αναθέσεις',
    'pdf.date': 'Ημερομηνία',
    'pdf.declarant': 'Ο/Η Δηλών/ούσα',
    'pdf.engineer': 'Ο Μηχανικός',
    'pdf.role.general_study': 'Γενική μελέτη έργου',
    'pdf.role.structural_study': 'Μελέτη στατικών',
    'pdf.role.mechanical_study': 'Μελέτη μηχανολογικών',
    'pdf.role.general_supervision': 'Γενική επίβλεψη έργου',
    'pdf.role.structural_supervision': 'Επίβλεψη στατικών',
    'pdf.role.mechanical_supervision': 'Επίβλεψη μηχανολογικών',
    'pdf.footerAssignment': 'Δήλωση Αναθέσεων — Forma Architecture',

    // PDF - Fee agreement
    'pdf.feeTitle': 'ΙΔΙΩΤΙΚΟ ΣΥΜΦΩΝΗΤΙΚΟ ΑΜΟΙΒΗΣ',
    'pdf.partiesSection': 'ΣΥΜΒΑΛΛΟΜΕΝΟΙ',
    'pdf.partyA': 'Α. Ο Εργοδότης:',
    'pdf.partyB': 'Β. Ο Μηχανικός:',
    'pdf.amTee': 'ΑΜ ΤΕΕ:',
    'pdf.subjectSection': 'ΑΝΤΙΚΕΙΜΕΝΟ',
    'pdf.regardsProject': 'Αφορά το έργο: {project}',
    'pdf.location': 'Θέση: {address}',
    'pdf.engineerUndertakes': 'Ο Μηχανικός αναλαμβάνει τις εξής εργασίες:',
    'pdf.noRolesDefined': '(δεν έχουν οριστεί)',
    'pdf.feeSection': 'ΑΜΟΙΒΗ',
    'pdf.totalFeeText': 'Η συνολική αμοιβή ορίζεται σε: {fee} (πλέον ΦΠΑ 24%)',
    'pdf.paymentIntro': 'Η αμοιβή καταβάλλεται ως εξής:',
    'pdf.phase': 'Φάση',
    'pdf.amount': 'Ποσό',
    'pdf.termsSection': 'ΓΕΝΙΚΟΙ ΟΡΟΙ',
    'pdf.term1': 'Η αμοιβή αφορά αποκλειστικά τις αναφερόμενες εργασίες.',
    'pdf.term2': 'Πρόσθετες εργασίες αμείβονται ξεχωριστά κατόπιν συμφωνίας.',
    'pdf.term3': 'Ο εργοδότης υποχρεούται να παρέχει τα απαραίτητα στοιχεία εγκαίρως.',
    'pdf.term4': 'Σε περίπτωση ακύρωσης, οφείλεται αμοιβή για τις εκτελεσθείσες εργασίες.',
    'pdf.employer': 'Ο Εργοδότης',
    'pdf.signatures': 'Υπογραφές',
    'pdf.footerFee': 'Ιδιωτικό Συμφωνητικό Αμοιβής — Forma Architecture',
  },

  en: {
    // Email - Welcome
    'email.welcome.subject': 'OpenAdeia — Client Portal: {projectName}',
    'email.welcome.greeting': 'Welcome, {name}!',
    'email.welcome.intro': 'A portal has been created for your project <strong>{projectName}</strong>.',
    'email.welcome.whatYouCanDo': 'Through this portal you can:',
    'email.welcome.bullet1': 'Fill in your personal details',
    'email.welcome.bullet2': 'Upload required documents',
    'email.welcome.bullet3': 'Digitally sign required forms',
    'email.welcome.bullet4': 'Track your project progress',
    'email.welcome.cta': 'Access your portal',
    'email.welcome.linkWarning': 'The link above is unique to you. Please do not share it.',
    'email.welcome.defaultName': 'Dear client',

    // Email - Step submitted (to engineer)
    'email.stepSubmitted.subject': '[{projectName}] New submission: {stepTitle}',
    'email.stepSubmitted.body': 'Client <strong>{clientName}</strong> submitted step <strong>{stepTitle}</strong> in project <strong>{projectName}</strong>.',
    'email.stepSubmitted.cta': 'View project',

    // Email - Step reviewed (to client)
    'email.stepReviewed.subjectApproved': 'Step approved: {stepTitle}',
    'email.stepReviewed.subjectRevision': 'Revision required: {stepTitle}',
    'email.stepReviewed.heading': 'Step update',
    'email.stepReviewed.bodyApproved': 'Step <strong>{stepTitle}</strong> has been approved in project <strong>{projectName}</strong>.',
    'email.stepReviewed.bodyRevision': 'Step <strong>{stepTitle}</strong> needs revision in project <strong>{projectName}</strong>.',
    'email.stepReviewed.revisionNotes': 'Engineer comment:',
    'email.stepReviewed.cta': 'Access your portal',

    // PDF - Assignment
    'pdf.assignmentTitle': 'ASSIGNMENT DECLARATION',
    'pdf.projectInfoSection': 'PROJECT DETAILS',
    'pdf.project': 'Project:',
    'pdf.projectAddress': 'Project address:',
    'pdf.kaek': 'KAEK:',
    'pdf.municipality': 'Municipality:',
    'pdf.ownerInfoSection': 'OWNER DETAILS',
    'pdf.fullName': 'Full name:',
    'pdf.fatherName': 'Father name:',
    'pdf.afm': 'Tax ID:',
    'pdf.idNumber': 'ID Number:',
    'pdf.addressLabel': 'Address:',
    'pdf.phone': 'Phone:',
    'pdf.declarationSection': 'DECLARATION',
    'pdf.declarationText': 'The undersigned {owner}, resident of {address}, in order to construct {project}, has assigned the study and supervision of the works to the following engineers:',
    'pdf.roleColumn': 'Role',
    'pdf.engineerColumn': 'Engineer',
    'pdf.noAssignments': 'No assignments defined',
    'pdf.date': 'Date',
    'pdf.declarant': 'The Declarant',
    'pdf.engineer': 'The Engineer',
    'pdf.role.general_study': 'General project study',
    'pdf.role.structural_study': 'Structural study',
    'pdf.role.mechanical_study': 'Mechanical study',
    'pdf.role.general_supervision': 'General project supervision',
    'pdf.role.structural_supervision': 'Structural supervision',
    'pdf.role.mechanical_supervision': 'Mechanical supervision',
    'pdf.footerAssignment': 'Assignment Declaration — Forma Architecture',

    // PDF - Fee agreement
    'pdf.feeTitle': 'PRIVATE FEE AGREEMENT',
    'pdf.partiesSection': 'CONTRACTING PARTIES',
    'pdf.partyA': 'A. The Client:',
    'pdf.partyB': 'B. The Engineer:',
    'pdf.amTee': 'Reg. No:',
    'pdf.subjectSection': 'SUBJECT',
    'pdf.regardsProject': 'Regarding the project: {project}',
    'pdf.location': 'Location: {address}',
    'pdf.engineerUndertakes': 'The Engineer undertakes the following tasks:',
    'pdf.noRolesDefined': '(none defined)',
    'pdf.feeSection': 'FEE',
    'pdf.totalFeeText': 'The total fee is set at: {fee} (plus 24% VAT)',
    'pdf.paymentIntro': 'The fee is payable as follows:',
    'pdf.phase': 'Phase',
    'pdf.amount': 'Amount',
    'pdf.termsSection': 'GENERAL TERMS',
    'pdf.term1': 'The fee covers exclusively the listed services.',
    'pdf.term2': 'Additional work is charged separately upon agreement.',
    'pdf.term3': 'The client is obliged to provide the necessary information in a timely manner.',
    'pdf.term4': 'In case of cancellation, fees are due for work already performed.',
    'pdf.employer': 'The Client',
    'pdf.signatures': 'Signatures',
    'pdf.footerFee': 'Private Fee Agreement — Forma Architecture',
  },
};

/**
 * Translate a key for a given language, with optional parameter substitution.
 */
export function t(lang, key, params = {}) {
  let str = translations[lang]?.[key] || translations['el']?.[key] || key;
  for (const [k, v] of Object.entries(params)) {
    str = str.replace(`{${k}}`, String(v ?? ''));
  }
  return str;
}

export default translations;
