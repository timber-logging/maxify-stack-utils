# Timber Logging

`@timber-logging/maxify-stack-utils` is a Node.js utility to convert a minified stack trace into a human readable format using source maps. It supports logging to both the console and [Timber Logging](https://www.timberlogging.co) for alerts and storage.

## Installation

Install the package via npm:

```bash
npm install @timber-logging/maxify-stack-utils
```

This utility is part of the [Maxify Stack Project](http://www.timberlogging.co/maxify-stack). If you are not using this as part of that project and are including it in your own project, then you will probably want to add the `--save-dev` flag when installing.

## Usage

This utility is used in the [Maxify Stack Project](http://www.timberlogging.co/maxify-stack) which is intended to be downloaded and run locally. The [Maxify Stack Project](http://www.timberlogging.co/maxify-stack) includes a very basic UI. This utility was split out so it can be used separately and it can be updated without re-downloading the whole project again.

  ```js
  import { maxifyStack } from '@timber-logging/maxify-stack-utils';

  async function convertMinifiedStackTrace() {
    const folderPath = `path/to/your/build/folder/with/maps`;
    const stackTrace = `TypeError: Cannot read properties of undefined (reading 'length')
    at g (/var/task/.next/server/chunks/_48b141cb._.js:2:522)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async m (/var/task/.next/server/chunks/_48b141cb._.js:2:318)
    at async m (/var/task/.next/server/chunks/[root-of-the-server]__b4596231._.js:12:843)
    at async w (/var/task/.next/server/chunks/_48b141cb._.js:1:3708)
    at async /var/task/.next/server/chunks/_48b141cb._.js:1:3542`;
    
    const { error, result } = await maxifyStack(folderPath, stackTrace);
    if (error) {
      console.error(error);
    }
    if (result) {
      console.log(result);
    }

    return { error, result };
  }
  ```

## API

### `await maxifyStack(folderPath, stackTrace)`
- `folderPath`: (string) The folder path to the build folder with source maps. To generate source maps, see the [Source Maps section](#source-maps).
- `stackTrace`: (string) The minified stack trace which you want to convert.
**Returns:** Promise<{result?: string, error?: string}>
- `result`: The converted stack trace (if successful)
- `error`: Any errors encountered during processing

## Requirements
- Node.js >= 20.x (might work with other versions, but it is not checked)
- Source maps must be enabled in your build configuration (see [Source Maps Section](#source-maps))

## Source Maps
For this utility to work, you need to generate source maps for your project. This is not done by default.

The source maps must be created from the exact version of the files as what generated the minified stack trace. For example, if you get a minified stack trace from logs in production, but your local files have been modified, when you generate the source maps they will not match to your production minified files.

In this case, you will need to get the production version of your files and generate the source maps from these files.

We recommend generating the source maps in a different folder to your build folder so you don't deploy them to production. Also ensure you set the source map folder in your .gitignore file.

### NextJs

**package.json**
Add the following scripts to your `package.json`:

``` json
{
  "scripts": {
    "build-source-maps": "BUILD_SOURCE_MAPS=true next build",
    "start-source-maps": "BUILD_SOURCE_MAPS=true next start",
  },
}
```

**next.config.js**
Update your next.config.js file. This conditionally creates a `.source-maps` build folder if one of the above scripts is called. This prevents the source maps from being added in production (which you probably don't want to do).

```js
// next.config.js

// used by build-source-maps and start-source-maps
const shouldGenerateSourceMaps = process.env.BUILD_SOURCE_MAPS === 'true';
const buildOutputDirectory = shouldGenerateSourceMaps ? '.source-maps' : '.next';

const config = {
  // this is here so when the build runs locally, we build source maps so we can
  // decode the minified stack output from production
  productionBrowserSourceMaps: shouldGenerateSourceMaps,

  // if we run build-source-maps, then we use this output so running npm run dev
  // doesn't wipe the maps. Then each deploy, we run the build-source-maps, then
  // we have prod maps to use in the stack-mapper project to debug
  distDir: buildOutputDirectory,
};
export default config;
```

**.gitignore**
Update your .gitignore file with the following so you don't commit the source maps.
`.source-maps/`

**Build Source Maps**
Now you can run `npm run build-source-maps` or `npm run start-source-maps` and the source maps will be added to the .source-maps folder.

You will need to get the full folder path to the .source-maps folder and use that when you call [maxifyStack(folderPath, stackTrace)](#api)

## Troubleshooting
If you see `minified file not found` at the end of every line then it is likely the source map files don't match the minified stack trace. If the stack trace is from production, create the source maps using the deployed version. See [Source Maps](#source-maps) for more information.

## License
This project is licensed under the MIT License.
