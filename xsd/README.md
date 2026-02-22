# TEE XSD Schemas

Αρχεία σχήματος XML του συστήματος e-Adeies του ΤΕΕ.

## Αρχεία

- `AdeiaAitisiInput.xsd` — Κύριο schema αίτησης οικοδομικής άδειας (v2.9.1, Jan 2025)
- `adeies_xml_tables_july2025.accdb` — Access DB με κωδικούς αναφοράς (ISSUER_TYPE, DOC_TYPE, APPROVAL_TYPE, OWNER_TYPE, κλπ.)

## Πηγή

https://web.tee.gr/e-adeies/egcheiridia-chrisis-chrisima-entypa/

Κατεβήκαν: `master_dataxsd-2.rar`

## XSD Field Mapping

### Ριζικό στοιχείο: `AITISI`

| XSD Element | DB Table | DB Column | Zod | Notes |
|-------------|----------|-----------|-----|-------|
| AITISI_AA | projects | aitisi_aa | z.number().int().positive().optional() | Αύξων αριθμός αίτησης |
| AITISI_TYPE | projects | aitisi_type_code | z.number().int().positive() | Κωδικός τύπου πράξης |
| YD_ID | projects | yd_id | z.number().int().positive() | Κωδικός ΥΔΟΜ |
| DIMOS_AA | projects | dimos_aa | z.number().int().positive() | Κωδικός Δήμου |
| AITISI_DESCR | projects | aitisi_descr | z.string().max(1024) | Περιγραφή |
| ADDR | properties | addr | z.string().max(128) | Οδός |
| ADDR_NUM_FROM | properties | addr_num_from | z.string().max(5) | Αριθμός από |
| ADDR_NUM_TO | properties | addr_num_to | z.string().max(5).optional() | Αριθμός έως |
| CITY | properties | city | z.string().max(64) | Πόλη |
| ZIP_CODE | properties | zip_code | z.number().int().positive() | ΤΚ |
| ADDR_LOCATION | properties | addr_location | z.string().max(128).optional() | Θέση |
| OT | properties | ot | z.string().max(20).optional() | Οικοδομικό Τετράγωνο |
| KAEK | properties | kaek | z.string().max(20).optional() | Κωδ. Κτηματολογίου |
| GIS_LOCATION | properties | gis_location | z.string().max(2048).optional() | Πολύγωνο GIS |
| ENTOS_SXEDIOU | projects | entos_sxediou | z.number().int() | 0=εκτός, 1=εντός |
| NATURAL_DISASTER_FLAG | projects | natural_disaster_flag | z.number().int().min(0).max(1) | Φυσική Καταστροφή |

### AITISI_OWNER_TYPE

| XSD | DB (clients) | Notes |
|-----|-------------|-------|
| OWNER_TYPE | owner_type | 1=φυσικό, 2=νομικό |
| SURNAME | surname | max 40 |
| NAME | name | max 20 |
| F_NAME | father_name | max 20 |
| M_NAME | mother_name | max 20, optional |
| RIGHT_TYPE | right_type | Τύπος δικαιώματος |
| RIGHT_PERCENT | right_percent | 0.00001–100 |
| ADDRESS | address | max 64 |
| CITY | city | max 32 |
| ZIP_CODE | zip_code | max 5 |
| TELEPHONE | phone | pattern: (+)?[0-9]{10,15} |
| MOBILE_PHONE | mobile | optional |
| EMAIL | email | max 64 |
| AFM | afm | max 10, ελληνικό ΑΦΜ |
| AFM_EX | afm_ex | max 32, ξένο ΑΦΜ |
| ADT | adt | max 8, ΑΔΤ |

### AITISI_ENGINEER_TYPE

| XSD | DB (users) | Notes |
|-----|-----------|-------|
| AMH | amh | Αριθμός Μητρώου ΤΕΕ |
| EM | em | 0/1 flag |
| AITISI_ENGINEER_SUBTASK.SUBTASK_ID | — | Υπεργολαβία |

### EKDOSI_TYPE (Στοιχεία Έκδοσης)

| XSD | DB (ekdosi) | Notes |
|-----|------------|-------|
| EKDOSI_TYPE | ekdosi_type | Τύπος έκδοσης |
| TOTAL_PLOT_AREA | total_plot_area | Συνολικό εμβαδό οικοπέδου |
| ROOF_GARDEN_AREA | roof_garden_area | Εμβαδό roof garden |
| TOTAL_BUILD_VOLUME | total_build_volume | Συνολικός δομημένος όγκος |
| NUM_OF_FLOORS | num_of_floors | Αριθμός ορόφων |
| NUM_OF_OWNERSHIPS | num_of_ownerships | Αριθμός ιδιοκτησιών |
| NUM_OF_PARKINGS | num_of_parkings | Θέσεις στάθμευσης |
| EKDOSI_DD (×15) | dd_rows (JSONB) | 15 γραμμές δεδομένων δόμησης |
| EKDOSI_BUILD_FLOOR | build_floors (JSONB) | Ανά όροφο χρήσεις |

### EKDOSI_DD_TYPE (15 υποχρεωτικές γραμμές)

Κάθε γραμμή (DD_ROW_TYPE 1–15):
- ALLOWED_AREA — Επιτρεπόμενο εμβαδό
- LEGALLY_EXISTING_AREA — Νόμιμα υφιστάμενο
- LEGALIZED_AREA — Νομιμοποιούμενο
- REGULATED_AREA — Ρυθμιζόμενο
- TOBE_LEGAL_AREA — Προς νομιμοποίηση
- NEW_AREA — Νέο εμβαδό
