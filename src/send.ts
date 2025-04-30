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

// Load your API key (keep this secret!)
const API_SECRET = process.env.TEST_ASC_API_KEY;

if (!API_SECRET) {
  console.error('Error: TEST_ASC_API_KEY not found in .env file');
  process.exit(1);
}

// Load your users data
const users: AcsSignatureItem[] = JSON.parse(fs.readFileSync('data/season7users.json', 'utf8'));

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
      'https://test4.xzsean.eu.org/acs/addDiscretionaryPointsBatch',
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