import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";

const encoder = new TextEncoder();
const key = encoder.encode(env.JWT_SECRET);

export type Session = { storeId: string; code4: string; isAdmin?: boolean };

export async function signSession(session: Session) {
  return await new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);
}

export async function verifySession(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, key);
    return payload as any;
  } catch {
    return null;
  }
}
