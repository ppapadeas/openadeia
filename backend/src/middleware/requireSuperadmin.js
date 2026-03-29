/**
 * requireSuperadmin — preHandler middleware
 *
 * Checks that the authenticated user has is_superadmin: true in the JWT.
 * Must be used AFTER fastify.authenticate.
 *
 * Usage:
 *   fastify.get('/api/admin/...', {
 *     onRequest: [fastify.authenticate],
 *     preHandler: [requireSuperadmin],
 *   }, handler);
 */

export default async function requireSuperadmin(request, reply) {
  if (!request.user?.is_superadmin) {
    return reply.code(403).send({
      error: 'Forbidden',
      detail: 'Superadmin access required',
    });
  }
}
