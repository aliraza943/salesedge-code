import { z } from "zod";
import { protectedProcedure, router } from "./trpc";
import * as db from "../db";

export const syncRouter = router({
  importAll: protectedProcedure
    .input(z.object({
      events: z.array(z.any()),
      rfps: z.array(z.any()),
      deals: z.array(z.any()),
      brokers: z.array(z.any()),
      salesGoal: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Simple sync: create all items for the user
      // In a real app, you'd handle duplicates/IDs more carefully
      for (const e of input.events) {
        await db.createEvent({
          userId,
          title: e.title,
          description: e.description,
          date: e.date,
          startTime: e.startTime,
          endTime: e.endTime,
          allDay: e.allDay,
          reminderMinutes: e.reminderMinutes,
        });
      }

      for (const r of input.rfps) {
        await db.createRfp({
          userId,
          title: r.title,
          clientName: r.client || r.clientName,
          status: r.status,
          lives: r.lives,
          premium: r.premium,
          effectiveDate: r.effectiveDate,
          notes: r.notes,
        });
      }

      for (const d of input.deals) {
        await db.createDeal({
          userId,
          title: d.title,
          clientName: d.client || d.clientName,
          stage: d.stage,
          value: d.value,
          expectedCloseDate: d.expectedCloseDate,
        });
      }

      if (input.salesGoal) {
        await db.upsertSalesGoal(userId, input.salesGoal);
      }

      return { success: true };
    }),
});
