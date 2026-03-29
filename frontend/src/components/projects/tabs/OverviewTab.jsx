import { formatDate } from '../../../utils/index.js';

export default function OverviewTab({ project }) {
  const prop = project.property || {};
  const ek = project.ekdosi || {};
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Client */}
      {project.client && (
        <div className="card">
          <h3 className="font-semibold text-sm mb-3 text-text-secondary">Ιδιοκτήτης</h3>
          <div className="space-y-1 text-sm">
            <div><span className="text-text-muted">Ονοματεπώνυμο:</span> {project.client.surname} {project.client.name}</div>
            {project.client.father_name && <div><span className="text-text-muted">Πατρώνυμο:</span> {project.client.father_name}</div>}
            {project.client.afm && <div><span className="text-text-muted">ΑΦΜ:</span> <span className="font-mono">{project.client.afm}</span></div>}
            {project.client.adt && <div><span className="text-text-muted">ΑΔΤ:</span> <span className="font-mono">{project.client.adt}</span></div>}
            {project.client.phone && <div><span className="text-text-muted">Τηλ:</span> {project.client.phone}</div>}
            {project.client.email && <div><span className="text-text-muted">Email:</span> {project.client.email}</div>}
          </div>
        </div>
      )}
      {/* Property */}
      <div className="card">
        <h3 className="font-semibold text-sm mb-3 text-text-secondary">Ακίνητο</h3>
        <div className="space-y-1 text-sm">
          {prop.kaek && <div><span className="text-text-muted">ΚΑΕΚ:</span> <span className="font-mono">{prop.kaek}</span></div>}
          {prop.addr && <div><span className="text-text-muted">Διεύθυνση:</span> {prop.addr} {prop.addr_num_from}</div>}
          {prop.city && <div><span className="text-text-muted">Πόλη:</span> {prop.city} {prop.zip_code}</div>}
          {prop.ot && <div><span className="text-text-muted">ΟΤ:</span> {prop.ot}</div>}
          {prop.zoning_info && (
            <div>
              <span className="text-text-muted">Δόμηση:</span>
              <pre className="text-xs font-mono bg-white/5 rounded p-2 mt-1 overflow-x-auto">
                {JSON.stringify(prop.zoning_info, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
      {/* Building data */}
      {ek && ek.total_plot_area > 0 && (
        <div className="card">
          <h3 className="font-semibold text-sm mb-3 text-text-secondary">Στοιχεία Κτιρίου (EKDOSI)</h3>
          <div className="space-y-1 text-sm">
            <div><span className="text-text-muted">Εμβαδό Οικοπέδου:</span> {ek.total_plot_area} m²</div>
            <div><span className="text-text-muted">Ολικός Όγκος:</span> {ek.total_build_volume} m³</div>
            <div><span className="text-text-muted">Αριθμός Ορόφων:</span> {ek.num_of_floors}</div>
            <div><span className="text-text-muted">Ιδιοκτησίες:</span> {ek.num_of_ownerships}</div>
            <div><span className="text-text-muted">Θέσεις Στάθμευσης:</span> {ek.num_of_parkings}</div>
          </div>
        </div>
      )}
      {/* TEE codes */}
      <div className="card">
        <h3 className="font-semibold text-sm mb-3 text-text-secondary">Στοιχεία e-Άδειες</h3>
        <div className="space-y-1 text-sm">
          <div><span className="text-text-muted">Κωδικός Αίτησης ΤΕΕ:</span> {project.aitisi_type_code || '—'}</div>
          <div><span className="text-text-muted">YD_ID:</span> {project.yd_id || '—'}</div>
          <div><span className="text-text-muted">DIMOS_AA:</span> {project.dimos_aa || '—'}</div>
          <div><span className="text-text-muted">Κωδικός Πράξης:</span> {project.tee_permit_code || '—'}</div>
          <div><span className="text-text-muted">Ημ. Υποβολής:</span> {formatDate(project.tee_submission_date)}</div>
        </div>
      </div>
    </div>
  );
}
