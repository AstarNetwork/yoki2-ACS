import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// Subgraph endpoint
const GRAPH_API_URL = 'http://localhost:4350/graphql';

// Query with pagination - updated to match the actual schema
const SEASON9_QUERY = `
query GetYokiPerSeasons($limit: Int!, $offset: Int!) {
  yokiPerSeasons(
    where: {season_eq: 9, hasAll_eq: true}
    limit: $limit
    offset: $offset
    orderBy: address_ASC
  ) {
    address
  }
}`;

interface Season9User {
  address: string;
}

interface QueryResponse {
  data: {
    yokiPerSeasons: Season9User[];
  };
  errors?: any[];
}

async function fetchAllUsers(): Promise<string[]> {
  let allAddresses: string[] = [];
  let hasMore = true;
  let offset = 0;
  const pageSize = 1000;

  console.log('Fetching Season 9 qualifying users...');

  while (hasMore) {
    try {
      console.log(`Querying page ${Math.floor(offset / pageSize) + 1}...`);

      const response = await axios.post<QueryResponse>(
        GRAPH_API_URL,
        {
          query: SEASON9_QUERY,
          variables: { 
            limit: pageSize, 
            offset: offset 
          }
        }
      );

      // Log any GraphQL errors
      if (response.data.errors) {
        console.error('GraphQL errors:', JSON.stringify(response.data.errors, null, 2));
        hasMore = false;
        continue;
      }

      const users = response.data.data.yokiPerSeasons;

      // Extract addresses and add to our list
      const addresses = users.map((user: Season9User) => user.address);
      allAddresses = [...allAddresses, ...addresses];

      console.log(`Found ${users.length} users on this page`);

      // Check if we need to load more
      if (users.length < pageSize) {
        hasMore = false;
      } else {
        offset += pageSize;
      }
    } catch (error: any) {
      console.error('Error fetching data:', error.message);
      // If there's a response with detailed error data, log it
      if (error.response?.data) {
        console.error('Error details:', JSON.stringify(error.response.data, null, 2));
      }
      hasMore = false;
    }
  }

  return allAddresses;
}

async function main() {
  try {
    // Fetch all qualifying users
    const addresses = await fetchAllUsers();

    // Format as CSV content
    // Just a simple list of addresses, one per line
    const csvContent = addresses.join('\n');

    // Create data directory if it doesn't exist
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Write to file
    const outputPath = path.join(dataDir, '_season9users.csv');
    fs.writeFileSync(outputPath, csvContent);

    console.log(`Success! Exported ${addresses.length} addresses to _season9users.csv`);
  } catch (error: any) {
    console.error('Failed to export users:', error);
  }
}

main();