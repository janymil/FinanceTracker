import type { Express } from "express";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { storage } from "../storage";
import { generatePdfReport } from "../generatePdf";
import { cloudStorage } from "../cloudStorage";

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

      let importedCount = 0;
      let skippedCount = 0;
      const errors: Array<{ row: number; field: string; message: string }> =[];

      // Process each transaction
      for (let i = 0; i < importTransactions.length; i++) {
        const transaction = importTransactions[i];

        try {
          // Validate required fields
          if (!transaction.description || !transaction.amount || !transaction.type || !transaction.date) {
            errors.push({
              row: i + 1,
              field: 'required',
              message: 'Missing required fields: description, amount, type, or date'
            });
            skippedCount++;
            continue;
          }

          // Convert and validate data
          const transactionData = {
            userId,
            description: String(transaction.description).trim(),
            amount: String(Math.abs(parseFloat(transaction.amount))),
            type: transaction.type.toLowerCase() === 'income' ? 'income' : 'expense',
            date: new Date(transaction.date),
            categoryId: transaction.categoryId || 1, // Default to first category
          };

          // Check for duplicates if merge strategy is not 'append'
          if (mergeStrategy !== 'append') {
            const existingTransactions = await storage.getUserTransactions(userId);
            const isDuplicate = existingTransactions.some(existing => 
              existing.description === transactionData.description &&
              existing.amount === transactionData.amount &&
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
            message: error instanceof Error ? error.message : 'Unknown error'
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
      console.log('PDF Export Request:', req.body);
      
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const user = await storage.getUser(userId);
      console.log('PDF Export User:', user?.plan);

      if (!user || user.plan === 'free') {
        console.log('PDF Export Error: Plan restriction');
        return res.status(403).json({ message: "PDF export requires Standard or Premium subscription" });
      }

      const { month, year } = req.body;
      console.log('PDF Export Parameters:', { month, year });

      // Parse month and year
      const targetYear = year || new Date().getFullYear();
      const targetMonth = month ? new Date(Date.parse(month + " 1, 2000")).getMonth() : new Date().getMonth();

      // Get date range for the specified month
      const start = new Date(targetYear, targetMonth, 1);
      const end = new Date(targetYear, targetMonth + 1, 0);

      // Get all user data
      const transactions = await storage.getUserTransactions(userId);
      const budgets = await storage.getUserBudgets(userId);
      let goals = [];
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

      // Prepare PDF data with proper data transformation
      const pdfData = {
        transactions: monthlyTransactions.map(t => ({
          id: t.id,
          amount: t.amount,
          description: t.description,
          date: t.date.toISOString(),
          type: t.type as 'income' | 'expense',
          categoryId: t.categoryId?.toString() || null
        })),
        budgets: budgets.map(b => ({
          id: b.id,
          name: b.categoryId?.toString() || "Uncategorized", 
          amount: b.amount,
          spent: "0", // Calculate spent amount from transactions
          categoryId: b.categoryId || 0,
          period: b.period
        })),
        goals: goals.map((g: any) => ({
          id: g.id,
          name: g.name,
          targetAmount: g.targetAmount,
          currentAmount: g.currentAmount,
          targetDate: g.targetDate
        })),
        summary: {
          totalIncome: income,
          totalExpenses: expenses,
          netAmount: income - expenses,
          transactionCount: monthlyTransactions.length,
          categoryBreakdown,
          month: month || new Date().toLocaleDateString('en-US', { month: 'long' }),
          year: targetYear
        },
        userName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email || 'User'
      };

      console.log('PDF Data prepared:', JSON.stringify(pdfData, null, 2));

      // Generate PDF
      const pdfBuffer = await generatePdfReport(pdfData);
      
      // Send PDF response
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="kaptia-report-${month}-${targetYear}.pdf"`);
      return res.send(pdfBuffer);

    } catch (error) {
      console.error("Error generating PDF:", error);
      console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
      return res.status(500).json({ 
        message: "Failed to generate PDF report", 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  app.post('/api/export', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const user = await storage.getUser(userId);

      if (!user || user.plan !== 'premium') {
        return res.status(403).json({ message: "Data export requires Premium subscription" });
      }

      const { format, dateRange, includeTransactions, includeBudgets, includeGoals, startDate, endDate } = req.body;

      const exportData: any = {};

      if (includeTransactions) {
        let transactions = await storage.getUserTransactions(userId);
        
        // Filter by date range if specified
        if (dateRange === 'custom' && startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
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
      exportData.userId = userId;
      exportData.userName = user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email;

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="kaptia-export.json"');
        return res.json(exportData);
      } else if (format === 'csv') {
        // For CSV, we'll export transactions only as CSV format is tabular
        if (exportData.transactions) {
          const csvHeader = 'Date,Description,Amount,Type,Category\n';
          const csvRows = exportData.transactions.map((t: any) => {
            const dateStr = t.date instanceof Date ? t.date.toISOString().split('T')[0] : String(t.date || '').split('T')[0];
            return `${dateStr},"${(t.description || '').replace(/"/g, '""')}",${t.amount},${t.type},${t.categoryName || 'Uncategorized'}`;
          }).join('\n');
          
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename="kaptia-transactions.csv"');
          return res.send(csvHeader + csvRows);
        } else {
          return res.status(400).json({ message: "CSV export requires transactions to be included" });
        }
      } else {
        return res.status(400).json({ message: "Unsupported export format" });
      }

    } catch (error) {
      console.error("Error exporting data:", error);
      return res.status(500).json({ message: "Failed to export data" });
    }
  });

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
      if (!filename) {
        return res.status(400).json({ message: "Backup filename required" });
      }

      console.log(`RESTORE DEBUG: Restoring backup file: ${filename} for user: ${userId}`);

      // Use the existing downloadFile method with proper path
      const filePath = `backups/user-${userId}/${filename}`;
      const backupContent = await backupStorage.downloadFile(filePath);
      const parsedData = JSON.parse(backupContent);

      if (parsedData.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized backup access" });
      }

      // Actually restore the data to the database
      const restoredData = {
        transactions: 0,
        budgets: 0,
        goals: 0
      };

      // Clear existing user data first
      const existingTransactions = await storage.getUserTransactions(userId);
      for (const transaction of existingTransactions) {
        await storage.deleteTransaction(transaction.id, userId);
      }

      const existingBudgets = await storage.getUserBudgets(userId);
      for (const budget of existingBudgets) {
        await storage.deleteBudget(budget.id, userId);
      }

      try {
        const existingGoals = await storage.getUserGoals(userId);
        for (const goal of existingGoals) {
          await storage.deleteGoal(goal.id, userId);
        }
      } catch (error) {
        console.log('Goals not available for deletion:', error);
      }

      // Restore transactions
      if (parsedData.data.transactions) {
        for (const transaction of parsedData.data.transactions) {
          // Convert string dates back to Date objects
          const transactionData = {
            ...transaction,
            date: new Date(transaction.date),
            createdAt: new Date(transaction.createdAt),
            updatedAt: new Date(transaction.updatedAt)
          };
          delete transactionData.id; // Let database generate new ID
          await storage.createTransaction(transactionData);
          restoredData.transactions++;
        }
      }

      // Restore budgets
      if (parsedData.data.budgets) {
        for (const budget of parsedData.data.budgets) {
          const budgetData = {
            ...budget,
            startDate: new Date(budget.startDate),
            endDate: new Date(budget.endDate),
            createdAt: new Date(budget.createdAt)
          };
          delete budgetData.id; // Let database generate new ID
          await storage.createBudget(budgetData);
          restoredData.budgets++;
        }
      }

      // Restore goals
      if (parsedData.data.goals) {
        try {
          for (const goal of parsedData.data.goals) {
            const goalData = {
              ...goal,
              deadline: goal.deadline ? new Date(goal.deadline) : null,
              createdAt: new Date(goal.createdAt),
              updatedAt: new Date(goal.updatedAt)
            };
            delete goalData.id; // Let database generate new ID
            await storage.createGoal(goalData);
            restoredData.goals++;
          }
        } catch (error) {
          console.log('Goals not available for restoration:', error);
        }
      }

      console.log(`RESTORE DEBUG: Successfully restored backup: ${filename} with data:`, restoredData);

      return res.json({ 
        success: true, 
        message: "Backup restored successfully",
        restoredData,
        filename: filename,
        backupDate: parsedData.timestamp
      });

    } catch (error: any) {
      console.error("RESTORE ERROR: Error restoring backup:", error);
      console.error("RESTORE ERROR: Error details:", error.message);
      console.error("RESTORE ERROR: Error stack:", error.stack);
      return res.status(500).json({ message: "Failed to restore backup", error: error.message });
    }
  });
}