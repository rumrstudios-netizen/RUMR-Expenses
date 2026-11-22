import 'server-only';
import {createCipheriv, createDecipheriv, createHash, randomBytes} from 'node:crypto';

export const googleClientId = () => process.env.GOOGLE_OAUTH_CLIENT_SECRET ? process.env.GOOGLE_OAUTH_CLIENT_ID : undefined;
const scope = 'https://www.googleapis.com/auth/drive.file';

function encryptionKey() {
 const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
 if (!secret) throw Error('Google connection is not configured.');
 return createHash('sha256').update('rumr-google-refresh-v1:' + secret).digest();
}

async function tokenRequest(params: Record<string, string>) {
 const response = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  body: new URLSearchParams({...params, client_id: googleClientId() || '', client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || ''}),
  signal: AbortSignal.timeout(10000),
 });
 if (!response.ok) throw Error('Google authorization failed. Connect your Google account again.');
 return response.json();
}

export async function connectGoogle(code: string, origin: string) {
 if (!googleClientId()) throw Error('Google connection is not configured.');
 const token = await tokenRequest({code, redirect_uri: origin, grant_type: 'authorization_code'});
 if (!token.scope?.split(' ').includes(scope) || !token.refresh_token) {
  throw Error('Google did not grant ongoing file access. Remove the app’s access in your Google Account and connect again.');
 }
 const identity = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
  headers: {Authorization: 'Bearer ' + token.access_token},
  signal: AbortSignal.timeout(10000),
 });
 if (!identity.ok) throw Error('Could not identify the connected Google account.');
 const {sub, email, email_verified} = await identity.json();
 if (!sub || !email_verified || !email) throw Error('Use a verified Google account.');
 const connectionId = createHash('sha256').update(googleClientId() + ':' + sub).digest('hex');
 const nonce = randomBytes(12);
 const cipher = createCipheriv('aes-256-gcm', encryptionKey(), nonce);
 const encrypted = Buffer.concat([cipher.update(token.refresh_token, 'utf8'), cipher.final()]);
 const refresh = Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString('base64url');
 return {provider: 'oauth', refresh, connectionId, email};
}

export async function sheetsClient(refresh: string) {
 const stored = Buffer.from(refresh, 'base64url');
 const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), stored.subarray(0, 12));
 decipher.setAuthTag(stored.subarray(12, 28));
 const refreshToken = Buffer.concat([decipher.update(stored.subarray(28)), decipher.final()]).toString('utf8');
 const token = await tokenRequest({refresh_token: refreshToken, grant_type: 'refresh_token'});
 return async (path: string, body?: unknown) => {
  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets' + path, {
   method: body === undefined ? 'GET' : 'POST',
   headers: {Authorization: 'Bearer ' + token.access_token, 'Content-Type': 'application/json'},
   body: JSON.stringify(body),
   signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw Error('Could not update Google Sheets. Check the connection and retry.');
  return response.json();
 };
}

type SheetsClient = Awaited<ReturnType<typeof sheetsClient>>;
const tabs = [
 {sheetId: 0, title: 'Shoot Expenses', headerRow: 5},
 {sheetId: 1, title: 'Personal Expenses', headerRow: 4},
] as const;
const rowCount = 5005;

function tabProperties(tab: typeof tabs[number]) {
 return {sheetId: tab.sheetId, title: tab.title, gridProperties: {frozenRowCount: tab.headerRow, rowCount, columnCount: 8}};
}

export async function createProjectSheet(client: SheetsClient, title: string) {
 const result = await client('', {properties: {title, locale: 'en_IN', timeZone: 'Asia/Kolkata'}, sheets: tabs.map(tab => ({properties: tabProperties(tab)}))});
 if (!/^[\w-]+$/.test(result.spreadsheetId || '')) throw Error('Google did not return a spreadsheet ID.');
 return result.spreadsheetId as string;
}

type ExpenseRow = {
 date: string; name: string; category: string; method: string;
 amount: number | null; personal: boolean; payer: string; description: string;
};
const formula = (formulaValue: string) => ({formulaValue});
type Cell = string | number | null | ReturnType<typeof formula>;
const amountFormat = {type: 'NUMBER', pattern: '"₹"#,##0.##'};
const baseText = {fontFamily: 'Arial', fontSize: 10};

function rowsForTab(tab: typeof tabs[number], title: string, expenses: ExpenseRow[]): Cell[][] {
 const personal = tab.sheetId === 1;
 const first = tab.headerRow + 1;
 const headers = ['Date', 'Expense', 'Category', 'Amount (INR)', ...(personal ? ['Posted by'] : []), 'Paid by', 'Notes', 'Payment type'];
 const rows: Cell[][] = personal
  ? [['Personal Expenses'], ['Personal total', formula(`=SUM(D${first}:D)`)], [], headers]
  : [[title + ' Shoot Expenses'],
     ['Shoot total', formula(`=SUM(D${first}:D)`), null, 'Personal total', formula("='Personal Expenses'!B2"), 'All payments', formula('=B2+E2')],
     ['Food (INR)', formula(`=SUMIF(C${first}:C,"Food",D${first}:D)`), null, 'Transport total', formula(`=SUMIF(C${first}:C,"Transport",D${first}:D)`)],
     [], headers];
 for (const expense of expenses) {
  if (expense.personal !== personal) continue;
  const date = expense.date ? Date.parse(expense.date + 'T00:00:00Z') / 86400000 + 25569 : NaN;
  rows.push([
   Number.isFinite(date) ? date : expense.date, expense.name, expense.category,
   expense.amount == null ? null : expense.amount / 100,
   ...(personal ? [null] : []), expense.payer, expense.description, expense.method,
  ]);
 }
 return rows;
}

export async function writeProjectSheet(client: SheetsClient, id: string, title: string, expenses: ExpenseRow[]) {
 if (!/^[\w-]+$/.test(id)) throw Error('Invalid spreadsheet ID.');
 const metadata = await client('/' + id + '?fields=sheets(properties(sheetId,title,gridProperties))');
 const sheets: {properties: {sheetId: number; title: string}}[] = metadata.sheets ?? [];
 const requests: object[] = [{updateSpreadsheetProperties: {properties: {title}, fields: 'title'}}];
 for (const tab of tabs) {
  const existing = sheets.find(sheet => sheet.properties.title === tab.title)
   ?? (tab.sheetId === 0 ? sheets.find(sheet => sheet.properties.sheetId === 0 && sheet.properties.title === 'Expenses') : undefined);
  const sheetId = existing?.properties.sheetId ?? (sheets.some(sheet => sheet.properties.sheetId === tab.sheetId) ? Math.max(1, ...sheets.map(sheet => sheet.properties.sheetId)) + 1 : tab.sheetId);
  const properties = {...tabProperties(tab), sheetId};
  if (existing) {
   requests.push({updateSheetProperties: {properties, fields: 'title,gridProperties.frozenRowCount,gridProperties.rowCount,gridProperties.columnCount'}});
  } else {
   requests.push({addSheet: {properties}});
  }
  const rows = rowsForTab(tab, title, expenses);
  const values = rows.map((row, index) => ({values: row.map((value, column) => {
   const header = index === tab.headerRow - 1;
   const summary = index > 0 && index < tab.headerRow - 2;
   const expense = index >= tab.headerRow;
   const border = {style: 'SOLID'};
   const userEnteredFormat = {
    verticalAlignment: 'MIDDLE',
    textFormat: {...baseText, ...(index === 0 ? {fontSize: 14, bold: true} : header || summary || (expense && column === 3 && tab.sheetId === 0) ? {bold: true} : {})},
    ...(header ? {backgroundColor: {red: .9333, green: .9333, blue: .9333}, borders: {top: border, bottom: border, left: border, right: border}} : {}),
    ...(expense && column === 0 ? {numberFormat: {type: 'DATE', pattern: 'M/d/yyyy'}} : {}),
    ...(expense && (column === 1 || column === (tab.sheetId === 1 ? 6 : 5)) ? {wrapStrategy: 'WRAP'} : {}),
    ...(expense && column === 3 || summary && typeof value === 'object' && value !== null ? {numberFormat: amountFormat} : {}),
   };
   const userEnteredValue = typeof value === 'number' ? {numberValue: value}
    : typeof value === 'string' ? {stringValue: value}
    : value ?? undefined;
   return {userEnteredValue, userEnteredFormat};
  })}));
  requests.push({updateCells: {range: {sheetId, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: 8}, rows: values, fields: 'userEnteredValue,userEnteredFormat'}});
  for (const [column, pixelSize] of (tab.sheetId === 0 ? [112, 300, 120, 125, 140, 275, 130] : [112, 300, 120, 125, 140, 140, 275, 130]).entries()) {
   requests.push({updateDimensionProperties: {range: {sheetId, dimension: 'COLUMNS', startIndex: column, endIndex: column + 1}, properties: {pixelSize}, fields: 'pixelSize'}});
  }
 }
 await client('/' + id + ':batchUpdate', {requests});
}
