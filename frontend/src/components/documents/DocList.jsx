import { useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { projectsApi, nokApi } from '../../api/projects.js';
import StatusBadge from '../ui/StatusBadge.jsx';
import { formatDate } from '../../utils/index.js';

export default function DocList({ projectId, type, studiesOnly = false }) {
  const qc = useQueryClient();
  const fileInput = useRef(null);
  const uploadDocType = useRef(null);

  const { data: docs = [] } = useQuery({
    queryKey: ['documents', projectId],
    queryFn: () => projectsApi.listDocs(projectId),
  });

  const { data: checklist } = useQuery({
    queryKey: ['checklist', type],
    queryFn: () => nokApi.checklist(type),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ docType, file }) => {
      const fd = new FormData();
      fd.append('doc_type', docType);
      fd.append('file', file);
      return projectsApi.uploadDoc(projectId, fd);
    },
    onSuccess: () => { qc.invalidateQueries(['documents', projectId]); toast.success('Το αρχείο ανέβηκε!'); },
    onError: (e) => toast.error(e.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ did, status }) => projectsApi.updateDoc(projectId, did, { status }),
    onSuccess: () => { qc.invalidateQueries(['documents', projectId]); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (did) => projectsApi.deleteDoc(projectId, did),
    onSuccess: () => { qc.invalidateQueries(['documents', projectId]); toast.success('Αφαιρέθηκε'); },
    onError: (e) => toast.error(e.message),
  });

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && uploadDocType.current) {
      uploadMutation.mutate({ docType: uploadDocType.current, file });
    }
    e.target.value = '';
  };

  const triggerUpload = (docType) => {
    uploadDocType.current = docType;
    fileInput.current?.click();
  };

  const required = studiesOnly
    ? (checklist?.studies || [])
    : (checklist?.documents || []);

  const docMap = Object.fromEntries(docs.map(d => [d.doc_type, d]));

  return (
    <div>
      <input ref={fileInput} type="file" className="hidden" onChange={handleFileChange}
        accept=".pdf,.doc,.docx,.dwg,.jpg,.png,.zip" />

      <div className="space-y-2">
        {required.map((req) => {
          const doc = docMap[req.id];
          return (
            <div key={req.id} className="card flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{req.label}</span>
                  {req.signerRole && (
                    <span className="badge text-xs bg-white/5 text-text-muted">{req.signerRole}</span>
                  )}
                </div>
                {doc && (
                  <div className="text-xs text-text-muted mt-0.5">
                    {doc.file_size && `${(doc.file_size / 1024).toFixed(0)} KB · `}
                    {formatDate(doc.uploaded_at)}
                    {doc.signed_at && ` · Υπ: ${formatDate(doc.signed_at)}`}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <StatusBadge status={doc?.status || 'pending'} />
                {doc && doc.status === 'uploaded' && req.signerRole && (
                  <button
                    onClick={() => updateStatusMutation.mutate({ did: doc.id, status: 'signed' })}
                    className="btn-secondary text-xs py-1 px-2"
                    title="Σήμανση ως υπεγραμμένο"
                  >
                    ✍ Υπογράφηκε
                  </button>
                )}
                <button
                  onClick={() => triggerUpload(req.id)}
                  className="btn-secondary text-xs py-1 px-2"
                  disabled={uploadMutation.isPending}
                >
                  {doc ? '↑ Αντικατάσταση' : '↑ Ανέβασμα'}
                </button>
                {doc && (
                  <button
                    onClick={async () => {
                      const { url } = await projectsApi.downloadDoc(projectId, doc.id);
                      window.open(url, '_blank');
                    }}
                    className="btn-secondary text-xs py-1 px-2"
                  >
                    ↓
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {required.length === 0 && (
          <div className="text-text-muted text-sm">Δεν υπάρχουν απαιτούμενα {studiesOnly ? 'μελέτες' : 'έγγραφα'} για αυτόν τον τύπο.</div>
        )}
      </div>
    </div>
  );
}
