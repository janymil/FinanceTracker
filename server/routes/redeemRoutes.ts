import { log } from '../logger';
import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { isAuthenticated } from "../clerkAuth";
import { rateLimit } from "../middleware/rateLimit";

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

      return res.json({
        redeemedCodes: codesWithDetails,
        plan: user?.plan || 'free',
        totalRedeemed: redeemedCodes.length,
        canRedeemMore: redeemedCodes.length < 2,
        remainingSlots: Math.max(0, 2 - redeemedCodes.length)
      });

    } catch (error) {
      log.error("Get my codes error:", error);
      return res.status(500).json({
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

      return res.json({
        redeemedCodes: redeemedCodes.map((code: any) => code.code),
        plan: user?.plan || 'free',
        totalRedeemed: redeemedCodes.length
      });

    } catch (error) {
      log.error("Get redeem status error:", error);
      return res.status(500).json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Capped per person and per address so codes cannot be guessed by brute force.
  app.post("/api/redeem", isAuthenticated,
    rateLimit({ windowMs: 60 * 60 * 1000, max: 10, keyPrefix: 'redeem-user', perUser: true, message: 'Too many attempts. Please try again later.' }),
    rateLimit({ windowMs: 60 * 60 * 1000, max: 20, keyPrefix: 'redeem-ip', message: 'Too many attempts. Please try again later.' }),
    async (req: any, res) => {
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

      log.info(`User ${userId} currently has ${currentCodeCount} redeemed codes`);

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

      // Redeem all valid codes. The final UPDATE is atomic, so a code someone else took in
      // the meantime comes back empty; only the codes actually redeemed count.
      const redeemedCodes: any[] = [];
      const lostRace: string[] = [];
      for (const code of validCodes) {
        try {
          redeemedCodes.push(await storage.redeemCode(code, userId));
        } catch {
          lostRace.push(code);
        }
      }

      if (redeemedCodes.length === 0) {
        return res.status(400).json({
          error: "Some codes are invalid or already redeemed by another user",
          invalidCodes: lostRace,
          currentCodes: currentRedeemedCodes.map((code: any) => code.code)
        });
      }

      // Determine new plan based on total codes after successful redemption
      const totalCodesAfterRedemption = currentCodeCount + redeemedCodes.length;
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

      log.info(`User ${userId} upgraded to ${plan} plan with ${totalCodesAfterRedemption} total codes`);

      return res.json({
        success: true,
        plan,
        validCodes: redeemedCodes,
        invalidCodes: lostRace,
        totalCodes: totalCodesAfterRedemption,
        previousCodes: currentRedeemedCodes.map((code: any) => code.code),
        newlyRedeemed: redeemedCodes.map((c: any) => c.code)
      });

    } catch (error) {
      log.error("Redeem codes error:", error);
      return res.status(500).json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
}