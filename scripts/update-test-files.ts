#!/usr/bin/env tsx

/**
 * Script to update all test files to remove hashedPassword references
 */

import { promises as fs } from 'fs';
import { glob } from 'glob';

async function updateTestFiles() {
  // console.log('🔧 Updating test files to remove hashedPassword references...\n');
  
  try {
    // Find all test files
    const testFiles = await glob('tests/**/*.ts', {
      ignore: ['node_modules/**', 'dist/**']
    });

    // console.log(`Found ${testFiles.length} test files to check:`);
    
    let updatedCount = 0;
    
    for (const filePath of testFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        
        // Check if file contains hashedPassword references
        if (content.includes('hashedPassword')) {
          // console.log(`  - Updating: ${filePath}`);
          
          let updatedContent = content;
          
          // Remove hashedPassword from object definitions
          updatedContent = updatedContent.replace(
            /hashedPassword:\s*[^,\n}]+[,]?\s*/g,
            ''
          );
          
          // Remove hashedPassword from destructuring
          updatedContent = updatedContent.replace(
            /hashedPassword:\s*[^,\n}]+,?\s*/g,
            ''
          );
          
          // Remove hashedPassword property access
          updatedContent = updatedContent.replace(
            /\.hashedPassword/g,
            ''
          );
          
          // Remove hashedPassword from faker calls
          updatedContent = updatedContent.replace(
            /hashedPassword:\s*faker\.[^,\n}]+[,]?\s*/g,
            ''
          );
          
          // Remove hashedPassword from string literals and comments
          updatedContent = updatedContent.replace(
            /'hashedPassword'/g,
            ''
          );
          
          updatedContent = updatedContent.replace(
            /"hashedPassword"/g,
            ''
          );
          
          // Clean up any double commas or trailing commas
          updatedContent = updatedContent.replace(/,\s*,/g, ',');
          updatedContent = updatedContent.replace(/,\s*}/g, '}');
          updatedContent = updatedContent.replace(/,\s*\]/g, ']');
          
          await fs.writeFile(filePath, updatedContent, 'utf-8');
          updatedCount++;
        } else {
          // console.log(`  - Skipping: ${filePath} (no hashedPassword references)`);
        }
      } catch (error) {
        // console.error(`  - Error updating ${filePath}:`, error);
      }
    }
    
    // console.log(`\n✅ Updated ${updatedCount} test files successfully!`);
    
  } catch (error) {
    // console.error('❌ Error updating test files:', error);
  }
}

updateTestFiles();