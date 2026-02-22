import * as Minio from 'minio';

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: Number(process.env.MINIO_PORT) || 9000,
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
});

export const BUCKET = process.env.MINIO_BUCKET || 'permits';

export async function ensureBucket() {
  const exists = await minioClient.bucketExists(BUCKET);
  if (!exists) {
    await minioClient.makeBucket(BUCKET, 'eu-west-1');
  }
}

// Path: permits/{project_id}/{category}/{filename}
export function buildPath(projectId, category, filename) {
  return `${projectId}/${category}/${filename}`;
}

export default minioClient;
