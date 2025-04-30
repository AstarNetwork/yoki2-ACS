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
const DEFI_ID = 21;
const ACS_AMOUNT_SEASON7 = 2000000;
const SEASON7_USERS = 3227;
const ACS_AMOUNT = Math.floor(ACS_AMOUNT_SEASON7 / SEASON7_USERS);
const DESCRIPTION = "Yoki2 season 7";

async function main() {
  try {
    // Resolve paths relative to this script
    const csvPath = path.resolve(__dirname, '../data/season7users.csv');
    const outputPath = path.resolve(__dirname, '../data/season7users.json');
    
    console.log(`Reading addresses from ${csvPath}`);
    
    // Read the CSV file
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Split by newlines and filter empty lines
    const addresses = fileContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    console.log(`Found ${addresses.length} addresses`);
    
    // Create items from addresses
    const items: Item[] = addresses.map(address => ({
      userAddress: address,
      defiId: DEFI_ID,
      acsAmount: ACS_AMOUNT,
      description: DESCRIPTION
    }));
    
    // Write to JSON file
    fs.writeFileSync(
      outputPath,
      JSON.stringify(items, null, 2),
      'utf-8'
    );
    
    console.log(`Successfully wrote ${items.length} items to ${outputPath}`);
  } catch (error: any) {
    console.error('Error processing CSV to JSON:', error.message);
    process.exit(1);
  }
}

main();