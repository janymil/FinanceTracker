import { db } from '../server/db';
import { merchantLearning, merchantPatterns, categories } from '../shared/schema';
import { eq, and, desc, sql, isNull, gte } from 'drizzle-orm';

export interface MerchantLearningData {
  userId: string;
  merchantName: string;
  transcript: string;
  originalCategoryId?: number | null;
  correctedCategoryId: number;
  businessType?: string;
  countryCode: string;
  language: string;
  confidence?: number;
  correctionType: 'manual_selection' | 'category_change' | 'merchant_correction';
  transactionId?: number;
}

export interface LearnedMerchantPattern {
  merchantName: string;
  businessType: string;
  categoryId: number;
  categoryName: string;
  confidence: number;
  userCount: number;
  source: string;
}

/**
 * How many different accounts must make the same correction before it is offered to anyone else.
 *
 * A shared pattern used to be created by the first person who corrected a merchant, at 0.7
 * confidence, and read back for the whole country. One mistyped purchase could therefore hand
 * everybody else the wrong category, and a single account could quietly teach the app something
 * false. Below this count the correction stays private to the person who made it.
 */
export const PATTERN_MIN_CONFIRMATIONS = 3;

/**
 * Record a user correction for learning
 */
export async function recordMerchantLearning(data: MerchantLearningData): Promise<void> {
  try {
    console.log('📚 [MerchantLearning] Recording user correction:', {
      merchant: data.merchantName,
      correctionType: data.correctionType,
      country: data.countryCode
    });

    // Insert the learning record
    await db.insert(merchantLearning).values({
      userId: data.userId,
      merchantName: data.merchantName,
      transcript: data.transcript,
      originalCategoryId: data.originalCategoryId,
      correctedCategoryId: data.correctedCategoryId,
      businessType: data.businessType,
      countryCode: data.countryCode,
      language: data.language,
      confidence: data.confidence?.toString() || '0.5',
      correctionType: data.correctionType,
      transactionId: data.transactionId
    });

    // Update or create global merchant pattern
    await updateMerchantPattern(data);

    console.log('✅ [MerchantLearning] Learning recorded successfully');
  } catch (error) {
    console.error('❌ [MerchantLearning] Error recording learning:', error);
    throw error;
  }
}

/**
 * Update global merchant pattern based on user correction
 */
async function updateMerchantPattern(data: MerchantLearningData): Promise<void> {
  try {
    // Get the category name
    // Only a *system* category may become a shared pattern. A category row with a user_id is
    // someone's private label ("Mum's hospital bills"), and copying its name into
    // merchant_patterns published it to every account in the country.
    const category = await db
      .select({ name: categories.name })
      .from(categories)
      .where(and(eq(categories.id, data.correctedCategoryId), isNull(categories.userId)))
      .limit(1);

    if (!category[0]) {
      console.warn('[MerchantLearning] Category not found for ID:', data.correctedCategoryId);
      return;
    }

    const categoryName = category[0].name;

    // Check if pattern already exists
    const existingPattern = await db
      .select()
      .from(merchantPatterns)
      .where(
        and(
          eq(merchantPatterns.merchantName, data.merchantName.toLowerCase()),
          eq(merchantPatterns.countryCode, data.countryCode),
          eq(merchantPatterns.categoryId, data.correctedCategoryId)
        )
      )
      .limit(1);

    if (existingPattern[0]) {
      // Update existing pattern - increase user count and confidence
      const newUserCount = existingPattern[0].userCount + 1;
      const newConfidence = Math.min(0.95, parseFloat(existingPattern[0].confidence) + 0.05);

      await db
        .update(merchantPatterns)
        .set({
          userCount: newUserCount,
          confidence: newConfidence.toString(),
          isUserGenerated: newUserCount < PATTERN_MIN_CONFIRMATIONS,
          lastUpdated: new Date()
        })
        .where(eq(merchantPatterns.id, existingPattern[0].id));

      console.log('📈 [MerchantLearning] Updated existing pattern:', {
        merchant: data.merchantName,
        userCount: newUserCount,
        confidence: newConfidence
      });
    } else {
      // Create new pattern
      await db.insert(merchantPatterns).values({
        merchantName: data.merchantName.toLowerCase(),
        businessType: data.businessType || 'unknown',
        categoryId: data.correctedCategoryId,
        categoryName: categoryName,
        countryCode: data.countryCode,
        language: data.language,
        userCount: 1,
        confidence: '0.7', // Starting confidence for user-generated patterns
        // Private until other accounts independently agree (see PATTERN_MIN_CONFIRMATIONS):
        // one person's correction must not change what everybody else is offered.
        isUserGenerated: true,
        source: 'user_feedback'
      });

      console.log('🆕 [MerchantLearning] Created new pattern:', {
        merchant: data.merchantName,
        category: categoryName,
        country: data.countryCode
      });
    }
  } catch (error) {
    console.error('[MerchantLearning] Error updating merchant pattern:', error);
  }
}

/**
 * Get learned patterns for a merchant
 */
export async function getLearnedMerchantPattern(
  merchantName: string,
  countryCode: string
): Promise<LearnedMerchantPattern | null> {
  try {
    // Return null if merchantName is null or empty
    if (!merchantName || merchantName.trim() === '') {
      return null;
    }
    
    const patterns = await db
      .select({
        merchantName: merchantPatterns.merchantName,
        businessType: merchantPatterns.businessType,
        categoryId: merchantPatterns.categoryId,
        categoryName: merchantPatterns.categoryName,
        confidence: merchantPatterns.confidence,
        userCount: merchantPatterns.userCount,
        source: merchantPatterns.source
      })
      .from(merchantPatterns)
      .where(
        and(
          eq(merchantPatterns.merchantName, merchantName.toLowerCase()),
          eq(merchantPatterns.countryCode, countryCode),
          // Only patterns several accounts independently arrived at are shared.
          gte(merchantPatterns.userCount, PATTERN_MIN_CONFIRMATIONS)
        )
      )
      .orderBy(desc(merchantPatterns.userCount), desc(merchantPatterns.confidence))
      .limit(1);

    if (patterns[0]) {
      return {
        merchantName: patterns[0].merchantName,
        businessType: patterns[0].businessType,
        categoryId: patterns[0].categoryId || 0,
        categoryName: patterns[0].categoryName,
        confidence: parseFloat(patterns[0].confidence),
        userCount: patterns[0].userCount,
        source: patterns[0].source || 'user_feedback'
      };
    }

    return null;
  } catch (error) {
    console.error('[MerchantLearning] Error getting learned pattern:', error);
    return null;
  }
}

/**
 * Get user's personal merchant history
 */
export async function getUserMerchantHistory(
  userId: string,
  merchantName: string
): Promise<{ categoryId: number; confidence: number } | null> {
  try {
    const history = await db
      .select({
        categoryId: merchantLearning.correctedCategoryId,
        confidence: merchantLearning.confidence
      })
      .from(merchantLearning)
      .where(
        and(
          eq(merchantLearning.userId, userId),
          eq(merchantLearning.merchantName, merchantName.toLowerCase())
        )
      )
      .orderBy(desc(merchantLearning.learnedAt))
      .limit(1);

    if (history[0] && history[0].categoryId !== null) {
      return {
        categoryId: history[0].categoryId,
        confidence: parseFloat(history[0].confidence || '0.5')
      };
    }

    return null;
  } catch (error) {
    console.error('[MerchantLearning] Error getting user history:', error);
    return null;
  }
}

/**
 * Get top learned merchants for a country
 */
export async function getTopLearnedMerchants(
  countryCode: string,
  limit: number = 50
): Promise<LearnedMerchantPattern[]> {
  try {
    const patterns = await db
      .select({
        merchantName: merchantPatterns.merchantName,
        businessType: merchantPatterns.businessType,
        categoryId: merchantPatterns.categoryId,
        categoryName: merchantPatterns.categoryName,
        confidence: merchantPatterns.confidence,
        userCount: merchantPatterns.userCount,
        source: merchantPatterns.source
      })
      .from(merchantPatterns)
      .where(eq(merchantPatterns.countryCode, countryCode))
      .orderBy(desc(merchantPatterns.userCount), desc(merchantPatterns.confidence))
      .limit(limit);

    return patterns.map(p => ({
      merchantName: p.merchantName,
      businessType: p.businessType,
      categoryId: p.categoryId || 0,
      categoryName: p.categoryName,
      confidence: parseFloat(p.confidence),
      userCount: p.userCount,
      source: p.source || 'user_feedback'
    }));
  } catch (error) {
    console.error('[MerchantLearning] Error getting top merchants:', error);
    return [];
  }
}

/**
 * Import initial merchant patterns from JSON files
 */
export async function importMerchantPatterns(
  merchantData: any,
  countryCode: string
): Promise<void> {
  try {
    console.log(`[MerchantLearning] Importing patterns for ${countryCode}`);

    for (const [businessType, data] of Object.entries(merchantData)) {
      const { merchants } = data as any;
      
      for (const merchant of merchants) {
        // Check if pattern already exists
        const existing = await db
          .select()
          .from(merchantPatterns)
          .where(
            and(
              eq(merchantPatterns.merchantName, merchant.toLowerCase()),
              eq(merchantPatterns.countryCode, countryCode)
            )
          )
          .limit(1);

        if (!existing[0]) {
          await db.insert(merchantPatterns).values({
            merchantName: merchant.toLowerCase(),
            businessType: businessType,
            categoryId: 0, // Will be updated when users correct
            categoryName: 'Unknown',
            countryCode: countryCode,
            language: countryCode === 'sk' ? 'sk-sk' : 'en-us',
            userCount: 0,
            confidence: '0.5',
            isUserGenerated: false,
            source: 'file_import'
          });
        }
      }
    }

    console.log(`✅ [MerchantLearning] Import completed for ${countryCode}`);
  } catch (error) {
    console.error('[MerchantLearning] Error importing patterns:', error);
  }
}

/**
 * Get learning analytics for admin dashboard
 */
export async function getLearningAnalytics(): Promise<any> {
  try {
    const stats = await db.execute(sql`
      SELECT 
        country_code,
        COUNT(*) as total_patterns,
        AVG(user_count) as avg_user_confirmations,
        AVG(confidence) as avg_confidence,
        COUNT(CASE WHEN is_user_generated = true THEN 1 END) as user_generated,
        COUNT(CASE WHEN source = 'file_import' THEN 1 END) as file_imported
      FROM merchant_patterns 
      GROUP BY country_code
      ORDER BY total_patterns DESC
    `);

    const recentLearning = await db
      .select({
        merchantName: merchantLearning.merchantName,
        correctionType: merchantLearning.correctionType,
        countryCode: merchantLearning.countryCode,
        learnedAt: merchantLearning.learnedAt
      })
      .from(merchantLearning)
      .orderBy(desc(merchantLearning.learnedAt))
      .limit(20);

    return {
      countryStats: stats,
      recentLearning: recentLearning
    };
  } catch (error) {
    console.error('[MerchantLearning] Error getting analytics:', error);
    return { countryStats: [], recentLearning: [] };
  }
}