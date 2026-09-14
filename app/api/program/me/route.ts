import { NextResponse } from "next/server";
import { authenticateProgramRequest } from "@/lib/program-auth";

export async function GET(request: Request) {
  const result = await authenticateProgramRequest(request);
  if ("response" in result) return result.response;

  const { user } = result;
  return NextResponse.json({ id: user.id, username: user.username, name: user.name });
}
