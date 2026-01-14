"use strict";
/**
 * Credential Monitoring Service for tracking fallback usage and system health.
 * Provides comprehensive monitoring, reporting, and audit capabilities for credential management.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CredentialMonitoringService = void 0;
exports.getCredentialMonitoringService = getCredentialMonitoringService;
exports.resetCredentialMonitoringService = resetCredentialMonitoringService;
const credential_fallback_manager_1 = require("./credential-fallback-manager");
const credential_monitoring_database_1 = require("./credential-monitoring-database");
const credential_error_handling_1 = require("./credential-error-handling");
/**
 * Credential Monitoring Service class
 * Provides comprehensive monitoring and reporting for credential management
 */
class CredentialMonitoringService {
    constructor() {
        this.fallbackManager = (0, credential_fallback_manager_1.getCredentialFallbackManager)();
        this.auditLog = [];
        this.nextAuditId = 1;
        this.database = null;
        // Initialize database connection if available
        try {
            this.database = (0, credential_monitoring_database_1.createCredentialMonitoringDatabase)();
        }
        catch (error) {
            console.warn('[Credential Monitoring] Database not available, using in-memory storage only:', error);
        }
    }
    /**
     * Gets fallback usage statistics
     *
     * @returns FallbackUsageStats with current usage metrics
     */
    getFallbackUsageStats() {
        const fallbackStats = this.fallbackManager.getFallbackUsageStats();
        // Calculate project-level statistics
        const uniqueProjectsUsingFallback = new Set(fallbackStats.recentUsage.map(entry => entry.projectRef)).size;
        // For this implementation, we'll estimate total projects based on unique projects seen
        // In a real implementation, this would query the actual project database
        const totalProjects = Math.max(fallbackStats.uniqueProjects, uniqueProjectsUsingFallback);
        const fallbackUsagePercentage = totalProjects > 0
            ? (uniqueProjectsUsingFallback / totalProjects) * 100
            : 0;
        return {
            totalProjects,
            projectsUsingFallback: uniqueProjectsUsingFallback,
            fallbackUsagePercentage: Math.round(fallbackUsagePercentage * 100) / 100,
            recentFallbackUsage: fallbackStats.recentUsage
        };
    }
    /**
     * Gets project credential status for all known projects
     *
     * @returns Array of ProjectCredentialStatus objects
     */
    getProjectCredentialStatus() {
        const fallbackStats = this.fallbackManager.getFallbackUsageStats();
        const projectsUsingFallback = new Set(fallbackStats.recentUsage.map(entry => entry.projectRef));
        // Create status entries for projects using fallback
        const statuses = [];
        projectsUsingFallback.forEach(projectRef => {
            const recentUsage = fallbackStats.recentUsage
                .filter(entry => entry.projectRef === projectRef)
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
            let credentialStatus = 'missing_both';
            if (recentUsage) {
                switch (recentUsage.credentialType) {
                    case 'user':
                        credentialStatus = 'missing_user';
                        break;
                    case 'password':
                        credentialStatus = 'missing_password';
                        break;
                    case 'both':
                        credentialStatus = 'missing_both';
                        break;
                }
            }
            statuses.push({
                projectRef,
                hasCredentials: false,
                credentialStatus,
                lastChecked: recentUsage?.timestamp || new Date().toISOString(),
                usesFallback: true
            });
        });
        return statuses;
    }
    /**
     * Performs a comprehensive credential health check
     *
     * @returns HealthCheckResult with system health assessment
     */
    performCredentialHealthCheck() {
        const stats = this.getFallbackUsageStats();
        const projectStatuses = this.getProjectCredentialStatus();
        const issues = [];
        const recommendations = [];
        // Determine health status based on fallback usage
        let status = 'healthy';
        if (stats.fallbackUsagePercentage > 50) {
            status = 'critical';
            issues.push(`High fallback usage: ${stats.fallbackUsagePercentage}% of projects using fallback credentials`);
            recommendations.push('Prioritize credential migration for projects using fallback credentials');
        }
        else if (stats.fallbackUsagePercentage > 20) {
            status = 'warning';
            issues.push(`Moderate fallback usage: ${stats.fallbackUsagePercentage}% of projects using fallback credentials`);
            recommendations.push('Consider migrating projects with missing credentials');
        }
        if (stats.projectsUsingFallback > 0) {
            issues.push(`${stats.projectsUsingFallback} projects are using fallback credentials`);
            recommendations.push('Run credential migration tool to add project-specific credentials');
        }
        // Check for projects with incomplete credentials
        const incompleteProjects = projectStatuses.filter(p => !p.hasCredentials);
        if (incompleteProjects.length > 0) {
            issues.push(`${incompleteProjects.length} projects have incomplete credentials`);
            recommendations.push('Validate and complete missing project credentials');
        }
        // Add general recommendations
        if (recommendations.length === 0) {
            recommendations.push('System is healthy - continue monitoring credential usage');
        }
        const result = {
            status,
            totalProjects: stats.totalProjects,
            projectsWithCredentials: stats.totalProjects - stats.projectsUsingFallback,
            projectsUsingFallback: stats.projectsUsingFallback,
            fallbackUsagePercentage: stats.fallbackUsagePercentage,
            issues,
            recommendations,
            timestamp: new Date().toISOString()
        };
        // Log the health check
        this.logAuditEvent('health_check', 'system', {
            healthStatus: status,
            fallbackUsagePercentage: stats.fallbackUsagePercentage,
            projectsUsingFallback: stats.projectsUsingFallback,
            totalIssues: issues.length
        });
        return result;
    }
    /**
     * Generates a comprehensive credential report
     *
     * @returns CredentialReport with complete system analysis
     */
    generateCredentialReport() {
        const stats = this.getFallbackUsageStats();
        const projectStatuses = this.getProjectCredentialStatus();
        const healthStatus = this.performCredentialHealthCheck();
        const recommendations = [
            ...healthStatus.recommendations
        ];
        // Add specific recommendations based on analysis
        if (stats.projectsUsingFallback > 0) {
            recommendations.push(`Migrate ${stats.projectsUsingFallback} projects to use project-specific credentials`);
        }
        if (stats.fallbackUsagePercentage > 10) {
            recommendations.push('Set up monitoring alerts for fallback credential usage');
        }
        const report = {
            generatedAt: new Date().toISOString(),
            summary: {
                totalProjects: stats.totalProjects,
                projectsWithCredentials: stats.totalProjects - stats.projectsUsingFallback,
                projectsUsingFallback: stats.projectsUsingFallback,
                fallbackUsagePercentage: stats.fallbackUsagePercentage
            },
            projectStatuses,
            recentFallbackUsage: stats.recentFallbackUsage,
            healthStatus,
            recommendations: [...new Set(recommendations)] // Remove duplicates
        };
        // Log report generation
        this.logAuditEvent('report_generated', 'system', {
            reportType: 'credential_report',
            projectCount: stats.totalProjects,
            fallbackUsagePercentage: stats.fallbackUsagePercentage
        });
        return report;
    }
    /**
     * Logs an audit event for credential-related operations with comprehensive error handling
     *
     * @param eventType - Type of event being logged
     * @param projectRef - Project reference (use 'system' for system-wide events)
     * @param eventDetails - Additional details about the event
     * @param userId - Optional user ID associated with the event
     */
    async logAuditEvent(eventType, projectRef, eventDetails, userId) {
        const errorHandler = (0, credential_error_handling_1.getCredentialErrorHandler)();
        await errorHandler.executeWithErrorHandling(async () => {
            const auditEntry = {
                id: this.nextAuditId++,
                project_ref: projectRef,
                event_type: eventType,
                event_details: eventDetails,
                timestamp: new Date().toISOString(),
                user_id: userId
            };
            // Add to in-memory audit log
            this.auditLog.push(auditEntry);
            // Keep only the last 5000 entries to prevent memory issues
            if (this.auditLog.length > 5000) {
                this.auditLog = this.auditLog.slice(-5000);
            }
            // Persist to database if available
            if (this.database) {
                try {
                    await this.database.insertAuditLogEntry({
                        project_ref: projectRef,
                        event_type: eventType,
                        event_details: eventDetails,
                        timestamp: auditEntry.timestamp,
                        user_id: userId
                    });
                }
                catch (error) {
                    // Don't throw here - database persistence is not critical for audit logging
                    console.error('[Credential Monitoring] Failed to persist audit log to database:', error);
                }
            }
            // Log to console for operational visibility
            console.log(`[Credential Audit] ${eventType.toUpperCase()}: ${projectRef}`, eventDetails);
        }, {
            serviceName: 'credential-monitoring',
            context: `logAuditEvent-${eventType}-${projectRef}`,
            enableRetry: true,
            enableCircuitBreaker: false, // Logging shouldn't be circuit broken
            enableGracefulDegradation: true,
            fallbackFn: async () => {
                // Fallback: just log to console if everything else fails
                console.warn('[Credential Monitoring] Fallback audit logging to console only');
                console.log(`[Credential Audit Fallback] ${eventType.toUpperCase()}: ${projectRef}`, eventDetails);
            }
        }).catch(error => {
            // Even if audit logging fails, don't throw - it's not critical for system operation
            console.error('[Credential Monitoring] Audit logging failed completely:', error);
        });
    }
    /**
     * Gets recent audit log entries
     *
     * @param limit - Maximum number of entries to return (default: 100)
     * @param eventType - Optional filter by event type
     * @returns Array of recent audit log entries
     */
    async getAuditLog(limit = 100, eventType) {
        // Try to get from database first if available
        if (this.database) {
            try {
                return await this.database.getAuditLogEntries({
                    limit,
                    eventType
                });
            }
            catch (error) {
                console.warn('[Credential Monitoring] Failed to get audit log from database, falling back to in-memory:', error);
            }
        }
        // Fallback to in-memory log
        let filteredLog = this.auditLog;
        if (eventType) {
            filteredLog = this.auditLog.filter(entry => entry.event_type === eventType);
        }
        return filteredLog
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, limit);
    }
    /**
     * Clears the audit log
     * Useful for testing or periodic cleanup
     */
    clearAuditLog() {
        this.auditLog = [];
        this.nextAuditId = 1;
    }
    /**
     * Gets audit log statistics
     *
     * @returns Statistics about audit log entries
     */
    async getAuditLogStats() {
        // Try to get from database first if available
        if (this.database) {
            try {
                const dbStats = await this.database.getAuditLogStatistics();
                const recentActivity = await this.getAuditLog(10);
                return {
                    totalEntries: dbStats.totalEntries,
                    eventTypeCounts: dbStats.eventTypeCounts.map(item => ({
                        eventType: item.event_type,
                        count: item.count
                    })),
                    recentActivity
                };
            }
            catch (error) {
                console.warn('[Credential Monitoring] Failed to get audit log stats from database, falling back to in-memory:', error);
            }
        }
        // Fallback to in-memory statistics
        const eventTypeCounts = new Map();
        this.auditLog.forEach(entry => {
            const count = eventTypeCounts.get(entry.event_type) || 0;
            eventTypeCounts.set(entry.event_type, count + 1);
        });
        const recentActivity = await this.getAuditLog(10);
        return {
            totalEntries: this.auditLog.length,
            eventTypeCounts: Array.from(eventTypeCounts.entries())
                .map(([eventType, count]) => ({ eventType, count }))
                .sort((a, b) => b.count - a.count),
            recentActivity
        };
    }
}
exports.CredentialMonitoringService = CredentialMonitoringService;
/**
 * Singleton instance of the CredentialMonitoringService
 */
let credentialMonitoringServiceInstance = null;
/**
 * Gets the singleton instance of CredentialMonitoringService
 *
 * @returns CredentialMonitoringService instance
 */
function getCredentialMonitoringService() {
    if (!credentialMonitoringServiceInstance) {
        credentialMonitoringServiceInstance = new CredentialMonitoringService();
    }
    return credentialMonitoringServiceInstance;
}
/**
 * Resets the singleton instance (useful for testing)
 */
function resetCredentialMonitoringService() {
    credentialMonitoringServiceInstance = null;
}
