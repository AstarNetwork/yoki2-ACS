import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// Subgraph endpoint
const GRAPH_API_URL = 'http://localhost:4350/graphql';

// User ID we want to verify
const MISSING_USER = '0x515944479d05743df23e9a4cae5d5d28dd402ebb';

// Add a debug query to check our specific user
const DEBUG_QUERY = `
query CheckSpecificUser {
  yokiPerSeasonById(id: "${MISSING_USER}_8") {
    address
    hasAll
    season
    ownedYokis
  }
}`;

// Query with pagination - updated to match the actual schema
const SEASON8_QUERY = `
query GetYokiPerSeasons($limit: Int!, $offset: Int!) {
  yokiPerSeasons(
    where: {season_eq: 8, hasAll_eq: true}
    limit: $limit
    offset: $offset
  ) {
    address
  }
}`;

interface Season8User {
  address: string;
}

interface QueryResponse {
  data: {
    yokiPerSeasons: Season8User[];
  };
  errors?: any[];
}

// Function to check if our specific user is present
async function checkSpecificUser() {
  try {
    console.log(`\nVerifying specific user ${MISSING_USER}...`);
    const response = await axios.post(
      GRAPH_API_URL,
      { query: DEBUG_QUERY }
    );
    
    const userData = response.data.data?.yokiPerSeasonById;
    if (!userData) {
      console.error(`❌ User ${MISSING_USER} not found in database!`);
      return;
    }
    
    console.log(`✓ Found user data:`, userData);
    console.log(`  - Address: ${userData.address}`);
    console.log(`  - Season: ${userData.season}`);
    console.log(`  - Has All Yokis: ${userData.hasAll}`);
    console.log(`  - Token Count: ${userData.ownedYokis.filter((count: number) => count > 0).length} tokens\n`);
    
    // Verify query would include this user
    if (userData.season === 8 && userData.hasAll === true) {
      console.log(`✓ User SHOULD be included in results (season=8, hasAll=true)`);
    } else {
      console.log(`❌ User doesn't meet filter criteria (season=${userData.season}, hasAll=${userData.hasAll})`);
    }
    
    return userData;
  } catch (error: any) {
    console.error(`❌ Error checking specific user: ${error.message}`);
    return null;
  }
}

async function fetchAllUsers(): Promise<string[]> {
  let allAddresses: string[] = [];
  let hasMore = true;
  let offset = 0;
  const pageSize = 1000;
  let foundMissingUser = false;

  // First check if our specific user is in the database
  await checkSpecificUser();

  console.log('Fetching Season 8 qualifying users...');

  while (hasMore) {
    try {
      console.log(`Querying page ${Math.floor(offset / pageSize) + 1}...`);

      const response = await axios.post<QueryResponse>(
        GRAPH_API_URL,
        {
          query: SEASON8_QUERY,
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

      // Extract addresses and check for our missing user
      const addresses = users.map((user: Season8User) => {
        const address = user.address;
        if (address.toLowerCase() === MISSING_USER.toLowerCase()) {
          foundMissingUser = true;
          console.log(`✓ Found our specific user in results!`);
        }
        return address;
      });
      
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

  // After all pages, check if we found our user
  if (!foundMissingUser) {
    console.error(`\n❌ The user ${MISSING_USER} was NOT found in any page of results!`);
    
    // Check if the address is in the final list anyway
    if (allAddresses.some(addr => addr.toLowerCase() === MISSING_USER.toLowerCase())) {
      console.log(`However, the address IS in the final list somehow!`);
    }
  } else {
    console.log(`\n✓ The user ${MISSING_USER} was successfully found in the results.`);
  }

  return allAddresses;
}

async function main() {
  try {
    // Fetch all qualifying users
    const addresses = await fetchAllUsers();

    // Check if our specific address is in the final list
    const hasMissingUser = addresses.some(addr => 
      addr.toLowerCase() === MISSING_USER.toLowerCase()
    );
    
    console.log(`\nFinal check: User ${MISSING_USER} in results? ${hasMissingUser ? 'YES' : 'NO'}`);

    // Format as CSV content
    // Just a simple list of addresses, one per line
    const csvContent = addresses.join('\n');

    // Create data directory if it doesn't exist
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Write to file
    const outputPath = path.join(dataDir, '_season8users.csv');
    fs.writeFileSync(outputPath, csvContent);

    console.log(`Success! Exported ${addresses.length} addresses to _season8users.csv`);
    
    // If our specific user wasn't included, add them manually to a separate file
    if (!hasMissingUser) {
      const fixedPath = path.join(dataDir, '_season8users_fixed.csv');
      fs.writeFileSync(fixedPath, csvContent + '\n' + MISSING_USER);
      console.log(`Created fixed version with missing user at: ${fixedPath}`);
    }
    
  } catch (error: any) {
    console.error('Failed to export users:', error);
  }
}

main();