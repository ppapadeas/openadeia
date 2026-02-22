import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { projectsApi } from '../../api/projects.js';

const TEMPLATES = [
  { label: 'Αίτηση Δικαιολογητικών', subject: 'Αίτηση δικαιολογητικών για φάκελο αδειοδότησης', body: 'Αγαπητέ/ή,\n\nΣας ενημερώνουμε ότι για την επεξεργασία του φακέλου αδειοδότησης σας απαιτούνται τα παρακάτω δικαιολογητικά:\n\n- Τίτλος ιδιοκτησίας\n- Αστυνομική ταυτότητα\n- Φορολογική ενημερότητα\n\nΠαρακαλούμε να τα αποστείλετε το συντομότερο δυνατό.\n\nΜε εκτίμηση,' },
  { label: 'Ενημέρωση Προόδου', subject: 'Ενημέρωση για την πρόοδο του φακέλου σας', body: 'Αγαπητέ/ή,\n\nΣας ενημερώνουμε ότι ο φάκελος αδειοδότησής σας βρίσκεται σε εξέλιξη.\n\nΤρέχον στάδιο: \n\nΕκτιμώμενος χρόνος ολοκλήρωσης: \n\nΜε εκτίμηση,' },
  { label: 'Ολοκλήρωση Αδείας', subject: 'Η άδειά σας εκδόθηκε!', body: 'Αγαπητέ/ή,\n\nΧαρούμε να σας ενημερώσουμε ότι η οικοδομική άδεια για το ακίνητό σας εκδόθηκε επιτυχώς.\n\nΚωδικός Πράξης ΤΕΕ: \n\nΜπορείτε να τη βρείτε στο σύστημα e-Άδειες.\n\nΜε εκτίμηση,' },
];

export default function ComposeDialog({ projectId, defaultTo, projectCode, onClose, onSent }) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const sendMutation = useMutation({
    mutationFn: () => projectsApi.sendEmail(projectId, { to, subject, body }),
    onSuccess: () => { toast.success('Email εστάλη!'); onSent?.(); },
    onError: (e) => toast.error(e.message),
  });

  const applyTemplate = (t) => {
    setSubject(`[${projectCode}] ${t.subject}`);
    setBody(t.body);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#151922] border border-white/10 rounded-2xl p-7 w-full max-w-lg">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">Σύνταξη Email</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-xl">×</button>
        </div>

        {/* Templates */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {TEMPLATES.map((t, i) => (
            <button key={i} onClick={() => applyTemplate(t)}
              className="text-xs bg-white/5 hover:bg-white/10 text-text-secondary px-2.5 py-1.5 rounded-lg transition-colors">
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="label">Προς</label>
            <input className="input" value={to} onChange={e => setTo(e.target.value)} placeholder="email@example.com" />
          </div>
          <div>
            <label className="label">Θέμα</label>
            <input className="input" value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div>
            <label className="label">Μήνυμα</label>
            <textarea className="input h-40 resize-none font-mono text-xs" value={body} onChange={e => setBody(e.target.value)} />
          </div>
          <div className="flex gap-3 pt-1">
            <button className="btn-secondary flex-1" onClick={onClose}>Ακύρωση</button>
            <button className="btn-primary flex-1 justify-center" onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending || !to || !subject}>
              {sendMutation.isPending ? 'Αποστολή…' : '✉ Αποστολή'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
