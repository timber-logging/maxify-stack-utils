const fs = require('fs');
const path = require('path');
const { SourceMapConsumer } = require('source-map');

/**
 * Searches for the map file in both server and client chunk directories.
 * @param {string} folderPath - Path to the local build directory
 * @param {string} baseFileName - The clean file name (e.g., '7a388834aa9d5bf2.js').
 * @returns {string|null} The absolute path to the .map file if found, otherwise null.
 */
function findMapPath(folderPath, baseFileName) {
  const sourceFolderPaths = [
    path.join(folderPath, baseFileName + '.map'),
    path.join(folderPath, 'server', baseFileName + '.map'),
    path.join(folderPath, 'static', 'chunks', baseFileName + '.map'),
    path.join(folderPath, 'server', 'chunks', baseFileName + '.map'),
    path.join(folderPath, 'server', 'app', baseFileName + '.map'),
    path.join(folderPath, 'server', 'app-pages-browser', 'chunks', baseFileName + '.map'),
    path.join(folderPath, 'dist', baseFileName + '.map'),
    path.join(folderPath, 'build', baseFileName + '.map'),
    path.join(folderPath, '.webpack', baseFileName + '.map'),
  ];

  for (let sourceFolderPath of sourceFolderPaths) {
    if (fs.existsSync(sourceFolderPath)) {
      return sourceFolderPath;
    }
  }

  return null; // Not found in any standard location
}

/**
 * @param {string|string[]} folderPath - the folder path which contains source maps, or array of paths
 * @param {string} stack - the minified stack trace you want to convert
 * @returns {Promise<{ result?: string, error?: string, fileFound?: boolean }>}
 */
async function maxifyStack(folderPath, stack) {
  if (typeof stack !== 'string') {
    return { error: `stack not provided as a string` };
  }
  // if it is just a single string, use it
  if (typeof folderPath === 'string') {
    return await maxifyStackForPath(folderPath, stack);
  }

  if (!Array.isArray(folderPath) || folderPath.length === 0) {
    return { error: `path must be a string or array of strings` };
  }

  let response;
  for (let path of folderPath) {
    response = await maxifyStackForPath(path, stack);
    if (response.fileFound) {
      return response;
    }
  }

  return response || {}; // sends the last one if none were found
}

/**
 * @param {string} folderPath - the folder path which contains source maps
 * @param {string} stack - the minified stack trace you want to convert
 * @returns {Promise<{ result?: string, error?: string, fileFound?: boolean }>}
 */
async function maxifyStackForPath(folderPath, stack) {
  let fileFound = false; // where at least one row had the file found
  if (!folderPath || typeof folderPath !== 'string') {
    return { error: `folderPath not provided as a string`, fileFound };
  }

  const stackLines = stack.split('\n');

  const updatedLines = [];
  const errors = [];
  for (let stackLine of stackLines) {
    // at f (/var/task/.next/server/chunks/_ae9127c6._.js:1:8867)
    // at /var/task/.next/server/chunks/[root-of-the-server]__d6ddf850._.js:7:3411
    // at async I (/var/task/.next/server/chunks/[root-of-the-server]__d6ddf850._.js:7:3130)
    // at async W (/var/task/.next/server/chunks/_37b977cc._.js:5:3311)
    // "[\/\\]" to handle linux/windows
    const regex =
      /(?<=^)(?<intro> *at(?: async)?)(?: .+)? \(?.+[\/\\](?<filename>.+\.(?:js|jsx|ts|tsx|mjs|cjs)):(?<line>\d+):(?<column>\d+)\)?$/m;

    const fields = regex.exec(stackLine);
    if (!fields) {
      updatedLines.push(stackLine);
      continue;
    }

    // Search all likely locations
    const mapPath = findMapPath(folderPath, fields.groups.filename);

    if (!mapPath) {
      updatedLines.push(`${stackLine} *minified file not found*`);
      continue;
    }

    fileFound = true; // where at least one row had the file found

    try {
      const mapContent = fs.readFileSync(mapPath, 'utf8');
      const consumer = await new SourceMapConsumer(mapContent);

      const originalPosition = consumer.originalPositionFor({
        line: parseInt(fields.groups.line, 10),
        column: parseInt(fields.groups.column, 10),
      });
      consumer.destroy(); // clean up

      const functionName = originalPosition.name || 'anonymous';
      const prefixRegex = /^(?:webpack:|webpack-internal:|turbopack:|@fs)\/\//;
      const filename = originalPosition.source.replace(prefixRegex, '');
      const lineColumn = `${originalPosition.line}:${originalPosition.column}`;

      const updatedLine = `${fields.groups.intro} ${functionName} ${filename}:${lineColumn}`;
      updatedLines.push(updatedLine);
      continue;
    } catch (e) {
      errors.push(`${stackLine}: ${e.message}`);
      updatedLines.push(`${stackLine} *error*`);
      continue;
    }
  }

  let error;
  let result;
  if (updatedLines.length) result = updatedLines.join('\n');
  if (errors.length) error = errors.join('\n');

  // console.log(result)
  // if (error) console.log('errors', error)

  return { result, error, fileFound };
}

module.exports = { maxifyStack };
