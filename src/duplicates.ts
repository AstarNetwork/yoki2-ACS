import * as fs from 'fs';
import * as path from 'path';

// Read the CSV file
const filePath = path.join(__dirname, '..', 'data', '_season9users.csv');
const fileContent = fs.readFileSync(filePath, 'utf8');

// Split the content by newlines and filter out any comments or empty lines
const addresses = fileContent
  .split('\n')
  .filter(line => line.trim() && !line.startsWith('//'));

// Convert addresses to lowercase for case-insensitive comparison
const normalizedAddresses = addresses.map(addr => addr.toLowerCase());

// Find duplicates
const addressCount: Record<string, number> = {};
const duplicates: string[] = [];

normalizedAddresses.forEach((address, index) => {
  if (addressCount[address]) {
    addressCount[address]++;
    
    // If this is the first time we're seeing this address as a duplicate
    if (addressCount[address] === 2) {
      duplicates.push(address);
    }
  } else {
    addressCount[address] = 1;
  }
});

// Get the total number of duplicate entries
const totalDuplicateEntries = Object.values(addressCount)
  .filter(count => count > 1)
  .reduce((sum, count) => sum + (count - 1), 0);

// Output the results
console.log(`Number of duplicate entries in ${filePath}: ${totalDuplicateEntries}`);

if (duplicates.length > 0) {
  console.log(`Example duplicate address: ${duplicates[0]}`);
  console.log(`This address appears ${addressCount[duplicates[0]]} times`);
}