const fs = require('fs');
const path = require('path');
const { SourceMapConsumer } = require('source-map');

/**
 * Searches for the map file in both server and client chunk directories.
 * @param {string} nextBuildPath - Path to the local Next.js build directory (.next).
 * @param {string} baseFileName - The clean file name (e.g., '7a388834aa9d5bf2.js').
 * @returns {string|null} The absolute path to the .map file if found, otherwise null.
 */
function findMapPath(nextBuildPath, baseFileName) {
  // Client-Side Chunk Location (static/chunks)
  const clientPath = path.join(nextBuildPath, 'static', 'chunks', baseFileName + '.map');
  if (fs.existsSync(clientPath)) {
    return clientPath;
  }
  
  // Server-Side Chunk Location (server/chunks)
  const serverPath = path.join(nextBuildPath, 'server', 'chunks', baseFileName + '.map');
  if (fs.existsSync(serverPath)) {
    return serverPath;
  }

  // Server Entry Point Location (server/pages or server/app)
  // Check the main server folder as well, as some files land there.
  const serverMainPath = path.join(nextBuildPath, 'server', baseFileName + '.map');
  if (fs.existsSync(serverMainPath)) {
    return serverMainPath;
  }

  return null; // Not found in any standard location
}

async function maxifyStack(nextBuildPath, stack) {
  const stackLines = stack.split('\n');

  const updatedLines = [];
  const errors = [];
  for (let stackLine of stackLines) {
    // at f (/var/task/.next/server/chunks/_ae9127c6._.js:1:8867)
    // at /var/task/.next/server/chunks/[root-of-the-server]__d6ddf850._.js:7:3411
    // at async I (/var/task/.next/server/chunks/[root-of-the-server]__d6ddf850._.js:7:3130)
    // at async W (/var/task/.next/server/chunks/_37b977cc._.js:5:3311)
    const regex = /(?<=^)(?<intro> *at(?: async)?)(?: .+)? \(?.+\/(?<filename>.+\.js):(?<line>\d+):(?<column>\d+)\)?$/m;

    const fields = regex.exec(stackLine);
    if (!fields) {
      updatedLines.push(stackLine);
      continue;
    }

    // Search all likely locations
    const mapPath = findMapPath(nextBuildPath, fields.groups.filename);

    if (!mapPath) {
      updatedLines.push(`${stackLine} ***minified file not found***`);
      continue;
    }

    try {
      const mapContent = fs.readFileSync(mapPath, 'utf8');
      const consumer = await new SourceMapConsumer(mapContent);

      const originalPosition = consumer.originalPositionFor({
        line: parseInt(fields.groups.line, 10),
        column: parseInt(fields.groups.column, 10)
      });

      const functionName = originalPosition.name || 'anonymous';
      const filename = originalPosition.source.replace(/^webpack:\/\//, '');
      const lineColumn = `${originalPosition.line}:${originalPosition.column}`;

      const updatedLine = `${fields.groups.intro} ${functionName} ${filename}:${lineColumn}`;
      updatedLines.push(updatedLine);
      continue;
    } catch (e) {
      errors.push(`${stackLine}: ${e.message}`);
      updatedLines.push(`${stackLine} ***error***`);
      continue;
    }
  }

  let error;
  let result;
  if (updatedLines.length) result = updatedLines.join('\n');
  if (errors.length) error = errors.join('\n');

  // console.log(result)
  // if (error) console.log('errors', error)

  return { result, error };
}

module.exports = { maxifyStack };
