import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { isAuthenticated } from "../clerkAuth";

const redeemSchema = z.object({
  codes: z.array(z.string().min(1)).min(1).max(2)
});

export function registerRedeemRoutes(app: Express) {
  app.post("/api/redeem", isAuthenticated, async (req, res) => {
    try {
      const auth = req.auth();
      const userId = auth?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { codes } = redeemSchema.parse(req.body);

      // Check if codes exist and are not redeemed
      const validCodes = [];
      const invalidCodes = [];

      for (const code of codes) {
        const redeemCode = await storage.getRedeemCode(code);
        if (!redeemCode || redeemCode.redeemed) {
          invalidCodes.push(code);
        } else {
          validCodes.push(code);
        }
      }

      // If any codes are invalid, return error
      if (invalidCodes.length > 0) {
        return res.status(400).json({
          error: "Invalid or already redeemed codes",
          invalidCodes
        });
      }

      // Determine plan based on number of valid codes
      let plan: string;
      if (validCodes.length === 1) {
        plan = "standard";
      } else if (validCodes.length === 2) {
        plan = "premium";
      } else {
        return res.status(400).json({
          error: "Invalid number of codes. Provide 1 code for Standard or 2 codes for Premium."
        });
      }

      // Redeem all codes
      const redeemedCodes = [];
      for (const code of validCodes) {
        const redeemedCode = await storage.redeemCode(code, userId);
        redeemedCodes.push(redeemedCode);
      }

      // Update user's plan and set activation timestamp
      await storage.updateUser(userId, { 
        plan,
        activatedAt: new Date()
      });

      res.json({
        success: true,
        plan,
        validCodes: redeemedCodes,
        invalidCodes: []
      });

    } catch (error) {
      console.error("Redeem codes error:", error);
      res.status(500).json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
}