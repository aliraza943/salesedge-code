/**
 * Email/password auth with MongoDB.
 * Users collection; JWT for sessions.
 * Forgot-password: security question ("What city were you born in?"); answer stored hashed at signup.
 */

import crypto from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { ObjectId } from "mongodb";
import type { Request, Response } from "express";
import { getDb } from "./mongo-client";

const COLLECTION_USERS = "users";
const JWT_SECRET = process.env.JWT_SECRET || "salesedge-dev-secret-change-in-production";
const SALT_LEN = 16;
const KEY_LEN = 64;
const RESET_TOKEN_EXPIRY_MINUTES = 15;
const FORGOT_PASSWORD_RATE_LIMIT_SECONDS = 60;
const SECURITY_QUESTION = "What city were you born in?";

/** In-memory rate limit: email -> last request timestamp (ms). */
const forgotPasswordRateLimit = new Map<string, number>();

export type UserDocument = {
  _id?: ObjectId;
  name: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  /** Hashed answer to security question (set at signup). */
  securityAnswerHash?: string;
};

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

async function getUsersCol() {
  const db = await getDb();
  return db.collection<UserDocument>(COLLECTION_USERS);
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LEN).toString("hex");
  const hash = crypto.scryptSync(password, salt, KEY_LEN).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const computed = crypto.scryptSync(password, salt, KEY_LEN).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(computed, "hex"));
}

async function signToken(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<string | null> {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const sub = payload.sub;
    return typeof sub === "string" ? sub : null;
  } catch {
    return null;
  }
}

/** Sign a short-lived reset token (payload: email). */
async function signResetToken(email: string): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${RESET_TOKEN_EXPIRY_MINUTES}m`)
    .sign(secret);
}

/** Verify reset token; returns email or null. */
export async function verifyResetToken(token: string): Promise<string | null> {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const email = payload.email;
    return typeof email === "string" ? email : null;
  } catch {
    return null;
  }
}

/** Middleware: set req.userId from Authorization Bearer token. Does not block if missing. */
export async function authOptional(req: Request, _res: Response, next: () => void): Promise<void> {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (token) {
    const userId = await verifyToken(token);
    if (userId) req.userId = userId;
  }
  next();
}

/** Middleware: require auth; 401 if no valid token. */
export async function authRequired(req: Request, res: Response, next: () => void): Promise<void> {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const userId = await verifyToken(token);
  if (!userId) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  req.userId = userId;
  next();
}

function toUserResponse(doc: UserDocument & { _id: ObjectId }) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    username: doc.username,
    email: doc.email,
  };
}

export async function signup(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";
    const securityAnswer = typeof body.securityAnswer === "string" ? body.securityAnswer.trim() : "";

    if (!name || !username || !email || !password) {
      res.status(400).json({ error: "Name, username, email and password are required" });
      return;
    }
    if (!securityAnswer) {
      res.status(400).json({ error: "Security answer is required. It will be used if you forget your password." });
      return;
    }
    if (password !== confirmPassword) {
      res.status(400).json({ error: "Password and confirm password do not match" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    const col = await getUsersCol();
    const existingEmail = await col.findOne({ email });
    if (existingEmail) {
      res.status(400).json({ error: "An account with this email already exists" });
      return;
    }
    const existingUsername = await col.findOne({ username });
    if (existingUsername) {
      res.status(400).json({ error: "Username is already taken" });
      return;
    }

    const doc: UserDocument = {
      name,
      username,
      email,
      passwordHash: hashPassword(password),
      securityAnswerHash: hashPassword(securityAnswer),
      createdAt: new Date().toISOString(),
    };
    const result = await col.insertOne(doc as UserDocument & { _id?: ObjectId });
    const inserted = await col.findOne({ _id: result.insertedId });
    if (!inserted) {
      res.status(500).json({ error: "Failed to create user" });
      return;
    }
    const userId = (inserted as UserDocument & { _id: ObjectId })._id.toString();
    const token = await signToken(userId);
    res.status(201).json({
      token,
      user: toUserResponse(inserted as UserDocument & { _id: ObjectId }),
    });
  } catch (err) {
    console.error("[auth-mongo] signup error:", err);
    res.status(500).json({ error: "Sign up failed" });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const col = await getUsersCol();
    const user = await col.findOne({ email });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    const userId = (user as UserDocument & { _id: ObjectId })._id.toString();
    const token = await signToken(userId);
    res.json({
      token,
      user: toUserResponse(user as UserDocument & { _id: ObjectId }),
    });
  } catch (err) {
    console.error("[auth-mongo] login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
}

export async function me(req: Request, res: Response): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const col = await getUsersCol();
    const oid = new ObjectId(req.userId);
    const user = await col.findOne({ _id: oid });
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    res.json({ user: toUserResponse(user as UserDocument & { _id: ObjectId }) });
  } catch (err) {
    console.error("[auth-mongo] me error:", err);
    res.status(500).json({ error: "Failed to get user" });
  }
}

export async function logout(_req: Request, res: Response): Promise<void> {
  res.json({ ok: true });
}

/** POST /api/auth/forgot-password: validate email and return security question (no email sent). Rate-limited. */
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: "Please enter a valid email address" });
      return;
    }

    const now = Date.now();
    const last = forgotPasswordRateLimit.get(email) ?? 0;
    if (now - last < FORGOT_PASSWORD_RATE_LIMIT_SECONDS * 1000) {
      const waitSec = Math.ceil((FORGOT_PASSWORD_RATE_LIMIT_SECONDS * 1000 - (now - last)) / 1000);
      res.status(429).json({
        error: `Please wait ${waitSec} seconds before trying again`,
      });
      return;
    }

    const col = await getUsersCol();
    const user = await col.findOne({ email });
    if (!user) {
      res.status(404).json({
        error: "This account is not present in our system. Please try with a registered email address.",
      });
      return;
    }

    const doc = user as UserDocument & { _id: ObjectId };
    if (!doc.securityAnswerHash) {
      res.status(400).json({
        error: "This account does not have a security answer set. Please contact support.",
      });
      return;
    }

    forgotPasswordRateLimit.set(email, now);
    res.status(200).json({ success: true, securityQuestion: SECURITY_QUESTION });
  } catch (err) {
    console.error("[auth-mongo] forgotPassword error:", err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}

/** POST /api/auth/verify-security-answer: validate answer and return short-lived reset token. */
export async function verifySecurityAnswer(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const answer = typeof body.answer === "string" ? body.answer.trim() : "";

    if (!email || !answer) {
      res.status(400).json({ error: "Email and security answer are required" });
      return;
    }

    const col = await getUsersCol();
    const user = await col.findOne({ email });
    if (!user) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const doc = user as UserDocument & { _id: ObjectId };
    if (!doc.securityAnswerHash) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    if (!verifyPassword(answer, doc.securityAnswerHash)) {
      res.status(400).json({ error: "Security answer is incorrect. Please try again." });
      return;
    }

    const resetToken = await signResetToken(email);
    res.status(200).json({ success: true, resetToken });
  } catch (err) {
    console.error("[auth-mongo] verifySecurityAnswer error:", err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}

/** POST /api/auth/reset-password: update password using reset token; clears OTP. */
export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as Record<string, unknown>;
    const resetToken = typeof body.resetToken === "string" ? body.resetToken.trim() : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

    if (!resetToken) {
      res.status(400).json({ error: "Reset token is required" });
      return;
    }
    if (!newPassword) {
      res.status(400).json({ error: "New password is required" });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    const email = await verifyResetToken(resetToken);
    if (!email) {
      res.status(400).json({ error: "Invalid or expired reset link. Please request a new code." });
      return;
    }

    const col = await getUsersCol();
    const user = await col.findOne({ email });
    if (!user) {
      res.status(400).json({ error: "Invalid or expired reset link." });
      return;
    }

    const hashed = hashPassword(newPassword);

    await col.updateOne(
      { email },
      { $set: { passwordHash: hashed } },
    );

    res.status(200).json({ success: true, message: "Password has been reset. You can sign in with your new password." });
  } catch (err) {
    console.error("[auth-mongo] resetPassword error:", err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}

/** Permanently delete the authenticated user and all their data. */
export async function deleteAccount(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const db = await getDb();
    const oid = new ObjectId(userId);

    await db.collection("events").deleteMany({ userId });
    await db.collection("rfps").deleteMany({ userId });
    await db.collection("deals").deleteMany({ userId });
    await db.collection("brokers").deleteMany({ userId });
    await db.collection("chatMessages").deleteMany({ userId });
    await db.collection("salesGoal").deleteOne({ _id: userId });
    await db.collection("rfp_field_labels").deleteOne({ _id: userId });
    await db.collection(COLLECTION_USERS).deleteOne({ _id: oid });

    res.json({ ok: true });
  } catch (err) {
    console.error("[auth-mongo] deleteAccount error:", err);
    res.status(500).json({ error: "Failed to delete account" });
  }
}

export function registerAuthRoutes(app: import("express").Express): void {
  app.post("/api/auth/signup", signup);
  app.post("/api/auth/login", login);
  app.post("/api/auth/forgot-password", forgotPassword);
  app.post("/api/auth/verify-security-answer", verifySecurityAnswer);
  app.post("/api/auth/reset-password", resetPassword);
  app.get("/api/auth/me", authRequired, me);
  app.post("/api/auth/logout", logout);
  app.delete("/api/auth/account", authRequired, deleteAccount);
}
