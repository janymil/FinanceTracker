import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { isAuthenticated } from "../clerkAuth";

const redeemSchema = z.object({
  codes: z.array(z.string().min(1)).min(1).max(2)
});

export function registerRedeemRoutes(app: Express) {
  // Get user's redeemed codes with details
  app.get("/api/my-codes", isAuthenticated, async (req: any, res) => {
    try {
      const auth = req.auth();
      const userId = auth?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const redeemedCodes = await storage.getUserRedeemedCodes(userId);
      const user = await storage.getUser(userId);

      const codesWithDetails = redeemedCodes.map((code: any) => ({
        code: code.code,
        redeemedAt: code.redeemedAt,
        tier: code.tier || 'standard'
      }));

      res.json({
        redeemedCodes: codesWithDetails,
        plan: user?.plan || 'free',
        totalRedeemed: redeemedCodes.length,
        canRedeemMore: redeemedCodes.length < 2,
        remainingSlots: Math.max(0, 2 - redeemedCodes.length)
      });

    } catch (error) {
      console.error("Get my codes error:", error);
      res.status(500).json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get user's redeemed codes
  app.get("/api/redeem/status", isAuthenticated, async (req: any, res) => {
    try {
      const auth = req.auth();
      const userId = auth?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const redeemedCodes = await storage.getUserRedeemedCodes(userId);
      const user = await storage.getUser(userId);

      res.json({
        redeemedCodes: redeemedCodes.map((code: any) => code.code),
        plan: user?.plan || 'free',
        totalRedeemed: redeemedCodes.length
      });

    } catch (error) {
      console.error("Get redeem status error:", error);
      res.status(500).json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/redeem", isAuthenticated, async (req: any, res) => {
    try {
      const auth = req.auth();
      const userId = auth?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { codes } = redeemSchema.parse(req.body);

      // Check current user's redeemed codes
      const currentRedeemedCodes = await storage.getUserRedeemedCodes(userId);
      const currentCodeCount = currentRedeemedCodes.length;

      console.log(`User ${userId} currently has ${currentCodeCount} redeemed codes`);

      // Validation: Check if user already has maximum codes
      if (currentCodeCount >= 2) {
        return res.status(400).json({
          error: "You have already redeemed the maximum number of codes (2)",
          currentCodes: currentRedeemedCodes.map((code: any) => code.code)
        });
      }

      // Validation: Check if user is trying to redeem more codes than allowed
      const newCodeCount = codes.length;
      const totalAfterRedemption = currentCodeCount + newCodeCount;

      if (totalAfterRedemption > 2) {
        return res.status(400).json({
          error: `You can only redeem ${2 - currentCodeCount} more code(s). You currently have ${currentCodeCount} code(s).`,
          currentCodes: currentRedeemedCodes.map((code: any) => code.code)
        });
      }

      // Validation: Check if user is trying to redeem a code they already have
      const currentCodesArray = currentRedeemedCodes.map((code: any) => code.code.toUpperCase());
      const duplicateCodes = codes.filter(code => currentCodesArray.includes(code.toUpperCase()));
      
      if (duplicateCodes.length > 0) {
        return res.status(400).json({
          error: "You have already redeemed some of these codes",
          duplicateCodes,
          currentCodes: currentRedeemedCodes.map((code: any) => code.code)
        });
      }

      // Check if new codes exist and are not redeemed
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
          error: "Some codes are invalid or already redeemed by another user",
          invalidCodes,
          currentCodes: currentRedeemedCodes.map((code: any) => code.code)
        });
      }

      // Redeem all valid codes
      const redeemedCodes = [];
      for (const code of validCodes) {
        const redeemedCode = await storage.redeemCode(code, userId);
        redeemedCodes.push(redeemedCode);
      }

      // Determine new plan based on total codes after successful redemption
      const totalCodesAfterRedemption = currentCodeCount + validCodes.length;
      let plan: string;
      
      if (totalCodesAfterRedemption >= 2) {
        plan = "premium";
      } else {
        plan = "standard";
      }

      // Update user's plan and set activation timestamp
      await storage.updateUser(userId, { 
        plan,
        activatedAt: new Date()
      });

      console.log(`User ${userId} upgraded to ${plan} plan with ${totalCodesAfterRedemption} total codes`);

      res.json({
        success: true,
        plan,
        validCodes: redeemedCodes,
        invalidCodes: [],
        totalCodes: totalCodesAfterRedemption,
        previousCodes: currentRedeemedCodes.map((code: any) => code.code),
        newlyRedeemed: validCodes
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