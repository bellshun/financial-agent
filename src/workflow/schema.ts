import { z } from 'zod';

export const ExecutionPlanSchema = z.object({
    steps: z.array(z.object({
      id: z.string(),
      toolName: z.string(),
      parameters: z.record(z.any()),
      description: z.string(),
      completed: z.boolean().default(false),
      mcpServer: z.enum(['crypto', 'news', 'stock']).optional(),
      targetSymbol: z.string().default('')
    })).default([]),
    analysisType: z.enum(['technical', 'fundamental', 'sentiment', 'comprehensive']).default('comprehensive'),
    priority: z.number().default(3)
});