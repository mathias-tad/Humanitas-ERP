import { describe, expect, it } from "vitest";
import { visiblePermissions, type PermissionCatalogEntry } from "./permissionCatalog";

const entries: PermissionCatalogEntry[] = [
  { id: "view_users", label: "View Users", group: "Users", module: "core" },
  { id: "view_payroll", label: "View Payroll", group: "Payroll", module: "hrms" },
  { id: "view_products", label: "View Products", group: "Products", module: "products" },
];

describe("visiblePermissions", () => {
  it("always shows core permissions and only those of subscribed modules", () => {
    const shown = visiblePermissions(entries, (m) => m === "products").map((p) => p.id);
    expect(shown).toEqual(["view_users", "view_products"]);
  });

  it("puts each permission under its group in the matrix", () => {
    expect(visiblePermissions(entries, () => true)[1]).toEqual({ id: "view_payroll", name: "view_payroll", label: "View Payroll", module: "Payroll" });
  });

  it("shows nothing while the catalog is loading", () => {
    expect(visiblePermissions(undefined, () => true)).toEqual([]);
  });
});
