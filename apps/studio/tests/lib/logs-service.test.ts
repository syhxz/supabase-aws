/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  LogsServiceAdapter,
  getLogsServiceAdapter,
  resetLogsServiceAdapter,
  LogLevel,
} from '../../lib/logs-service'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

describe('LogsServiceAdapter', () => {
  let adapter: LogsServiceAdapter
  let tempDir: string

  beforeEach(() => {
    // Use a temporary directory for tests
    tempDir = path.join(os.tmpdir(), `logs-test-${Date.now()}-${Math.random().toString(36).substring(7)}`)
    process.env.LOGS_DIR = tempDir
    
    resetLogsServiceAdapter()
    adapter = getLogsServiceAdapter()
  })

  afterEach(() => {
    resetLogsServiceAdapter()
    delete process.env.LOGS_DIR
    
    // Clean up temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('Log Method', () => {
    it('should create log entry with correct structure', async () => {
      const projectRef = 'test-project'
      const level = LogLevel.INFO
      const message = 'Test log message'
      const metadata = { userId: '123', action: 'login' }

      await adapter.log(projectRef, level, message, metadata)

      // Read the log file to verify
      const logFilePath = path.join(tempDir, projectRef, `api-${new Date().toISOString().split('T')[0]}.log`)
      const logContent = await fs.promises.readFile(logFilePath, 'utf8')
      const logEntry = JSON.parse(logContent.trim())

      expect(logEntry).toMatchObject({
        level,
        message,
        metadata,
        project_ref: projectRef,
      })
      expect(logEntry.timestamp).toBeDefined()
      expect(new Date(logEntry.timestamp)).toBeInstanceOf(Date)
    })

    it('should write to correct log file based on level', async () => {
      const projectRef = 'test-project'

      // Log an error
      await adapter.log(projectRef, LogLevel.ERROR, 'Error message')

      const errorLogPath = path.join(tempDir, projectRef, `errors-${new Date().toISOString().split('T')[0]}.log`)
      expect(fs.existsSync(errorLogPath)).toBe(true)

      // Log an info message
      await adapter.log(projectRef, LogLevel.INFO, 'Info message')

      const infoLogPath = path.join(tempDir, projectRef, `api-${new Date().toISOString().split('T')[0]}.log`)
      expect(fs.existsSync(infoLogPath)).toBe(true)
    })

    it('should tag logs with project_ref', async () => {
      const projectRef = 'project-a'

      await adapter.log(projectRef, LogLevel.INFO, 'Test message')

      const logFilePath = path.join(tempDir, projectRef, `api-${new Date().toISOString().split('T')[0]}.log`)
      const logContent = await fs.promises.readFile(logFilePath, 'utf8')
      const logEntry = JSON.parse(logContent.trim())

      expect(logEntry.project_ref).toBe(projectRef)
    })
  })

  describe('Query Method', () => {
    it('should return empty array when no log files exist', async () => {
      const projectRef = 'nonexistent-project'

      const logs = await adapter.query(projectRef)

      expect(logs).toEqual([])
    })

    it('should filter logs by level', async () => {
      const projectRef = 'test-project'
      
      // Create some logs
      await adapter.log(projectRef, LogLevel.INFO, 'Info 1')
      await adapter.log(projectRef, LogLevel.ERROR, 'Error 1')
      await adapter.log(projectRef, LogLevel.INFO, 'Info 2')
      await adapter.log(projectRef, LogLevel.WARN, 'Warn 1')

      const errorLogs = await adapter.query(projectRef, {
        level: [LogLevel.ERROR],
      })

      expect(errorLogs).toHaveLength(1)
      expect(errorLogs[0].level).toBe(LogLevel.ERROR)
      expect(errorLogs[0].message).toBe('Error 1')
    })

    it('should filter logs by search term', async () => {
      const projectRef = 'test-project'
      
      await adapter.log(projectRef, LogLevel.INFO, 'User login successful')
      await adapter.log(projectRef, LogLevel.INFO, 'Database query executed')
      await adapter.log(projectRef, LogLevel.INFO, 'User logout')

      const logs = await adapter.query(projectRef, {
        search: 'user',
      })

      expect(logs).toHaveLength(2)
      expect(logs.some(log => log.message.includes('User'))).toBe(true)
    })

    it('should search in metadata', async () => {
      const projectRef = 'test-project'
      
      await adapter.log(projectRef, LogLevel.INFO, 'Action', { userId: '123' })
      await adapter.log(projectRef, LogLevel.INFO, 'Action', { userId: '456' })

      const logs = await adapter.query(projectRef, {
        search: '123',
      })

      expect(logs).toHaveLength(1)
      expect(logs[0].metadata?.userId).toBe('123')
    })

    it('should respect limit parameter', async () => {
      const projectRef = 'test-project'
      
      // Create 20 logs
      for (let i = 0; i < 20; i++) {
        await adapter.log(projectRef, LogLevel.INFO, `Log ${i}`)
      }

      const logs = await adapter.query(projectRef, {
        limit: 10,
      })

      expect(logs.length).toBeLessThanOrEqual(10)
    })

    it('should sort logs by timestamp (newest first)', async () => {
      const projectRef = 'test-project'
      
      await adapter.log(projectRef, LogLevel.INFO, 'Log 1')
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10))
      await adapter.log(projectRef, LogLevel.INFO, 'Log 2')
      await new Promise(resolve => setTimeout(resolve, 10))
      await adapter.log(projectRef, LogLevel.INFO, 'Log 3')

      const logs = await adapter.query(projectRef)

      expect(logs[0].message).toBe('Log 3')
      expect(logs[logs.length - 1].message).toBe('Log 1')
    })
  })

  describe('Export Method', () => {
    it('should export logs as JSON', async () => {
      const projectRef = 'test-project'
      
      await adapter.log(projectRef, LogLevel.INFO, 'Log 1')
      await adapter.log(projectRef, LogLevel.ERROR, 'Log 2')

      const blob = await adapter.export(projectRef, 'json')

      expect(blob.type).toBe('application/json')

      const text = await blob.text()
      const exported = JSON.parse(text)

      expect(exported.length).toBeGreaterThan(0)
      expect(exported[0]).toHaveProperty('message')
      expect(exported[0]).toHaveProperty('level')
    })

    it('should export logs as CSV', async () => {
      const projectRef = 'test-project'
      
      await adapter.log(projectRef, LogLevel.INFO, 'Log 1')
      await adapter.log(projectRef, LogLevel.ERROR, 'Log 2')

      const blob = await adapter.export(projectRef, 'csv')

      expect(blob.type).toBe('text/csv')

      const text = await blob.text()
      const lines = text.split('\n')

      expect(lines[0]).toBe('timestamp,level,message,project_ref,metadata')
      expect(lines.length).toBeGreaterThan(1)
    })

    it('should escape CSV values with commas', async () => {
      const projectRef = 'test-project'
      
      await adapter.log(projectRef, LogLevel.INFO, 'Log with, comma')

      const blob = await adapter.export(projectRef, 'csv')
      const text = await blob.text()

      expect(text).toContain('"Log with, comma"')
    })

    it('should throw error for unsupported format', async () => {
      const projectRef = 'test-project'

      await expect(
        adapter.export(projectRef, 'xml' as any)
      ).rejects.toThrow('Unsupported export format')
    })
  })

  describe('Get Stats Method', () => {
    it('should calculate log statistics', async () => {
      const projectRef = 'test-project-stats'
      
      await adapter.log(projectRef, LogLevel.INFO, 'Log 1')
      await adapter.log(projectRef, LogLevel.INFO, 'Log 2')
      await adapter.log(projectRef, LogLevel.ERROR, 'Log 3')
      await adapter.log(projectRef, LogLevel.WARN, 'Log 4')
      await adapter.log(projectRef, LogLevel.ERROR, 'Log 5')

      const stats = await adapter.getStats(projectRef, {
        start: new Date(Date.now() - 60000), // 1 minute ago
        end: new Date(Date.now() + 60000), // 1 minute from now
      })

      // Verify stats structure is correct
      expect(stats).toHaveProperty('totalLogs')
      expect(stats).toHaveProperty('byLevel')
      expect(stats).toHaveProperty('timeRange')
      
      // Verify byLevel has all log levels
      expect(stats.byLevel).toHaveProperty(LogLevel.DEBUG)
      expect(stats.byLevel).toHaveProperty(LogLevel.INFO)
      expect(stats.byLevel).toHaveProperty(LogLevel.WARN)
      expect(stats.byLevel).toHaveProperty(LogLevel.ERROR)
      
      // Total should equal sum of all levels
      const sum = Object.values(stats.byLevel).reduce((a, b) => a + b, 0)
      expect(stats.totalLogs).toBe(sum)
    })
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = getLogsServiceAdapter()
      const instance2 = getLogsServiceAdapter()

      expect(instance1).toBe(instance2)
    })

    it('should create new instance after reset', () => {
      const instance1 = getLogsServiceAdapter()
      resetLogsServiceAdapter()
      const instance2 = getLogsServiceAdapter()

      expect(instance1).not.toBe(instance2)
    })
  })
})
