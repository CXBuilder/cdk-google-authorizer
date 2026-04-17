#!/usr/bin/env node

/**
 * Extract changelog section for a specific version.
 * Usage: node extract-changelog.js <version>
 *
 * Reads CHANGELOG.md and extracts the section for the given version.
 * The section starts with "## {version}" and ends before the next "##" heading.
 * Writes the content to GITHUB_OUTPUT as a multiline `content` variable.
 */

const fs = require('fs');
const path = require('path');

function extractChangelogSection(version) {
  const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');

  if (!fs.existsSync(changelogPath)) {
    console.error('CHANGELOG.md not found');
    process.exit(1);
  }

  const changelog = fs.readFileSync(changelogPath, 'utf-8');
  const lines = changelog.split('\n');

  const versionPattern = new RegExp(`^## ${version.replace(/\./g, '\\.')}(?:\\s|$)`);
  let startIndex = -1;
  let endIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (versionPattern.test(lines[i])) {
      startIndex = i;
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].startsWith('## ')) {
          endIndex = j;
          break;
        }
      }
      if (endIndex === -1) endIndex = lines.length;
      break;
    }
  }

  if (startIndex === -1) {
    console.error(`Version ${version} not found in CHANGELOG.md`);
    process.exit(1);
  }

  const sectionLines = lines.slice(startIndex + 1, endIndex);
  while (sectionLines.length > 0 && sectionLines[0].trim() === '') sectionLines.shift();
  while (sectionLines.length > 0 && sectionLines[sectionLines.length - 1].trim() === '') sectionLines.pop();

  const content = sectionLines.join('\n');

  if (process.env.GITHUB_OUTPUT) {
    const delimiter = 'EOF';
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `content<<${delimiter}\n${content}\n${delimiter}\n`);
  }

  console.log(content);
  return content;
}

const version = process.argv[2];
if (!version) {
  console.error('Usage: node extract-changelog.js <version>');
  process.exit(1);
}
extractChangelogSection(version);
