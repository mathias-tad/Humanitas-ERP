import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface BankTransferEmployeeItem {
  userId: string;
  employeeName: string;
  email?: string;
  department?: string;
  accountNumber: string;
  bankName?: string;
  bankCode?: string;
  routingNumber?: string;
  netSalary: number;
}

export type BankTransferFormat =
  | 'nacha'
  | 'aba'
  | 'cbe'
  | 'awash'
  | 'dashen'
  | 'generic';

export interface ExportResult {
  content: string;
  contentType: string;
  filename: string;
  recordCount: number;
  totalAmount: number;
}

@Injectable()
export class BankTransferExportService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Fetch approved/calculated payroll records with employee banking details for the specified month/year.
   */
  async getPayrollBankRecords(
    tenantId: string,
    month: number,
    year: number,
    companyId?: string,
    branchId?: string,
  ): Promise<BankTransferEmployeeItem[]> {
    const conn = await this.databaseService.getTenantConnectionById(tenantId);

    let query = `
      SELECT pi.id, pi.user_id, pi.net_salary,
             u.full_name as employee_name, u.email, u.department,
             COALESCE(u.account_number, '') as account_number,
             COALESCE(u.bank_name, 'Default Bank') as bank_name,
             COALESCE(u.bank_code, '000000000') as bank_code
      FROM payroll_items pi
      JOIN users u ON pi.user_id = u.id
      JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
      WHERE pr.month = $1 AND pr.year = $2
    `;

    const params: any[] = [month, year];
    let paramIdx = 3;

    if (companyId) {
      query += ` AND (u.company_id = $${paramIdx++} OR pr.company_id = $${paramIdx - 1})`;
      params.push(companyId);
    }
    if (branchId) {
      query += ` AND (u.branch_id = $${paramIdx++} OR pr.branch_id = $${paramIdx - 1})`;
      params.push(branchId);
    }

    query += ` ORDER BY u.full_name ASC`;

    const rows = (await conn.query(query, params)) || [];

    return rows.map((r: any) => ({
      userId: r.user_id,
      employeeName: r.employee_name || 'Employee',
      email: r.email,
      department: r.department,
      accountNumber: String(r.account_number || '').trim(),
      bankName: r.bank_name || 'Bank',
      bankCode: r.bank_code || '000000000',
      routingNumber: r.bank_code || '123456780',
      netSalary: parseFloat(r.net_salary) || 0,
    }));
  }

  /**
   * Main export dispatcher generating the requested banking format.
   */
  async generateBankTransferFile(
    tenantId: string,
    month: number,
    year: number,
    format: BankTransferFormat,
    companyName: string = 'Humanitas Enterprise',
    companyId?: string,
    branchId?: string,
  ): Promise<ExportResult> {
    const records = await this.getPayrollBankRecords(tenantId, month, year, companyId, branchId);

    if (records.length === 0) {
      throw new BadRequestException(
        `No payroll records found for ${month}/${year} to generate a bank transfer file.`,
      );
    }

    const totalAmount = records.reduce((sum, r) => sum + r.netSalary, 0);
    const dateStr = `${year}_${String(month).padStart(2, '0')}`;

    switch (format) {
      case 'nacha': {
        const content = this.generateNachaFile(records, companyName, month, year);
        return {
          content,
          contentType: 'text/plain',
          filename: `NACHA_PAYROLL_${dateStr}.ach`,
          recordCount: records.length,
          totalAmount,
        };
      }

      case 'aba': {
        const content = this.generateAbaFile(records, companyName, month, year);
        return {
          content,
          contentType: 'text/plain',
          filename: `ABA_PAYROLL_${dateStr}.aba`,
          recordCount: records.length,
          totalAmount,
        };
      }

      case 'cbe': {
        const content = this.generateCbeCsv(records, month, year);
        return {
          content,
          contentType: 'text/csv;charset=utf-8',
          filename: `CBE_SALARY_TRANSFER_${dateStr}.csv`,
          recordCount: records.length,
          totalAmount,
        };
      }

      case 'awash': {
        const content = this.generateAwashCsv(records, month, year);
        return {
          content,
          contentType: 'text/csv;charset=utf-8',
          filename: `AWASH_BANK_SALARY_${dateStr}.csv`,
          recordCount: records.length,
          totalAmount,
        };
      }

      case 'dashen': {
        const content = this.generateDashenCsv(records, month, year);
        return {
          content,
          contentType: 'text/csv;charset=utf-8',
          filename: `DASHEN_SALARY_TRANSFER_${dateStr}.csv`,
          recordCount: records.length,
          totalAmount,
        };
      }

      case 'generic':
      default: {
        const content = this.generateGenericCsv(records, month, year);
        return {
          content,
          contentType: 'text/csv;charset=utf-8',
          filename: `BANK_TRANSFER_BATCH_${dateStr}.csv`,
          recordCount: records.length,
          totalAmount,
        };
      }
    }
  }

  // =========================================================================
  // 1. NACHA ACH Fixed-Width (94 characters per record)
  // =========================================================================
  private generateNachaFile(
    records: BankTransferEmployeeItem[],
    companyName: string,
    month: number,
    year: number,
  ): string {
    const lines: string[] = [];
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const fileDate = `${yy}${mm}${dd}`;
    const fileTime = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

    // Record Type 1: File Header Record (94 chars)
    // 1(1) + Priority(2) + Dest(10) + Origin(10) + Date(6) + Time(4) + Modifier(1) + Size(3) + Block(2) + Format(1) + DestName(23) + OriginName(23) + Ref(8)
    const immediateDest = ' 123456780';
    const immediateOrigin = ' 987654321';
    const cleanCompName = companyName.slice(0, 23).padEnd(23, ' ');
    const bankDestName = 'FEDERAL RESERVE BANK   ';

    const fileHeader = `101${immediateDest}${immediateOrigin}${fileDate}${fileTime}A094101${bankDestName}${cleanCompName}        `;
    lines.push(fileHeader);

    // Record Type 5: Batch Header Record (94 chars)
    // 5(1) + ServiceClass(3) + CompName(16) + Discretionary(20) + CompId(10) + SEC(3) + EntryDesc(10) + DescDate(6) + EffDate(6) + Settlement(3) + Status(1) + DFI(8) + Batch(7)
    const batchCompName = companyName.slice(0, 16).padEnd(16, ' ');
    const compId = '1987654321';
    const effDate = `${String(year).slice(-2)}${String(month).padStart(2, '0')}01`;
    const batchHeader = `5220${batchCompName}${' '.repeat(20)}${compId}PPD` +
      `PAYROLL   ${fileDate}${effDate}   1123456780000001`;
    lines.push(batchHeader);

    // Record Type 6: Entry Detail Records (94 chars)
    let entryHashSum = 0;
    let totalCreditCents = 0;

    records.forEach((rec, idx) => {
      // 8-digit routing + 1 digit check digit
      const routing = (rec.bankCode || '12345678').replace(/\D/g, '').padEnd(8, '0').slice(0, 8);
      const checkDigit = this.calculateNachaCheckDigit(routing);
      entryHashSum += parseInt(routing, 10);

      const acctNum = rec.accountNumber.replace(/[^A-Za-z0-9]/g, '').slice(0, 17).padEnd(17, ' ');
      const amountCents = Math.round(rec.netSalary * 100);
      totalCreditCents += amountCents;
      const amtStr = String(amountCents).padStart(10, '0');

      const empId = rec.userId.replace(/[^A-Za-z0-9]/g, '').slice(0, 15).padEnd(15, ' ');
      const empName = rec.employeeName.slice(0, 22).padEnd(22, ' ');
      const traceNum = `12345678${String(idx + 1).padStart(7, '0')}`;

      // 6(1) + 22(2) + DFI(8) + CheckDigit(1) + DFI_Account(17) + Amount(10) + EmpID(15) + Name(22) + Disc(2) + Addenda(1) + Trace(15)
      const detailRecord = `622${routing}${checkDigit}${acctNum}${amtStr}${empId}${empName}  0${traceNum}`;
      lines.push(detailRecord);
    });

    // Record Type 8: Batch Control Record (94 chars)
    const entryCount = records.length;
    const entryCountStr = String(entryCount).padStart(6, '0');
    const hashStr = String(entryHashSum % 10000000000).padStart(10, '0');
    const totalCreditStr = String(totalCreditCents).padStart(12, '0');
    const totalDebitStr = '0'.padStart(12, '0');

    // 8(1) + 220(3) + Count(6) + Hash(10) + Debit(12) + Credit(12) + CompId(10) + Auth(19) + Reserved(6) + DFI(8) + Batch(7)
    const batchControl = `8220${entryCountStr}${hashStr}${totalDebitStr}${totalCreditStr}${compId}${' '.repeat(19)}${' '.repeat(6)}123456780000001`;
    lines.push(batchControl);

    // Record Type 9: File Control Record (94 chars)
    // Total lines so far = 1(header) + 1(batch header) + N(details) + 1(batch control) + 1(file control)
    const totalPhysicalRecords = lines.length + 1;
    const blockCount = Math.ceil(totalPhysicalRecords / 10);
    const blockCountStr = String(blockCount).padStart(6, '0');
    const fileEntryCountStr = String(entryCount).padStart(8, '0');

    const fileControl = `9000001${blockCountStr}${fileEntryCountStr}${hashStr}${totalDebitStr}${totalCreditStr}${' '.repeat(39)}`;
    lines.push(fileControl);

    // Padding to complete block of 10
    const linesNeeded = blockCount * 10 - lines.length;
    for (let p = 0; p < linesNeeded; p++) {
      lines.push('9'.repeat(94));
    }

    return lines.join('\r\n');
  }

  private calculateNachaCheckDigit(routing8: string): number {
    const weights = [3, 7, 1, 3, 7, 1, 3, 7];
    let sum = 0;
    for (let i = 0; i < 8; i++) {
      sum += (parseInt(routing8[i], 10) || 0) * weights[i];
    }
    return (10 - (sum % 10)) % 10;
  }

  // =========================================================================
  // 2. ABA (Australian / CEMTEX Standard)
  // =========================================================================
  private generateAbaFile(
    records: BankTransferEmployeeItem[],
    companyName: string,
    month: number,
    year: number,
  ): string {
    const lines: string[] = [];
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    const processDate = `${dd}${mm}${yy}`;

    // Record Type 0: Descriptive Record (120 chars)
    const fi = 'CBA';
    const userSupplying = companyName.slice(0, 26).padEnd(26, ' ');
    const apcaUserNum = '123456';
    const entryDesc = `PAYROLL ${month}/${year}`.slice(0, 12).padEnd(12, ' ');
    const descRecord = `0                 01${fi}      ${userSupplying}${apcaUserNum}${entryDesc}${processDate}${' '.repeat(40)}`;
    lines.push(descRecord);

    let totalCents = 0;

    records.forEach((rec) => {
      // Record Type 1: Detail Record (120 chars)
      const bsb = (rec.bankCode || '012-002').slice(0, 7).padEnd(7, ' ');
      const acct = rec.accountNumber.slice(0, 9).padStart(9, ' ');
      const indicator = ' ';
      const transCode = '53'; // Standard payroll credit
      const cents = Math.round(rec.netSalary * 100);
      totalCents += cents;
      const amountStr = String(cents).padStart(10, '0');
      const title = rec.employeeName.slice(0, 32).padEnd(32, ' ');
      const lodgement = `SALARY ${month}/${year}`.slice(0, 18).padEnd(18, ' ');
      const traceBsb = '012-002';
      const traceAcct = '123456789'.slice(0, 9).padStart(9, ' ');
      const remitter = companyName.slice(0, 16).padEnd(16, ' ');
      const tax = '00000000';

      const line = `1${bsb}${acct}${indicator}${transCode}${amountStr}${title}${lodgement}${traceBsb}${traceAcct}${remitter}${tax}`;
      lines.push(line);
    });

    // Record Type 7: Total Record (120 chars)
    const netTotalStr = String(totalCents).padStart(10, '0');
    const creditTotalStr = String(totalCents).padStart(10, '0');
    const debitTotalStr = '0000000000';
    const countStr = String(records.length).padStart(6, '0');

    const totalRecord = `7999-999            ${netTotalStr}${creditTotalStr}${debitTotalStr}${' '.repeat(24)}${countStr}${' '.repeat(40)}`;
    lines.push(totalRecord);

    return lines.join('\r\n');
  }

  // =========================================================================
  // 3. Commercial Bank of Ethiopia (CBE) Direct Credit CSV
  // =========================================================================
  private generateCbeCsv(
    records: BankTransferEmployeeItem[],
    month: number,
    year: number,
  ): string {
    const headers = ['Account Number', 'Beneficiary Name', 'Amount', 'Reference', 'Remark'];
    const rows = records.map((r) => [
      `"${r.accountNumber}"`,
      `"${r.employeeName.replace(/"/g, '""')}"`,
      r.netSalary.toFixed(2),
      `"SALARY-${month}-${year}"`,
      `"${r.department || 'Payroll'} - Monthly Salary"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  }

  // =========================================================================
  // 4. Awash Bank Direct Credit CSV
  // =========================================================================
  private generateAwashCsv(
    records: BankTransferEmployeeItem[],
    month: number,
    year: number,
  ): string {
    const headers = [
      'Staff ID',
      'Employee Name',
      'Bank Name',
      'Account Number',
      'Net Salary',
      'Payment Description',
    ];
    const rows = records.map((r) => [
      `"${r.userId}"`,
      `"${r.employeeName.replace(/"/g, '""')}"`,
      `"${r.bankName || 'Awash Bank'}"`,
      `"${r.accountNumber}"`,
      r.netSalary.toFixed(2),
      `"Net Salary for ${month}/${year}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  }

  // =========================================================================
  // 5. Dashen Bank Direct Credit CSV
  // =========================================================================
  private generateDashenCsv(
    records: BankTransferEmployeeItem[],
    month: number,
    year: number,
  ): string {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const headers = [
      'Transaction Date',
      'Account Number',
      'Beneficiary Name',
      'Amount',
      'Currency',
      'Narrative',
    ];
    const rows = records.map((r) => [
      `"${todayStr}"`,
      `"${r.accountNumber}"`,
      `"${r.employeeName.replace(/"/g, '""')}"`,
      r.netSalary.toFixed(2),
      '"ETB"',
      `"Payroll Settlement ${month}/${year}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  }

  // =========================================================================
  // 6. Generic Corporate Bank Batch CSV
  // =========================================================================
  private generateGenericCsv(
    records: BankTransferEmployeeItem[],
    month: number,
    year: number,
  ): string {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const headers = [
      'Employee ID',
      'Employee Name',
      'Bank Name',
      'Routing / BIC / Bank Code',
      'Account Number',
      'Amount',
      'Currency',
      'Payment Reference',
      'Payment Date',
    ];

    const rows = records.map((r) => [
      `"${r.userId}"`,
      `"${r.employeeName.replace(/"/g, '""')}"`,
      `"${r.bankName || 'Corporate Bank'}"`,
      `"${r.bankCode || '000000000'}"`,
      `"${r.accountNumber}"`,
      r.netSalary.toFixed(2),
      '"USD"',
      `"SALARY-${month}-${year}"`,
      `"${todayStr}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  }
}
