import type { Express } from "express";
import { isAuthenticated, getUserId } from "../clerkAuth";
import { storage } from "../storage";
import { getUserLanguage } from "../categoryTranslations";
import { rateLimit } from "../middleware/rateLimit";
import { log } from '../logger';

// Multilingual server messages
const serverMessages = {
  'en-us': {
    authRequired: "Authentication required",
    userAlreadyParticipant: "User is already a participant in this goal",
    userAlreadyPartOfGoal: "User is already part of this goal or cannot join",
    invitationEmailSent: "An invitation email has been sent",
    userAddedToGoal: "User has been added to the goal successfully",
    goalNotFound: "Goal not found",
    permissionDenied: "Permission denied",
    invalidData: "Invalid data provided",
    failedToSendEmail: "Failed to send invitation email"
  },
  'es-pe': {
    authRequired: "Se requiere autenticación",
    userAlreadyParticipant: "El usuario ya es participante en esta meta",
    userAlreadyPartOfGoal: "El usuario ya es parte de esta meta o no puede unirse",
    invitationEmailSent: "Se ha enviado un correo de invitación",
    userAddedToGoal: "El usuario ha sido agregado a la meta exitosamente",
    goalNotFound: "Meta no encontrada",
    permissionDenied: "Permiso denegado",
    invalidData: "Datos inválidos proporcionados",
    failedToSendEmail: "Error al enviar el correo de invitación"
  },
  'sk-sk': {
    authRequired: "Vyžaduje sa autentifikácia",
    userAlreadyParticipant: "Používateľ je už účastníkom tohto cieľa",
    userAlreadyPartOfGoal: "Používateľ je už súčasťou tohto cieľa alebo sa nemôže pripojiť",
    invitationEmailSent: "Pozvánovací e-mail bol odoslaný",
    userAddedToGoal: "Používateľ bol úspešne pridaný do cieľa",
    goalNotFound: "Cieľ nenájdený",
    permissionDenied: "Prístup zamietnutý",
    invalidData: "Poskytnuté neplatné údaje",
    failedToSendEmail: "Nepodarilo sa odoslať pozvánovací e-mail"
  }
};

function getLocalizedMessage(language: string, key: string): string {
  const lang = language.toLowerCase();
  
  // Check if language is supported and has the key
  if (lang === 'es-pe' && (serverMessages['es-pe'] as any)[key]) {
    return (serverMessages['es-pe'] as any)[key];
  }
  if (lang === 'sk-sk' && (serverMessages['sk-sk'] as any)[key]) {
    return (serverMessages['sk-sk'] as any)[key];
  }
  
  // Fallback to English
  return (serverMessages['en-us'] as any)[key] || key;
}

export function registerCollaborativeGoalRoutes(app: Express) {
  /**
   * A contribution may only come from an active participant of the goal.
   * Without this check any signed-in user could write into someone else's goal.
   */
  async function requireActiveParticipant(goalId: number, userId: string) {
    const participant = await storage.getGoalParticipant(goalId, userId);
    return participant && participant.status === 'active' ? participant : null;
  }

  /** Shared parsing for both contribution endpoints (they must accept the same input). */
  function parseContribution(body: any): { amount: string; description: string | null } | null {
    const amount = Number(body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const note = typeof body?.note === 'string' ? body.note.trim() : '';
    return { amount: amount.toFixed(2), description: note || null };
  }

  // Friend management routes
  app.post('/api/friends/request', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const { recipientEmail } = req.body;
      
      const friendship = await storage.sendFriendRequest(userId, recipientEmail);
      return res.json(friendship);
    } catch (error) {
      log.error("Error sending friend request:", error);
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/api/friends/accept/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const friendshipId = parseInt(req.params.id);
      
      const friendship = await storage.acceptFriendRequest(friendshipId, userId);
      return res.json(friendship);
    } catch (error) {
      log.error("Error accepting friend request:", error);
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.delete('/api/friends/reject/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const friendshipId = parseInt(req.params.id);
      
      await storage.rejectFriendRequest(friendshipId, userId);
      res.status(204).send();
    } catch (error) {
      log.error("Error rejecting friend request:", error);
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get('/api/friends', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const friends = await storage.getUserFriends(userId);
      return res.json(friends);
    } catch (error) {
      log.error("Error fetching friends:", error);
      return res.status(500).json({ message: "Failed to fetch friends" });
    }
  });

  app.get('/api/friends/requests', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const requests = await storage.getPendingFriendRequests(userId);
      return res.json(requests);
    } catch (error) {
      log.error("Error fetching friend requests:", error);
      return res.status(500).json({ message: "Failed to fetch friend requests" });
    }
  });

  // Collaborative goals routes
  app.post('/api/collaborative-goals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      // Allow-list, never a spread. A goal's `currentAmount` is progress that participants
      // trust, and `coverImage`/`joinCode` are shown to or gate everyone else — none of them
      // may be set by the request body.
      if (
        typeof req.body.name !== 'string' || !req.body.name.trim() ||
        req.body.targetAmount === undefined || req.body.targetAmount === null ||
        !req.body.targetDate ||
        typeof req.body.category !== 'string' || !req.body.category
      ) {
        return res.status(400).json({ message: 'Name, category, target amount and target date are required' });
      }

      const goalData = {
        name: req.body.name.trim(),
        description: typeof req.body.description === 'string' ? req.body.description : null,
        targetAmount: String(req.body.targetAmount),
        targetDate: new Date(req.body.targetDate),
        category: req.body.category,
        challengeType: typeof req.body.challengeType === 'string' && req.body.challengeType
          ? req.body.challengeType
          : 'collaborative',
        isPublic: req.body.isPublic === true,
        createdBy: userId,
      };

      const goal = await storage.createCollaborativeGoal(goalData);
      return res.json(goal);
    } catch (error) {
      log.error("Error creating collaborative goal:", error);
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get('/api/collaborative-goals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const goals = await storage.getUserCollaborativeGoals(userId);
      return res.json(goals);
    } catch (error) {
      log.error("Error fetching collaborative goals:", error);
      return res.status(500).json({ message: "Failed to fetch collaborative goals" });
    }
  });

  app.get('/api/collaborative-goals/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const goalId = parseInt(req.params.id);
      
      const goal = await storage.getCollaborativeGoal(goalId, userId);
      if (!goal) {
        // Not a member yet: return a minimal preview so the invite link can
        // offer a "Join" action (previously this was a hard 404). The preview is only
        // available for a public goal or when the link carries the join code.
        const inviteCode = typeof req.query.code === 'string' ? req.query.code : undefined;
        const preview = await storage.getCollaborativeGoalPreview(goalId, inviteCode);
        if (!preview) {
          return res.status(404).json({ message: "Goal not found" });
        }
        return res.json({
          ...preview,
          isParticipant: false,
          participants: [],
          contributions: [],
          activities: []
        });
      }

      return res.json({ ...goal, isParticipant: true });
    } catch (error) {
      log.error("Error fetching collaborative goal:", error);
      return res.status(500).json({ message: "Failed to fetch goal" });
    }
  });

  app.post('/api/collaborative-goals/:id/join', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const goalId = parseInt(req.params.id);
      const { personalTarget, joinCode } = req.body;
      if (typeof joinCode !== 'string' || !joinCode.trim()) {
        return res.status(403).json({ message: "An invitation code is required to join this goal" });
      }

      const participant = await storage.joinCollaborativeGoalWithCode(goalId, userId, joinCode, personalTarget);
      return res.json(participant);
    } catch (error) {
      log.error("Error joining collaborative goal:", error);
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/api/collaborative-goals/:id/leave', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const goalId = parseInt(req.params.id);
      
      await storage.leaveCollaborativeGoal(goalId, userId);
      res.status(204).send();
    } catch (error) {
      log.error("Error leaving collaborative goal:", error);
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.put('/api/collaborative-goals/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const goalId = parseInt(req.params.id);
      
      // Same allow-list as creation: `currentAmount` is progress, not an editable field, and
      // an outside `coverImage` URL would be a beacon on a page every participant opens.
      const editable: Record<string, any> = {};
      if (typeof req.body.name === 'string' && req.body.name.trim()) editable.name = req.body.name.trim();
      if (req.body.description === null || typeof req.body.description === 'string') {
        editable.description = req.body.description;
      }
      if (req.body.targetAmount !== undefined) editable.targetAmount = String(req.body.targetAmount);
      if (req.body.targetDate !== undefined) editable.targetDate = new Date(req.body.targetDate);
      if (typeof req.body.category === 'string' && req.body.category) editable.category = req.body.category;
      if (typeof req.body.isPublic === 'boolean') editable.isPublic = req.body.isPublic;
      if (typeof req.body.status === 'string' && ['active', 'completed', 'cancelled'].includes(req.body.status)) {
        editable.status = req.body.status;
      }

      if (Object.keys(editable).length === 0) {
        return res.status(400).json({ message: "No supported fields to update" });
      }

      const goal = await storage.updateCollaborativeGoal(goalId, userId, editable);
      return res.json(goal);
    } catch (error) {
      log.error("Error updating collaborative goal:", error);
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.delete('/api/collaborative-goals/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const goalId = parseInt(req.params.id);
      
      await storage.deleteCollaborativeGoal(goalId, userId);
      res.status(204).send();
    } catch (error) {
      log.error("Error deleting collaborative goal:", error);
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Goal contributions
  app.post('/api/collaborative-goals/:id/contribute', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const goalId = parseInt(req.params.id);

      const participant = await requireActiveParticipant(goalId, userId);
      if (!participant) {
        return res.status(403).json({ message: "You are not a participant of this goal" });
      }

      const parsed = parseContribution(req.body);
      if (!parsed) {
        return res.status(400).json({ message: "A positive amount is required" });
      }

      const contribution = await storage.addGoalContribution({
        goalId,
        userId,
        amount: parsed.amount,
        description: parsed.description,
      });
      return res.json(contribution);
    } catch (error) {
      log.error("Error adding contribution:", error);
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get('/api/collaborative-goals/:id/contributions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const goalId = parseInt(req.params.id);
      if (!userId || !(await requireActiveParticipant(goalId, userId))) {
        return res.status(403).json({ message: "You are not a participant of this goal" });
      }
      const contributions = await storage.getGoalContributions(goalId);
      return res.json(contributions);
    } catch (error) {
      log.error("Error fetching contributions:", error);
      return res.status(500).json({ message: "Failed to fetch contributions" });
    }
  });

  app.get('/api/collaborative-goals/:id/activities', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const goalId = parseInt(req.params.id);
      if (!userId || !(await requireActiveParticipant(goalId, userId))) {
        return res.status(403).json({ message: "You are not a participant of this goal" });
      }
      const activities = await storage.getGoalActivities(goalId);
      return res.json(activities);
    } catch (error) {
      log.error("Error fetching activities:", error);
      return res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  // Email invitation endpoint for collaborative goals
  app.post('/api/collaborative-goals/:id/invite', isAuthenticated, rateLimit({ windowMs: 60 * 60 * 1000, max: 20, keyPrefix: 'goal-invite', perUser: true }), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        const userLanguage = getUserLanguage(req);
        return res.status(401).json({ message: getLocalizedMessage(userLanguage, 'authRequired') });
      }
      const goalId = parseInt(req.params.id);
      const { email } = req.body;
      const userLanguage = getUserLanguage(req);

      if (!email || !email.includes('@')) {
        return res.status(400).json({ message: getLocalizedMessage(userLanguage, 'invalidData') });
      }

      // Check if user has permission to invite to this goal (creator only)
      const goal = await storage.getCollaborativeGoal(goalId, userId);
      if (!goal) {
        return res.status(404).json({ message: "Goal not found or access denied" });
      }
      if (goal.createdBy !== userId) {
        return res.status(403).json({ message: getLocalizedMessage(userLanguage, 'permissionDenied') });
      }

      // Get inviter details
      const inviter = await storage.getUser(userId);
      if (!inviter) {
        return res.status(404).json({ message: "Inviter not found" });
      }

      // One response shape for every invite, whatever the address turns out to be.
      //
      // This route used to answer `existingUser: true` and add that account to the goal on the
      // spot. Both were wrong: the answer told the inviter whether an address has a Kaptia
      // account (an account-existence oracle), and the goal gained a member who never agreed.
      // An invitation now only sends the link with the join code; joining is the recipient's
      // decision.
      const existingUser = await storage.getUserByEmail(email);

      if (existingUser) {
        const existingParticipant = await storage.getGoalParticipant(goalId, existingUser.id);
        if (existingParticipant) {
          // The creator can see the participant list already, so this reveals nothing new, and
          // a second invitation would only add noise to the recipient's inbox.
          return res.json({ success: true, emailSent: false });
        }
      }

      const { sendGoalInvitationEmail } = await import('../emailService');
      const goalUrl = `${process.env.APP_URL || 'https://kaptia.app'}/collaborative-goals/${goalId}?code=${encodeURIComponent(goal.joinCode ?? "")}`;

      const emailSent = await sendGoalInvitationEmail({
        recipientEmail: email,
        // The name only greets the recipient in their own copy of the mail.
        recipientName: existingUser
          ? `${existingUser.firstName ?? ''} ${existingUser.lastName ?? ''}`.trim() || 'there'
          : 'there',
        inviterName: `${inviter.firstName} ${inviter.lastName}`,
        goalName: goal.name,
        goalDescription: goal.description || '',
        targetAmount: goal.targetAmount,
        targetDate: goal.targetDate,
        goalUrl,
        isExistingUser: Boolean(existingUser)
      });

      return res.json({ success: true, emailSent });
    } catch (error: any) {
      log.error("Error inviting user:", error);
      const lang = getUserLanguage(req);
      return res.status(500).json({ message: getLocalizedMessage(lang, 'failedToSendEmail') });
    }
  });

  // Add contribution to collaborative goal
  app.post('/api/collaborative-goals/:id/contributions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const goalId = parseInt(req.params.id);

      const participant = await requireActiveParticipant(goalId, userId);
      if (!participant) {
        return res.status(403).json({ message: "You are not a participant of this goal" });
      }

      const parsed = parseContribution(req.body);
      if (!parsed) {
        return res.status(400).json({ message: "A positive amount is required" });
      }

      const contribution = await storage.addGoalContribution({
        goalId,
        userId,
        amount: parsed.amount,
        description: parsed.description,
      });
      return res.json(contribution);
    } catch (error: any) {
      log.error("Error adding contribution:", error);
      return res.status(400).json({ message: error?.message || "Failed to add contribution" });
    }
  });

  app.get('/api/achievements', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const achievements = await storage.getUserAchievements(userId);
      return res.json(achievements);
    } catch (error) {
      log.error("Error fetching achievements:", error);
      return res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });

  // Goal messages/chat routes
  app.get('/api/collaborative-goals/:goalId/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const goalId = parseInt(req.params.goalId);
      
      // Check if user is a participant in the goal
      const participants = await storage.getGoalParticipants(goalId);
      const isParticipant = participants.some(p => p.userId === userId);
      
      if (!isParticipant) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const messages = await storage.getGoalMessages(goalId);
      return res.json(messages);
    } catch (error) {
      log.error("Error fetching goal messages:", error);
      return res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post('/api/collaborative-goals/:goalId/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const goalId = parseInt(req.params.goalId);
      
      // Check if user is a participant in the goal
      const participants = await storage.getGoalParticipants(goalId);
      const isParticipant = participants.some(p => p.userId === userId);
      
      if (!isParticipant) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { message, messageType = 'text', metadata } = req.body;
      
      if (!message) {
        return res.status(400).json({ message: "Message content is required" });
      }
      
      const newMessage = await storage.createGoalMessage({
        goalId,
        userId,
        message,
        messageType,
        metadata: metadata || null,
      });
      
      return res.status(201).json(newMessage);
    } catch (error) {
      log.error("Error creating goal message:", error);
      return res.status(500).json({ message: "Failed to create message" });
    }
  });

  app.put('/api/collaborative-goals/messages/:messageId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const messageId = parseInt(req.params.messageId);
      const { message } = req.body;
      
      if (!message) {
        return res.status(400).json({ message: "Message content is required" });
      }
      
      // Only the author's own message matches (userId is part of the query).
      const updatedMessage = await storage.updateGoalMessage(messageId, userId, {
        message,
      });
      
      if (!updatedMessage) {
        return res.status(404).json({ message: "Message not found" });
      }
      
      return res.json(updatedMessage);
    } catch (error) {
      log.error("Error updating goal message:", error);
      return res.status(500).json({ message: "Failed to update message" });
    }
  });

  app.delete('/api/collaborative-goals/messages/:messageId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const messageId = parseInt(req.params.messageId);
      
      // Allowed for the author or the goal creator (checked in storage).
      const deleted = await storage.deleteGoalMessage(messageId, userId);
      
      if (!deleted) {
        return res.status(404).json({ message: "Message not found" });
      }
      
      return res.json({ message: "Message deleted successfully" });
    } catch (error) {
      log.error("Error deleting goal message:", error);
      return res.status(500).json({ message: "Failed to delete message" });
    }
  });


}