import { NextRequest, NextResponse } from "next/server";
import { getUsersData, updateUserPermissions } from "@/lib/users";

export async function GET() {
  try {
    const users = await getUsersData();
    // Hash password tidak perlu sampai ke browser.
    return NextResponse.json(users.map(({ password, ...rest }) => rest));
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, permissions } = await request.json();
    const ok = await updateUserPermissions(String(id), permissions || {});
    if (!ok) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
