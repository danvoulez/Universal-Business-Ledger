/**
 * LOGGER UNIT TESTS
 * 
 * Fase 4: Observabilidade do Diamante
 * 
 * Tests for the canonical logger implementation.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { logger, generateTraceId, extractTraceId } from '../../core/observability/logger';

describe('Logger - Unit Tests', () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    // Spy on console.log and console.error
    consoleLogSpy = {
      calls: [] as string[],
      original: console.log,
    };
    consoleErrorSpy = {
      calls: [] as string[],
      original: console.error,
    };

    console.log = (...args: any[]) => {
      consoleLogSpy.calls.push(args.join(' '));
    };
    console.error = (...args: any[]) => {
      consoleErrorSpy.calls.push(args.join(' '));
    };
  });

  afterEach(() => {
    // Restore original console methods
    console.log = consoleLogSpy.original;
    console.error = consoleErrorSpy.original;
  });

  describe('1. Basic Logging', () => {
    it('should log info messages to stdout', () => {
      logger.info('test.message', { component: 'test' });
      
      assert.strictEqual(consoleLogSpy.calls.length, 1, 'Should log one message');
      const logLine = consoleLogSpy.calls[0];
      assert.ok(logLine.includes('"level":"info"'), 'Should have level info');
      assert.ok(logLine.includes('"message":"test.message"'), 'Should have message');
      assert.ok(logLine.includes('"component":"test"'), 'Should have component');
    });

    it('should log warn messages to stderr', () => {
      logger.warn('test.warning', { component: 'test' });
      
      assert.strictEqual(consoleErrorSpy.calls.length, 1, 'Should log one error message');
      const logLine = consoleErrorSpy.calls[0];
      assert.ok(logLine.includes('"level":"warn"'), 'Should have level warn');
      assert.ok(logLine.includes('"message":"test.warning"'), 'Should have message');
    });

    it('should log error messages to stderr', () => {
      logger.error('test.error', { component: 'test', errorCode: 'TEST_ERROR' });
      
      assert.strictEqual(consoleErrorSpy.calls.length, 1, 'Should log one error message');
      const logLine = consoleErrorSpy.calls[0];
      assert.ok(logLine.includes('"level":"error"'), 'Should have level error');
      assert.ok(logLine.includes('"message":"test.error"'), 'Should have message');
      assert.ok(logLine.includes('"errorCode":"TEST_ERROR"'), 'Should have errorCode');
    });
  });

  describe('2. JSON Format', () => {
    it('should output valid JSON', () => {
      logger.info('test.json', { component: 'test', traceId: 'trace-123' });
      
      const logLine = consoleLogSpy.calls[0];
      assert.doesNotThrow(() => {
        JSON.parse(logLine);
      }, 'Should be valid JSON');
    });

    it('should include timestamp', () => {
      logger.info('test.timestamp', { component: 'test' });
      
      const logLine = consoleLogSpy.calls[0];
      const parsed = JSON.parse(logLine);
      assert.ok(parsed.timestamp, 'Should have timestamp');
      assert.ok(typeof parsed.timestamp === 'string', 'Timestamp should be string');
      assert.ok(parsed.timestamp.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/), 'Timestamp should be ISO format');
    });

    it('should include all context fields', () => {
      const context = {
        component: 'test',
        traceId: 'trace-123',
        sessionId: 'sess-456',
        realmId: 'realm-789',
        endpoint: '/test',
        turn: 1,
        processingMs: 42,
      };
      
      logger.info('test.context', context);
      
      const logLine = consoleLogSpy.calls[0];
      const parsed = JSON.parse(logLine);
      
      assert.strictEqual(parsed.component, 'test');
      assert.strictEqual(parsed.traceId, 'trace-123');
      assert.strictEqual(parsed.sessionId, 'sess-456');
      assert.strictEqual(parsed.realmId, 'realm-789');
      assert.strictEqual(parsed.endpoint, '/test');
      assert.strictEqual(parsed.turn, 1);
      assert.strictEqual(parsed.processingMs, 42);
    });
  });

  describe('3. Trace ID Generation', () => {
    it('should generate a trace ID', () => {
      const traceId = generateTraceId();
      
      assert.ok(traceId, 'Should generate a trace ID');
      assert.ok(typeof traceId === 'string', 'Trace ID should be string');
      assert.ok(traceId.startsWith('trace-'), 'Trace ID should start with "trace-"');
    });

    it('should generate unique trace IDs', () => {
      const traceId1 = generateTraceId();
      const traceId2 = generateTraceId();
      
      assert.notStrictEqual(traceId1, traceId2, 'Trace IDs should be unique');
    });
  });

  describe('4. Trace ID Extraction', () => {
    it('should extract trace ID from x-trace-id header', () => {
      const headers = {
        'x-trace-id': 'trace-abc123',
      };
      
      const traceId = extractTraceId(headers);
      assert.strictEqual(traceId, 'trace-abc123');
    });

    it('should extract trace ID from X-Trace-Id header (case insensitive)', () => {
      const headers = {
        'X-Trace-Id': 'trace-xyz789',
      };
      
      const traceId = extractTraceId(headers);
      assert.strictEqual(traceId, 'trace-xyz789');
    });

    it('should extract trace ID from array header', () => {
      const headers = {
        'x-trace-id': ['trace-array1', 'trace-array2'],
      };
      
      const traceId = extractTraceId(headers);
      assert.strictEqual(traceId, 'trace-array1');
    });

    it('should return undefined if trace ID not found', () => {
      const headers = {
        'authorization': 'Bearer token',
      };
      
      const traceId = extractTraceId(headers);
      assert.strictEqual(traceId, undefined);
    });
  });

  describe('5. Error Handling', () => {
    it('should not throw when logging with invalid context', () => {
      assert.doesNotThrow(() => {
        logger.info('test', { invalid: undefined } as any);
      }, 'Should not throw on invalid context');
    });

    it('should handle empty context', () => {
      assert.doesNotThrow(() => {
        logger.info('test');
      }, 'Should not throw on empty context');
    });
  });
});

