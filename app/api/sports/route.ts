import { NextResponse } from "next/server";
import { getSports } from "@/data/selectors";

export async function GET() {
  return NextResponse.json({ sports: getSports() });
}
