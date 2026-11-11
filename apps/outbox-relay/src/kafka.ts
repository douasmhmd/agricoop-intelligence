import { EVENT_TYPES, topicFor } from '@agricoop/events';
import { Kafka, logLevel, Partitioners, type Producer } from 'kafkajs';
import type { Logger } from 'pino';
import { DEAD_LETTER_TOPIC, type EventPublisher, type OutboundMessage } from './relay';

export interface KafkaPublisherOptions {
  brokers: string[];
  clientId?: string;
  logger: Logger;
}

export interface KafkaPublisher extends EventPublisher {
  connected(): boolean;
  /** Creates the v1 topics + dead letter if missing (idempotent). */
  ensureTopics(partitions: number, replicationFactor: number): Promise<void>;
  disconnect(): Promise<void>;
}

/** All topics the relay may write to. */
export const RELAY_TOPICS = [...EVENT_TYPES.map((t) => topicFor(t)), DEAD_LETTER_TOPIC];

/**
 * KafkaJS producer for Redpanda: idempotent, acks = all, Java-compatible murmur2 partitioner (so the
 * coop_id key maps to the same partition for every client, e.g. Redpanda Connect).
 */
export async function createKafkaPublisher(
  options: KafkaPublisherOptions,
): Promise<KafkaPublisher> {
  const log = options.logger.child({ component: 'kafkajs' });
  const kafka = new Kafka({
    clientId: options.clientId ?? 'agricoop-outbox-relay',
    brokers: options.brokers,
    retry: { retries: 5 },
    logLevel: logLevel.WARN,
    logCreator: () => (entry) => {
      const { message, ...rest } = entry.log;
      if (entry.level <= logLevel.ERROR) log.error(rest, message);
      else log.warn(rest, message);
    },
  });
  const producer: Producer = kafka.producer({
    idempotent: true,
    maxInFlightRequests: 1,
    allowAutoTopicCreation: false,
    createPartitioner: Partitioners.DefaultPartitioner,
  });
  let isConnected = false;
  producer.on(producer.events.CONNECT, () => (isConnected = true));
  producer.on(producer.events.DISCONNECT, () => (isConnected = false));
  await producer.connect();

  return {
    connected: () => isConnected,

    async publish(messages: OutboundMessage[]): Promise<void> {
      if (messages.length === 0) return;
      const byTopic = new Map<string, OutboundMessage[]>();
      for (const m of messages) byTopic.set(m.topic, [...(byTopic.get(m.topic) ?? []), m]);
      await producer.sendBatch({
        acks: -1,
        topicMessages: [...byTopic].map(([topic, list]) => ({
          topic,
          messages: list.map((m) => ({ key: m.key, value: m.value, headers: m.headers })),
        })),
      });
    },

    async ensureTopics(partitions: number, replicationFactor: number): Promise<void> {
      const admin = kafka.admin();
      await admin.connect();
      try {
        const existing = new Set(await admin.listTopics());
        const missing = RELAY_TOPICS.filter((t) => !existing.has(t));
        if (missing.length > 0) {
          await admin.createTopics({
            waitForLeaders: true,
            topics: missing.map((topic) => ({
              topic,
              numPartitions: partitions,
              replicationFactor,
            })),
          });
        }
      } finally {
        await admin.disconnect();
      }
    },

    disconnect: () => producer.disconnect(),
  };
}
