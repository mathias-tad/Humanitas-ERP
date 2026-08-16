
function PayrollDashboard() {
  return (
    <>
      <div className="w-full">
        <p className="text-2xl font-bold">Payroll Dashboard</p>
        <div className="w-full flex gap-2">
          <div className="flex flex-col gap-2 items-center border p-2 rounded bg-white">
            <p>0</p>
            <p className="font-bold">Total Salary Paid</p>
          </div>
          <div className="flex flex-col gap-2 items-center border p-2 rounded bg-white">
            <p>0</p>
            <p className="font-bold">This Month</p>
          </div>
        </div>
      </div>
    </>
  );
}
export default PayrollDashboard;
