import * as XLSX from 'xlsx';
import { Member, SMSTransaction } from '../services/api.js';

export function exportMembersToExcel(members: Member[], departmentMap: Record<string, string>, fileName = 'ChurchSMS_Members') {
  const rows = members.map(m => ({
    'Member ID': m.id,
    'Full Name': m.fullName,
    'First Name': m.firstName,
    'Second Name': m.secondName,
    'Phone (E.164)': m.phone,
    'Raw Phone': m.rawPhone,
    'Email': m.email || '',
    'Gender': m.gender,
    'Departments': m.departmentIds.map(id => departmentMap[id] || id).join(', '),
    'SMS Consent': m.smsConsent ? 'Yes' : 'No',
    'Status': m.status.toUpperCase(),
    'Notes': m.notes || '',
    'Source': m.source,
    'Registration Date': new Date(m.registrationDate).toLocaleDateString(),
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Members');
  XLSX.writeFile(workbook, `${fileName}_${new Date().toISOString().substring(0, 10)}.xlsx`);
}

export function exportMembersToCSV(members: Member[], departmentMap: Record<string, string>, fileName = 'ChurchSMS_Members') {
  const rows = members.map(m => ({
    'Member ID': m.id,
    'Full Name': m.fullName,
    'First Name': m.firstName,
    'Second Name': m.secondName,
    'Phone': m.phone,
    'Email': m.email || '',
    'Gender': m.gender,
    'Departments': m.departmentIds.map(id => departmentMap[id] || id).join('; '),
    'SMS Consent': m.smsConsent ? 'Yes' : 'No',
    'Status': m.status,
    'Notes': m.notes || '',
    'Registration Date': m.registrationDate,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  downloadBlob(csv, `${fileName}_${new Date().toISOString().substring(0, 10)}.csv`, 'text/csv;charset=utf-8;');
}

export function exportTransactionsToExcel(transactions: SMSTransaction[], fileName = 'ChurchSMS_Delivery_History') {
  const rows = transactions.map(t => ({
    'Transaction ID': t.id,
    'Provider Message ID': t.providerMessageId || 'N/A',
    'Recipient Name': t.recipientName,
    'Recipient Phone': t.recipientPhone,
    'Status': t.status,
    'Credits Consumed': t.calculatedCredits,
    'Sent Time': new Date(t.sentAt).toLocaleString(),
    'Message Content': t.messageContent,
    'Error Details': t.errorReason || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'SMS_History');
  XLSX.writeFile(workbook, `${fileName}_${new Date().toISOString().substring(0, 10)}.xlsx`);
}

export function exportTransactionsToCSV(transactions: SMSTransaction[], fileName = 'ChurchSMS_Delivery_History') {
  const rows = transactions.map(t => ({
    'Transaction ID': t.id,
    'Provider Message ID': t.providerMessageId || '',
    'Recipient Name': t.recipientName,
    'Recipient Phone': t.recipientPhone,
    'Status': t.status,
    'Credits': t.calculatedCredits,
    'Sent Time': t.sentAt,
    'Message': t.messageContent,
    'Error': t.errorReason || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  downloadBlob(csv, `${fileName}_${new Date().toISOString().substring(0, 10)}.csv`, 'text/csv;charset=utf-8;');
}

function downloadBlob(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parses uploaded Excel (.xlsx, .xls) or .csv file into JSON array
 */
export async function parseImportFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = err => reject(err);
    reader.readAsBinaryString(file);
  });
}

/**
 * Downloads a ready-to-use Excel template with sample rows and clear column headers
 */
export function downloadSampleImportTemplate(fileName = 'ChurchSMS_Member_Import_Template') {
  const sampleRows = [
    {
      'First Name': 'Moses',
      'Second Name': 'Kasirye',
      'Phone Number': '0772123456',
      'Gender': 'Male',
      'Email': 'moses.kasirye@gmail.com',
      'SMS Consent': 'Yes',
      'Departments': 'Media and Technical, Choir',
      'Notes': 'Registered during Sunday Service',
    },
    {
      'First Name': 'Grace',
      'Second Name': 'Nalubega',
      'Phone Number': '0701987654',
      'Gender': 'Female',
      'Email': 'grace.nalubega@yahoo.com',
      'SMS Consent': 'Yes',
      'Departments': 'Prayer and Intercession, Ushering',
      'Notes': 'Cell leader in Mbuya Zone 2',
    },
    {
      'First Name': 'David',
      'Second Name': 'Okello',
      'Phone Number': '0755332211',
      'Gender': 'Male',
      'Email': 'david.okello@gmail.com',
      'SMS Consent': 'Yes',
      'Departments': 'Evangelism, Mighty Youth',
      'Notes': 'Youth coordinator',
    },
    {
      'First Name': 'Prossy',
      'Second Name': 'Namaganda',
      'Phone Number': '+256782445566',
      'Gender': 'Female',
      'Email': 'prossy.namaganda@gmail.com',
      'SMS Consent': 'No',
      'Departments': 'Women of Faith, Choir',
      'Notes': 'Prefers phone call notifications',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleRows);

  // Set explicit column widths for nice appearance
  worksheet['!cols'] = [
    { wch: 15 }, // First Name
    { wch: 16 }, // Second Name
    { wch: 18 }, // Phone Number
    { wch: 10 }, // Gender
    { wch: 28 }, // Email
    { wch: 14 }, // SMS Consent
    { wch: 35 }, // Departments
    { wch: 35 }, // Notes
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Member_Import_Template');
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}
