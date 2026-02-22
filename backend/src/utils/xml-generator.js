/**
 * TEE e-Adeies XML Generator
 * Generates valid XML conforming to AdeiaAitisiInput.xsd (v2.9.1)
 *
 * XSD Structure:
 *   AITISI (root)
 *   ├── AITISI_TYPE, YD_ID, DIMOS_AA, AITISI_DESCR
 *   ├── ADDR, ADDR_NUM_FROM, ADDR_NUM_TO, CITY, ZIP_CODE
 *   ├── ADDR_LOCATION, OT, KAEK, GIS_LOCATION, COMMENTS
 *   ├── ENTOS_SXEDIOU, NATURAL_DISASTER_FLAG
 *   ├── EKDOSI (EKDOSI_TYPE, TOTAL_PLOT_AREA, ROOF_GARDEN_AREA,
 *   │           TOTAL_BUILD_VOLUME, NUM_OF_FLOORS, NUM_OF_OWNERSHIPS,
 *   │           NUM_OF_PARKINGS, [EKDOSI_DD x15], [EKDOSI_BUILD_FLOOR...])
 *   ├── AITISI_OWNER (1..n): OWNER_TYPE, SURNAME, NAME, F_NAME, ...
 *   ├── AITISI_ENGINEER (1..n): AMH, EM, [AITISI_ENGINEER_SUBTASK...]
 *   ├── AITISI_DOC_RIGHT (0..n)
 *   ├── AITISI_APPROVAL (0..n)
 *   ├── AITISI_APPROVAL_EXT (0..n) [v2.9.1]
 *   ├── AITISI_PARKING (0..n)
 *   └── AITISI_PREV_PRAXI (0..n)
 */

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function el(tag, value, attrs = '') {
  if (value == null || value === '') return '';
  return `<${tag}${attrs ? ' ' + attrs : ''}>${esc(value)}</${tag}>`;
}

function elNum(tag, value) {
  if (value == null) return '';
  return `<${tag}>${Number(value)}</${tag}>`;
}

function elDecimal(tag, value) {
  if (value == null) return '';
  return `<${tag}>${parseFloat(value).toFixed(5)}</${tag}>`;
}

/**
 * Build the 15 mandatory EKDOSI_DD rows (DD_ROW_TYPE 1..15).
 * All values default to 0 if not provided.
 */
function buildDDRows(ddRows = []) {
  const rows = [];
  for (let i = 1; i <= 15; i++) {
    const row = ddRows.find(r => r.dd_row_type === i) || {};
    rows.push(`
    <EKDOSI_DD>
      ${elNum('DD_ROW_TYPE', i)}
      ${elDecimal('ALLOWED_AREA', row.allowed_area ?? 0)}
      ${elDecimal('LEGALLY_EXISTING_AREA', row.legally_existing_area ?? 0)}
      ${elDecimal('LEGALIZED_AREA', row.legalized_area ?? 0)}
      ${elDecimal('REGULATED_AREA', row.regulated_area ?? 0)}
      ${elDecimal('TOBE_LEGAL_AREA', row.tobe_legal_area ?? 0)}
      ${elDecimal('NEW_AREA', row.new_area ?? 0)}
    </EKDOSI_DD>`);
  }
  return rows.join('');
}

function buildBuildFloors(floors = []) {
  return floors.map(f => `
    <EKDOSI_BUILD_FLOOR>
      ${el('BUILD_DESCR', f.build_descr)}
      ${elNum('FLOOR_ID', f.floor_id)}
      ${(f.usages || []).map(u => `
      <EKDOSI_BUILD_USAGE>
        ${elNum('BUILD_USAGE', u.build_usage)}
        ${u.total_build_area != null ? elDecimal('TOTAL_BUILD_AREA', u.total_build_area) : ''}
      </EKDOSI_BUILD_USAGE>`).join('')}
    </EKDOSI_BUILD_FLOOR>`).join('');
}

function buildOwners(owners = []) {
  return owners.map(o => `
  <AITISI_OWNER>
    ${elNum('OWNER_TYPE', o.owner_type)}
    ${el('SURNAME', o.surname)}
    ${el('NAME', o.name)}
    ${el('F_NAME', o.father_name)}
    ${o.mother_name ? el('M_NAME', o.mother_name) : ''}
    ${elNum('RIGHT_TYPE', o.right_type ?? 1)}
    ${elDecimal('RIGHT_PERCENT', o.right_percent ?? 100)}
    ${el('ADDRESS', o.address)}
    ${el('CITY', o.city)}
    ${el('ZIP_CODE', o.zip_code)}
    ${el('TELEPHONE', o.phone)}
    ${o.mobile ? el('MOBILE_PHONE', o.mobile) : ''}
    ${o.fax ? el('FAX', o.fax) : ''}
    ${o.email ? el('EMAIL', o.email) : ''}
    ${o.afm ? el('AFM', o.afm) : ''}
    ${o.afm_ex ? el('AFM_EX', o.afm_ex) : ''}
    ${o.adt ? el('ADT', o.adt) : ''}
  </AITISI_OWNER>`).join('');
}

function buildEngineers(engineers = []) {
  return engineers.map(e => `
  <AITISI_ENGINEER>
    ${elNum('AMH', e.amh)}
    ${elNum('EM', e.em ?? 0)}
    ${(e.subtasks || []).map(s => `
    <AITISI_ENGINEER_SUBTASK>
      ${elNum('SUBTASK_ID', s.subtask_id)}
    </AITISI_ENGINEER_SUBTASK>`).join('')}
  </AITISI_ENGINEER>`).join('');
}

function buildDocRights(docRights = []) {
  return docRights.map(d => `
  <AITISI_DOC_RIGHT>
    ${d.ar_etos ? el('AR_ETOS', d.ar_etos) : ''}
    ${elNum('ISSUER_TYPE', d.issuer_type)}
    ${el('ISSUER_DATA', d.issuer_data)}
    ${elNum('DOC_TYPE', d.doc_type)}
  </AITISI_DOC_RIGHT>`).join('');
}

function buildApprovals(approvals = []) {
  return approvals.map(a => `
  <AITISI_APPROVAL>
    ${a.ar_egrisis ? el('AR_EGRISIS', a.ar_egrisis) : ''}
    ${elNum('ISSUER_TYPE', a.issuer_type)}
    ${el('ISSUER_DATA', a.issuer_data)}
    ${elNum('APPROVAL_TYPE', a.approval_type)}
    ${a.total_area != null ? elDecimal('TOTAL_AREA', a.total_area) : ''}
    ${a.comments ? el('COMMENTS', a.comments) : ''}
  </AITISI_APPROVAL>`).join('');
}

function buildApprovalsExt(approvalsExt = []) {
  return approvalsExt.map(a => `
  <AITISI_APPROVAL_EXT>
    ${elNum('APPROVAL_TYPE_EXT', a.approval_type_ext)}
    ${el('ISSUER_DATA', a.issuer_data)}
    ${el('AA_PROTOCOL', a.aa_protocol)}
    ${a.protocol_date ? el('PROTOCOL_DATE', a.protocol_date) : ''}
  </AITISI_APPROVAL_EXT>`).join('');
}

function buildParkings(parkings = []) {
  return parkings.map(p => `
  <AITISI_PARKING>
    ${el('AR_PRAXIS', p.ar_praxis)}
    ${p.praxi_date ? el('PRAXI_DATE', p.praxi_date) : ''}
    ${el('ISSUER_DATA', p.issuer_data)}
    ${elNum('NUM_OF_PARKINGS', p.num_of_parkings)}
  </AITISI_PARKING>`).join('');
}

function buildPrevPraxis(prevPraxis = []) {
  return prevPraxis.map(p => `
  <AITISI_PREV_PRAXI>
    ${elNum('PREV_PRAXI_TYPE', p.prev_praxi_type)}
    ${el('AA_PRAXIS', p.aa_praxis)}
    ${el('PROJECT_DESCR', p.project_descr)}
    ${p.praxi_date ? el('PRAXI_DATE', p.praxi_date) : ''}
    ${p.praxi_valid_to ? el('PRAXI_VALID_TO', p.praxi_valid_to) : ''}
  </AITISI_PREV_PRAXI>`).join('');
}

/**
 * Generate complete AITISI XML string.
 *
 * @param {object} data
 * @param {object} data.project     - Row from `projects` table
 * @param {object} data.property    - Row from `properties` table
 * @param {object} data.ekdosi      - Row from `ekdosi` table
 * @param {array}  data.owners      - Rows from `clients` table (with right_type, right_percent)
 * @param {array}  data.engineers   - Rows from `users` table (with subtasks)
 * @param {array}  data.docRights   - Rows from `doc_rights` table
 * @param {array}  data.approvals   - Rows from `approvals` table
 * @param {array}  data.approvalsExt
 * @param {array}  data.parkings
 * @param {array}  data.prevPraxis
 */
export function generateXML(data) {
  const { project, property, ekdosi, owners, engineers,
          docRights, approvals, approvalsExt, parkings, prevPraxis } = data;
  const prop = property || {};
  const ek = ekdosi || {};

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<AITISI>
  ${project.aitisi_aa ? elNum('AITISI_AA', project.aitisi_aa) : ''}
  ${elNum('AITISI_TYPE', project.aitisi_type_code)}
  ${elNum('YD_ID', project.yd_id)}
  ${elNum('DIMOS_AA', project.dimos_aa)}
  ${el('AITISI_DESCR', project.aitisi_descr || project.title)}
  ${el('ADDR', prop.addr)}
  ${el('ADDR_NUM_FROM', prop.addr_num_from)}
  ${prop.addr_num_to ? el('ADDR_NUM_TO', prop.addr_num_to) : ''}
  ${el('CITY', prop.city)}
  ${elNum('ZIP_CODE', prop.zip_code)}
  ${prop.addr_location ? el('ADDR_LOCATION', prop.addr_location) : ''}
  ${prop.ot ? el('OT', prop.ot) : ''}
  ${prop.kaek ? el('KAEK', prop.kaek) : ''}
  ${prop.gis_location ? el('GIS_LOCATION', prop.gis_location) : ''}
  ${project.notes ? el('COMMENTS', project.notes) : ''}
  ${elNum('ENTOS_SXEDIOU', project.entos_sxediou ?? 1)}
  ${project.mix_project_aa ? elNum('MIX_PROJECT_AA', project.mix_project_aa) : ''}
  ${elNum('NATURAL_DISASTER_FLAG', project.natural_disaster_flag ?? 0)}
  <EKDOSI>
    ${elNum('EKDOSI_TYPE', ek.ekdosi_type ?? 1)}
    ${elDecimal('TOTAL_PLOT_AREA', ek.total_plot_area ?? 0)}
    ${ek.comments ? el('COMMENTS', ek.comments) : ''}
    ${elDecimal('ROOF_GARDEN_AREA', ek.roof_garden_area ?? 0)}
    ${elDecimal('TOTAL_BUILD_VOLUME', ek.total_build_volume ?? 0)}
    ${elNum('NUM_OF_FLOORS', ek.num_of_floors ?? 0)}
    ${elNum('NUM_OF_OWNERSHIPS', ek.num_of_ownerships ?? 0)}
    ${elNum('NUM_OF_PARKINGS', ek.num_of_parkings ?? 0)}
    ${ek.ekdosi_categ != null ? elNum('EKDOSI_CATEG', ek.ekdosi_categ) : ''}
    ${(ek.add_specs || []).map(s => `
    <EKDOSI_ADD_SPECS>
      ${elNum('ADD_SPECS_TYPE', s.add_specs_type)}
    </EKDOSI_ADD_SPECS>`).join('')}
    ${buildBuildFloors(ek.build_floors)}
    ${buildDDRows(ek.dd_rows)}
  </EKDOSI>
  ${buildOwners(owners)}
  ${buildEngineers(engineers)}
  ${buildDocRights(docRights)}
  ${buildApprovals(approvals)}
  ${buildApprovalsExt(approvalsExt)}
  ${buildParkings(parkings)}
  ${buildPrevPraxis(prevPraxis)}
</AITISI>`;

  // Remove blank lines produced by empty optional elements
  return xml.replace(/^\s*\n/gm, '').trim();
}
