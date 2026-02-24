import { describe, it, expect } from 'vitest';
import { generateXML } from '../../src/utils/xml-generator.js';

// ── Helpers ─────────────────────────────────────────────────────────

function minimalData() {
  return {
    project: {
      aitisi_type_code: 1,
      yd_id: 100,
      dimos_aa: 200,
      title: 'Νέα Οικοδομική Άδεια',
    },
    property: {
      addr: 'Σταδίου 1',
      addr_num_from: '1',
      city: 'Αθήνα',
      zip_code: 10562,
    },
    ekdosi: {
      ekdosi_type: 1,
      total_plot_area: 500.0,
      total_build_volume: 1200.0,
      num_of_floors: 3,
      num_of_ownerships: 6,
      num_of_parkings: 4,
    },
    owners: [{
      owner_type: 1,
      surname: 'Παπαδόπουλος',
      name: 'Γιάννης',
      father_name: 'Νικόλαος',
      right_type: 1,
      right_percent: 100,
      afm: '123456789',
      adt: 'ΑΒ12345',
    }],
    engineers: [{
      amh: 12345,
      em: 1,
      subtasks: [{ subtask_id: 1 }, { subtask_id: 2 }],
    }],
    docRights: [],
    approvals: [],
    approvalsExt: [],
    parkings: [],
    prevPraxis: [],
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('generateXML', () => {
  it('generates valid XML with XML declaration', () => {
    const xml = generateXML(minimalData());
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  });

  it('wraps content in AITISI root element', () => {
    const xml = generateXML(minimalData());
    expect(xml).toContain('<AITISI>');
    expect(xml).toContain('</AITISI>');
  });

  // ── Header fields ──────────────────────────────────────────────

  it('includes AITISI_TYPE from project.aitisi_type_code', () => {
    const xml = generateXML(minimalData());
    expect(xml).toContain('<AITISI_TYPE>1</AITISI_TYPE>');
  });

  it('includes YD_ID and DIMOS_AA', () => {
    const xml = generateXML(minimalData());
    expect(xml).toContain('<YD_ID>100</YD_ID>');
    expect(xml).toContain('<DIMOS_AA>200</DIMOS_AA>');
  });

  it('includes AITISI_DESCR from project.title', () => {
    const xml = generateXML(minimalData());
    expect(xml).toContain('<AITISI_DESCR>Νέα Οικοδομική Άδεια</AITISI_DESCR>');
  });

  it('includes AITISI_AA when project.aitisi_aa is set', () => {
    const data = minimalData();
    data.project.aitisi_aa = 42;
    const xml = generateXML(data);
    expect(xml).toContain('<AITISI_AA>42</AITISI_AA>');
  });

  it('omits AITISI_AA when not set', () => {
    const xml = generateXML(minimalData());
    expect(xml).not.toContain('<AITISI_AA>');
  });

  // ── Address fields ─────────────────────────────────────────────

  it('includes address fields from property', () => {
    const xml = generateXML(minimalData());
    expect(xml).toContain('<ADDR>Σταδίου 1</ADDR>');
    expect(xml).toContain('<ADDR_NUM_FROM>1</ADDR_NUM_FROM>');
    expect(xml).toContain('<CITY>Αθήνα</CITY>');
    expect(xml).toContain('<ZIP_CODE>10562</ZIP_CODE>');
  });

  it('includes optional KAEK and OT when present', () => {
    const data = minimalData();
    data.property.kaek = '050607080090';
    data.property.ot = '123A';
    const xml = generateXML(data);
    expect(xml).toContain('<KAEK>050607080090</KAEK>');
    expect(xml).toContain('<OT>123A</OT>');
  });

  it('omits KAEK and OT when not set', () => {
    const xml = generateXML(minimalData());
    expect(xml).not.toContain('<KAEK>');
    expect(xml).not.toContain('<OT>');
  });

  it('handles null property gracefully', () => {
    const data = minimalData();
    data.property = null;
    const xml = generateXML(data);
    expect(xml).toContain('<AITISI>');
    // Should not throw
  });

  // ── EKDOSI ─────────────────────────────────────────────────────

  it('includes EKDOSI block with building specs', () => {
    const xml = generateXML(minimalData());
    expect(xml).toContain('<EKDOSI>');
    expect(xml).toContain('<EKDOSI_TYPE>1</EKDOSI_TYPE>');
    expect(xml).toContain('<TOTAL_PLOT_AREA>500.00000</TOTAL_PLOT_AREA>');
    expect(xml).toContain('<TOTAL_BUILD_VOLUME>1200.00000</TOTAL_BUILD_VOLUME>');
    expect(xml).toContain('<NUM_OF_FLOORS>3</NUM_OF_FLOORS>');
    expect(xml).toContain('<NUM_OF_OWNERSHIPS>6</NUM_OF_OWNERSHIPS>');
    expect(xml).toContain('<NUM_OF_PARKINGS>4</NUM_OF_PARKINGS>');
  });

  it('generates all 15 mandatory EKDOSI_DD rows', () => {
    const xml = generateXML(minimalData());
    for (let i = 1; i <= 15; i++) {
      expect(xml).toContain(`<DD_ROW_TYPE>${i}</DD_ROW_TYPE>`);
    }
    // Count occurrences of EKDOSI_DD
    const matches = xml.match(/<EKDOSI_DD>/g);
    expect(matches).toHaveLength(15);
  });

  it('populates DD rows with data when provided', () => {
    const data = minimalData();
    data.ekdosi.dd_rows = [
      { dd_row_type: 1, allowed_area: 250.5, new_area: 100.0 },
      { dd_row_type: 3, legally_existing_area: 75.0 },
    ];
    const xml = generateXML(data);
    expect(xml).toContain('<ALLOWED_AREA>250.50000</ALLOWED_AREA>');
    expect(xml).toContain('<NEW_AREA>100.00000</NEW_AREA>');
    expect(xml).toContain('<LEGALLY_EXISTING_AREA>75.00000</LEGALLY_EXISTING_AREA>');
  });

  it('defaults DD row values to 0 when not provided', () => {
    const xml = generateXML(minimalData());
    // Row 1 should have all zeros since no dd_rows were provided
    expect(xml).toContain('<ALLOWED_AREA>0.00000</ALLOWED_AREA>');
    expect(xml).toContain('<NEW_AREA>0.00000</NEW_AREA>');
  });

  it('includes EKDOSI_BUILD_FLOOR when floors are present', () => {
    const data = minimalData();
    data.ekdosi.build_floors = [{
      build_descr: 'Ισόγειο',
      floor_id: 0,
      usages: [{ build_usage: 1, total_build_area: 120.5 }],
    }];
    const xml = generateXML(data);
    expect(xml).toContain('<EKDOSI_BUILD_FLOOR>');
    expect(xml).toContain('<BUILD_DESCR>Ισόγειο</BUILD_DESCR>');
    expect(xml).toContain('<FLOOR_ID>0</FLOOR_ID>');
    expect(xml).toContain('<BUILD_USAGE>1</BUILD_USAGE>');
    expect(xml).toContain('<TOTAL_BUILD_AREA>120.50000</TOTAL_BUILD_AREA>');
  });

  it('handles null ekdosi gracefully', () => {
    const data = minimalData();
    data.ekdosi = null;
    const xml = generateXML(data);
    expect(xml).toContain('<EKDOSI>');
    // defaults to 0 values
    expect(xml).toContain('<EKDOSI_TYPE>1</EKDOSI_TYPE>');
  });

  // ── Owners ─────────────────────────────────────────────────────

  it('includes AITISI_OWNER elements', () => {
    const xml = generateXML(minimalData());
    expect(xml).toContain('<AITISI_OWNER>');
    expect(xml).toContain('<SURNAME>Παπαδόπουλος</SURNAME>');
    expect(xml).toContain('<NAME>Γιάννης</NAME>');
    expect(xml).toContain('<F_NAME>Νικόλαος</F_NAME>');
    expect(xml).toContain('<AFM>123456789</AFM>');
    expect(xml).toContain('<ADT>ΑΒ12345</ADT>');
    expect(xml).toContain('<RIGHT_PERCENT>100.00000</RIGHT_PERCENT>');
  });

  it('handles multiple owners', () => {
    const data = minimalData();
    data.owners.push({
      owner_type: 1,
      surname: 'Αγγελίδης',
      name: 'Κωνσταντίνος',
      father_name: 'Δημήτριος',
      right_type: 1,
      right_percent: 50,
      afm: '987654321',
    });
    data.owners[0].right_percent = 50;
    const xml = generateXML(data);
    const ownerMatches = xml.match(/<AITISI_OWNER>/g);
    expect(ownerMatches).toHaveLength(2);
    expect(xml).toContain('<SURNAME>Αγγελίδης</SURNAME>');
  });

  // ── Engineers ──────────────────────────────────────────────────

  it('includes AITISI_ENGINEER elements with subtasks', () => {
    const xml = generateXML(minimalData());
    expect(xml).toContain('<AITISI_ENGINEER>');
    expect(xml).toContain('<AMH>12345</AMH>');
    expect(xml).toContain('<EM>1</EM>');
    expect(xml).toContain('<SUBTASK_ID>1</SUBTASK_ID>');
    expect(xml).toContain('<SUBTASK_ID>2</SUBTASK_ID>');
  });

  // ── Optional sections ─────────────────────────────────────────

  it('includes AITISI_DOC_RIGHT when docRights are provided', () => {
    const data = minimalData();
    data.docRights = [{
      ar_etos: '2024',
      issuer_type: 1,
      issuer_data: 'Υποθηκοφυλάκειο Αθηνών',
      doc_type: 3,
    }];
    const xml = generateXML(data);
    expect(xml).toContain('<AITISI_DOC_RIGHT>');
    expect(xml).toContain('<AR_ETOS>2024</AR_ETOS>');
    expect(xml).toContain('<ISSUER_DATA>Υποθηκοφυλάκειο Αθηνών</ISSUER_DATA>');
    expect(xml).toContain('<DOC_TYPE>3</DOC_TYPE>');
  });

  it('includes AITISI_APPROVAL when approvals are provided', () => {
    const data = minimalData();
    data.approvals = [{
      ar_egrisis: '123/2024',
      issuer_type: 2,
      issuer_data: 'Αρχαιολογικό Συμβούλιο',
      approval_type: 1,
      total_area: 500.0,
      comments: 'Εγκρίθηκε',
    }];
    const xml = generateXML(data);
    expect(xml).toContain('<AITISI_APPROVAL>');
    expect(xml).toContain('<AR_EGRISIS>123/2024</AR_EGRISIS>');
    expect(xml).toContain('<APPROVAL_TYPE>1</APPROVAL_TYPE>');
    expect(xml).toContain('<TOTAL_AREA>500.00000</TOTAL_AREA>');
  });

  it('includes AITISI_APPROVAL_EXT when approvalsExt are provided', () => {
    const data = minimalData();
    data.approvalsExt = [{
      approval_type_ext: 5,
      issuer_data: 'Δασαρχείο',
      aa_protocol: '456/2024',
      protocol_date: '2024-03-15',
    }];
    const xml = generateXML(data);
    expect(xml).toContain('<AITISI_APPROVAL_EXT>');
    expect(xml).toContain('<APPROVAL_TYPE_EXT>5</APPROVAL_TYPE_EXT>');
    expect(xml).toContain('<AA_PROTOCOL>456/2024</AA_PROTOCOL>');
    expect(xml).toContain('<PROTOCOL_DATE>2024-03-15</PROTOCOL_DATE>');
  });

  it('includes AITISI_PARKING when parkings are provided', () => {
    const data = minimalData();
    data.parkings = [{
      ar_praxis: '789/2024',
      praxi_date: '2024-01-20',
      issuer_data: 'ΔΗΜΟΣ ΑΘΗΝΑΙΩΝ',
      num_of_parkings: 2,
    }];
    const xml = generateXML(data);
    expect(xml).toContain('<AITISI_PARKING>');
    expect(xml).toContain('<AR_PRAXIS>789/2024</AR_PRAXIS>');
    expect(xml).toContain('<NUM_OF_PARKINGS>2</NUM_OF_PARKINGS>');
  });

  it('includes AITISI_PREV_PRAXI when prevPraxis are provided', () => {
    const data = minimalData();
    data.prevPraxis = [{
      prev_praxi_type: 1,
      aa_praxis: '2020/12345',
      project_descr: 'Αρχική Άδεια Δόμησης',
      praxi_date: '2020-06-01',
      praxi_valid_to: '2024-06-01',
    }];
    const xml = generateXML(data);
    expect(xml).toContain('<AITISI_PREV_PRAXI>');
    expect(xml).toContain('<PREV_PRAXI_TYPE>1</PREV_PRAXI_TYPE>');
    expect(xml).toContain('<AA_PRAXIS>2020/12345</AA_PRAXIS>');
    expect(xml).toContain('<PROJECT_DESCR>Αρχική Άδεια Δόμησης</PROJECT_DESCR>');
    expect(xml).toContain('<PRAXI_VALID_TO>2024-06-01</PRAXI_VALID_TO>');
  });

  // ── XML escaping ───────────────────────────────────────────────

  it('escapes special XML characters', () => {
    const data = minimalData();
    data.project.title = 'Άδεια & Αναθεώρηση <2024>';
    const xml = generateXML(data);
    expect(xml).toContain('Άδεια &amp; Αναθεώρηση &lt;2024&gt;');
    expect(xml).not.toContain('<2024>');
  });

  it('escapes quotes in owner data', () => {
    const data = minimalData();
    data.owners[0].surname = 'O\'Brien';
    const xml = generateXML(data);
    expect(xml).toContain('O&apos;Brien');
  });

  // ── Defaults ───────────────────────────────────────────────────

  it('defaults ENTOS_SXEDIOU to 1', () => {
    const xml = generateXML(minimalData());
    expect(xml).toContain('<ENTOS_SXEDIOU>1</ENTOS_SXEDIOU>');
  });

  it('defaults NATURAL_DISASTER_FLAG to 0', () => {
    const xml = generateXML(minimalData());
    expect(xml).toContain('<NATURAL_DISASTER_FLAG>0</NATURAL_DISASTER_FLAG>');
  });

  // ── Full round-trip: no blank lines ────────────────────────────

  it('does not produce consecutive blank lines', () => {
    const xml = generateXML(minimalData());
    expect(xml).not.toMatch(/\n\s*\n/);
  });

  // ── Empty arrays produce no elements ──────────────────────────

  it('produces no AITISI_DOC_RIGHT when docRights is empty', () => {
    const xml = generateXML(minimalData());
    expect(xml).not.toContain('<AITISI_DOC_RIGHT>');
  });

  it('produces no AITISI_APPROVAL when approvals is empty', () => {
    const xml = generateXML(minimalData());
    expect(xml).not.toContain('<AITISI_APPROVAL>');
  });
});
