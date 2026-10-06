import { NextRequest, NextResponse } from "next/server";
import { getUsersData, updateUserPermissions, PERMISSION_KEYS } from "@/lib/users";
import { listRoles } from "@/lib/roles";
import { audit } from "@/lib/audit";

export async function GET() {
  try {
    const [users, roles] = await Promise.all([getUsersData(), listRoles()]);
    const roleMap = new Map(roles.map((r) => [r.key, r]));
    // Hash password tidak perlu sampai ke browser.
    return NextResponse.json(
      users.map(({ password, ...rest }) => {
        const role = roleMap.get(rest.role);
        // Permission yang berbeda dari template role-nya (+ = tambahan, - = kurang).
        const deviations = role
          ? PERMISSION_KEYS.filter((k) => (rest[k] === "TRUE") !== (role.perms[k] === "TRUE")).map(
              (k) => `${rest[k] === "TRUE" ? "+" : "-"}${k}`
            )
          : [];
        return { ...rest, role_name: role?.name || rest.role, deviations };
      })
    );
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
    audit(request, "UPDATE", `Mengubah permission user ${id}: ${Object.entries(permissions || {}).map(([k, v]) => `${v ? "+" : "-"}${k}`).join(", ")}`, "user", String(id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
