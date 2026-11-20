import { BadRequestException } from '@nestjs/common';
import { ActivityTimelineService } from './activity-timeline.service';
import type { DatabaseService } from '../database/database.service';

describe('ActivityTimelineService', () => {
  let service: ActivityTimelineService;
  let conn: { query: jest.Mock };

  beforeEach(() => {
    conn = { query: jest.fn() };
    const db = { getTenantConnectionById: jest.fn().mockResolvedValue(conn) } as unknown as DatabaseService;
    service = new ActivityTimelineService(db);
  });

  describe('diff()', () => {
    const fields = { name: 'Name', price: 'Sales price', active: 'Active', tags: 'Tags', launched: 'Launch date' };

    it('returns only tracked fields that changed, with labels', () => {
      const changes = ActivityTimelineService.diff(
        { name: 'Tea', price: '10.00', active: true, secret: 'a' },
        { name: 'Green tea', price: '10.00', active: true, secret: 'b' },
        fields,
      );
      expect(changes).toEqual([{ field: 'name', label: 'Name', old: 'Tea', new: 'Green tea' }]);
    });

    it('treats numeric strings and numbers as equal (DB decimals vs DTO numbers)', () => {
      expect(ActivityTimelineService.diff({ price: '10.00' }, { price: 10 }, fields)).toEqual([]);
      expect(ActivityTimelineService.diff({ price: '10.00' }, { price: 10.5 }, fields)).toHaveLength(1);
    });

    it('treats null, undefined and empty string as the same empty value', () => {
      expect(ActivityTimelineService.diff({ name: null }, { name: '' }, fields)).toEqual([]);
      expect(ActivityTimelineService.diff({ name: undefined }, { name: null }, fields)).toEqual([]);
    });

    it('ignores fields that are not part of the update payload', () => {
      expect(ActivityTimelineService.diff({ name: 'Tea', price: 5 }, { price: 5 }, fields)).toEqual([]);
    });

    it('compares objects/arrays deeply and dates by instant', () => {
      expect(ActivityTimelineService.diff({ tags: ['a', 'b'] }, { tags: ['a', 'b'] }, fields)).toEqual([]);
      expect(ActivityTimelineService.diff({ tags: ['a'] }, { tags: ['a', 'b'] }, fields)).toHaveLength(1);
      const d = new Date('2026-11-20T10:00:00Z');
      expect(ActivityTimelineService.diff({ launched: d }, { launched: new Date(d.getTime()) }, fields)).toEqual([]);
      const [c] = ActivityTimelineService.diff({ launched: null }, { launched: d }, fields);
      expect(c.new).toBe('2026-11-20T10:00:00.000Z');
    });

    it('reports every tracked field on creation (before = null)', () => {
      const changes = ActivityTimelineService.diff(null, { name: 'Tea', price: 3 }, { name: 'Name', price: 'Price' });
      expect(changes.map((c) => c.field)).toEqual(['name', 'price']);
    });

    it('detects boolean flips', () => {
      expect(ActivityTimelineService.diff({ active: true }, { active: false }, fields)).toEqual([
        { field: 'active', label: 'Active', old: true, new: false },
      ]);
    });
  });

  describe('record()', () => {
    it('inserts a parameterized row with JSON columns and defaults', async () => {
      conn.query.mockResolvedValueOnce([{ id: 'e1' }]);
      const res = await service.record('t1', {
        entityType: 'product',
        entityId: 'p1',
        eventType: 'created',
        moduleKey: 'products',
        actorId: 'u1',
      });
      expect(res).toEqual({ id: 'e1' });
      const [sql, params] = conn.query.mock.calls[0];
      expect(sql).toContain('INSERT INTO activity_events');
      expect(params).toEqual(['product', 'p1', 'created', 'products', null, '[]', '{}', 'ui', 'internal', 'u1', null, null]);
    });

    it('passes an explicit occurredAt as ISO for backdated entries', async () => {
      conn.query.mockResolvedValueOnce([{ id: 'e2' }]);
      await service.record('t1', {
        entityType: 'crm_lead', entityId: 'l1', eventType: 'interaction',
        occurredAt: new Date('2026-11-01T08:30:00Z'), payload: { channel: 'voip_call', direction: 'out' },
      });
      const params = conn.query.mock.calls[0][1];
      expect(params[6]).toBe('{"channel":"voip_call","direction":"out"}');
      expect(params[11]).toBe('2026-11-01T08:30:00.000Z');
    });

    it.each([
      [{ entityType: 'Bad Type', entityId: 'x', eventType: 'created' }],
      [{ entityType: 'product', entityId: '', eventType: 'created' }],
      [{ entityType: 'product', entityId: 'x', eventType: 'exploded' }],
      [{ entityType: 'product', entityId: 'x', eventType: 'created', source: 'telepathy' }],
      [{ entityType: 'product', entityId: 'x', eventType: 'created', visibility: 'public' }],
    ])('rejects invalid input %#', async (input) => {
      await expect(service.record('t1', input as never)).rejects.toBeInstanceOf(BadRequestException);
      expect(conn.query).not.toHaveBeenCalled();
    });
  });

  describe('recordChanges()', () => {
    it('writes nothing when no tracked field changed', async () => {
      const res = await service.recordChanges('t1', {
        entityType: 'product', entityId: 'p1', before: { name: 'Tea' }, after: { name: 'Tea' }, fields: { name: 'Name' },
      });
      expect(res).toBeNull();
      expect(conn.query).not.toHaveBeenCalled();
    });

    it('writes one updated event with the diff and a default summary', async () => {
      conn.query.mockResolvedValueOnce([{ id: 'e3' }]);
      await service.recordChanges('t1', {
        entityType: 'product', entityId: 'p1',
        before: { name: 'Tea', price: '5.00' }, after: { name: 'Black tea', price: 6 },
        fields: { name: 'Name', price: 'Sales price' }, actorId: 'u1', source: 'ai',
      });
      const params = conn.query.mock.calls[0][1];
      expect(params[2]).toBe('updated');
      expect(params[4]).toBe('Name, Sales price changed');
      expect(JSON.parse(params[5])).toHaveLength(2);
      expect(params[7]).toBe('ai');
    });
  });

  describe('list()', () => {
    it('returns newest first with a cursor when there are more rows', async () => {
      conn.query.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
      const res = await service.list('t1', 'product', 'p1', { limit: 2 });
      expect(res).toEqual({ events: [{ id: 'a' }, { id: 'b' }], nextCursor: 'b' });
      const [sql, params] = conn.query.mock.calls[0];
      expect(sql).toContain('ORDER BY e.occurred_at DESC, e.id DESC');
      expect(params).toEqual(['product', 'p1', 3]);
    });

    it('applies type, visibility and cursor filters as parameters', async () => {
      conn.query.mockResolvedValueOnce([]);
      const res = await service.list('t1', 'product', 'p1', {
        eventTypes: ['note', 'interaction'], visibility: 'customer', before: '00000000-0000-0000-0000-000000000001',
      });
      expect(res.nextCursor).toBeNull();
      const [sql, params] = conn.query.mock.calls[0];
      expect(sql).toContain('e.event_type = ANY($3)');
      expect(sql).toContain('e.visibility = $4');
      expect(sql).toContain('WHERE id = $5::uuid');
      expect(params).toEqual(['product', 'p1', ['note', 'interaction'], 'customer', '00000000-0000-0000-0000-000000000001', 51]);
    });

    it('caps the page size at 200 and rejects bad entity or event types', async () => {
      conn.query.mockResolvedValue([]);
      await service.list('t1', 'product', 'p1', { limit: 5000 });
      expect(conn.query.mock.calls[0][1].at(-1)).toBe(201);
      await expect(service.list('t1', 'DROP TABLE', 'p1')).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.list('t1', 'product', 'p1', { eventTypes: ['bogus' as never] })).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
