import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// Constants as specified in requirements
const YOKIS = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 101, 201, 301, 401, 501, 601, 701, 801, 901, 1001, 1101, 1201];
const CUTOFF_TIMESTAMP = 1746968400000; // May 11, 2025
const YOKI_CONTRACT = '0x80E041b16a38f4caa1d0137565B37FD71b2f1E2b';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const GRAPHQL_ENDPOINT = 'http://localhost:8000/subgraphs/name/yoki2';
const PAGE_SIZE = 1000;

// Track token ownership per user
interface UserTokens {
  [address: string]: {
    [tokenId: string]: number;  // Track the quantity of each token
  }
}

const userTokens: UserTokens = {};

// GraphQL query for transfers
const TRANSFERS_QUERY = `
query GetTransferSingles($first: Int!, $skip: Int!, $blockTimestamp_lte: String!) {
  transferSingles(
    first: $first
    skip: $skip
    where: {
      blockTimestamp_lte: $blockTimestamp_lte
      tokenId_gt: "13"
    }
    orderBy: blockTimestamp
    orderDirection: asc
  ) {
    from
    to
    tokenId
    value
    blockTimestamp
    season
    transactionHash
  }
}
`;

interface TransferSingle {
  from: string;
  to: string;
  tokenId: string;
  value: string;
  blockTimestamp: string;
  season: number;
  transactionHash: string;
}

interface GraphQLResponse {
  data: {
    transferSingles: TransferSingle[];
  }
}

/**
 * Initialize user tokens with zero quantities for all tokens
 */
function initializeUserTokens(address: string): void {
  if (!userTokens[address]) {
    userTokens[address] = {};
    // Initialize all token counts to 0
    for (const tokenId of YOKIS) {
      userTokens[address][tokenId.toString()] = 0;
    }
  }
}

/**
 * Process token transfers to track token ownership
 */
function processTransfers(transfers: TransferSingle[]): void {
  for (const transfer of transfers) {
    const { from, to, tokenId, value } = transfer;
    const valueNum = parseInt(value, 10);
    
    // Process "from" address (decrement token count)
    if (from.toLowerCase() !== ZERO_ADDRESS) {
      const fromAddress = from.toLowerCase();
      initializeUserTokens(fromAddress);
      
      // Decrease token count for the sender
      if (userTokens[fromAddress][tokenId]) {
        userTokens[fromAddress][tokenId] -= valueNum;
      }
    }
    
    // Process "to" address (increment token count)
    // ONLY if this is a mint (from zero address)
    if (from.toLowerCase() === ZERO_ADDRESS) {
      const toAddress = to.toLowerCase();
      initializeUserTokens(toAddress);
      
      // Increase token count for the receiver
      userTokens[toAddress][tokenId] = (userTokens[toAddress][tokenId] || 0) + valueNum;
    }
  }
}

/**
 * Fetch transfers with pagination
 */
async function fetchAllTransfers(): Promise<void> {
  let hasMore = true;
  let skip = 0;
  let totalFetched = 0;
  
  console.log(`Starting to fetch transfers before timestamp ${new Date(CUTOFF_TIMESTAMP).toISOString()}`);
  
  while (hasMore) {
    try {
      console.log(`Fetching batch starting at offset ${skip}...`);
      
      const response = await axios.post<GraphQLResponse>(
        GRAPHQL_ENDPOINT,
        {
          query: TRANSFERS_QUERY,
          variables: {
            first: PAGE_SIZE,
            skip: skip,
            blockTimestamp_lte: Math.floor(CUTOFF_TIMESTAMP / 1000).toString() // Convert to seconds
          }
        },
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      if (!response.data.data || !response.data.data.transferSingles) {
        console.error('Unexpected response format:', response.data);
        break;
      }
      
      const transfers = response.data.data.transferSingles;
      const count = transfers.length;
      totalFetched += count;
      
      console.log(`Received ${count} transfers (total: ${totalFetched})`);
      
      // Process this batch of transfers
      processTransfers(transfers);
      
      // Check if we need to fetch more
      if (count < PAGE_SIZE) {
        hasMore = false;
        console.log('No more transfers to fetch.');
      } else {
        skip += PAGE_SIZE;
      }
      
      // Add a small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error('Error fetching transfers:', error instanceof Error ? error.message : error);
      
      if (axios.isAxiosError(error) && error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      
      // Try again after a delay
      console.log('Retrying in 3 seconds...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  console.log(`Completed fetching a total of ${totalFetched} transfers`);
}

/**
 * Check if a user has all required tokens
 */
function userHasAllTokens(userTokenTracker: {[tokenId: string]: number}): boolean {
  return YOKIS.every(tokenId => {
    const tokenCount = userTokenTracker[tokenId.toString()] || 0;
    return tokenCount > 0;
  });
}

/**
 * Main function to run the script
 */
async function main(): Promise<void> {
  try {
    console.log(`Starting YOKIS token collection analysis using GraphQL`);
    console.log(`Looking for users who have collected all ${YOKIS.length} tokens before ${new Date(CUTOFF_TIMESTAMP).toISOString()}`);
    
    // Fetch all transfers and process them
    await fetchAllTransfers();
    
    // Find users who have all required tokens
    const qualifiedUsers: string[] = [];
    
    for (const [address, tokens] of Object.entries(userTokens)) {
      if (userHasAllTokens(tokens)) {
        qualifiedUsers.push(address);
      }
    }
    
    // Output results
    console.log(`Found ${qualifiedUsers.length} users with all ${YOKIS.length} tokens`);
    
    // Create data directory if it doesn't exist
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Write to CSV file
    const outputPath = path.join(dataDir, 'yokiSeason8.csv');
    fs.writeFileSync(outputPath, qualifiedUsers.join('\n'));
    
    console.log(`Results saved to ${outputPath}`);
    
  } catch (error) {
    console.error('Script execution failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run the script
main();