# Server Node Modules File Structure

This document shows the file structure of `server/node_modules` directory.

**Total Files:** ~7,159 files (as counted)

## Top-Level Structure

```
server/node_modules/
├── .package-lock.json
├── .bin/                          # Executable binaries
│   ├── acorn, acorn.cmd, acorn.ps1
│   ├── esbuild, esbuild.cmd, esbuild.ps1
│   ├── eslint, eslint.cmd, eslint.ps1
│   ├── js-yaml, js-yaml.cmd, js-yaml.ps1
│   ├── mime, mime.cmd, mime.ps1
│   ├── node-which, node-which.cmd, node-which.ps1
│   ├── openai, openai.cmd, openai.ps1
│   ├── rimraf, rimraf.cmd, rimraf.ps1
│   ├── semver, semver.cmd, semver.ps1
│   ├── tsc, tsc.cmd, tsc.ps1
│   ├── tsserver, tsserver.cmd, tsserver.ps1
│   └── tsx, tsx.cmd, tsx.ps1
│
├── @esbuild/                      # ESBuild packages
│   └── win32-x64/
│       ├── esbuild.exe
│       ├── package.json
│       └── README.md
│
├── @eslint/                       # ESLint packages
│   ├── eslintrc/
│   │   ├── LICENSE
│   │   ├── package.json
│   │   ├── README.md
│   │   ├── universal.js
│   │   ├── conf/
│   │   ├── dist/
│   │   ├── lib/
│   │   └── node_modules/
│   └── js/
│       ├── LICENSE
│       ├── package.json
│       ├── README.md
│       └── src/
│
├── @eslint-community/             # ESLint community packages
│   ├── eslint-utils/
│   └── regexpp/
│
├── @humanwhocodes/                # HumanWhoCodes packages
│   ├── config-array/
│   ├── module-importer/
│   └── object-schema/
│
├── @mongodb-js/                   # MongoDB JS packages
│   └── saslprep/
│
├── @nodelib/                      # Node.js library packages
│   ├── fs.scandir/
│   ├── fs.stat/
│   └── fs.walk/
│
├── @socket.io/                    # Socket.IO packages
│   └── component-emitter/
│
├── @types/                        # TypeScript type definitions
│   ├── bcryptjs/
│   ├── body-parser/
│   ├── compression/
│   ├── connect/
│   ├── cors/
│   ├── express/
│   ├── express-serve-static-core/
│   ├── http-errors/
│   ├── json-schema/
│   ├── jsonwebtoken/
│   ├── mime/
│   ├── ms/
│   ├── node/                      # Extensive Node.js type definitions
│   │   ├── assert.d.ts, async_hooks.d.ts, buffer.d.ts, etc.
│   │   ├── assert/, compatibility/, dns/, fs/, etc.
│   │   └── ts5.6/, web-globals/
│   ├── node-fetch/
│   ├── qs/
│   ├── range-parser/
│   ├── semver/
│   ├── send/
│   ├── serve-static/
│   ├── webidl-conversions/
│   └── whatwg-url/
│
├── @typescript-eslint/            # TypeScript ESLint plugin
│   └── eslint-plugin/
│       ├── index.d.ts
│       ├── package.json
│       ├── README.md
│       ├── rules.d.ts
│       └── dist/
│           ├── index.js
│           ├── configs/            # ESLint configs
│           ├── rules/            # 200+ ESLint rules
│           └── util/
│
├── @ungap/                        # UNGAP packages
│
├── express/                       # Express.js web framework
│   ├── History.md
│   ├── index.js
│   ├── LICENSE
│   ├── package.json
│   ├── Readme.md
│   ├── lib/
│   │   ├── application.js
│   │   ├── express.js
│   │   ├── request.js
│   │   ├── response.js
│   │   ├── utils.js
│   │   ├── view.js
│   │   ├── middleware/
│   │   │   ├── init.js
│   │   │   └── query.js
│   │   └── router/
│   │       ├── index.js
│   │       ├── layer.js
│   │       └── route.js
│   └── node_modules/              # Express dependencies
│
├── mongoose/                      # MongoDB ODM
│   ├── browser.js
│   ├── index.js
│   ├── LICENSE.md
│   ├── package.json
│   ├── README.md
│   ├── SECURITY.md
│   ├── dist/
│   ├── lib/
│   │   ├── aggregate.js
│   │   ├── browser.js
│   │   ├── browserDocument.js
│   │   ├── cast/                 # Type casting
│   │   ├── cast.js
│   │   ├── collection.js
│   │   ├── connection.js
│   │   ├── connectionState.js
│   │   ├── constants.js
│   │   ├── cursor/               # Database cursors
│   │   ├── document.js
│   │   ├── documentProvider.js
│   │   ├── driver.js
│   │   ├── drivers/              # Database drivers
│   │   ├── error/                # Error handling
│   │   ├── helpers/              # Helper functions
│   │   ├── index.js
│   │   ├── internal.js
│   │   ├── model.js
│   │   ├── modifiedPathsSnapshot.js
│   │   ├── mongoose.js
│   │   ├── options/              # Schema options
│   │   ├── options.js
│   │   ├── plugins/             # Mongoose plugins
│   │   ├── query.js
│   │   ├── queryHelpers.js
│   │   ├── schema/              # Schema definitions
│   │   ├── schema.js
│   │   ├── schemaType.js
│   │   ├── stateMachine.js
│   │   ├── types/               # Type definitions
│   │   ├── utils.js
│   │   ├── validOptions.js
│   │   └── virtualType.js
│   └── types/                    # TypeScript definitions
│
├── socket.io/                     # Socket.IO real-time communication
│   ├── LICENSE
│   ├── package.json
│   ├── Readme.md
│   ├── wrapper.mjs
│   ├── client-dist/              # Client-side distributions
│   │   ├── socket.io.js
│   │   ├── socket.io.min.js
│   │   ├── socket.io.esm.min.js
│   │   ├── socket.io.msgpack.min.js
│   │   └── *.map files
│   ├── dist/                     # Server-side code
│   │   ├── index.d.ts, index.js
│   │   ├── client.d.ts, client.js
│   │   ├── namespace.d.ts, namespace.js
│   │   ├── socket.d.ts, socket.js
│   │   ├── broadcast-operator.d.ts
│   │   ├── parent-namespace.d.ts
│   │   ├── socket-types.d.ts
│   │   ├── typed-events.d.ts
│   │   └── uws.d.ts
│   └── node_modules/
│
├── mongodb/                       # MongoDB driver
├── bcryptjs/                      # Password hashing
├── jsonwebtoken/                  # JWT authentication
├── cors/                          # CORS middleware
├── helmet/                        # Security middleware
├── dotenv/                        # Environment variables
├── openai/                        # OpenAI API client
├── typescript/                    # TypeScript compiler
├── tsx/                           # TypeScript execution
├── eslint/                        # ESLint linter
│
└── [200+ other packages]/        # Additional dependencies

## Key Package Categories

### Core Runtime Dependencies
- **express** - Web framework
- **mongoose** - MongoDB ODM
- **mongodb** - MongoDB driver
- **socket.io** - WebSocket communication
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT tokens
- **cors** - Cross-Origin Resource Sharing
- **helmet** - Security headers
- **dotenv** - Environment configuration
- **openai** - OpenAI API integration

### Development Dependencies
- **typescript** - TypeScript compiler
- **tsx** - TypeScript execution runtime
- **eslint** - Code linting
- **@typescript-eslint/eslint-plugin** - TypeScript-specific ESLint rules
- **@eslint/eslintrc** - ESLint configuration

### Type Definitions (@types)
- Node.js built-in types
- Express and Express-related packages
- MongoDB and Mongoose types
- Socket.IO types
- Various utility package types

### Binary Executables (.bin)
Command-line tools accessible via npm scripts:
- **tsc** - TypeScript compiler
- **tsx** - TypeScript runner
- **eslint** - Code linter
- **esbuild** - Fast bundler
- **openai** - OpenAI CLI tool

## Notes

1. Each package typically contains:
   - `package.json` - Package metadata and dependencies
   - Source files (`.js`, `.ts`, etc.)
   - Type definitions (`.d.ts`) for TypeScript packages
   - Documentation (README.md, LICENSE)
   - Its own `node_modules/` folder for nested dependencies

2. The structure follows npm's dependency resolution where:
   - Direct dependencies are at the root of `node_modules/`
   - Nested dependencies are in sub-packages' `node_modules/` folders
   - Scoped packages (starting with `@`) are grouped in namespace folders

3. The full structure includes thousands of files across hundreds of packages due to the dependency tree of the main packages.

