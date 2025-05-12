import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// Constants as specified in requirements
// const YOKIS = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 101, 201, 301, 401, 501, 601, 701, 801, 901, 1001, 1101, 1201];
const YOKIS = [100, 200, 300, 400, 101, 201, 301, 401];
// const CUTOFF_TIMESTAMP = 1746968400000; // May 11, 2025
const CUTOFF_TIMESTAMP = 1746104400000; // Season7
const YOKI_CONTRACT = '0x80E041b16a38f4caa1d0137565B37FD71b2f1E2b';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const API_BASE_URL = 'https://soneium.blockscout.com/api/v2';

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
const userTokens: Record<string, Set<string>> = {};

/**
 * Fetch transfers for a specific token ID with pagination
 */
async function fetchTokenTransfers(tokenId: number): Promise<void> {
  console.log(`Fetching transfers for token ID: ${tokenId}`);
  
  let hasNextPage = true;
  let nextPageParams: any = null;
  
  while (hasNextPage) {
    try {
      let url = `${API_BASE_URL}/tokens/${YOKI_CONTRACT}/instances/${tokenId}/transfers`;
      
      // Add pagination parameters if available
      if (nextPageParams) {
        url += `?block_number=${nextPageParams.block_number}&index=${nextPageParams.index}`;
        if (nextPageParams.token_id) url += `&token_id=${nextPageParams.token_id}`;
        if (nextPageParams.items_count) url += `&items_count=${nextPageParams.items_count}`;
      }
      
      // Fetch data from API
      const response = await axios.get<ApiResponse>(url);
      const { items, next_page_params } = response.data;
      
      // Process transfers
      for (const transfer of items) {
        // Skip if this isn't a mint (from zero address)
        if (transfer.from.hash.toLowerCase() !== ZERO_ADDRESS.toLowerCase()) {
          continue;
        }
        
        // Skip if after cutoff timestamp
        const transferTimestamp = new Date(transfer.timestamp).getTime();
        if (transferTimestamp > CUTOFF_TIMESTAMP) {
          continue;
        }
        
        // Record this mint
        const toAddress = transfer.to.hash.toLowerCase();
        if (!userTokens[toAddress]) {
          userTokens[toAddress] = new Set();
        }
        userTokens[toAddress].add(transfer.total.token_id);
      }
      
      // Check if there's another page
      if (next_page_params) {
        nextPageParams = next_page_params;
        console.log(`  - Fetched page for ${tokenId}, more data available`);
      } else {
        hasNextPage = false;
        console.log(`  - Completed fetching transfers for token ID: ${tokenId}`);
      }
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error: any) {
      console.error(`Error fetching transfers for token ID ${tokenId}:`, error.message);
      
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error(`Response data:`, error.response.data);
      }
      
      // Retry logic (with backoff)
      console.log(`Retrying in 2 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

/**
 * Check if a user has all required tokens
 */
function userHasAllTokens(userTokenSet: Set<string>): boolean {
  return YOKIS.every(tokenId => userTokenSet.has(tokenId.toString()));
}

/**
 * Main function to run the script
 */
async function main() {
  try {
    console.log(`Starting to fetch YOKIS minters before ${new Date(CUTOFF_TIMESTAMP).toISOString()}`);
    
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
    const outputPath = path.join(dataDir, 'transfers.csv');
    fs.writeFileSync(outputPath, csvContent);
    
    console.log(`Finished processing ${totalUsers} users`);
    console.log(`Found ${qualifiedUsers.length} users who minted all 24 tokens`);
    console.log(`Results saved to data/transfers.csv`);
    
  } catch (error: any) {
    console.error('Script execution failed:', error.message);
    process.exit(1);
  }
}

main();