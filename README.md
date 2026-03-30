# Maxify Stack Utilities
`@timber-logging/maxify-stack-utils` is a Node.js utility to convert a minified stack trace into a human-readable format using source maps.

This utility is part of the [Maxify Stack Project](http://www.timberlogging.co/maxify-stack). If you copy the project locally, it provides a basic UI so you can add the folder path to your source maps and paste in your minified stack trace. You should use the project instead of using this package directly, unless you are wanting to do something custom.

It was created by [Timber Logging](https://www.timberlogging.co) but you don't need to be a customer to use this. It is a free utility to convert minified stack traces.

## Installation
Install the package via npm:

```bash
npm install @timber-logging/maxify-stack-utils
```

If you are not using this as part of the Maxify Stack project and are including it in your own project, then you will probably want to add the `--save-dev` flag when installing.

## Usage

This utility is used in the [Maxify Stack Project](http://www.timberlogging.co/maxify-stack) which is intended to be downloaded and run locally. The [Maxify Stack Project](http://www.timberlogging.co/maxify-stack) includes a very basic UI. This utility was split out so it can be used separately and it can be updated without re-downloading the whole project again.

  ```js
  import { maxifyStack } from '@timber-logging/maxify-stack-utils';

  async function convertMinifiedStackTrace() {
    const folderPath = 'path/to/your/build/folder/with/maps';
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
- `folderPath`: (string|string[]) The folder path to the build folder with source maps, or an array of possible folder paths. If you provide an array, it will loop through them until one matches the stack trace. To generate source maps, see the [Source Maps section](#source-maps).
- `stackTrace`: (string) The minified stack trace which you want to convert.
**Returns:** Promise<{result?: string, error?: string, fileFound?: boolean}>
- `result`: The converted stack trace (if successful)
- `error`: Any errors encountered during processing
- `fileFound`: If at least one file was found for one of the lines in the stack. If it is false then it is likely that the minified stack doesn't match the source maps.

## Requirements
- Node.js >= 20.x (might work with other versions, but it is not checked)
- Source maps must be enabled in your build configuration (see [Source Maps Section](#source-maps))

## Source Maps
For this utility to work, you need to generate source maps for your project. This is not done by default for security reasons. For this reason, when you build the source maps, you should ensure you don't push this to production by building in a different folder, or removing the map files once they are built etc.

The source maps must be created from the exact version of the files as what generated the minified stack trace. For example, if you get a minified stack trace from logs in production, but your local files have been modified, when you generate the source maps they will not match to your production minified files.

In this case, you will need to get the production version of your files and generate the source maps from these files.

Below are the instructions for a NextJs project which is built and hosted by Vercel. If you build the project separately and push the build to Vercel, then you could build with source maps, strip them out, then send everything but the source maps onto vercel.

### NextJs built/hosted by Vercel
By default, source maps are not created in production. If you run `vercel build --prod` it will create a build which is as close as possible to the production build, but you need the vercel CLI installed. Otherwise you can run `next build`, but there can be differences which will mean the minified stack can't be decoded. 

#### NextJs (if you do have vercel CLI)

- Ensure the vercel CLI package is up to date
- Ensure you have linked the project
- Ensure you use the same version of NodeJs as what you are using in vercel (eg 22.x 24.x)

**next.config.js**
Update your next.config.js file.

```js
// next.config.js

// used by build-source-maps
const shouldGenerateSourceMaps = process.env.BUILD_SOURCE_MAPS === 'true';
const config = {
  // this is here so when the build runs locally, we build source maps so we can
  // decode the minified stack output from production. By default, production
  // builds don't include source maps and deployed versions should not include them 
  productionBrowserSourceMaps: shouldGenerateSourceMaps
};
export default config;
```

**package.json**
Add the following scripts to your `package.json`:

``` json
{
  "scripts": {
    "build-source-maps": "vercel pull --environment=production && BUILD_SOURCE_MAPS=true vercel build --prod",
  },
}
```

- Command `vercel pull --environment=production` will pull the production env variables and config into your .vercel folder. It will not update/modify your local env files.
- Command `BUILD_SOURCE_MAPS=true vercel build --prod` will create a build and put it in the `.vercel/output` folder
- Both commands can be run using `npm run build-source-maps` if setup as per above in the `package.json`
- Ensure `.vercel` is in your `.gitignore`
- You will need to get the full folder path to the `.vercel/output` folder and use that when you call [maxifyStack(folderPath, stackTrace)](#api)


#### NextJs (if you don't have vercel CLI)

**next.config.js**
Update your next.config.js file. This conditionally creates a `.source-maps` build folder if one of the above scripts is called. This prevents the source maps from being added in production (which you probably don't want to do).

```js
// next.config.js

// used by build-source-maps
const shouldGenerateSourceMaps = process.env.BUILD_SOURCE_MAPS === 'true';
const buildOutputDirectory = shouldGenerateSourceMaps ? '.source-maps' : '.next';

const config = {
  // this is here so when the build runs locally, we build source maps so we can
  // decode the minified stack output from production. By default, production
  // builds don't include source maps and deployed versions should not include them 
  productionBrowserSourceMaps: shouldGenerateSourceMaps,

  // if we run build-source-maps, then we use this output so running npm run dev
  // doesn't wipe the maps. Then each deploy, we run the build-source-maps, then
  // we have prod maps to use in the maxify-stack project to debug
  distDir: buildOutputDirectory,
};
export default config;
```

**package.json**
Add the following scripts to your `package.json`:

``` json
{
  "scripts": {
    "build-source-maps": "BUILD_SOURCE_MAPS=true next build",
  },
}
```

**.gitignore**
Update your .gitignore file with the following so you don't commit the source maps.
`.source-maps/`

**Build Source Maps**
Now you can run `npm run build-source-maps` and the source maps will be built.

You will need to get the full folder path to the `.source-maps` or `.next` folder and use that when you call [maxifyStack(folderPath, stackTrace)](#api)

## Troubleshooting
If you see `minified file not found` at the end of every line then it is likely the source map files don't match the minified stack trace. If the stack trace is from production, create the source maps using the deployed version. See [Source Maps](#source-maps) for more information.

## License
This project is licensed under the MIT License.
