import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { transcribeAudio } from "./_core/voiceTranscription";
import { storagePut } from "./storage";
import * as db from "./db";
import {
  buildChatSystemPrompt,
  buildPublicChatSystemPrompt,
  buildRfpSummarizePrompt,
} from "./prompt-helpers";
import {
  createOutlookEvent,
  updateOutlookEvent,
  deleteOutlookEvent,
  exchangeCodeForTokens,
  saveOutlookToken,
  deleteOutlookToken,
  getOutlookToken,
} from "./outlook-calendar";

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
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
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
          timezone: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { timezone, ...eventData } = input;
        const eventId = await db.createEvent({ ...eventData, userId: ctx.user.id });
        // Silently sync to Outlook if connected
        try {
          const outlookId = await createOutlookEvent(ctx.user.id, {
            title: input.title,
            description: input.description,
            date: input.date,
            startTime: input.startTime,
            endTime: input.endTime,
            allDay: input.allDay,
            timezone,
          });
          if (outlookId) {
            await db.updateEvent(eventId, ctx.user.id, { outlookEventId: outlookId });
          }
        } catch (err) {
          console.error("[Outlook] Auto-sync create failed (non-fatal):", err);
        }
        return eventId;
      }),
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
          timezone: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, timezone, ...data } = input;
        await db.updateEvent(id, ctx.user.id, data);
        // Silently sync to Outlook if connected
        try {
          const existing = await db.getEventById(id, ctx.user.id);
          if (existing?.outlookEventId) {
            await updateOutlookEvent(ctx.user.id, existing.outlookEventId, {
              title: data.title ?? existing.title,
              description: data.description ?? existing.description ?? undefined,
              date: data.date ?? existing.date,
              startTime: data.startTime ?? existing.startTime ?? undefined,
              endTime: data.endTime ?? existing.endTime ?? undefined,
              allDay: data.allDay ?? existing.allDay,
              timezone,
            });
          }
        } catch (err) {
          console.error("[Outlook] Auto-sync update failed (non-fatal):", err);
        }
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Silently delete from Outlook if connected
        try {
          const existing = await db.getEventById(input.id, ctx.user.id);
          if (existing?.outlookEventId) {
            await deleteOutlookEvent(ctx.user.id, existing.outlookEventId);
          }
        } catch (err) {
          console.error("[Outlook] Auto-sync delete failed (non-fatal):", err);
        }
        return db.deleteEvent(input.id, ctx.user.id);
      }),
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
        // Save user message
        await db.saveChatMessage({
          userId: ctx.user.id,
          role: "user",
          content: input.message,
        });

        // Fetch context data for AI
        const [userEvents, userRfps, userDeals, userBrokers] =
          await Promise.all([
            db.getUserEvents(ctx.user.id),
            db.getUserRfps(ctx.user.id),
            db.getUserDeals(ctx.user.id),
            db.getUserBrokers(ctx.user.id),
          ]);

        const today = getLocalDate(input.timezone, input.localDate);
        const dayOfWeek = getDayOfWeek(today);

        const systemPrompt = buildChatSystemPrompt({
          today,
          dayOfWeek,
          userEvents,
          userRfps,
          userDeals,
          userBrokers,
        });

        // Get recent chat history for context
        const recentHistory = await db.getChatHistory(
          ctx.user.id,
          10
        );
        const chatContext = recentHistory
          .reverse()
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            ...chatContext.slice(0, -1),
            { role: "user", content: input.message },
          ],
        });

        const rawContent = response.choices[0]?.message?.content;
        const aiContent =
          typeof rawContent === "string"
            ? rawContent
            : "I'm sorry, I couldn't process that.";

        // Parse and execute actions
        const actionRegex = /<action>(.*?)<\/action>/gs;
        let match;
        const executedActions: Array<{
          type: string;
          result: unknown;
          data?: Record<string, unknown>;
        }> = [];

        while ((match = actionRegex.exec(aiContent)) !== null) {
          try {
            const action = JSON.parse(match[1]);
            let result: unknown;

            switch (action.type) {
              case "create_event": {
                const { reminderMinutes, ...eventData } =
                  action.data;
                result = await db.createEvent({
                  ...eventData,
                  userId: ctx.user.id,
                });
                executedActions.push({
                  type: "create_event",
                  result,
                  data: {
                    ...eventData,
                    id: result,
                    reminderMinutes: reminderMinutes || 0,
                  },
                });
                break;
              }
              case "create_rfp":
                result = await db.createRfp({
                  ...action.data,
                  userId: ctx.user.id,
                });
                executedActions.push({
                  type: "create_rfp",
                  result,
                });
                break;
              case "create_deal":
                result = await db.createDeal({
                  ...action.data,
                  userId: ctx.user.id,
                });
                executedActions.push({
                  type: "create_deal",
                  result,
                });
                break;
              case "update_event":
                await db.updateEvent(
                  action.data.id,
                  ctx.user.id,
                  action.data
                );
                executedActions.push({
                  type: "update_event",
                  result: action.data.id,
                });
                break;
              case "update_rfp":
                await db.updateRfp(
                  action.data.id,
                  ctx.user.id,
                  action.data
                );
                executedActions.push({
                  type: "update_rfp",
                  result: action.data.id,
                });
                break;
              case "update_deal":
                await db.updateDeal(
                  action.data.id,
                  ctx.user.id,
                  action.data
                );
                executedActions.push({
                  type: "update_deal",
                  result: action.data.id,
                });
                break;
            }
          } catch (e) {
            console.error("Failed to execute action:", e);
          }
        }

        // Clean the response of action tags for display
        const cleanContent = aiContent
          .replace(/<action>.*?<\/action>/gs, "")
          .trim();

        // Save assistant message
        await db.saveChatMessage({
          userId: ctx.user.id,
          role: "assistant",
          content: cleanContent,
        });

        return {
          message: cleanContent,
          actions: executedActions,
        };
      }),
  }),

  // ─── Public AI Chat (no auth required) ─────────────────
  publicChat: router({
    send: publicProcedure
      .input(
        z.object({
          message: z.string().min(1),
          events: z.string().optional(),
          rfps: z.string().optional(),
          deals: z.string().optional(),
          brokers: z.string().optional(),
          chatHistory: z.string().optional(),
          timezone: z.string().optional(),
          localDate: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const today = getLocalDate(input.timezone, input.localDate);
        const dayOfWeek = getDayOfWeek(today);

        const userEvents = input.events
          ? JSON.parse(input.events)
          : [];
        const userRfps = input.rfps
          ? JSON.parse(input.rfps)
          : [];
        const userDeals = input.deals
          ? JSON.parse(input.deals)
          : [];
        const userBrokers = input.brokers
          ? JSON.parse(input.brokers)
          : [];
        const chatHistory = input.chatHistory
          ? JSON.parse(input.chatHistory)
          : [];

        const systemPrompt = buildPublicChatSystemPrompt({
          today,
          dayOfWeek,
          userEvents,
          userRfps,
          userDeals,
          userBrokers,
        });

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            ...chatHistory
              .slice(-10)
              .map((m: any) => ({
                role: m.role,
                content: m.content,
              })),
            { role: "user", content: input.message },
          ],
        });

        const rawContent = response.choices[0]?.message?.content;
        const aiContent =
          typeof rawContent === "string"
            ? rawContent
            : "I'm sorry, I couldn't process that.";

        // Parse actions for the client to execute locally
        const actionRegex = /<action>(.*?)<\/action>/gs;
        let actionMatch;
        const parsedActions: Array<{
          type: string;
          data: Record<string, unknown>;
        }> = [];

        while (
          (actionMatch = actionRegex.exec(aiContent)) !== null
        ) {
          try {
            const action = JSON.parse(actionMatch[1]);
            parsedActions.push({
              type: action.type,
              data: action.data,
            });
          } catch (e) {
            console.error("Failed to parse action:", e);
          }
        }

        const cleanContent = aiContent
          .replace(/<action>.*?<\/action>/gs, "")
          .trim();

        return {
          message: cleanContent,
          actions: parsedActions,
        };
      }),
  }),

  // ─── RFP Summarization ─────────────────────────────────
  rfpSummarize: router({
    summarize: publicProcedure
      .input(
        z.object({
          text: z.string().min(1),
          localDate: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const systemContent = buildRfpSummarizePrompt(
          input.localDate
        );

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemContent },
            { role: "user", content: input.text },
          ],
        });

        const rawContent = response.choices[0]?.message?.content;
        const content =
          typeof rawContent === "string" ? rawContent : "{}";

        try {
          const jsonStr = content
            .replace(/```json?\n?/g, "")
            .replace(/```/g, "")
            .trim();
          const parsed = JSON.parse(jsonStr);
          return {
            title: parsed.title || null,
            client: parsed.client || null,
            brokerContact: parsed.brokerContact || null,
            lives: parsed.lives || null,
            effectiveDate: parsed.effectiveDate || null,
            premium: parsed.premium || null,
            followUpDate: parsed.followUpDate || null,
            notes: parsed.notes || null,
          };
        } catch {
          return {
            title: null,
            client: null,
            brokerContact: null,
            lives: null,
            effectiveDate: null,
            premium: null,
            followUpDate: null,
            notes: content.slice(0, 500),
          };
        }
      }),
  }),

  // ─── PDF Generation ────────────────────────────────────
  pdf: router({
    attackPlan: publicProcedure
      .input(
        z.object({
          events: z.array(
            z.object({
              title: z.string(),
              date: z.string(),
              startTime: z.string().optional(),
              endTime: z.string().optional(),
              description: z.string().optional(),
              reminderMinutes: z.number().optional(),
            })
          ),
          rfps: z.array(
            z.object({
              title: z.string(),
              client: z.string(),
              status: z.string(),
              value: z.string().optional(),
              deadline: z.string().optional(),
              summary: z.string().optional(),
              notes: z.string().optional(),
            })
          ),
          deals: z.array(
            z.object({
              title: z.string(),
              client: z.string(),
              stage: z.string(),
              value: z.string().optional(),
              expectedCloseDate: z.string().optional(),
            })
          ),
          date: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const { generateAttackPlanPDF } = await import(
          "./pdf-generator"
        );
        const pdfBuffer = await generateAttackPlanPDF(input);
        const base64 = pdfBuffer.toString("base64");
        return { pdfBase64: base64 };
      }),
  }),

  // ─── Bulk Sync (local → cloud migration) ────────────────
  sync: router({
    importAll: protectedProcedure
      .input(
        z.object({
          events: z.array(
            z.object({
              title: z.string(),
              description: z.string().optional(),
              date: z.string(),
              startTime: z.string().optional(),
              endTime: z.string().optional(),
              reminderMinutes: z.number().optional(),
              sourceType: z.string().optional(),
              sourceRfpId: z.string().optional(),
            })
          ).optional(),
          rfps: z.array(
            z.object({
              title: z.string(),
              client: z.string(),
              brokerContact: z.string().optional(),
              lives: z.number().optional(),
              effectiveDate: z.string().optional(),
              premium: z.string().optional(),
              status: z.enum(["draft", "recommended", "sold"]).optional(),
              notes: z.string().optional(),
              description: z.string().optional(),
              followUpDate: z.string().optional(),
            })
          ).optional(),
          deals: z.array(
            z.object({
              title: z.string(),
              client: z.string(),
              stage: z.enum(["lead", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"]).optional(),
              value: z.string().optional(),
              expectedCloseDate: z.string().optional(),
              description: z.string().optional(),
            })
          ).optional(),
          brokers: z.array(
            z.object({
              name: z.string(),
              company: z.string().optional(),
              phone: z.string().optional(),
              email: z.string().optional(),
              notes: z.array(
                z.object({ content: z.string() })
              ).optional(),
            })
          ).optional(),
          salesGoal: z.object({
            currentSales: z.string().optional(),
            goalAmount: z.string().optional(),
            goalDeadline: z.string().optional(),
          }).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user.id;
        const results = { events: 0, rfps: 0, deals: 0, brokers: 0, salesGoal: false };

        // Import events
        if (input.events && input.events.length > 0) {
          for (const e of input.events) {
            try {
              await db.createEvent({
                userId,
                title: e.title,
                description: e.description,
                date: e.date,
                startTime: e.startTime,
                endTime: e.endTime,
                reminderMinutes: e.reminderMinutes,
                sourceType: e.sourceType,
                sourceRfpId: e.sourceRfpId ? parseInt(e.sourceRfpId) : undefined,
              });
              results.events++;
            } catch (err) {
              console.error("[Sync] Failed to import event:", err);
            }
          }
        }

        // Import RFPs
        if (input.rfps && input.rfps.length > 0) {
          for (const r of input.rfps) {
            try {
              await db.createRfp({
                userId,
                title: r.title,
                clientName: r.client,
                brokerContact: r.brokerContact,
                lives: r.lives,
                effectiveDate: r.effectiveDate,
                premium: r.premium,
                status: r.status || "draft",
                notes: r.notes,
                description: r.description,
                followUpDate: r.followUpDate,
              });
              results.rfps++;
            } catch (err) {
              console.error("[Sync] Failed to import RFP:", err);
            }
          }
        }

        // Import deals
        if (input.deals && input.deals.length > 0) {
          for (const d of input.deals) {
            try {
              await db.createDeal({
                userId,
                title: d.title,
                clientName: d.client,
                stage: d.stage || "lead",
                value: d.value,
                expectedCloseDate: d.expectedCloseDate,
                description: d.description,
              });
              results.deals++;
            } catch (err) {
              console.error("[Sync] Failed to import deal:", err);
            }
          }
        }

        // Import brokers
        if (input.brokers && input.brokers.length > 0) {
          for (const b of input.brokers) {
            try {
              const brokerId = await db.createBroker({
                userId,
                name: b.name,
                company: b.company,
                phone: b.phone,
                email: b.email,
              });
              // Import broker notes
              if (b.notes && b.notes.length > 0) {
                for (const n of b.notes) {
                  try {
                    await db.addBrokerNote({
                      brokerId,
                      userId,
                      content: n.content,
                    });
                  } catch (noteErr) {
                    console.error("[Sync] Failed to import broker note:", noteErr);
                  }
                }
              }
              results.brokers++;
            } catch (err) {
              console.error("[Sync] Failed to import broker:", err);
            }
          }
        }

        // Import sales goal
        if (input.salesGoal) {
          try {
            await db.upsertSalesGoal(userId, {
              currentSales: input.salesGoal.currentSales,
              goalAmount: input.salesGoal.goalAmount,
              goalDeadline: input.salesGoal.goalDeadline,
            });
            results.salesGoal = true;
          } catch (err) {
            console.error("[Sync] Failed to import sales goal:", err);
          }
        }

        return results;
      }),
  }),

  // ─── Voice Transcription ───────────────────────────────
  voice: router({
    transcribe: publicProcedure
      .input(
        z.object({
          audioBase64: z.string(),
          mimeType: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.audioBase64, "base64");
        const ext = input.mimeType?.includes("webm")
          ? "webm"
          : input.mimeType?.includes("mp4")
            ? "m4a"
            : "webm";
        const key =
          "voice/" +
          Date.now() +
          "-" +
          Math.random().toString(36).slice(2) +
          "." +
          ext;
        const { url } = await storagePut(
          key,
          buffer,
          input.mimeType || "audio/webm"
        );

        const result = await transcribeAudio({
          audioUrl: url,
          language: "en",
        });

        return {
          text:
            "text" in result
              ? result.text
              : "Transcription failed",
        };
      }),
  }),

  // ─── Outlook Calendar Integration ─────────────────────
  outlook: router({
    /** Returns connection status + connected email */
    status: protectedProcedure.query(async ({ ctx }) => {
      const token = await getOutlookToken(ctx.user.id);
      return {
        connected: !!token,
        email: token?.outlookEmail ?? null,
      };
    }),

    /** Exchange the auth code from the client for tokens and save them */
    connect: protectedProcedure
      .input(z.object({
        code: z.string(),
        redirectUri: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const clientId = process.env.MICROSOFT_CLIENT_ID;
        const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
          throw new Error("Microsoft OAuth credentials not configured on the server.");
        }
        const tokens = await exchangeCodeForTokens(input.code, input.redirectUri);
        await saveOutlookToken(ctx.user.id, tokens);
        return { success: true, email: tokens.outlookEmail ?? null };
      }),

    /** Disconnect Outlook — removes stored tokens */
    disconnect: protectedProcedure.mutation(async ({ ctx }) => {
      await deleteOutlookToken(ctx.user.id);
      return { success: true };
    }),

    /** Get the Microsoft OAuth authorization URL to start the login flow */
    getAuthUrl: protectedProcedure
      .input(z.object({ redirectUri: z.string() }))
      .query(({ input }) => {
        const clientId = process.env.MICROSOFT_CLIENT_ID ?? "";
        const tenantId = process.env.MICROSOFT_TENANT_ID ?? "common";
        const url = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
        url.searchParams.set("client_id", clientId);
        url.searchParams.set("response_type", "code");
        url.searchParams.set("redirect_uri", input.redirectUri);
        url.searchParams.set("scope", "Calendars.ReadWrite offline_access User.Read");
        url.searchParams.set("response_mode", "query");
        url.searchParams.set("prompt", "select_account");
        return { url: url.toString() };
      }),
  }),
});

export type AppRouter = typeof appRouter;
