// Admin redeem routes - no longer needed as codes uploaded directly

const upload = multer({ 
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

export function registerAdminRedeemRoutes(app: Express) {
  // Bulk upload redeem codes from CSV
  app.post("/api/admin-analytics/upload-codes", upload.single('csvFile'), async (req: any, res) => {
    try {
      // Check admin authentication
      if (!req.session.adminAuthenticated) {
        return res.status(401).json({ error: "Admin authentication required" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No CSV file uploaded" });
      }

      // Parse CSV file
      const csvContent = req.file.buffer.toString('utf-8');
      let codes: string[];
      
      try {
        // Parse CSV with no headers, single column
        const records = parse(csvContent, {
          skip_empty_lines: true,
          trim: true
        });
        
        // Extract codes from single column
        codes = records.map((record: any) => {
          if (Array.isArray(record)) {
            return record[0]?.toString().trim();
          }
          return record?.toString().trim();
        }).filter((code: string) => code && code.length > 0);
      } catch (parseError) {
        return res.status(400).json({ error: "Invalid CSV format" });
      }

      if (codes.length === 0) {
        return res.status(400).json({ error: "No valid codes found in CSV" });
      }

      // Validate codes format (alphanumeric, 6 characters)
      const validCodes = codes.filter(code => /^[A-Z0-9]{6}$/.test(code));
      const invalidCodes = codes.filter(code => !/^[A-Z0-9]{6}$/.test(code));

      if (validCodes.length === 0) {
        return res.status(400).json({ 
          error: "No valid codes found. Codes must be 6 alphanumeric characters.",
          invalidCodes: invalidCodes.slice(0, 10) // Show first 10 invalid codes
        });
      }

      // Bulk insert codes
      let insertedCount = 0;
      let duplicateCount = 0;
      const errors: string[] = [];

      for (const code of validCodes) {
        try {
          // Check if code already exists
          const existingCode = await storage.getRedeemCode(code);
          if (existingCode) {
            duplicateCount++;
            continue;
          }

          // Insert new code
          await storage.db.insert(storage.redeemCodes).values({
            code: code,
            redeemed: false,
            createdAt: new Date()
          });
          insertedCount++;
        } catch (error: any) {
          errors.push(`Failed to insert ${code}: ${error.message}`);
        }
      }

      res.json({
        success: true,
        totalCodes: codes.length,
        validCodes: validCodes.length,
        invalidCodes: invalidCodes.length,
        insertedCount,
        duplicateCount,
        errors: errors.slice(0, 5), // Show first 5 errors
        invalidCodesPreview: invalidCodes.slice(0, 5)
      });

    } catch (error: any) {
      console.error("Bulk upload error:", error);
      res.status(500).json({ error: "Failed to upload codes" });
    }
  });

  // Get redeem codes statistics
  app.get("/api/admin-analytics/codes-stats", async (req: any, res) => {
    try {
      // Check admin authentication
      if (!req.session.adminAuthenticated) {
        return res.status(401).json({ error: "Admin authentication required" });
      }

      const totalCodes = await storage.db.select().from(storage.redeemCodes);
      const redeemedCodes = totalCodes.filter(code => code.redeemed);
      const availableCodes = totalCodes.filter(code => !code.redeemed);

      res.json({
        totalCodes: totalCodes.length,
        redeemedCodes: redeemedCodes.length,
        availableCodes: availableCodes.length,
        recentCodes: totalCodes
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 10)
          .map(code => ({
            code: code.code,
            redeemed: code.redeemed,
            redeemedBy: code.redeemedBy,
            redeemedAt: code.redeemedAt,
            createdAt: code.createdAt
          }))
      });

    } catch (error: any) {
      console.error("Codes stats error:", error);
      res.status(500).json({ error: "Failed to get codes statistics" });
    }
  });
}