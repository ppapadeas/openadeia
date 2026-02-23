import { z } from 'zod';

// ── Reusable atoms ─────────────────────────────────────────────────
const uuid = z.string().uuid();

// Correct permit type codes matching TEE e-Adeies system
// Top-level distinction: νέα πράξη vs σε συνέχεια (captured by is_continuation)
const permitType = z.enum([
  // Νέα Πράξη (new acts — is_continuation: false)
  'new_building',   // Νέα Οικοδομική Άδεια
  'minor_cat1',     // Έγκριση Εργασιών Δόμησης Κατ.1
  'minor_cat2',     // Έγκριση Εργασιών Δόμησης Κατ.2
  'vod',            // Βεβαίωση Όρων Δόμησης
  'preapproval',    // Προέγκριση
  // Σε Συνέχεια (continuations — is_continuation: true)
  'revision',       // Αναθεώρηση Άδειας
  'revision_ext',   // Αναθεώρηση με Επέκταση
  'file_update',    // Ενημέρωση Φακέλου
]);

const docStatus = z.enum(['pending', 'uploaded', 'signed', 'rejected']);
const projectStage = z.enum([
  'init', 'data_collection', 'studies', 'signatures', 'submission', 'review', 'approved',
]);
// XSD fdate: dd/mm/yyyy or empty
const _fdate = z.string().regex(/^((0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[012])\/(18|19|20)\d{2})?$/).optional();
// XSD phone pattern
const _phone = z.string().regex(/^(\+)?([0-9]{10,15})$/).optional();

// ── Project schemas ────────────────────────────────────────────────
export const createProjectSchema = z.object({
  type: permitType,
  is_continuation: z.boolean().optional().default(false),
  title: z.string().min(1).max(255),
  client_id: uuid.optional(),
  aitisi_type_code: z.number().int().positive().optional(),
  yd_id: z.number().int().positive().optional(),
  dimos_aa: z.number().int().positive().optional(),
  aitisi_descr: z.string().max(1024).optional(),
  entos_sxediou: z.number().int().optional(),
  natural_disaster_flag: z.number().int().min(0).max(1).optional(),
  deadline: z.string().optional(),
  notes: z.string().optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

// ── Client (owner) schemas — maps to AITISI_OWNER_TYPE ────────────
export const createClientSchema = z.object({
  surname: z.string().min(1).max(40),
  name: z.string().min(1).max(20),
  father_name: z.string().max(20).optional(),
  mother_name: z.string().max(20).optional(),
  owner_type: z.number().int().positive().default(1),
  email: z.string().email().max(64).optional().or(z.literal('')),
  phone: z.string().max(16).optional(),
  mobile: z.string().max(16).optional(),
  afm: z.string().max(10).optional(),
  afm_ex: z.string().max(32).optional(),
  adt: z.string().max(8).optional(),
  address: z.string().max(64).optional(),
  city: z.string().max(32).optional(),
  zip_code: z.string().max(5).optional(),
});

export const updateClientSchema = createClientSchema.partial();

// ── Document schemas ───────────────────────────────────────────────
export const updateDocumentSchema = z.object({
  status: docStatus.optional(),
  signer_role: z.string().max(30).optional(),
  notes: z.string().optional(),
});

// ── Workflow schemas ───────────────────────────────────────────────
export const rejectSchema = z.object({
  targetStage: projectStage,
  reason: z.string().min(1),
});

// ── Property schema ────────────────────────────────────────────────
export const propertySchema = z.object({
  kaek: z.string().max(20).optional(),
  ot: z.string().max(20).optional(),
  addr: z.string().max(128).optional(),
  addr_num_from: z.string().max(5).optional(),
  addr_num_to: z.string().max(5).optional(),
  city: z.string().max(64).optional(),
  zip_code: z.number().int().positive().optional(),
  addr_location: z.string().max(128).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  zoning_info: z.record(z.unknown()).optional(),
});

// ── Email schema ───────────────────────────────────────────────────
export const sendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
  attachmentDocIds: z.array(uuid).optional(),
});

// ── Auth schemas ───────────────────────────────────────────────────
export const registerSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(2).max(255),
  password: z.string().min(8).max(128),
  amh: z.number().int().positive().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const profileUpdateSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  amh: z.number().int().positive().nullable().optional(),
  tee_username: z.string().max(100).nullable().optional(),
  tee_password: z.string().max(255).nullable().optional(),
  current_password: z.string().optional(),
  new_password: z.string().min(8).max(128).optional(),
});

// ── Fastify validation helper ──────────────────────────────────────
export function zodValidator(schema) {
  return async (request, reply) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      reply.code(400).send({ error: 'Validation failed', details: result.error.flatten() });
    } else {
      request.body = result.data;
    }
  };
}
