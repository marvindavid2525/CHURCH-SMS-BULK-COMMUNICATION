import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { db, Member, Department, GoogleSyncLog } from './db.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const EXCEL_OUTPUT_PATH = path.join(DATA_DIR, 'Omega_Prayer_Mission_Member_Register.xlsx');

/**
 * Creates a formatted row object for member worksheets with clickable hyperlink support
 */
function formatMemberRow(m: Member, deptMap: Record<string, string>) {
  const deptNames = m.departmentIds.map(id => deptMap[id] || id).join(', ') || 'Unassigned';
  const editUrl = m.googleEditResponseUrl || '';

  return {
    'Member ID': m.id,
    'First Name': m.firstName,
    'Second Name': m.secondName,
    'Phone Number': m.phone,
    'Gender': m.gender,
    'Email': m.email || '',
    'SMS Consent': m.smsConsent ? 'Yes' : 'No',
    'Departments': deptNames,
    'Registration Date': m.registrationDate ? new Date(m.registrationDate).toLocaleDateString() : '',
    'Google Response ID': m.googleResponseId || 'N/A',
    'Google Response/Edit Link': editUrl || 'Unavailable',
    'Last Synced': m.lastSyncedAt ? new Date(m.lastSyncedAt).toLocaleString() : 'N/A',
    'Sync Status': (m.syncStatus || 'synced').toUpperCase(),
  };
}

/**
 * Attaches SheetJS clickable hyperlinks to the 'Google Response/Edit Link' column
 */
function applyHyperlinksToSheet(worksheet: XLSX.WorkSheet, data: any[], linkColumnHeader = 'Google Response/Edit Link') {
  if (!worksheet['!ref']) return;
  const range = XLSX.utils.decode_range(worksheet['!ref']);

  // Find column index for linkColumnHeader
  let linkColIdx = -1;
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
    const cell = worksheet[cellAddress];
    if (cell && cell.v === linkColumnHeader) {
      linkColIdx = C;
      break;
    }
  }

  if (linkColIdx === -1) return;

  // Add hyperlinks for rows 1 to end
  data.forEach((row, rowIdx) => {
    const r = rowIdx + 1; // row 0 is header
    const cellAddress = XLSX.utils.encode_cell({ r, c: linkColIdx });
    const cell = worksheet[cellAddress];
    const url = row[linkColumnHeader];

    if (cell && url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
      cell.l = {
        Target: url,
        Tooltip: 'Open Google Form Edit Response Link in Browser',
      };
      // Format as clickable link style text
      cell.v = url;
    }
  });
}

/**
 * Automatically maintains and regenerates the complete Omega_Prayer_Mission_Member_Register.xlsx
 * workbook containing all 11 required worksheets and clickable hyperlinks.
 */
export function generateChurchExcelRegister(): { filePath: string; buffer: Buffer; timestamp: string } {
  const currentDb = db.get();
  const members = currentDb.members.filter(m => m.status !== 'archived');
  const departments = currentDb.departments;
  const syncLogs = currentDb.googleSyncLogs || [];

  const deptMap: Record<string, string> = {};
  const deptNameToId: Record<string, string> = {};
  departments.forEach(d => {
    deptMap[d.id] = d.name;
    deptNameToId[d.name.toLowerCase().trim()] = d.id;
  });

  const workbook = XLSX.utils.book_new();

  // 1. All Members (each member appears only once)
  const allMembersRows = members.map(m => formatMemberRow(m, deptMap));
  const wsAllMembers = XLSX.utils.json_to_sheet(allMembersRows);
  applyHyperlinksToSheet(wsAllMembers, allMembersRows);
  XLSX.utils.book_append_sheet(workbook, wsAllMembers, 'All Members');

  // Helper for specific department sheets
  const addDepartmentSheet = (sheetName: string, deptNameMatch: string) => {
    const targetDept = departments.find(d => d.name.toLowerCase().includes(deptNameMatch.toLowerCase()));
    const deptMembers = targetDept
      ? members.filter(m => m.departmentIds.includes(targetDept.id))
      : [];
    const rows = deptMembers.map(m => formatMemberRow(m, deptMap));
    const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'Note': `No members currently registered in ${sheetName}` }]);
    if (rows.length > 0) {
      applyHyperlinksToSheet(ws, rows);
    }
    XLSX.utils.book_append_sheet(workbook, ws, sheetName.substring(0, 31));
  };

  // 2. Media and Technical
  addDepartmentSheet('Media and Technical', 'Media and Technical');

  // 3. Prayer and Intercession
  addDepartmentSheet('Prayer and Intercession', 'Prayer and Intercession');

  // 4. Evangelism
  addDepartmentSheet('Evangelism', 'Evangelism');

  // 5. Ushering
  addDepartmentSheet('Ushering', 'Ushering');

  // 6. Choir
  addDepartmentSheet('Choir', 'Choir');

  // 7. Mighty Youth
  addDepartmentSheet('Mighty Youth', 'Mighty Youth');

  // 8. Other Departments
  // Includes Praise and Worship, Hospitality, Children's Ministry, Men's Ministry, Women's Ministry, etc.
  const majorDeptNames = ['media and technical', 'prayer and intercession', 'evangelism', 'ushering', 'choir', 'mighty youth'];
  const otherDeptIds = departments
    .filter(d => !majorDeptNames.some(m => d.name.toLowerCase().includes(m)))
    .map(d => d.id);

  const otherDeptMembers = members.filter(m => m.departmentIds.some(id => otherDeptIds.includes(id)));
  const otherDeptRows = otherDeptMembers.map(m => formatMemberRow(m, deptMap));
  const wsOtherDepts = XLSX.utils.json_to_sheet(otherDeptRows.length > 0 ? otherDeptRows : [{ 'Note': 'No members in other departments' }]);
  if (otherDeptRows.length > 0) {
    applyHyperlinksToSheet(wsOtherDepts, otherDeptRows);
  }
  XLSX.utils.book_append_sheet(workbook, wsOtherDepts, 'Other Departments');

  // 9. Registration Response Links (Audit table of Google Form response links)
  const responseLinkRows = members.map(m => ({
    'Member ID': m.id,
    'Full Name': m.fullName,
    'Phone Number': m.phone,
    'Google Response ID': m.googleResponseId || 'N/A',
    'Google Response/Edit Link': m.googleEditResponseUrl || 'Unavailable',
    'Response Link Status': m.googleEditResponseUrl ? 'Active Link Available' : 'Response Link Missing / Disabled',
    'Registration Submitted At': m.googleSubmittedAt ? new Date(m.googleSubmittedAt).toLocaleString() : new Date(m.registrationDate).toLocaleDateString(),
    'Last Synchronised': m.lastSyncedAt ? new Date(m.lastSyncedAt).toLocaleString() : 'N/A',
    'Sync Status': (m.syncStatus || 'synced').toUpperCase(),
  }));
  const wsResponseLinks = XLSX.utils.json_to_sheet(responseLinkRows);
  applyHyperlinksToSheet(wsResponseLinks, responseLinkRows, 'Google Response/Edit Link');
  XLSX.utils.book_append_sheet(workbook, wsResponseLinks, 'Registration Response Links');

  // 10. Synchronisation History
  const syncHistoryRows = syncLogs.map(log => ({
    'Sync ID': log.id,
    'Timestamp': new Date(log.timestamp).toLocaleString(),
    'Source': log.source.toUpperCase(),
    'Status': log.status.toUpperCase(),
    'Total Received': log.totalReceived,
    'New Members': log.newCount,
    'Updated Members': log.updatedCount,
    'Skipped': log.skippedCount,
    'Failed': log.failedCount,
    'Summary': log.summary,
    'Error Details': log.errors && log.errors.length > 0 ? log.errors.join('; ') : 'None',
  }));
  const wsSyncHistory = XLSX.utils.json_to_sheet(syncHistoryRows.length > 0 ? syncHistoryRows : [{ 'Note': 'No sync operations recorded yet' }]);
  XLSX.utils.book_append_sheet(workbook, wsSyncHistory, 'Synchronisation History');

  // 11. Registration Summary
  const activeMembers = members.filter(m => m.status === 'active');
  const consentedMembers = members.filter(m => m.status === 'active' && m.smsConsent);
  const now = new Date().toISOString();

  const summaryRows = [
    { 'Metric': 'Church Name', 'Value': currentDb.generalSettings.churchName },
    { 'Metric': 'Report Generated (EAT)', 'Value': new Date().toLocaleString() },
    { 'Metric': 'Total Registered Members', 'Value': members.length },
    { 'Metric': 'Active Church Members', 'Value': activeMembers.length },
    { 'Metric': 'SMS Consented Members', 'Value': consentedMembers.length },
    { 'Metric': 'Non-Consenting Members', 'Value': members.filter(m => !m.smsConsent).length },
    { 'Metric': 'Members with Verified Google Edit Links', 'Value': members.filter(m => Boolean(m.googleEditResponseUrl)).length },
    { 'Metric': 'Members with Missing Edit Links', 'Value': members.filter(m => !m.googleEditResponseUrl).length },
    { 'Metric': 'Total Department Allocations', 'Value': members.reduce((sum, m) => sum + m.departmentIds.length, 0) },
    { 'Metric': 'Total Synchronisation Runs', 'Value': syncLogs.length },
  ];

  // Append department breakdown in summary
  departments.forEach(dept => {
    const deptCount = members.filter(m => m.departmentIds.includes(dept.id)).length;
    summaryRows.push({
      'Metric': `Department: ${dept.name}`,
      'Value': `${deptCount} members`,
    });
  });

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(workbook, wsSummary, 'Registration Summary');

  // Write to disk
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  fs.writeFileSync(EXCEL_OUTPUT_PATH, buffer);

  // Update last generated timestamp in database
  db.update(d => {
    if (!d.generalSettings) return;
    (d.generalSettings as any).lastExcelGeneratedAt = now;
  });

  return {
    filePath: EXCEL_OUTPUT_PATH,
    buffer,
    timestamp: now,
  };
}
