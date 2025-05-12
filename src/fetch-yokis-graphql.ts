import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// Constants as specified in requirements
const YOKIS = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 101, 201, 301, 401, 501, 601, 701, 801, 901, 1001, 1101, 1201];
const CUTOFF_TIMESTAMP = 1746968400000; // May 11, 2025
const CUTOFF_DATE = new Date(CUTOFF_TIMESTAMP).toISOString();
const YOKI_CONTRACT = '0x80E041b16a38f4caa1d0137565B37FD71b2f1E2b';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const GRAPHQL_URL = 'https://soneium.blockscout.com/api/graphql';

// Track which tokens each user has minted
const userTokens: Record<string, Set<string>> = {};

// GraphQL query for token transfers
const TOKEN_TRANSFERS_QUERY = `
query GetTokenTransfers($contract: AddressHash!, $tokenId: String!, $after: String) {
  erc1155Token(hash: $contract) {
    tokenTransfers(
      tokenIds: [$tokenId],
      filter: {
        from: {equalTo: "${ZERO_ADDRESS}"}
        timestamp: {lessThan: "${CUTOFF_DATE}"}
      },
      first: 50,
      after: $after
    ) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        timestamp
        to {
          hash
        }
        tokenId
        value
      }
    }
  }
}
`;

interface TokenTransferNode {
  timestamp: string;
  to: {
    hash: string;
  };
  tokenId: string;
  value: string;
}

interface GraphQLResponse {
  data: {
    erc1155Token: {
      tokenTransfers: {
        pageInfo: {
          hasNextPage: boolean;
          endCursor: string;
        };
        nodes: TokenTransferNode[];
      };
    };
  };
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
}

/**
 * Fetch transfers for a specific token ID with pagination using GraphQL
 */
async function fetchTokenTransfersGraphQL(tokenId: number): Promise<void> {
  console.log(`Fetching transfers for token ID: ${tokenId}`);
  
  let hasNextPage = true;
  let cursor: string | null = null;
  let totalFetched = 0;
  
  while (hasNextPage) {
    try {
      // Prepare GraphQL query with variables
      const variables: {
        contract: string;
        tokenId: string;
        after: string | null;
      } = {
        contract: YOKI_CONTRACT,
        tokenId: tokenId.toString(),
        after: cursor
      };
      
      // Execute GraphQL query
      const response = await axios.post<GraphQLResponse>(
        GRAPHQL_URL,
        {
          query: TOKEN_TRANSFERS_QUERY,
          variables: variables
        },
        {
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
      
      // Check for errors
      if (response.data.errors) {
        console.error(`GraphQL errors for token ${tokenId}:`, response.data.errors);
        throw new Error(`GraphQL query failed for token ${tokenId}`);
      }
      
      // Extract data
      const tokenTransfers = response.data.data.erc1155Token?.tokenTransfers;
      
      if (!tokenTransfers) {
        console.log(`No transfer data found for token ${tokenId}`);
        break;
      }
      
      const { nodes, pageInfo } = tokenTransfers;
      totalFetched += nodes.length;
      
      // Process transfers
      for (const transfer of nodes) {
        const toAddress = transfer.to.hash.toLowerCase();
        
        // Record this mint
        if (!userTokens[toAddress]) {
          userTokens[toAddress] = new Set();
        }
        userTokens[toAddress].add(transfer.tokenId);
      }
      
      // Update cursor for next page
      hasNextPage = pageInfo.hasNextPage;
      cursor = pageInfo.endCursor;
      
      console.log(`  - Fetched ${nodes.length} transfers for token ${tokenId}, total: ${totalFetched}`);
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error: any) {
      console.error(`Error fetching transfers for token ID ${tokenId}:`, error.message);
      
      if (error.response?.data) {
        console.error(`Response data:`, error.response.data);
      }
      
      // Retry logic with backoff
      console.log(`Retrying in 3 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  console.log(`  - Completed fetching ${totalFetched} transfers for token ID: ${tokenId}`);
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
    
    // Fetch transfers for each token ID using GraphQL
    for (const tokenId of YOKIS) {
      await fetchTokenTransfersGraphQL(tokenId);
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
    const outputPath = path.join(dataDir, 'graph.csv');
    fs.writeFileSync(outputPath, csvContent);
    
    console.log(`Finished processing ${totalUsers} users`);
    console.log(`Found ${qualifiedUsers.length} users who minted all ${YOKIS.length} tokens`);
    console.log(`Results saved to data/graph.csv`);
    
  } catch (error: any) {
    console.error('Script execution failed:', error.message);
    process.exit(1);
  }
}

main();