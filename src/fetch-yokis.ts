import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// Constants as specified in requirements
const YOKIS = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 101, 201, 301, 401, 501, 601, 701, 801, 901, 1001, 1101, 1201];
// const YOKIS = [100, 200, 300, 400, 101, 201, 301, 401]; // Test subset
const CUTOFF_TIMESTAMP = 1746968400000; // May 11, 2025
// const CUTOFF_TIMESTAMP = 1746104400000; // Season7
const YOKI_CONTRACT = '0x80E041b16a38f4caa1d0137565B37FD71b2f1E2b';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const API_BASE_URL = 'https://soneium.blockscout.com/api/v2';
const API_KEY = "";

// Interface for token transfer data from API response
interface TokenTransfer {
  from: {
    hash: string;
  };
  to: {
    hash: string;
  };
  timestamp: string;
  total: {
    token_id: string;
    value: string;
  };
  type: string;
}

interface ApiResponse {
  items: TokenTransfer[];
  next_page_params: {
    items_count: number;
    block_number: number;
    index: number;
    token_id: string;
  } | null;
}

// Track which tokens each user has minted
const userTokens: Record<string, Record<string, number>> = {};



/**
 * Process a token transfer between addresses
 */
function processTransfer(
  fromAddress: string, 
  toAddress: string, 
  tokenId: string, 
  value: number
): void {
  // Handle outgoing transfers (including burns)
  if (fromAddress !== ZERO_ADDRESS) {
    // Only try to decrease if the user has tokens
    if (userTokens[fromAddress] && userTokens[fromAddress][tokenId] > 0) {
      userTokens[fromAddress][tokenId] -= value;
      // console.log(`  - Decreased ${value} of token ${tokenId} from ${fromAddress}, remaining: ${userTokens[fromAddress][tokenId]}`);
      
      // Remove the entry if quantity reaches zero
      if (userTokens[fromAddress][tokenId] <= 0) {
        delete userTokens[fromAddress][tokenId];
        // console.log(`    (Removed empty token entry for ${fromAddress})`);
      }
    }
  }
  
  // Handle incoming transfers (ignore burns - to 0x0 address)
  if (toAddress !== ZERO_ADDRESS && fromAddress === ZERO_ADDRESS) {
    // Only track mints (from 0x0)
    if (!userTokens[toAddress]) {
      userTokens[toAddress] = {};
    }
    
    // Initialize or increase token quantity
    userTokens[toAddress][tokenId] = (userTokens[toAddress][tokenId] || 0) + value;
    // console.log(`  + Added ${value} of token ${tokenId} to ${toAddress}, total: ${userTokens[toAddress][tokenId]}`);
  }
}

/**
 * Process a batch of token transfers
 */
function processTransfers(transfers: TokenTransfer[]): void {
  for (const transfer of transfers) {
    // Skip if after cutoff timestamp
    const transferTimestamp = new Date(transfer.timestamp).getTime();
    if (transferTimestamp > CUTOFF_TIMESTAMP) {
      continue;
    }

    const tokenId = transfer.total.token_id;
    const valueNum = parseInt(transfer.total.value, 10);
    const fromAddress = transfer.from.hash.toLowerCase();
    const toAddress = transfer.to.hash.toLowerCase();
    
    // Process this transfer
    processTransfer(fromAddress, toAddress, tokenId, valueNum);
  }
}

/**
 * Fetch transfers for a specific token ID with pagination
 */
async function fetchTokenTransfers(tokenId: number): Promise<void> {
  console.log(`Fetching transfers for token ID: ${tokenId}`);

  let hasNextPage = true;
  let nextPageParams: any = null;
  let retryCount = 0;
  const maxRetries = 5;

  while (hasNextPage) {
    try {
      // Base URL with API key
      let url = `${API_BASE_URL}/tokens/${YOKI_CONTRACT}/instances/${tokenId}/transfers?apikey=${API_KEY}&sort=asc`;

      // Add pagination parameters if available
      if (nextPageParams) {
        url += `&block_number=${nextPageParams.block_number}&index=${nextPageParams.index}`;
        if (nextPageParams.token_id) url += `&token_id=${nextPageParams.token_id}`;
        if (nextPageParams.items_count) url += `&items_count=${nextPageParams.items_count}`;
      }

      // Fetch data from API
      const response = await axios.get<ApiResponse>(url);
      const { items, next_page_params } = response.data;

      // Process all transfers in this batch
      processTransfers(items);

      // Check if there's another page
      if (next_page_params) {
        nextPageParams = next_page_params;
        console.log(`  - Fetched page for token ${tokenId}, more data available`);
      } else {
        hasNextPage = false;
        console.log(`  - Completed fetching transfers for token ID: ${tokenId}`);
      }

      // Reset retry count on successful request
      retryCount = 0;

      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));

    } catch (error: any) {
      retryCount++;

      console.error(`Error fetching transfers for token ID ${tokenId} (attempt ${retryCount}/${maxRetries}):`, error.message);

      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        // Only log the data if it's not too large
        if (typeof error.response.data === 'string' && error.response.data.length < 500) {
          console.error(`Response data:`, error.response.data);
        } else {
          console.error(`Response status:`, error.response.status);
        }
      }

      // Exit after max retries
      if (retryCount >= maxRetries) {
        console.error(`Max retries reached for token ${tokenId}, moving to next token`);
        break;
      }

      // Exponential backoff for retries
      const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 15000);
      console.log(`Retrying in ${backoffTime / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, backoffTime));
    }
  }
}

/**
 * Check if a user has all required tokens with positive balance
 */
function userHasAllTokens(userTokens: Record<string, number>): boolean {
  return YOKIS.every(tokenId => {
    const tokenIdStr = tokenId.toString();
    return tokenIdStr in userTokens && userTokens[tokenIdStr] > 0;
  });
}

/**
 * Main function to run the script
 */
async function main() {
  try {
    console.log(`Starting to fetch YOKIS minters before ${new Date(CUTOFF_TIMESTAMP).toISOString()}`);
    console.log(`Using contract: ${YOKI_CONTRACT}`);
    console.log(`Looking for all ${YOKIS.length} tokens`);

    // Fetch transfers for each token ID
    for (const tokenId of YOKIS) {
      await fetchTokenTransfers(tokenId);
    }

    // Find users who have all tokens
    const qualifiedUsers: string[] = [];
    let totalUsers = 0;

    for (const [address, tokens] of Object.entries(userTokens)) {
      totalUsers++;
      if (userHasAllTokens(tokens)) {
        qualifiedUsers.push(address);
      }
    }

    // Format as CSV content - just a list of addresses
    const csvContent = qualifiedUsers.join('\n');

    // Create data directory if it doesn't exist
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Write to file
    const outputPath = path.join(dataDir, 'transfers2.csv');
    fs.writeFileSync(outputPath, csvContent);

    // Also save a more detailed JSON file with timestamps
    const jsonPath = path.join(dataDir, 'transfers2-details.json');
    fs.writeFileSync(jsonPath, JSON.stringify({
      qualifiedUsers,
      timestamp: new Date().toISOString(),
      cutoffDate: new Date(CUTOFF_TIMESTAMP).toISOString(),
      tokenCount: YOKIS.length,
      totalUsers
    }, null, 2));

    console.log(`Finished processing ${totalUsers} users`);
    console.log(`Found ${qualifiedUsers.length} users who minted all ${YOKIS.length} tokens`);
    console.log(`Results saved to data/transfers.csv`);

  } catch (error: any) {
    console.error('Script execution failed:', error.message);
    process.exit(1);
  }
}

main();