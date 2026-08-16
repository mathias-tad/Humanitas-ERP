import { ActionMenu } from "@/components/ActionMenu";
import { LucideEye } from "lucide-react";

function Accounts() {
  return (
    <>
      <div className="p-4 w-full mx-auto">
        <h1 className="text-xl font-bold text-foreground mb-4">Employees List</h1>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          {/* You can add filters or search bars here in the future */}
          <div className="flex items-center gap-4">
            <input
              type="text"
              placeholder="Search employees..."
              className="px-4 py-2 border border-input bg-background text-foreground rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select className="px-3 py-2 border border-input rounded-lg bg-background text-foreground">
              <option value="">All Departments</option>
              <option value="development">Development</option>
              <option value="product">Product</option>
              <option value="hr">HR</option>
            </select>
            <select className="px-3 py-2 border border-input rounded-lg bg-background text-foreground">
              <option value="">All States</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <button className="text-sm text-destructive hover:underline">
              Reset
            </button>
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors shadow-sm">
              Add User
            </button>
          </div>
        </div>
        <div className="overflow-x-auto bg-card shadow-sm rounded-lg border border-border">
          <table className="min-w-full table-auto">
            <thead className="bg-muted text-muted-foreground text-sm uppercase">
              <tr>
                <th className="px-6 py-3 text-left"></th>
                <th className="px-6 py-3 text-left">Name</th>
                <th className="px-6 py-3 text-left">Position</th>
                <th className="px-6 py-3 text-left">Department</th>
                <th className="px-6 py-3 text-left">KPI</th>
                <th className="px-6 py-3 text-left">State</th>
                <th className="px-6 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr className="hover:bg-muted/50 transition-colors">
                <td className="px-6 py-4">
                  <img className="w-12 h-12 rounded-full object-cover border border-border" />
                </td>
                <td className="px-6 py-4 text-foreground">John Doe</td>
                <td className="px-6 py-4 text-muted-foreground">Software Engineer</td>
                <td className="px-6 py-4 text-muted-foreground">Development</td>
                <td className="px-6 py-4 text-muted-foreground">90%</td>
                <td className="px-6 py-4">
                  <span className="px-3 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                    Active
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-4 text-primary">
                    <ActionMenu />
                    <span>|</span>
                    <LucideEye
                      size={20}
                      className="cursor-pointer hover:text-primary/80"
                    />
                  </div>
                </td>
              </tr>
              <tr className="hover:bg-muted/50 transition-colors">
                <td className="px-6 py-4">
                  <img className="w-12 h-12 rounded-full object-cover border border-border" />
                </td>
                <td className="px-6 py-4 text-foreground">Jane Smith</td>
                <td className="px-6 py-4 text-muted-foreground">Product Manager</td>
                <td className="px-6 py-4 text-muted-foreground">Product</td>
                <td className="px-6 py-4 text-muted-foreground">80%</td>
                <td className="px-6 py-4">
                  <span className="px-3 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                    Inactive
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-4 text-primary">
                    <ActionMenu />
                    <span>|</span>
                    <LucideEye
                      size={20}
                      className="cursor-pointer hover:text-primary/80"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
export default Accounts;
