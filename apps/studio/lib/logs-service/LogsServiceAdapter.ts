import { getServiceRouter } from '../service-router'
import * as fs from 'fs'
import * as path from 'path'
import { promisify } from 'util'

const appendFile = promisify(fs.appendFile)
const readFile = promisify(fs.readFile)
const mkdir = promisify(fs.mkdir)
const access = promisify(fs.access)
const readdir = promisify(fs.readdir)

/**
 * Log level enum
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * Log entry interface
 */
export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  metadata?: Record<string, any>
  project_ref: string
}

/**
 * Log filters for querying
 */
export interface LogFilters {
  level?: LogLevel[]
  startTime?: Date
  endTime?: Date
  search?: string
  limit?: number
}

/**
 * Time range for statistics
 */
export interface TimeRange {
  start: Date
  end: Date
}

/**
 * Log statistics
 */
export interface LogStats {
  totalLogs: number
  byLevel: Record<LogLevel, number>
  timeRange: TimeRange
}

/**
 * Logs Service Adapter
 * 
 * Provides project-isolated logging services.
 * Each project has its own log files and log entries are tagged with project_ref.
 */
export class LogsServiceAdapter {
  private serviceRouter = getServiceRouter()
  private readonly LOG_BASE_DIR = process.env.LOGS_DIR || '/var/log/supabase'

  /**
   * Log a message for a project
   * 
   * @param projectRef - The project reference
   * @param level - Log level
   * @param message - Log message
   * @param metadata - Optional metadata
   */
  async log(
    projectRef: string,
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    // Create log entry
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      metadata,
      project_ref: projectRef,
    }

    // Ensure project log directory exists
    await this.ensureLogDirectory(projectRef)

    // Get log file path based on level and date
    const logFilePath = this.getLogFilePath(projectRef, level)

    // Format log entry as JSON line
    const logLine = JSON.stringify(logEntry) + '\n'

    // Write to log file
    try {
      await appendFile(logFilePath, logLine, 'utf8')
    } catch (error: any) {
      console.error(`Failed to write log for project ${projectRef}:`, error)
      throw new Error(`Failed to write log: ${error.message}`)
    }
  }

  /**
   * Ensure log directory exists for a project
   * 
   * @param projectRef - The project reference
   */
  private async ensureLogDirectory(projectRef: string): Promise<void> {
    const projectLogDir = path.join(this.LOG_BASE_DIR, projectRef)

    try {
      await access(projectLogDir)
    } catch (error: any) {
      // Directory doesn't exist, create it
      try {
        await mkdir(projectLogDir, { recursive: true })
      } catch (mkdirError: any) {
        // If we can't create the directory, throw a more specific error
        throw new Error(`Failed to create log directory: ${mkdirError.message}`)
      }
    }
  }

  /**
   * Get log file path for a project
   * 
   * @param projectRef - The project reference
   * @param level - Log level
   * @returns Log file path
   */
  private getLogFilePath(projectRef: string, level: LogLevel): string {
    const date = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const levelPrefix = level === LogLevel.ERROR ? 'errors' : 'api'
    const filename = `${levelPrefix}-${date}.log`
    return path.join(this.LOG_BASE_DIR, projectRef, filename)
  }

  /**
   * Query logs for a project
   * 
   * @param projectRef - The project reference
   * @param filters - Log filters
   * @returns Array of log entries
   */
  async query(projectRef: string, filters: LogFilters = {}): Promise<LogEntry[]> {
    const { level, startTime, endTime, search, limit = 1000 } = filters

    // Get all log files for the project
    const logFiles = await this.getLogFiles(projectRef, startTime, endTime)

    // Read and parse log entries from all files
    const allEntries: LogEntry[] = []

    for (const logFile of logFiles) {
      try {
        const content = await readFile(logFile, 'utf8')
        const lines = content.split('\n').filter((line) => line.trim().length > 0)

        for (const line of lines) {
          try {
            const entry: LogEntry = JSON.parse(line)

            // Apply filters
            if (level && level.length > 0 && !level.includes(entry.level)) {
              continue
            }

            if (startTime && new Date(entry.timestamp) < startTime) {
              continue
            }

            if (endTime && new Date(entry.timestamp) > endTime) {
              continue
            }

            if (search && !this.matchesSearch(entry, search)) {
              continue
            }

            allEntries.push(entry)
          } catch (parseError) {
            // Skip malformed log lines
            console.warn(`Failed to parse log line: ${line}`)
          }
        }
      } catch (error) {
        console.warn(`Failed to read log file ${logFile}:`, error)
      }
    }

    // Sort by timestamp (newest first)
    allEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // Apply limit
    return allEntries.slice(0, limit)
  }

  /**
   * Get log files for a project within a time range
   * 
   * @param projectRef - The project reference
   * @param startTime - Optional start time
   * @param endTime - Optional end time
   * @returns Array of log file paths
   */
  private async getLogFiles(
    projectRef: string,
    startTime?: Date,
    endTime?: Date
  ): Promise<string[]> {
    const projectLogDir = path.join(this.LOG_BASE_DIR, projectRef)

    try {
      await access(projectLogDir)
    } catch {
      // Directory doesn't exist, return empty array
      return []
    }

    // Get all log files in the directory
    const files = await readdir(projectLogDir)

    // Filter log files based on date range if provided
    const logFiles = files
      .filter((file) => file.endsWith('.log'))
      .map((file) => path.join(projectLogDir, file))

    // If no time range specified, return all files
    if (!startTime && !endTime) {
      return logFiles
    }

    // Filter files based on date in filename
    return logFiles.filter((file) => {
      const filename = path.basename(file)
      const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/)

      if (!dateMatch) {
        return true // Include files without date pattern
      }

      const fileDate = new Date(dateMatch[1])

      if (startTime && fileDate < startTime) {
        return false
      }

      if (endTime && fileDate > endTime) {
        return false
      }

      return true
    })
  }

  /**
   * Check if a log entry matches a search string
   * 
   * @param entry - Log entry
   * @param search - Search string
   * @returns True if entry matches search
   */
  private matchesSearch(entry: LogEntry, search: string): boolean {
    const searchLower = search.toLowerCase()

    // Search in message
    if (entry.message.toLowerCase().includes(searchLower)) {
      return true
    }

    // Search in metadata
    if (entry.metadata) {
      const metadataStr = JSON.stringify(entry.metadata).toLowerCase()
      if (metadataStr.includes(searchLower)) {
        return true
      }
    }

    return false
  }

  /**
   * Export logs for a project
   * 
   * @param projectRef - The project reference
   * @param format - Export format ('json' or 'csv')
   * @param filters - Log filters
   * @returns Exported logs as a Blob
   */
  async export(
    projectRef: string,
    format: 'json' | 'csv',
    filters: LogFilters = {}
  ): Promise<Blob> {
    // Query logs with filters
    const logs = await this.query(projectRef, filters)

    if (format === 'json') {
      return this.exportAsJson(logs)
    } else if (format === 'csv') {
      return this.exportAsCsv(logs)
    } else {
      throw new Error(`Unsupported export format: ${format}`)
    }
  }

  /**
   * Export logs as JSON
   * 
   * @param logs - Log entries
   * @returns JSON Blob
   */
  private exportAsJson(logs: LogEntry[]): Blob {
    const jsonStr = JSON.stringify(logs, null, 2)
    return new Blob([jsonStr], { type: 'application/json' })
  }

  /**
   * Export logs as CSV
   * 
   * @param logs - Log entries
   * @returns CSV Blob
   */
  private exportAsCsv(logs: LogEntry[]): Blob {
    if (logs.length === 0) {
      return new Blob([''], { type: 'text/csv' })
    }

    // CSV header
    const headers = ['timestamp', 'level', 'message', 'project_ref', 'metadata']
    const csvLines = [headers.join(',')]

    // CSV rows
    for (const log of logs) {
      const row = [
        log.timestamp,
        log.level,
        this.escapeCsvValue(log.message),
        log.project_ref,
        log.metadata ? this.escapeCsvValue(JSON.stringify(log.metadata)) : '',
      ]
      csvLines.push(row.join(','))
    }

    const csvStr = csvLines.join('\n')
    return new Blob([csvStr], { type: 'text/csv' })
  }

  /**
   * Escape a value for CSV format
   * 
   * @param value - Value to escape
   * @returns Escaped value
   */
  private escapeCsvValue(value: string): string {
    // If value contains comma, newline, or quote, wrap in quotes and escape quotes
    if (value.includes(',') || value.includes('\n') || value.includes('"')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  /**
   * Get log statistics for a project
   * 
   * @param projectRef - The project reference
   * @param timeRange - Time range for statistics
   * @returns Log statistics
   */
  async getStats(projectRef: string, timeRange: TimeRange): Promise<LogStats> {
    // Query logs within time range (no limit for stats)
    const logs = await this.query(projectRef, {
      startTime: timeRange.start,
      endTime: timeRange.end,
      limit: 999999, // Very high limit to get all logs for accurate stats
    })

    // Count logs by level
    const byLevel: Record<LogLevel, number> = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 0,
      [LogLevel.WARN]: 0,
      [LogLevel.ERROR]: 0,
    }

    for (const log of logs) {
      byLevel[log.level] = (byLevel[log.level] || 0) + 1
    }

    return {
      totalLogs: logs.length,
      byLevel,
      timeRange,
    }
  }
}

// Singleton instance
let logsServiceAdapter: LogsServiceAdapter | null = null

/**
 * Get the singleton LogsServiceAdapter instance
 */
export function getLogsServiceAdapter(): LogsServiceAdapter {
  if (!logsServiceAdapter) {
    logsServiceAdapter = new LogsServiceAdapter()
  }
  return logsServiceAdapter
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetLogsServiceAdapter(): void {
  logsServiceAdapter = null
}
