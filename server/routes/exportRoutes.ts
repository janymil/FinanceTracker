import type { Express } from "express";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { storage } from "../storage";
import { getUserLanguage } from "../categoryTranslations";
import { buildMonthlyPayload, requestPdf, PdfProcessorError } from "../pdfProcessorClient";
import { cloudStorage } from "../cloudStorage";
import {
  cleanDateValue,
  cleanId,
  csvField,
  neutralizeSpreadsheetCell,
} from "@shared/trackingInput";
import { localParts, monthRange, presetRange, rangeEndFrom, rangeStartFrom, resolveTimeZone } from "@shared/timezones";

const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

const asFlag = (value: unknown) => value === true || value === 'true' || value === '1';

export function registerExportRoutes(app: Express) {



  // Data Import/Export endpoints (Premium only)
  app.post('/api/import/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const user = await storage.getUser(userId);

      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "Data import requires Premium subscription" });
      }

      const { transactions: importTransactions, mergeStrategy } = req.body;

      if (!Array.isArray(importTransactions)) {
        return res.status(400).json({ message: "Invalid transaction data format" });
      }

      if (importTransactions.length > 5000) {
        return res.status(400).json({ message: "Import at most 5000 transactions at a time" });
      }

      let importedCount = 0;
      let skippedCount = 0;
      const errors: Array<{ row: number; field: string; message: string }> =[];

      // One lookup for the whole file instead of one per row.
      const allowedCategoryIds = new Set((await storage.getCategories(userId)).map((category) => category.id));
      const existingTransactions = mergeStrategy !== 'append' ? await storage.getUserTransactions(userId) : [];

      // Process each transaction
      for (let i = 0; i < importTransactions.length; i++) {
        const transaction = importTransactions[i];

        try {
          const description = typeof transaction?.description === 'string' ? transaction.description.trim() : '';
          const amountNumber = Math.abs(Number.parseFloat(transaction?.amount));
          const date = cleanDateValue(transaction?.date);
          if (!description || description.length > 200 || !Number.isFinite(amountNumber) || amountNumber <= 0 || !date || !transaction?.type) {
            errors.push({
              row: i + 1,
              field: 'required',
              message: 'Needs a description (up to 200 characters), a positive amount, a type and a valid date'
            });
            skippedCount++;
            continue;
          }

          // A category that is not the person's own is dropped, never guessed.
          const requestedCategory = cleanId(transaction.categoryId);
          const transactionData = {
            userId,
            description,
            amount: amountNumber.toFixed(2),
            type: String(transaction.type).toLowerCase() === 'income' ? 'income' : 'expense',
            date,
            categoryId: requestedCategory !== null && allowedCategoryIds.has(requestedCategory) ? requestedCategory : null,
          };

          // Check for duplicates if merge strategy is not 'append'
          if (mergeStrategy !== 'append') {
            const isDuplicate = existingTransactions.some(existing =>
              existing.description === transactionData.description &&
              Number(existing.amount) === Number(transactionData.amount) &&
              Math.abs(new Date(existing.date).getTime() - transactionData.date.getTime()) < 86400000 // Within 1 day
            );

            if (isDuplicate && mergeStrategy === 'skip') {
              skippedCount++;
              continue;
            }
          }

          // Create the transaction
          await storage.createTransaction(transactionData);
          importedCount++;

        } catch (error) {
          console.error(`Error importing transaction ${i + 1}:`, error);
          errors.push({
            row: i + 1,
            field: 'general',
            message: 'Could not be saved'
          });
          skippedCount++;
        }
      }

      return res.json({
        success: true,
        imported: importedCount,
        skipped: skippedCount,
        errors,
        message: `Successfully imported ${importedCount} transactions${skippedCount > 0 ? `, skipped ${skippedCount}` : ''}`
      });

    } catch (error) {
      console.error("Error importing transactions:", error);
      return res.status(500).json({ message: "Failed to import transactions" });
    }
  });

  // Dedicated PDF export endpoint
  app.post('/api/export-pdf', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const user = await storage.getUser(userId);

      if (!user || user.plan === 'free') {
        return res.status(403).json({ message: "PDF export requires Standard or Premium subscription" });
      }

      const { month, year } = req.body;

      // Parse month and year
      const timeZone = resolveTimeZone(user.timezone);
      const today = localParts(new Date(), timeZone);
      const targetYear = Number.isInteger(Number(year)) && Number(year) >= 2000 && Number(year) <= 2100 ? Number(year) : today.year;
      let targetMonth = today.month - 1;
      if (month !== undefined && month !== null && month !== '') {
        const named = MONTH_NAMES.findIndex((name) => name.startsWith(String(month).trim().toLowerCase().slice(0, 3)) && String(month).trim().length >= 3);
        const numbered = Number(month) - 1;
        targetMonth = named >= 0 ? named : Number.isInteger(numbered) && numbered >= 0 && numbered <= 11 ? numbered : -1;
        if (targetMonth < 0) {
          return res.status(400).json({ message: "Invalid month" });
        }
      }

      // The whole month in the person's time zone, last day included.
      const { start, end } = monthRange(targetYear, targetMonth + 1, timeZone);

      // Get all user data
      const transactions = await storage.getUserTransactions(userId);
      const budgets = await storage.getUserBudgets(userId);
      let goals: any[] = [];
      try {
        goals = await storage.getUserGoals(userId);
      } catch (error) {
        console.log('Goals not available for user:', userId);
      }

      // Filter transactions for the specified month
      const monthlyTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate >= start && transactionDate <= end;
      });

      // Calculate financial summary
      const income = monthlyTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      const expenses = monthlyTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      // Calculate category breakdown
      const categoryBreakdown: { [key: string]: number } = {};
      monthlyTransactions
        .filter(t => t.type === 'expense')
        .forEach(t => {
          const category = t.categoryId?.toString() || 'Other';
          categoryBreakdown[category] = (categoryBreakdown[category] || 0) + parseFloat(t.amount);
        });

      // Map category ids to readable names for the report
      const categoryNames = new Map<number, string>();
      try {
        const userCategories = await storage.getCategories(userId);
        for (const category of userCategories) {
          categoryNames.set(category.id, category.name);
        }
      } catch (error) {
        console.warn(
          '[PDF] Could not load category names:',
          error instanceof Error ? error.message : String(error)
        );
      }

      const monthLabel = MONTH_NAMES[targetMonth][0].toUpperCase() + MONTH_NAMES[targetMonth].slice(1);
      const reportPeriod = `${monthLabel} ${targetYear}`;
      const spentByCategory = new Map<number, number>();
      for (const transaction of monthlyTransactions) {
        if (transaction.type !== 'expense' || transaction.categoryId == null) continue;
        spentByCategory.set(
          transaction.categoryId,
          (spentByCategory.get(transaction.categoryId) || 0) + parseFloat(transaction.amount)
        );
      }

      // Hand the report to the independent PDF processor.
      const payload = buildMonthlyPayload({
        userName:
          user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.email || 'User',
        email: user.email || undefined,
        language: getUserLanguage(req),
        period: reportPeriod,
        currency: user.currency || undefined,
        totals: { income, expenses },
        transactions: monthlyTransactions.map((transaction) => ({
          date: transaction.date,
          description: transaction.description,
          amount: transaction.amount,
          type: transaction.type,
          categoryName:
            transaction.categoryId != null ? categoryNames.get(transaction.categoryId) : undefined,
        })),
        categories: Object.entries(categoryBreakdown)
          .filter(([key]) => key !== 'Other')
          .map(([key, amount]) => ({ name: categoryNames.get(Number(key)) || 'Other', amount })),
        budgets: budgets.map((budget) => ({
          categoryName:
            budget.categoryId != null ? categoryNames.get(budget.categoryId) : undefined,
          amount: budget.amount,
          spent:
            budget.categoryId != null ? spentByCategory.get(budget.categoryId) || 0 : 0,
        })),
        goals: goals.map((goal: any) => ({
          name: goal.name,
          targetAmount: goal.targetAmount,
          currentAmount: goal.currentAmount,
        })),
      });

      const pdfBuffer = await requestPdf(payload);
      
      // Send PDF response
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="kaptia-report-${monthLabel.toLowerCase()}-${targetYear}.pdf"`);
      return res.send(pdfBuffer);

    } catch (error) {
      console.error("Error generating PDF:", error);
      console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
      if (error instanceof PdfProcessorError) {
        return res.status(error.statusCode).json({
          message: error.message,
          details: error.details
        });
      }
      return res.status(500).json({ 
        message: "Failed to generate PDF report", 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  const handleExport = async (req: any, res: any) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const user = await storage.getUser(userId);

      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "Data export requires Premium subscription" });
      }

      // The export page sends a GET with query parameters; scripts may POST a JSON body.
      const input = req.method === 'GET' ? req.query : req.body;
      const format = String(input.format || '');
      const dateRange = String(input.dateRange || 'all');
      const startDate = input.startDate;
      const endDate = input.endDate;
      const includeTransactions = asFlag(input.includeTransactions);
      const includeBudgets = asFlag(input.includeBudgets);
      const includeGoals = asFlag(input.includeGoals);

      const timeZone = resolveTimeZone(user.timezone);
      let range: { start: Date; end: Date } | null =
        dateRange === 'month' || dateRange === 'quarter' || dateRange === 'year' ? presetRange(dateRange, timeZone) : null;
      if (dateRange === 'custom') {
        const parsedStart = cleanDateValue(startDate);
        const parsedEnd = cleanDateValue(endDate);
        if (!parsedStart || !parsedEnd) {
          return res.status(400).json({ message: "Choose a valid start and end date" });
        }
        const start = rangeStartFrom(startDate, parsedStart, timeZone);
        const end = rangeEndFrom(endDate, parsedEnd, timeZone);
        if (end < start) {
          return res.status(400).json({ message: "End date must not be before the start date" });
        }
        range = { start, end };
      }

      const exportData: any = {};

      if (includeTransactions) {
        let transactions = await storage.getUserTransactions(userId);
        
        // Filter by the chosen period, last day included
        if (range) {
          const { start, end } = range;
          transactions = transactions.filter(t => {
            const transactionDate = new Date(t.date);
            return transactionDate >= start && transactionDate <= end;
          });
        }
        
        exportData.transactions = transactions;
      }

      if (includeBudgets) {
        try {
          exportData.budgets = await storage.getUserBudgets(userId);
        } catch (error) {
          console.log('Budgets not available for user:', userId);
          exportData.budgets = [];
        }
      }

      if (includeGoals) {
        try {
          exportData.goals = await storage.getUserGoals(userId);
        } catch (error) {
          console.log('Goals not available for user:', userId);
          exportData.goals = [];
        }
      }

      // Add metadata
      exportData.exportDate = new Date().toISOString();
      exportData.userName = user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email;

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="kaptia-export.json"');
        return res.json(exportData);
      } else if (format === 'csv') {
        // For CSV, we'll export transactions only as CSV format is tabular
        if (exportData.transactions) {
          // Text cells are quoted and defused against spreadsheet formulas; the BOM keeps accents readable in Excel.
          const csvHeader = 'Date,Description,Amount,Type,Category\r\n';
          const csvRows = exportData.transactions.map((t: any) => {
            const dateStr = t.date instanceof Date ? t.date.toISOString().split('T')[0] : String(t.date || '').split('T')[0];
            return [dateStr, csvField(t.description), Number(t.amount).toFixed(2), t.type, csvField(t.categoryName || 'Uncategorized')].join(',');
          }).join('\r\n');

          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Content-Disposition', 'attachment; filename="kaptia-transactions.csv"');
          return res.send('\uFEFF' + csvHeader + csvRows);
        } else {
          return res.status(400).json({ message: "CSV export requires transactions to be included" });
        }
      } else if (format === 'excel') {
        // The UI offers Excel; build a real .xlsx workbook with the `xlsx` package.
        const XLSX = await import('xlsx');
        const workbook = XLSX.utils.book_new();

        if (exportData.transactions?.length) {
          const rows = exportData.transactions.map((t: any) => ({
            Date: (t.date instanceof Date ? t.date : new Date(t.date)).toISOString().split('T')[0],
            Description: neutralizeSpreadsheetCell(t.description),
            Amount: Number(t.amount),
            Type: t.type,
            Category: neutralizeSpreadsheetCell(t.categoryName || 'Uncategorized')
          }));
          XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Transactions');
        }

        if (exportData.budgets?.length) {
          const rows = exportData.budgets.map((b: any) => ({
            Category: neutralizeSpreadsheetCell(b.categoryName || String(b.categoryId ?? '')),
            Budget: Number(b.amount),
            Spent: Number(b.spent ?? 0),
            Remaining: Number(b.remaining ?? 0),
            Period: b.period
          }));
          XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Budgets');
        }

        if (exportData.goals?.length) {
          const rows = exportData.goals.map((g: any) => ({
            Goal: neutralizeSpreadsheetCell(g.name),
            Target: Number(g.targetAmount),
            Current: Number(g.currentAmount ?? 0),
            TargetDate: g.targetDate ? String(g.targetDate).split('T')[0] : ''
          }));
          XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Goals');
        }

        if (workbook.SheetNames.length === 0) {
          return res.status(400).json({ message: "Nothing selected to export" });
        }

        const workbookBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="kaptia-export.xlsx"');
        return res.send(workbookBuffer);
      } else if (format === 'pdf') {
        // PDF rendering belongs to the independent processor (see pdfProcessorClient).
        const rows: any[] = exportData.transactions ?? [];
        const totals = rows.reduce(
          (acc: { income: number; expenses: number }, t: any) => {
            const amount = Number(t.amount) || 0;
            if (t.type === 'income') acc.income += amount;
            else acc.expenses += amount;
            return acc;
          },
          { income: 0, expenses: 0 }
        );

        const byCategory = new Map<string, number>();
        for (const t of rows) {
          if (t.type !== 'expense') continue;
          const name = t.categoryName || 'Uncategorized';
          byCategory.set(name, (byCategory.get(name) || 0) + (Number(t.amount) || 0));
        }

        const dayLabel = (instant: Date) => {
          const day = localParts(instant, timeZone);
          return `${day.year}-${String(day.month).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`;
        };
        const periodLabel = range ? `${dayLabel(range.start)} - ${dayLabel(range.end)}` : 'all time';

        const pdfBuffer = await requestPdf(
          buildMonthlyPayload({
            userName: exportData.userName,
            email: user.email || undefined,
            language: getUserLanguage(req),
            period: periodLabel,
            currency: user.currency || undefined,
            totals,
            transactions: rows.map((t: any) => ({
              date: t.date,
              description: t.description,
              amount: t.amount,
              type: t.type,
              categoryName: t.categoryName || undefined
            })),
            categories: Array.from(byCategory.entries()).map(([name, amount]) => ({ name, amount })),
            budgets: exportData.budgets ?? [],
            goals: exportData.goals ?? []
          })
        );

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="kaptia-export.pdf"');
        return res.send(pdfBuffer);
      } else {
        return res.status(400).json({ message: "Unsupported export format" });
      }

    } catch (error) {
      console.error("Error exporting data:", error);
      if (error instanceof PdfProcessorError) {
        return res.status(error.statusCode).json({ message: error.message, details: error.details });
      }
      return res.status(500).json({ message: "Failed to export data" });
    }
  };
  app.get('/api/export', isAuthenticated, handleExport);
  app.post('/api/export', isAuthenticated, handleExport);

  // Cloud backup endpoints using Cloud Storage (Cloudflare R2 or Bunny fallback)
  const backupStorage = cloudStorage;

  // Create backup endpoint
  app.post('/api/backup', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "Cloud backup requires Premium subscription" });
      }

      if (!backupStorage) {
        return res.status(503).json({ message: "Cloud backup service unavailable" });
      }

      // Get all user data
      const transactions = await storage.getUserTransactions(userId);
      const budgets = await storage.getUserBudgets(userId);
      let goals: any[] = [];
      try {
        goals = await storage.getUserGoals(userId);
        console.log(`Backup: Found ${goals.length} goals for user ${userId}`);
      } catch (error) {
        console.log('Goals not available for user:', userId);
      }

      const backupData = {
        userId,
        timestamp: new Date().toISOString(),
        data: {
          transactions,
          budgets,
          goals,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            plan: user.plan
          }
        }
      };

      // Use the existing createBackup method from BunnyStorage
      console.log('BACKUP DEBUG: Starting backup creation for user:', userId);
      console.log('BACKUP DEBUG: Backup data size:', JSON.stringify(backupData).length, 'characters');
      
      const filename = await backupStorage.createBackup(userId, backupData);
      
      console.log('BACKUP DEBUG: Backup created successfully with filename:', filename);

      return res.json({ 
        success: true, 
        message: "Backup created successfully",
        filename 
      });

    } catch (error: any) {
      console.error("BACKUP ERROR: Error creating backup:", error);
      console.error("BACKUP ERROR: Error details:", error.message);
      return res.status(500).json({ message: "Failed to create backup", error: error.message });
    }
  });

  // Backup status endpoint
  app.get('/api/backup/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "Cloud backup requires Premium subscription", userPlan: user?.plan });
      }

      if (!backupStorage) {
        return res.status(503).json({ message: "Cloud backup service unavailable" });
      }

      // Use the existing getUserBackups method
      const backups = await backupStorage.getUserBackups(userId);
      const lastBackup = backups.length > 0 ? backups[0] : null;

      res.json({
        lastBackup: lastBackup ? {
          date: lastBackup.DateCreated,
          size: lastBackup.Length,
          filename: lastBackup.ObjectName
        } : null,
        nextBackup: (() => {
          // Calculate next 2AM backup time
          const now = new Date();
          const next2AM = new Date();
          next2AM.setHours(2, 0, 0, 0);
          
          // If it's past 2AM today, schedule for tomorrow
          if (now.getHours() >= 2) {
            next2AM.setDate(next2AM.getDate() + 1);
          }
          
          return next2AM.toISOString();
        })(),
        realUsage: {
          used: backups.reduce((sum, file) => sum + file.Length, 0),
          limit: 100 * 1024 * 1024, // 100MB limit
          files: backups.length,
          total: `${Math.round(backups.reduce((sum, file) => sum + file.Length, 0) / 1024)} KB`
        },
        settings: {
          autoBackup: true,
          frequency: 'daily',
          retentionDays: 30,
          includeTransactions: true,
          includeBudgets: true,
          includeGoals: true
        },
        info: {
          totalBackups: backups.length,
          provider: "Bunny.net CDN",
          region: "Global",
          encryption: "AES-256"
        }
      });

    } catch (error) {
      console.error("Error getting backup status:", error);
      return res.status(500).json({ message: "Failed to get backup status" });
    }
  });

  // Available backups endpoint
  app.get('/api/available-backups', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "Cloud backup requires Premium subscription" });
      }

      if (!backupStorage) {
        return res.status(503).json({ message: "Cloud backup service unavailable" });
      }

      // Get user backups using the existing method
      const backups = await backupStorage.getUserBackups(userId);
      
      // Format backup data for frontend
      const formattedBackups = backups.map(backup => ({
        filename: backup.ObjectName,
        date: backup.DateCreated,
        size: backup.Length,
        formattedDate: new Date(backup.DateCreated).toLocaleString(),
        formattedSize: `${(backup.Length / 1024).toFixed(1)} KB`
      }));

      return res.json({
        backups: formattedBackups
      });

    } catch (error) {
      console.error("Error getting available backups:", error);
      return res.status(500).json({ message: "Failed to get available backups" });
    }
  });

  // Backup settings endpoint
  app.put('/api/backup-settings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "Cloud backup requires Premium subscription" });
      }

      return res.json({ success: true, message: "Backup settings updated" });

    } catch (error) {
      console.error("Error updating backup settings:", error);
      return res.status(500).json({ message: "Failed to update backup settings" });
    }
  });

  // Restore backup endpoint
  app.post('/api/restore-backup', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "Cloud backup requires Premium subscription" });
      }

      if (!backupStorage) {
        return res.status(503).json({ message: "Cloud backup service unavailable" });
      }

      const { filename } = req.body;
      // A plain file name only: no slashes, so it cannot climb out of the user's folder.
      if (typeof filename !== 'string' || !/^[\w.-]+\.json$/.test(filename) || filename.includes('..')) {
        return res.status(400).json({ message: "A valid backup filename is required" });
      }

      const filePath = `backups/user-${userId}/${filename}`;
      const backupContent = await backupStorage.downloadFile(filePath);
      const parsedData = JSON.parse(backupContent);

      if (parsedData.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized backup access" });
      }

      // Validate and convert the WHOLE backup before touching any live data, so a bad
      // file is rejected while the user's current data is still intact. Rows always
      // belong to the signed-in user, whatever the file claims.
      const toDate = (value: unknown, label: string): Date => {
        const date = new Date(value as string);
        if (Number.isNaN(date.getTime())) throw new Error(`Backup has an invalid date in ${label}`);
        return date;
      };
      const rows = (value: unknown): any[] => (Array.isArray(value) ? value : []);

      const backupData = parsedData.data ?? {};
      const newTransactions = rows(backupData.transactions).map((t) => {
        const { id, categoryName, categoryIcon, categoryColor, ...rest } = t;
        return {
          ...rest,
          userId,
          date: toDate(t.date, 'a transaction'),
          createdAt: toDate(t.createdAt ?? t.date, 'a transaction'),
          updatedAt: toDate(t.updatedAt ?? t.date, 'a transaction'),
        };
      });
      const newBudgets = rows(backupData.budgets).map((b) => {
        const { id, categoryName, categoryIcon, categoryColor, spent, remaining, percentage, ...rest } = b;
        return {
          ...rest,
          userId,
          startDate: toDate(b.startDate, 'a budget'),
          endDate: toDate(b.endDate, 'a budget'),
          createdAt: toDate(b.createdAt ?? b.startDate, 'a budget'),
        };
      });
      const newGoals = rows(backupData.goals).map((g) => {
        const { id, ...rest } = g;
        return {
          ...rest,
          userId,
          deadline: g.deadline ? toDate(g.deadline, 'a goal') : null,
          createdAt: toDate(g.createdAt ?? Date.now(), 'a goal'),
          updatedAt: toDate(g.updatedAt ?? Date.now(), 'a goal'),
        };
      });

      // Keep the current rows so the restore can be undone if it fails half way.
      const oldTransactions = await storage.getUserTransactions(userId);
      const oldBudgets = await storage.getUserBudgets(userId);
      const oldGoals = await storage.getUserGoals(userId).catch(() => []);

      const restoredData = { transactions: 0, budgets: 0, goals: 0 };

      const stripForReinsert = ({ id, categoryName, categoryIcon, categoryColor, spent, remaining, percentage, ...row }: any) => row;

      try {
        for (const transaction of oldTransactions) await storage.deleteTransaction(transaction.id, userId);
        for (const budget of oldBudgets) await storage.deleteBudget(budget.id, userId);
        for (const goal of oldGoals) await storage.deleteGoal(goal.id, userId);

        for (const row of newTransactions) {
          await storage.createTransaction(row as any);
          restoredData.transactions++;
        }
        for (const row of newBudgets) {
          await storage.createBudget(row as any);
          restoredData.budgets++;
        }
        for (const row of newGoals) {
          await storage.createGoal(row as any);
          restoredData.goals++;
        }
      } catch (restoreError) {
        console.error('Restore failed part-way; putting the previous data back:', restoreError);
        try {
          for (const t of await storage.getUserTransactions(userId)) await storage.deleteTransaction(t.id, userId);
          for (const b of await storage.getUserBudgets(userId)) await storage.deleteBudget(b.id, userId);
          for (const g of await storage.getUserGoals(userId).catch(() => [])) await storage.deleteGoal(g.id, userId);
          for (const row of oldTransactions) await storage.createTransaction(stripForReinsert(row));
          for (const row of oldBudgets) await storage.createBudget(stripForReinsert(row));
          for (const row of oldGoals) await storage.createGoal(stripForReinsert(row));
        } catch (rollbackError) {
          console.error('RESTORE ROLLBACK FAILED:', rollbackError);
        }
        return res.status(500).json({ message: "Failed to restore backup. Your previous data was kept." });
      }

      return res.json({
        success: true,
        message: "Backup restored successfully",
        restoredData,
        filename,
        backupDate: parsedData.timestamp
      });

    } catch (error: any) {
      console.error("RESTORE ERROR: Error restoring backup:", error);
      return res.status(500).json({ message: "Failed to restore backup" });
    }
  });
}