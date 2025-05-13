import * as fs from 'fs';
import * as path from 'path';

// Hardcoded input and output paths
const FIRST_FILE_PATH = 'data/season8users5887.csv';
const SECOND_FILE_PATH = 'data/_season8users.csv';
const OUTPUT_DIR = 'compares';

/**
 * Compares two CSV files of Ethereum addresses and outputs the differences
 */
function compareCSVFiles(): void {
  try {
    // Ensure the output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Read and parse input files
    console.log(`Reading files...`);
    console.log(`- ${FIRST_FILE_PATH}`);
    console.log(`- ${SECOND_FILE_PATH}`);
    
    const file1Content = fs.readFileSync(FIRST_FILE_PATH, 'utf8').trim();
    const file2Content = fs.readFileSync(SECOND_FILE_PATH, 'utf8').trim();

    // Split by newlines and filter empty lines
    const addresses1 = file1Content.split('\n').filter(line => line.trim() !== '');
    const addresses2 = file2Content.split('\n').filter(line => line.trim() !== '');

    console.log(`Found ${addresses1.length} addresses in ${FIRST_FILE_PATH}`);
    console.log(`Found ${addresses2.length} addresses in ${SECOND_FILE_PATH}`);

    // Create sets for efficient lookup
    const set1 = new Set(addresses1.map(addr => addr.toLowerCase()));
    const set2 = new Set(addresses2.map(addr => addr.toLowerCase()));

    // Find addresses in file1 not in file2
    const uniqueToFile1 = addresses1.filter(addr => !set2.has(addr.toLowerCase()));

    // Find addresses in file2 not in file1
    const uniqueToFile2 = addresses2.filter(addr => !set1.has(addr.toLowerCase()));

    // Generate output file paths
    const fileName1 = path.basename(FIRST_FILE_PATH, path.extname(FIRST_FILE_PATH));
    const fileName2 = path.basename(SECOND_FILE_PATH, path.extname(SECOND_FILE_PATH));
    
    const outputFile1 = path.join(OUTPUT_DIR, `${fileName1}_not_in_${fileName2}.csv`);
    const outputFile2 = path.join(OUTPUT_DIR, `${fileName2}_not_in_${fileName1}.csv`);

    // Write output files
    fs.writeFileSync(outputFile1, uniqueToFile1.join('\n'), 'utf8');
    fs.writeFileSync(outputFile2, uniqueToFile2.join('\n'), 'utf8');

    console.log(`Found ${uniqueToFile1.length} addresses unique to ${FIRST_FILE_PATH}`);
    console.log(`Found ${uniqueToFile2.length} addresses unique to ${SECOND_FILE_PATH}`);
    console.log(`Outputs saved to:`);
    console.log(`- ${outputFile1}`);
    console.log(`- ${outputFile2}`);
    
    // Also calculate intersection
    const intersection = addresses1.filter(addr => set2.has(addr.toLowerCase()));
    console.log(`Found ${intersection.length} addresses common to both files`);
    
  } catch (error) {
    console.error('Error comparing CSV files:', error);
    if (error instanceof Error) {
      console.error(error.message);
    }
  }
}

// Run the comparison function
compareCSVFiles();