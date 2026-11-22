import { setUploadResponseHeaders } from './upload-utils';

/**
 * @fastify/static 10 hands setHeaders the Fastify reply (reply.header), older versions the raw response
 * (res.setHeader). Calling the missing one threw, so every uploaded file was served as a 500 error.
 */
describe('setUploadResponseHeaders', () => {
  it('works with a Fastify reply (@fastify/static 10)', () => {
    const headers: Record<string, string> = {};
    const reply = { header: (k: string, v: string) => { headers[k] = v; return reply; } };
    setUploadResponseHeaders(reply, '/app/uploads/products/t/img_1.jpg');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Cross-Origin-Resource-Policy']).toBe('same-site');
    expect(headers['Content-Disposition']).toBeUndefined();
  });

  it('works with a raw response and forces non-media files to download', () => {
    const headers: Record<string, string> = {};
    setUploadResponseHeaders({ setHeader: (k: string, v: string) => { headers[k] = v; } }, '/app/uploads/a/report.docx');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Content-Disposition']).toBe('attachment; filename="report.docx"');
  });
});
