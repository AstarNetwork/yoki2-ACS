import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// Subgraph endpoint
const GRAPH_API_URL = 'https://api.studio.thegraph.com/query/64002/yoki2/v0.0.14';

// Query with pagination
const SEASON7_QUERY = `
query checkSeason7Conditions($skip: Int) {
  season7Conditions_collection(
    where: {
      hasAllRequiredTokens: true
    }
    first: 1000,
    skip: $skip,
    orderBy: lastUpdated,
    orderDirection: desc
  ) {
    id
    address
  }
}`;

interface Season7User {
  id: string;
  address: string;
}

interface QueryResponse {
  data: {
    season7Conditions_collection: Season7User[];
  };
}

async function fetchAllUsers(): Promise<string[]> {
  let allAddresses: string[] = [];
  let hasMore = true;
  let skip = 0;
  const pageSize = 1000;

  console.log('Fetching Season 7 qualifying users...');

  while (hasMore) {
    try {
      console.log(`Querying page ${skip / pageSize + 1}...`);

      const response = await axios.post<QueryResponse>(
        GRAPH_API_URL,
        {
          query: SEASON7_QUERY,
          variables: { skip }
        }
      );

      const users = response.data.data.season7Conditions_collection;

      // Extract addresses and add to our list
      const addresses = users.map((user: Season7User) => user.address);
      allAddresses = [...allAddresses, ...addresses];

      console.log(`Found ${users.length} users on this page`);

      // Check if we need to load more
      if (users.length < pageSize) {
        hasMore = false;
      } else {
        skip += pageSize;
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
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

    // Write to file
    const outputPath = path.join(__dirname, '../data', 'season7users.csv');
    fs.writeFileSync(outputPath, csvContent);

    console.log(`Success! Exported ${addresses.length} addresses to season7users.csv`);
  } catch (error: any) {
    console.error('Failed to export users:', error);
  }
}

main();