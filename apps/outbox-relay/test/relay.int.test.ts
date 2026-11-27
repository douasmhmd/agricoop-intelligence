/*
 * Outbox relay against real Postgres (with and without RLS) and Redpanda (Testcontainers).
 */
import { randomUUID } from 'node:crypto';
import { assertValidEvent, EVENT_TOPIC, type EventEnvelope } from '@agricoop/events';
import { ownerQuery, startTestDatabase, type TestDatabase } from '@agricoop/testing';
import { RedpandaContainer, type StartedRedpandaContainer } from '@testcontainers/redpanda';
import { Kafka, logLevel } from 'kafkajs';
import pg from 'pg';
import pino from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createKafkaPublisher, type KafkaPublisher } from '../src/kafka';
import { DEAD_LETTER_TOPIC, type OutboundMessage, relayBatch } from '../src/relay';

const COOP_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const COOP_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const logger = pino({ level: 'silent' });

/** A stock_modifie payload as in the shared contract; `code_produit` tells test rows apart. */
const stockModifie = (code: string) => ({
  mouvement_id: randomUUID(),
  lot_id: randomUUID(),
  produit_id: randomUUID(),
  code_produit: code,
  type_mouvement: 'entree',
  quantite: 10,
  date_mouvement: '2026-11-01T09:00:00.000Z',
});

async function insertEvent(db: TestDatabase, coop: string, type: string, payload: unknown) {
  const [row] = await ownerQuery<{ event_id: string }>(
    db,
    'INSERT INTO outbox (coop_id, type, payload) VALUES ($1, $2, $3) RETURNING event_id',
    [coop, type, JSON.stringify(payload)],
  );
  return row!.event_id;
}

async function unpublished(db: TestDatabase): Promise<number> {
  const [r] = await ownerQuery<{ n: number }>(
    db,
    'SELECT count(*)::int AS n FROM outbox WHERE NOT publie',
  );
  return r!.n;
}

/** Reads `count` messages from the given topics, from the beginning. */
async function consume(
  brokers: string[],
  topics: string[],
  count: number,
): Promise<{ topic: string; key: string; value: string; headers: Record<string, string> }[]> {
  const kafka = new Kafka({ brokers, logLevel: logLevel.NOTHING });
  const consumer = kafka.consumer({ groupId: `test-${randomUUID()}` });
  await consumer.connect();
  await consumer.subscribe({ topics, fromBeginning: true });
  const received: { topic: string; key: string; value: string; headers: Record<string, string> }[] =
    [];
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`only ${received.length}/${count} messages`)),
      30_000,
    );
    void consumer.run({
      eachMessage: ({ topic, message }) => {
        received.push({
          topic,
          key: message.key?.toString() ?? '',
          value: message.value?.toString() ?? '',
          headers: Object.fromEntries(
            Object.entries(message.headers ?? {}).map(([k, v]) => [k, v?.toString() ?? '']),
          ),
        });
        if (received.length >= count) {
          clearTimeout(timeout);
          resolve();
        }
        return Promise.resolve();
      },
    });
  });
  await consumer.disconnect();
  return received;
}

describe.each([{ rls: false }, { rls: true }])('outbox relay (rls: $rls)', ({ rls }) => {
  let db: TestDatabase;
  let redpanda: StartedRedpandaContainer;
  let pool: pg.Pool;
  let publisher: KafkaPublisher;
  let brokers: string[];

  beforeAll(async () => {
    [db, redpanda] = await Promise.all([
      startTestDatabase({ rls }),
      new RedpandaContainer('redpandadata/redpanda:v26.2.6').start(),
    ]);
    brokers = [redpanda.getBootstrapServers()];
    await ownerQuery(
      db,
      `INSERT INTO cooperative (coop_id, code, nom, province) VALUES
         ($1, 'COOPA', 'A', 'Ouezzane'), ($2, 'COOPB', 'B', 'Taounate')`,
      [COOP_A, COOP_B],
    );
    pool = new pg.Pool({ connectionString: db.relayUrl, max: 4 });
    publisher = await createKafkaPublisher({ brokers, logger });
    await publisher.ensureTopics(3, 1);
  });

  afterAll(async () => {
    await publisher?.disconnect();
    await pool?.end();
    await Promise.all([db?.stop(), redpanda?.stop()]);
  });

  it('publishes contract envelopes to agricoop.events keyed by coop_id, marks rows published, and is a no-op when drained', async () => {
    const a1 = await insertEvent(db, COOP_A, 'stock_modifie', stockModifie('A-1'));
    const b1 = await insertEvent(db, COOP_B, 'stock_modifie', stockModifie('B-1'));
    const a2 = await insertEvent(db, COOP_A, 'stock_modifie', stockModifie('A-2'));

    expect(await relayBatch({ pool, publisher, batchSize: 100, logger })).toBe(3);
    expect(await unpublished(db)).toBe(0);
    expect(await relayBatch({ pool, publisher, batchSize: 100, logger })).toBe(0);

    const messages = await consume(brokers, [EVENT_TOPIC], 3);
    const byId = new Map(
      messages.map((m) => [(JSON.parse(m.value) as EventEnvelope).event_id, m] as const),
    );
    expect([...byId.keys()].sort()).toEqual([a1, a2, b1].sort());
    for (const m of messages) {
      const envelope = JSON.parse(m.value) as EventEnvelope & Record<string, unknown>;
      expect(() => assertValidEvent(envelope)).not.toThrow();
      expect(m.key).toBe(envelope.coop_id);
      expect(m.headers).toMatchObject({
        event_id: envelope.event_id,
        type: 'stock_modifie',
        version: '1',
      });
      // Exactly the envelope of the shared contract: nothing else (e.g. no is_synthetic).
      expect(Object.keys(envelope).sort()).toEqual(
        ['coop_id', 'event_id', 'occurred_at', 'payload', 'type', 'version'].sort(),
      );
    }
  });

  it('dead-letters invalid events without their payload, and keeps the queue moving', async () => {
    const bad = await insertEvent(db, COOP_A, 'stock_modifie', {
      ...stockModifie('BAD'),
      email: 'x@y.ma',
    });
    const unknown = await insertEvent(db, COOP_B, 'inconnu', { foo: 1 });
    expect(await relayBatch({ pool, publisher, batchSize: 100, logger })).toBe(2);
    expect(await unpublished(db)).toBe(0);

    const dlq = await consume(brokers, [DEAD_LETTER_TOPIC], 2);
    const values = dlq.map((m) => JSON.parse(m.value) as { event_id: string; payload: unknown });
    expect(values.map((v) => v.event_id).sort()).toEqual([bad, unknown].sort());
    for (const v of values) expect(v.payload).toBeNull();
    expect(dlq.map((m) => m.value).join()).not.toContain('x@y.ma');
  });

  it('leaves rows unpublished when publishing fails (at-least-once)', async () => {
    await insertEvent(db, COOP_A, 'stock_modifie', stockModifie('RETRY'));
    const failing = { publish: () => Promise.reject(new Error('broker down')) };
    await expect(relayBatch({ pool, publisher: failing, batchSize: 100, logger })).rejects.toThrow(
      'broker down',
    );
    expect(await unpublished(db)).toBe(1);
    expect(await relayBatch({ pool, publisher, batchSize: 100, logger })).toBe(1);
    expect(await unpublished(db)).toBe(0);
  });

  it('concurrent relays (SKIP LOCKED) publish every event exactly once', async () => {
    const ids = new Set<string>();
    for (let i = 0; i < 40; i++) {
      ids.add(
        await insertEvent(db, i % 2 ? COOP_A : COOP_B, 'stock_modifie', stockModifie(`C-${i}`)),
      );
    }
    const seen: string[] = [];
    const recording = {
      publish: async (messages: OutboundMessage[]) => {
        await new Promise((r) => setTimeout(r, 20)); // keep the batch's rows locked a little
        for (const m of messages) seen.push(m.headers.event_id!);
      },
    };
    const drain = async () => {
      while ((await relayBatch({ pool, publisher: recording, batchSize: 7, logger })) > 0) {
        /* keep going */
      }
    };
    await Promise.all([drain(), drain(), drain()]);
    expect(seen).toHaveLength(40);
    expect(new Set(seen)).toEqual(ids);
    expect(await unpublished(db)).toBe(0);
  });
});
