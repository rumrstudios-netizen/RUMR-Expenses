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
 return async (path: string, body: unknown) => {
  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets' + path, {
   method: 'POST',
   headers: {Authorization: 'Bearer ' + token.access_token, 'Content-Type': 'application/json'},
   body: JSON.stringify(body),
   signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw Error('Could not update Google Sheets. Check the connection and retry.');
  return response.json();
 };
}

type SheetsClient = Awaited<ReturnType<typeof sheetsClient>>;
export async function createProjectSheet(client: SheetsClient, title: string) {
 const result = await client('', {properties: {title}, sheets: [{properties: {sheetId: 0, title: 'Expenses', gridProperties: {frozenRowCount: 1, rowCount: 5001, columnCount: 8}}}]});
 if (!/^[\w-]+$/.test(result.spreadsheetId || '')) throw Error('Google did not return a spreadsheet ID.');
 return result.spreadsheetId as string;
}

type ExpenseRow = {
 date: string; name: string; category: string; method: string;
 amount: number | null; personal: boolean; payer: string; description: string;
};
export async function writeProjectSheet(client: SheetsClient, id: string, title: string, expenses: ExpenseRow[]) {
 if (!/^[\w-]+$/.test(id)) throw Error('Invalid spreadsheet ID.');
 const rows = [
  ['Date', 'Expense', 'Category', 'Payment type', 'Amount (INR)', 'Scope', 'Paid by', 'Description'],
  ...expenses.map(e => [e.date, e.name, e.category, e.method, e.amount === null ? '' : e.amount / 100, e.personal ? 'Personal' : 'Shoot', e.payer, e.description]),
 ];
 await client('/' + id + ':batchUpdate', {
  requests: [
   {updateSpreadsheetProperties: {properties: {title}, fields: 'title'}},
   {updateCells: {range: {sheetId: 0, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: 8}, rows: rows.map(row => ({values: row.map(value => ({userEnteredValue: typeof value === 'number' ? {numberValue: value} : {stringValue: String(value ?? '')}}))})), fields: 'userEnteredValue'}},
  ],
 });
}
