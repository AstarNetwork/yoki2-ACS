import { FILE } from 'dns';
import * as fs from 'fs';
import * as path from 'path';

const FILE_PATH = './data/_season8users.csv';
// Function to read the file and find duplicates
function findDuplicateAddresses(filePath: string): void {
  try {
    // Read the file
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    
    // Split the content by new line
    const addresses = fileContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0); // Remove empty lines
    
    console.log(`Total addresses found: ${addresses.length}`);
    
    // Check for duplicates
    const uniqueAddresses = new Set<string>();
    const duplicates = new Set<string>();
    
    for (const address of addresses) {
      if (uniqueAddresses.has(address)) {
        duplicates.add(address);
      } else {
        uniqueAddresses.add(address);
      }
    }
    
    // Output results
    console.log(`Unique addresses: ${uniqueAddresses.size}`);
    
    if (duplicates.size === 0) {
      console.log('No duplicates found!');
    } else {
      console.log(`Found ${duplicates.size} duplicate addresses:`);
      duplicates.forEach(dupe => console.log(dupe));
    }
  } catch (error) {
    console.error('Error processing file:', error);
  }
}

// Usage
const filePath = path.resolve(FILE_PATH); 
console.log(`Checking for duplicates in: ${filePath}`);
findDuplicateAddresses(filePath);