import * as fs from 'fs';
import * as crypto from 'crypto';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

interface AcsSignatureItem {
  userAddress: string;
  defiId: number;
  acsAmount: number;
  description: string;
}

interface SignatureParams {
  items: AcsSignatureItem[];
  timestamp: number;
  nonce: string;
  apiSecret: string;
}

// Change or check this part for any season
const API_SECRET = process.env.ACS_API_KEY_YOKI2;
// const ACS_ENDPOINT = 'https://test4.xzsean.eu.org/acs/addDiscretionaryPointsBatch'
const ACS_ENDPOINT = 'https://acs-api.astar.network/acs/addDiscretionaryPointsBatch'
const users: AcsSignatureItem[] = JSON.parse(fs.readFileSync('data/season9missing8-3.json', 'utf8'));

if (!API_SECRET) {
  console.error('Error: ASC_API_KEY not found in .env file');
  process.exit(1);
}
console.log(`sending ${users.length} users to ACS server ${ACS_ENDPOINT}`);

// Generate nonce
function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

// Generate signature
function generateSignature(params: SignatureParams): string {
  const { items, timestamp, nonce, apiSecret } = params;

  // Build the signature string
  const signStr = items.reduce((acc, item, idx) => {
    const itemStr = Object.keys(item)
      .sort()
      .map((key) => `${key}=${item[key as keyof AcsSignatureItem]}`)
      .join('&');
    return idx === 0 ? itemStr : `${acc}&${itemStr}`;
  }, '');

  // Add timestamp and nonce
  const finalStr = `${signStr}&timestamp=${timestamp}&nonce=${nonce}`;

  // Generate signature
  return crypto
    .createHmac('sha256', apiSecret)
    .update(Buffer.from(finalStr))
    .digest('hex');
}

// Send the request
async function sendData(): Promise<void> {
  const nonce = generateNonce();
  const timestamp = Date.now().toString();
  
  const signature = generateSignature({
    items: users,
    timestamp: parseInt(timestamp),
    nonce: nonce,
    apiSecret: API_SECRET as string
  });

  try {
    const response = await axios.post(
      ACS_ENDPOINT,
      users,
      {
        headers: {
          'x-timestamp': timestamp,
          'x-signature': signature,
          'x-nonce': nonce,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('Success!', response.data);
  } catch (error: any) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

sendData();