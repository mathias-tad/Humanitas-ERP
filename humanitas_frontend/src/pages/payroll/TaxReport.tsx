import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, TrendingUp, DollarSign } from "lucide-react";

const reports = [
  {
    title: "Annual Tax Summary",
    description: "Consolidated tax report for the fiscal year 2025",
    date: "Generated on Nov 30, 2025",
    size: "2.4 MB",
  },
  {
    title: "Quarterly 941 Report",
    description: "Employer's Quarterly Federal Tax Return (Q3 2025)",
    date: "Generated on Oct 15, 2025",
    size: "1.1 MB",
  },
  {
    title: "State Unemployment Tax",
    description: "State unemployment insurance tax report",
    date: "Generated on Oct 15, 2025",
    size: "0.8 MB",
  },
  {
    title: "W-2 Preview",
    description: "Preview of employee W-2 forms for verification",
    date: "Generated on Nov 30, 2025",
    size: "4.5 MB",
  },
];

export default function TaxReports() {
  return (
    <>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tax Reports</h1>
            <p className="text-gray-500 mt-1">
              Generate and download tax documents
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-blue-50 border-blue-100">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-medium text-primary-foreground/90">
                  Total Tax Liability
                </p>
              </div>
              <p className="text-2xl font-bold text-primary-foreground">$284,500.00</p>
              <p className="text-xs text-primary-foreground/80 mt-1">YTD 2025</p>
            </CardContent>
          </Card>
          <Card className="bg-green-50 border-green-100">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <p className="text-sm font-medium text-green-900">
                  Paid to Date
                </p>
              </div>
              <p className="text-2xl font-bold text-green-900">$260,000.00</p>
              <p className="text-xs text-green-700 mt-1">
                Last payment: Nov 15
              </p>
            </CardContent>
          </Card>
          <Card className="bg-orange-50 border-orange-100">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <FileText className="h-5 w-5 text-orange-600" />
                </div>
                <p className="text-sm font-medium text-orange-900">
                  Pending Filing
                </p>
              </div>
              <p className="text-2xl font-bold text-orange-900">$24,500.00</p>
              <p className="text-xs text-orange-700 mt-1">Due by Dec 15</p>
            </CardContent>
          </Card>
        </div>

        {/* Reports List */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-lg">Available Reports</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {reports.map((report, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 hover:bg-gray-50"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <FileText className="h-6 w-6 text-gray-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {report.title}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {report.description}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        <span>{report.date}</span>
                        <span>•</span>
                        <span>{report.size}</span>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
