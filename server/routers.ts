import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { syncRouter } from "./_core/syncRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { transcribeAudio } from "./_core/voiceTranscription";
import { storagePut } from "./storage";
import * as db from "./db";
import { sdk } from "./_core/sdk";
import {
  buildChatSystemPrompt,
  buildPublicChatSystemPrompt,
  buildRfpSummarizePrompt,
} from "./prompt-helpers";

function getDayOfWeek(dateStr: string): string {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return days[new Date(dateStr + "T12:00:00").getDay()];
}

function getLocalDate(timezone?: string, localDate?: string): string {
  if (localDate) return localDate;
  const tz =
    timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  return new Date().toLocaleDateString("en-CA", { timeZone: tz });
}

export const appRouter = router({
  system: systemRouter,
  sync: syncRouter,
  auth: router({
    signup: publicProcedure
      .input(z.object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(6),
      }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getUserByEmail(input.email);
        if (existing) {
          throw new Error("User with this email already exists");
        }

        const userId = await db.createUser({
          name: input.name,
          email: input.email,
          password: input.password, // In a real app, hash this!
          loginMethod: "email",
        });

        const user = await db.getUserById(userId);
        if (!user) throw new Error("Failed to create user");

        const sessionToken = await sdk.createSessionToken(user);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, cookieOptions);

        return { success: true, user, sessionToken };
      }),

    login: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserByEmail(input.email);
        if (!user || user.password !== input.password) {
          throw new Error("Invalid email or password");
        }

        const sessionToken = await sdk.createSessionToken(user);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, cookieOptions);

        return { success: true, user, sessionToken };
      }),

    me: publicProcedure.query((opts) => opts.ctx.user),
    
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
      await db.deleteUserAndData(ctx.user.id);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    }),
  }),

  // ─── Events ─────────────────────────────────────────────
  events: router({
    list: protectedProcedure.query(({ ctx }) =>
      db.getUserEvents(ctx.user.id)
    ),
    byDate: protectedProcedure
      .input(z.object({ date: z.string() }))
      .query(({ ctx, input }) =>
        db.getEventsByDate(ctx.user.id, input.date)
      ),
    create: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1).max(255),
          description: z.string().optional(),
          date: z.string(),
          startTime: z.string().optional(),
          endTime: z.string().optional(),
          allDay: z.boolean().optional(),
          reminderMinutes: z.number().optional(),
          sourceType: z.string().optional(),
          sourceRfpId: z.number().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        db.createEvent({ ...input, userId: ctx.user.id })
      ),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().min(1).max(255).optional(),
          description: z.string().optional(),
          date: z.string().optional(),
          startTime: z.string().optional(),
          endTime: z.string().optional(),
          allDay: z.boolean().optional(),
          reminderMinutes: z.number().optional(),
          sourceType: z.string().optional(),
          sourceRfpId: z.number().optional(),
        })
      )
      .mutation(({ ctx, input }) => {
        const { id, ...data } = input;
        return db.updateEvent(id, ctx.user.id, data);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) =>
        db.deleteEvent(input.id, ctx.user.id)
      ),
  }),

  // ─── RFPs ──────────────────────────────────────────────
  rfps: router({
    list: protectedProcedure.query(({ ctx }) =>
      db.getUserRfps(ctx.user.id)
    ),
    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ ctx, input }) =>
        db.getRfpById(input.id, ctx.user.id)
      ),
    create: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1).max(255),
          clientName: z.string().min(1).max(255),
          brokerContact: z.string().max(255).optional(),
          lives: z.number().optional(),
          effectiveDate: z.string().optional(),
          premium: z.string().optional(),
          status: z
            .enum(["draft", "recommended", "sold"])
            .optional(),
          notes: z.string().optional(),
          description: z.string().optional(),
          followUpDate: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        db.createRfp({ ...input, userId: ctx.user.id })
      ),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().min(1).max(255).optional(),
          clientName: z.string().min(1).max(255).optional(),
          brokerContact: z.string().max(255).optional(),
          lives: z.number().optional(),
          effectiveDate: z.string().optional(),
          premium: z.string().optional(),
          status: z
            .enum(["draft", "recommended", "sold"])
            .optional(),
          notes: z.string().optional(),
          description: z.string().optional(),
          followUpDate: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) => {
        const { id, ...data } = input;
        return db.updateRfp(id, ctx.user.id, data);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) =>
        db.deleteRfp(input.id, ctx.user.id)
      ),
  }),

  // ─── Deals ─────────────────────────────────────────────
  deals: router({
    list: protectedProcedure.query(({ ctx }) =>
      db.getUserDeals(ctx.user.id)
    ),
    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ ctx, input }) =>
        db.getDealById(input.id, ctx.user.id)
      ),
    create: protectedProcedure
      .input(
        z.object({
          clientName: z.string().min(1).max(255),
          title: z.string().min(1).max(255),
          description: z.string().optional(),
          value: z.string().optional(),
          stage: z
            .enum([
              "lead",
              "qualified",
              "proposal",
              "negotiation",
              "closed_won",
              "closed_lost",
            ])
            .optional(),
          expectedCloseDate: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        db.createDeal({ ...input, userId: ctx.user.id })
      ),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          clientName: z.string().min(1).max(255).optional(),
          title: z.string().min(1).max(255).optional(),
          description: z.string().optional(),
          value: z.string().optional(),
          stage: z
            .enum([
              "lead",
              "qualified",
              "proposal",
              "negotiation",
              "closed_won",
              "closed_lost",
            ])
            .optional(),
          expectedCloseDate: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) => {
        const { id, ...data } = input;
        return db.updateDeal(id, ctx.user.id, data);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) =>
        db.deleteDeal(input.id, ctx.user.id)
      ),
  }),

  // ─── Brokers ──────────────────────────────────────────
  brokers: router({
    list: protectedProcedure.query(({ ctx }) =>
      db.getUserBrokers(ctx.user.id)
    ),
    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ ctx, input }) =>
        db.getBrokerById(input.id, ctx.user.id)
      ),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(255),
          company: z.string().max(255).optional(),
          phone: z.string().max(64).optional(),
          email: z.string().max(320).optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        db.createBroker({ ...input, userId: ctx.user.id })
      ),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).max(255).optional(),
          company: z.string().max(255).optional(),
          phone: z.string().max(64).optional(),
          email: z.string().max(320).optional(),
        })
      )
      .mutation(({ ctx, input }) => {
        const { id, ...data } = input;
        return db.updateBroker(id, ctx.user.id, data);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) =>
        db.deleteBroker(input.id, ctx.user.id)
      ),
    addNote: protectedProcedure
      .input(
        z.object({
          brokerId: z.number(),
          content: z.string().min(1),
        })
      )
      .mutation(({ ctx, input }) =>
        db.addBrokerNote({
          brokerId: input.brokerId,
          userId: ctx.user.id,
          content: input.content,
        })
      ),
    removeNote: protectedProcedure
      .input(z.object({ noteId: z.number() }))
      .mutation(({ ctx, input }) =>
        db.removeBrokerNote(input.noteId, ctx.user.id)
      ),
  }),

  // ─── Sales Goals ──────────────────────────────────────
  salesGoal: router({
    get: protectedProcedure.query(({ ctx }) =>
      db.getUserSalesGoal(ctx.user.id)
    ),
    upsert: protectedProcedure
      .input(
        z.object({
          currentSales: z.string().optional(),
          goalAmount: z.string().optional(),
          goalDeadline: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        db.upsertSalesGoal(ctx.user.id, input)
      ),
  }),

  // ─── Chat / AI (authenticated) ─────────────────────────
  chat: router({
    history: protectedProcedure.query(({ ctx }) =>
      db.getChatHistory(ctx.user.id)
    ),
    clear: protectedProcedure.mutation(({ ctx }) =>
      db.clearChatHistory(ctx.user.id)
    ),
    send: protectedProcedure
      .input(
        z.object({
          message: z.string().min(1),
          timezone: z.string().optional(),
          localDate: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const history = await db.getChatHistory(ctx.user.id, 10);
        const messages = history.reverse().map(h => ({
          role: h.role,
          content: h.content,
        }));
        
        messages.push({ role: "user", content: input.message });
        
        await db.saveChatMessage({
          userId: ctx.user.id,
          role: "user",
          content: input.message,
        });

        const systemPrompt = buildChatSystemPrompt(
          getLocalDate(input.timezone, input.localDate),
          getDayOfWeek(getLocalDate(input.timezone, input.localDate))
        );

        const result = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
        });

        const reply = result.choices[0].message.content as string;
        
        await db.saveChatMessage({
          userId: ctx.user.id,
          role: "assistant",
          content: reply,
        });

        return { reply };
      }),
  }),

  voice: router({
    transcribe: protectedProcedure
      .input(z.object({ audioUrl: z.string() }))
      .mutation(async ({ input }) => {
        const text = await transcribeAudio(input.audioUrl);
        return { text };
      }),
  }),
});

export type AppRouter = typeof appRouter;
