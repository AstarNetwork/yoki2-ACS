import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// Subgraph endpoint
const GRAPH_API_URL = 'http://localhost:4350/graphql';

// Query all YokiPerSeason entities for season 8
const ALL_SEASON8_QUERY = `
query GetAllSeason8($limit: Int!, $offset: Int!) {
  yokiPerSeasons(
    where: {season_eq: 8}
    limit: $limit
    offset: $offset
  ) {
    address
    hasAll
    ownedYokis
  }
}`;

interface Season8User {
  address: string;
  hasAll: boolean;
  ownedYokis: number[];
}

interface QueryResponse {
  data: {
    yokiPerSeasons: Season8User[];
  };
}

async function fetchAllUsers(): Promise<string[]> {
  let allQualifiedUsers: string[] = [];
  let hasMore = true;
  let offset = 0;
  const pageSize = 1000;

  console.log('Fetching all Season 8 users and filtering manually...');

  while (hasMore) {
    try {
      console.log(`Querying page ${Math.floor(offset / pageSize) + 1}...`);

      const response = await axios.post<QueryResponse>(
        GRAPH_API_URL,
        {
          query: ALL_SEASON8_QUERY,
          variables: {
            limit: pageSize,
            offset: offset
          }
        }
      );

      const users = response.data.data.yokiPerSeasons;
      console.log(`Received ${users.length} users (before filtering)`);

      // Filter users who have all yokis - do this manually 
      // to bypass any potential GraphQL filtering issues
      const qualifiedUsers = users
        .filter(user => {
          // Check hasAll flag
          if (user.hasAll === true) return true;

          // As a backup, check the ownedYokis array if available
          if (user.ownedYokis && Array.isArray(user.ownedYokis)) {
            return user.ownedYokis.every(count => count > 0);
          }

          return false;
        })
        .map(user => user.address);

      console.log(`Found ${qualifiedUsers.length} qualified users on this page`);

      // Check for our specific user
      const missingUser = '0x515944479d05743df23e9a4cae5d5d28dd402ebb';
      if (qualifiedUsers.some(addr => addr.toLowerCase() === missingUser.toLowerCase())) {
        console.log(`✓ Found missing user on this page!`);
      }

      // Add to master list
      allQualifiedUsers = [...allQualifiedUsers, ...qualifiedUsers];

      // Check if we need to load more
      if (users.length < pageSize) {
        hasMore = false;
      } else {
        offset += pageSize;
      }
    } catch (error: any) {
      console.error('Error fetching data:', error.message);
      hasMore = false;
    }
  }


  // Remove duplicates (just in case)
  const uniqueUsers = [...new Set(allQualifiedUsers)];
  console.log(`Total unique qualified users: ${uniqueUsers.length}`);

  // Add these lines for duplicate analysis ⬇️
  console.log(`Total qualified users found across all pages: ${allQualifiedUsers.length}`);
  console.log(`Duplicates removed: ${allQualifiedUsers.length - uniqueUsers.length}`);

  // Check for examples of duplicates
  const addressCounts: Record<string, number> = {};
  allQualifiedUsers.forEach(addr => {
    addressCounts[addr] = (addressCounts[addr] || 0) + 1;
  });

  const duplicates = Object.entries(addressCounts)
    .filter(([_, count]) => count > 1)
    .sort((a, b) => (b[1] as number) - (a[1] as number));

  if (duplicates.length > 0) {
    console.log(`Found ${duplicates.length} addresses with duplicates`);
    console.log(`Top 5 most duplicated addresses:`);
    duplicates.slice(0, 5).forEach(([addr, count]) => {
      console.log(`${addr}: appears ${count} times`);
    });
  }
  // End of added code ⬆️

  return uniqueUsers;
}

async function main() {
  try {
    // Fetch all qualifying users
    const addresses = await fetchAllUsers();

    // Check for missing user
    const missingUser = '0x515944479d05743df23e9a4cae5d5d28dd402ebb';
    if (addresses.some(addr => addr.toLowerCase() === missingUser.toLowerCase())) {
      console.log(`✓ The missing user is in the final results!`);
    } else {
      console.log(`❌ The missing user is still not in the final results!`);
    }

    // Format as CSV content
    const csvContent = addresses.join('\n');

    // Create data directory if it doesn't exist
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }



    // Write to file
    const outputPath = path.join(dataDir, '_season8users_manual.csv');
    fs.writeFileSync(outputPath, csvContent);

    console.log(`Success! Exported ${addresses.length} addresses to ${outputPath}`);
  } catch (error: any) {
    console.error('Failed to export users:', error);
  }
}

main();