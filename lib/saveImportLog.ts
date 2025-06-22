import { storage } from "../server/storage";
import type { InsertImportLog } from "@shared/schema";

export interface ImportSummary {
  categories: number;
  incomes: number;
  expenses: number;
  budgets: number;
  goals: number;
  collaborativeGoals: number;
  errors: string[];
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
}

/**
 * Saves an import log to the database
 * @param userId - User ID who performed the import
 * @param summary - Import results summary
 * @param filename - Name of the imported file (optional)
 * @param type - File type ('csv' or 'json')
 * @param status - Import status ('success', 'failed', or 'partial')
 * @param errorMessage - Error message if import failed (optional)
 * @returns Created import log
 */
export async function saveImportLog(
  userId: string,
  summary: ImportSummary,
  filename?: string,
  type: 'csv' | 'json' = 'csv',
  status: 'success' | 'failed' | 'partial' = 'success',
  errorMessage?: string
) {
  const logData: InsertImportLog = {
    userId,
    summary: summary as any, // JSONB field
    filename: filename || null,
    type,
    status,
    errorMessage: errorMessage || null,
  };

  return await storage.createImportLog(logData);
}

/**
 * Gets the latest import logs for a user
 * @param userId - User ID
 * @param limit - Number of logs to retrieve (default: 10)
 * @returns Array of import logs
 */
export async function getRecentImportLogs(userId: string, limit: number = 10) {
  return await storage.getUserImportLogs(userId, limit);
}

/**
 * Creates a summary object from import results
 * @param results - Import results from the import process
 * @returns Formatted import summary
 */
export function createImportSummary(results: {
  categories: number;
  incomes: number;
  expenses: number;
  budgets: number;
  goals: number;
  collaborativeGoals: number;
  errors: string[];
}): ImportSummary {
  const totalRecords = results.categories + results.incomes + results.expenses + 
                      results.budgets + results.goals + results.collaborativeGoals;
  const failedRecords = results.errors.length;
  const successfulRecords = totalRecords - failedRecords;

  return {
    ...results,
    totalRecords,
    successfulRecords,
    failedRecords,
  };
}

/**
 * Determines import status based on results
 * @param summary - Import summary
 * @returns Import status
 */
export function determineImportStatus(summary: ImportSummary): 'success' | 'failed' | 'partial' {
  if (summary.failedRecords === 0) {
    return 'success';
  } else if (summary.successfulRecords === 0) {
    return 'failed';
  } else {
    return 'partial';
  }
}

/**
 * Formats import log for display in UI
 * @param log - Import log from database
 * @returns Formatted log data
 */
export function formatImportLogForDisplay(log: any) {
  const summary = log.summary as ImportSummary;
  
  return {
    id: log.id,
    date: log.importedAt,
    filename: log.filename || 'Unknown file',
    type: log.type.toUpperCase(),
    status: log.status,
    totalRecords: summary.totalRecords,
    successfulRecords: summary.successfulRecords,
    failedRecords: summary.failedRecords,
    categories: summary.categories,
    incomes: summary.incomes,
    expenses: summary.expenses,
    budgets: summary.budgets,
    goals: summary.goals,
    collaborativeGoals: summary.collaborativeGoals,
    errors: summary.errors,
    errorMessage: log.errorMessage,
  };
}