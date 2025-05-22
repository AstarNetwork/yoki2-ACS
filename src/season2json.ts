import * as fs from 'fs';
import * as path from 'path';

// Define the item structure
interface Item {
  userAddress: string;
  defiId: number;
  acsAmount: number;
  description: string;
}

// Constants
const DEFI_ID = 41;
const ACS_AMOUNT_PER_SEASON = 1500000;
const BATCH_SIZE = 1900; // Max addresses per file
const DESCRIPTION = "Yoki2 season 9";

/**
 * Split an array into chunks of specified size
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

async function main() {
  try {
    // Resolve paths relative to this script
    const csvPath = path.resolve(__dirname, '../data/season9missing8.csv');
    const outputDir = path.resolve(__dirname, '../data');
    
    console.log(`Reading addresses from ${csvPath}`);
    
    // Read the CSV file
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Split by newlines and filter empty lines
    const addresses = fileContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    console.log(`Found ${addresses.length} addresses`);
    
    // Calculate ACS amount per user based on total addresses
    const usersPerSeason = addresses.length;
    const ACS_AMOUNT = Math.floor(ACS_AMOUNT_PER_SEASON / usersPerSeason);
    
    console.log(`ACS amount per user: ${ACS_AMOUNT}`);
    
    // Create items from addresses
    const items: Item[] = addresses.map(address => ({
      userAddress: address,
      defiId: DEFI_ID,
      acsAmount: ACS_AMOUNT,
      description: DESCRIPTION
    }));
    
    // Split items into chunks of BATCH_SIZE
    const chunks = chunkArray(items, BATCH_SIZE);
    
    // Write each chunk to a separate JSON file
    chunks.forEach((chunk, index) => {
      const fileNumber = index + 1;
      const outputPath = path.resolve(outputDir, `season9missing8-${fileNumber}.json`);
      
      fs.writeFileSync(
        outputPath,
        JSON.stringify(chunk, null, 2),
        'utf-8'
      );
      
      console.log(`[${fileNumber}/${chunks.length}] Wrote ${chunk.length} items to ${outputPath}`);
    });
    
    console.log(`Successfully created ${chunks.length} JSON files with ${addresses.length} total addresses`);
  } catch (error: any) {
    console.error('Error processing CSV to JSON:', error.message);
    process.exit(1);
  }
}

main();